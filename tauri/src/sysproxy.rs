//! System proxy control.
//!
//! Windows mirrors `src/main/lib/systemProxy.ts` (registry + WinINET refresh
//! via PowerShell, with a backup file so the user's previous settings can be
//! restored). macOS (`networksetup`) and Linux (`gsettings`) are best-effort
//! additions for the Rust edition.
//!
//! Every function here is synchronous — callers run them inside
//! `spawn_blocking`.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::l10n::{l, LString};
use crate::settings::set_owner_only;
use crate::util::now_ms;

#[derive(Clone, Debug)]
pub struct ProxySnapshot {
    pub applied: bool,
    pub server: Option<String>,
}

pub fn backup_path(base: &Path) -> PathBuf {
    base.join("proxy-backup.json")
}

fn write_backup<T: Serialize>(base: &Path, value: &T) {
    let _ = fs::create_dir_all(base);
    let path = backup_path(base);
    if let Ok(json) = serde_json::to_string_pretty(value) {
        if fs::write(&path, json).is_ok() {
            set_owner_only(&path);
        }
    }
}

fn read_backup<T: serde::de::DeserializeOwned>(base: &Path) -> Option<T> {
    let raw = fs::read_to_string(backup_path(base)).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn read(base: &Path) -> Result<ProxySnapshot, LString> {
    #[cfg(windows)]
    {
        return win_read(base);
    }
    #[cfg(target_os = "macos")]
    {
        return mac_read(base);
    }
    #[cfg(target_os = "linux")]
    {
        return linux_read(base);
    }
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        let _ = base;
        Err(l(
            "پروکسی سیستم در این پلتفرم پشتیبانی نمی‌شود",
            "System proxy is not supported on this platform",
        ))
    }
}

pub fn apply(base: &Path, host: &str, port: u16) -> Result<(), LString> {
    #[cfg(windows)]
    {
        return win_apply(base, host, port);
    }
    #[cfg(target_os = "macos")]
    {
        return mac_apply(base, host, port);
    }
    #[cfg(target_os = "linux")]
    {
        return linux_apply(base, host, port);
    }
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        let _ = (base, host, port);
        Err(l(
            "پروکسی سیستم در این پلتفرم پشتیبانی نمی‌شود",
            "System proxy is not supported on this platform",
        ))
    }
}

pub fn restore(base: &Path) -> Result<(), LString> {
    #[cfg(windows)]
    {
        return win_restore(base);
    }
    #[cfg(target_os = "macos")]
    {
        return mac_restore(base);
    }
    #[cfg(target_os = "linux")]
    {
        return linux_restore(base);
    }
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        let _ = base;
        Err(l(
            "پروکسی سیستم در این پلتفرم پشتیبانی نمی‌شود",
            "System proxy is not supported on this platform",
        ))
    }
}

/// Startup reconciliation (port of `reconcileSystemProxyOnLaunch`):
/// - our proxy still applied with the expected address → restore the user's old settings
/// - anything else → just drop a stale backup file
pub fn reconcile_on_startup(base: &Path, expected: &str) {
    if !backup_path(base).exists() {
        return;
    }
    match read(base) {
        Ok(snapshot) => {
            if snapshot.applied && snapshot.server.as_deref() == Some(expected) {
                let _ = restore(base);
            } else {
                let _ = fs::remove_file(backup_path(base));
            }
        }
        Err(_) => {}
    }
}

/* ------------------------------------------------------------------ Windows */

#[cfg(windows)]
const BYPASS: &str = "localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.2*.*;172.30.*;172.31.*;192.168.*;::1;<local>";

#[cfg(windows)]
#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
struct WinBackup {
    proxy_enable: Option<i32>,
    proxy_server: Option<String>,
    proxy_override: Option<String>,
    auto_config_url: Option<String>,
    captured_at: Option<i64>,
}

#[cfg(windows)]
#[derive(Deserialize)]
struct WinReadResult {
    #[serde(rename = "ProxyEnable", default)]
    proxy_enable: Option<i32>,
    #[serde(rename = "ProxyServer", default)]
    proxy_server: Option<String>,
}

#[cfg(windows)]
fn run_powershell(script: &str) -> Result<(i32, String), LString> {
    use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let encoded: Vec<u8> = script.encode_utf16().flat_map(|unit| unit.to_le_bytes()).collect();
    let encoded = B64.encode(&encoded);
    let out = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", &encoded])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| {
            l(
                &format!("اجرای PowerShell ناموفق: {}", e),
                &format!("Failed to run PowerShell: {}", e),
            )
        })?;
    Ok((out.status.code().unwrap_or(-1), String::from_utf8_lossy(&out.stdout).into_owned()))
}

#[cfg(windows)]
fn ps_quote(value: &str) -> String {
    value.replace('\'', "''")
}

#[cfg(windows)]
fn refresh_snippet() -> String {
    r#"
$signature = '[DllImport("wininet.dll", SetLastError=true)] public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);'
$helper = Add-Type -MemberDefinition $signature -Name 'NaxloWinInet' -Namespace 'Native' -PassThru
$helper::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0) | Out-Null
$helper::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0) | Out-Null
"#
    .to_string()
}

#[cfg(windows)]
const HKCU_PATH: &str = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";

#[cfg(windows)]
fn win_read(_base: &Path) -> Result<ProxySnapshot, LString> {
    let script = format!(
        r#"$props = Get-ItemProperty -Path '{}' -ErrorAction SilentlyContinue
[pscustomobject]@{{ ProxyEnable = $props.ProxyEnable; ProxyServer = $props.ProxyServer }} | ConvertTo-Json -Compress"#,
        HKCU_PATH
    );
    let (code, out) = run_powershell(&script)?;
    if code != 0 {
        return Err(l(
            "خواندن وضعیت پروکسی سیستم ناموفق بود",
            "Failed to read the system proxy state",
        ));
    }
    let line = out.lines().map(str::trim).filter(|s| !s.is_empty()).last();
    let Some(line) = line else {
        return Ok(ProxySnapshot { applied: false, server: None });
    };
    match serde_json::from_str::<WinReadResult>(line) {
        Ok(parsed) => Ok(ProxySnapshot {
            applied: parsed.proxy_enable.unwrap_or(0) == 1,
            server: parsed.proxy_server.filter(|s| !s.is_empty()),
        }),
        Err(_) => Ok(ProxySnapshot { applied: false, server: None }),
    }
}

#[cfg(windows)]
fn win_apply(base: &Path, host: &str, port: u16) -> Result<(), LString> {
    let server = format!("{}:{}", host, port);
    let script = format!(
        r#"$props = Get-ItemProperty -Path '{path}' -ErrorAction SilentlyContinue
[pscustomobject]@{{ proxyEnable = $props.ProxyEnable; proxyServer = $props.ProxyServer; proxyOverride = $props.ProxyOverride; autoConfigUrl = $props.AutoConfigURL; capturedAt = {now} }} | ConvertTo-Json -Compress
Set-ItemProperty -Path '{path}' -Name ProxyEnable -Value 1
Set-ItemProperty -Path '{path}' -Name ProxyServer -Value '{server}'
Set-ItemProperty -Path '{path}' -Name ProxyOverride -Value '{bypass}'
{refresh}"#,
        path = HKCU_PATH,
        now = now_ms(),
        server = ps_quote(&server),
        bypass = ps_quote(BYPASS),
        refresh = refresh_snippet()
    );
    let (code, out) = run_powershell(&script)?;
    if code != 0 {
        return Err(l(
            "تنظیم پروکسی سیستم ناموفق بود",
            "Failed to configure the system proxy",
        ));
    }
    // First non-empty stdout line is the backup envelope.
    if let Some(line) = out.lines().map(str::trim).filter(|s| !s.is_empty()).next() {
        if let Ok(backup) = serde_json::from_str::<WinBackup>(line) {
            write_backup(base, &backup);
        }
    }
    Ok(())
}

#[cfg(windows)]
fn win_restore(base: &Path) -> Result<(), LString> {
    let backup: Option<WinBackup> = read_backup(base);
    let script = match backup {
        Some(b) => {
            let mut lines = Vec::new();
            lines.push(format!(
                "Set-ItemProperty -Path '{}' -Name ProxyEnable -Value {}",
                HKCU_PATH,
                b.proxy_enable.unwrap_or(0)
            ));
            for (name, value) in [
                ("ProxyServer", b.proxy_server.as_deref()),
                ("ProxyOverride", b.proxy_override.as_deref()),
                ("AutoConfigURL", b.auto_config_url.as_deref()),
            ] {
                match value.filter(|v| !v.is_empty()) {
                    Some(v) => lines.push(format!(
                        "Set-ItemProperty -Path '{}' -Name {} -Value '{}'",
                        HKCU_PATH,
                        name,
                        ps_quote(v)
                    )),
                    None => lines.push(format!(
                        "Remove-ItemProperty -Path '{}' -Name {} -ErrorAction SilentlyContinue",
                        HKCU_PATH, name
                    )),
                }
            }
            lines.push(refresh_snippet());
            lines.join("\n")
        }
        None => format!(
            "Set-ItemProperty -Path '{}' -Name ProxyEnable -Value 0\n{}",
            HKCU_PATH,
            refresh_snippet()
        ),
    };
    let (code, _) = run_powershell(&script)?;
    if code != 0 {
        return Err(l(
            "بازگردانی پروکسی سیستم ناموفق بود",
            "Failed to restore the system proxy",
        ));
    }
    let _ = fs::remove_file(backup_path(base));
    Ok(())
}

/* -------------------------------------------------------------------- macOS */

#[cfg(target_os = "macos")]
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct MacServiceBackup {
    service: String,
    http_enabled: bool,
    http_server: String,
    http_port: u16,
    https_enabled: bool,
    https_server: String,
    https_port: u16,
}

#[cfg(target_os = "macos")]
fn networksetup(args: &[&str]) -> Result<String, LString> {
    let out = std::process::Command::new("networksetup")
        .args(args)
        .output()
        .map_err(|e| {
            l(
                &format!("اجرای networksetup ناموفق: {}", e),
                &format!("Failed to run networksetup: {}", e),
            )
        })?;
    if !out.status.success() {
        return Err(l(
            "تنظیم پروکسی سیستم ناموفق بود",
            "Failed to configure the system proxy",
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

#[cfg(target_os = "macos")]
fn mac_services() -> Vec<String> {
    let text = networksetup(&["-listallnetworkservices"]).unwrap_or_default();
    text.lines()
        .skip(1) // first line is the asterisk legend
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty() && !line.starts_with('*'))
        .collect()
}

#[cfg(target_os = "macos")]
fn mac_proxy_state(service: &str, flag: &str) -> (bool, String, u16) {
    let text = networksetup(&[flag, service]).unwrap_or_default();
    let mut enabled = false;
    let mut server = String::new();
    let mut port = 0u16;
    for line in text.lines() {
        let Some((key, value)) = line.split_once(':') else { continue };
        let value = value.trim();
        match key.trim().to_ascii_lowercase().as_str() {
            "enabled" => enabled = value.eq_ignore_ascii_case("yes"),
            "server" => server = value.to_string(),
            "port" => port = value.parse().unwrap_or(0),
            _ => {}
        }
    }
    (enabled, server, port)
}

#[cfg(target_os = "macos")]
fn mac_read(_base: &Path) -> Result<ProxySnapshot, LString> {
    for service in mac_services() {
        let (enabled, server, port) = mac_proxy_state(&service, "-getwebproxy");
        if enabled && !server.is_empty() {
            return Ok(ProxySnapshot { applied: true, server: Some(format!("{}:{}", server, port)) });
        }
    }
    Ok(ProxySnapshot { applied: false, server: None })
}

#[cfg(target_os = "macos")]
fn mac_apply(base: &Path, host: &str, port: u16) -> Result<(), LString> {
    let services = mac_services();
    let mut backups = Vec::new();
    for service in &services {
        let (he, hs, hp) = mac_proxy_state(service, "-getwebproxy");
        let (se, ss, sp) = mac_proxy_state(service, "-getsecurewebproxy");
        backups.push(MacServiceBackup {
            service: service.clone(),
            http_enabled: he,
            http_server: hs,
            http_port: hp,
            https_enabled: se,
            https_server: ss,
            https_port: sp,
        });
    }
    write_backup(base, &backups);
    let port_str = port.to_string();
    for service in &services {
        let svc = service.as_str();
        networksetup(&["-setwebproxy", svc, host, port_str.as_str()])?;
        networksetup(&["-setsecurewebproxy", svc, host, port_str.as_str()])?;
        networksetup(&[
            "-setproxybypassdomains",
            svc,
            "localhost",
            "127.0.0.1",
            "10.*",
            "172.16.*",
            "192.168.*",
            "::1",
            "*.local",
        ])?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn mac_restore(base: &Path) -> Result<(), LString> {
    let backups: Option<Vec<MacServiceBackup>> = read_backup(base);
    let _ = fs::remove_file(backup_path(base));
    let Some(backups) = backups else {
        for service in mac_services() {
            let _ = networksetup(&["-setwebproxystate", service.as_str(), "off"]);
            let _ = networksetup(&["-setsecurewebproxystate", service.as_str(), "off"]);
        }
        return Ok(());
    };
    for backup in backups {
        let svc = backup.service.as_str();
        if backup.http_enabled && !backup.http_server.is_empty() {
            let port = backup.http_port.to_string();
            let _ = networksetup(&["-setwebproxy", svc, backup.http_server.as_str(), port.as_str()]);
        } else {
            let _ = networksetup(&["-setwebproxystate", svc, "off"]);
        }
        if backup.https_enabled && !backup.https_server.is_empty() {
            let port = backup.https_port.to_string();
            let _ = networksetup(&["-setsecurewebproxy", svc, backup.https_server.as_str(), port.as_str()]);
        } else {
            let _ = networksetup(&["-setsecurewebproxystate", svc, "off"]);
        }
    }
    Ok(())
}

/* -------------------------------------------------------------------- Linux */

#[cfg(target_os = "linux")]
#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
struct LinuxBackup {
    mode: String,
    http_host: String,
    http_port: u32,
    https_host: String,
    https_port: u32,
    ignore_hosts: Vec<String>,
}

#[cfg(target_os = "linux")]
fn gsettings(args: &[&str]) -> Result<String, LString> {
    let out = std::process::Command::new("gsettings")
        .args(args)
        .output()
        .map_err(|e| {
            l(
                &format!("اجرای gsettings ناموفق: {}", e),
                &format!("Failed to run gsettings: {}", e),
            )
        })?;
    if !out.status.success() {
        return Err(l(
            "تنظیم پروکسی سیستم ناموفق بود",
            "Failed to configure the system proxy",
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

#[cfg(target_os = "linux")]
fn gget(schema: &str, key: &str) -> String {
    gsettings(&["get", schema, key]).unwrap_or_default().trim_matches('\'').to_string()
}

#[cfg(target_os = "linux")]
fn gset(schema: &str, key: &str, value: &str) -> Result<(), LString> {
    gsettings(&["set", schema, key, value]).map(|_| ())
}

#[cfg(target_os = "linux")]
fn parse_string_list(raw: &str) -> Vec<String> {
    let inner = raw.trim().trim_start_matches('[').trim_end_matches(']');
    inner
        .split(',')
        .map(|part| part.trim().trim_matches('\'').to_string())
        .filter(|part| !part.is_empty())
        .collect()
}

#[cfg(target_os = "linux")]
fn q(value: &str) -> String {
    format!("'{}'", value.replace('\'', ""))
}

#[cfg(target_os = "linux")]
fn linux_read(_base: &Path) -> Result<ProxySnapshot, LString> {
    let mode = gget("org.gnome.system.proxy", "mode");
    if mode.is_empty() {
        return Err(l(
            "پروکسی سیستم در این پلتفرم پشتیبانی نمی‌شود",
            "System proxy is not supported on this platform",
        ));
    }
    if mode != "manual" {
        return Ok(ProxySnapshot { applied: false, server: None });
    }
    let host = gget("org.gnome.system.proxy.http", "host");
    let port = gget("org.gnome.system.proxy.http", "port");
    Ok(ProxySnapshot {
        applied: !host.is_empty(),
        server: if host.is_empty() { None } else { Some(format!("{}:{}", host, port)) },
    })
}

#[cfg(target_os = "linux")]
fn linux_apply(base: &Path, host: &str, port: u16) -> Result<(), LString> {
    let backup = LinuxBackup {
        mode: gget("org.gnome.system.proxy", "mode"),
        http_host: gget("org.gnome.system.proxy.http", "host"),
        http_port: gget("org.gnome.system.proxy.http", "port").parse().unwrap_or(0),
        https_host: gget("org.gnome.system.proxy.https", "host"),
        https_port: gget("org.gnome.system.proxy.https", "port").parse().unwrap_or(0),
        ignore_hosts: parse_string_list(&gsettings(&["get", "org.gnome.system.proxy", "ignore-hosts"]).unwrap_or_default()),
    };
    if backup.mode.is_empty() {
        return Err(l(
            "پروکسی سیستم در این پلتفرم پشتیبانی نمی‌شود",
            "System proxy is not supported on this platform",
        ));
    }
    write_backup(base, &backup);
    let port_str = port.to_string();
    gset("org.gnome.system.proxy", "mode", "'manual'")?;
    gset("org.gnome.system.proxy.http", "host", &q(host))?;
    gset("org.gnome.system.proxy.http", "port", &port_str)?;
    gset("org.gnome.system.proxy.https", "host", &q(host))?;
    gset("org.gnome.system.proxy.https", "port", &port_str)?;
    gset(
        "org.gnome.system.proxy",
        "ignore-hosts",
        "['localhost', '127.0.0.1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '::1']",
    )?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn linux_restore(base: &Path) -> Result<(), LString> {
    let backup: Option<LinuxBackup> = read_backup(base);
    let _ = fs::remove_file(backup_path(base));
    let Some(backup) = backup else {
        let _ = gset("org.gnome.system.proxy", "mode", "'none'");
        return Ok(());
    };
    let mode = if backup.mode.is_empty() { "none".to_string() } else { backup.mode.clone() };
    gset("org.gnome.system.proxy", "mode", &q(&mode))?;
    if mode == "manual" {
        gset("org.gnome.system.proxy.http", "host", &q(&backup.http_host))?;
        gset("org.gnome.system.proxy.http", "port", &backup.http_port.to_string())?;
        gset("org.gnome.system.proxy.https", "host", &q(&backup.https_host))?;
        gset("org.gnome.system.proxy.https", "port", &backup.https_port.to_string())?;
        if !backup.ignore_hosts.is_empty() {
            let list = backup
                .ignore_hosts
                .iter()
                .map(|h| format!("'{}'", h.replace('\'', "")))
                .collect::<Vec<_>>()
                .join(", ");
            let _ = gset("org.gnome.system.proxy", "ignore-hosts", &format!("[{}]", list));
        }
    }
    Ok(())
}
