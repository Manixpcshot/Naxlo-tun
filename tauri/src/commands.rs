//! Tauri command surface — mirrors `src/main/ipc.ts`.
//!
//! Errors are `Err(String)` where the string is a JSON-serialized
//! `{ fa, en }` LString; the UI shim parses it back and throws the object so
//! renderer code sees exactly what the Electron preload bridge throws.

use std::collections::HashMap;

use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::l10n::{l, LString};
use crate::manager;
use crate::models::{
    to_server_view, AppInfo, AppUpdateInfo, CoreStatus, CoreUpdateInfo, FetchReport, LogEntry,
    ServerConfig, ServerView, SpeedResult, StoredSubscription,
};
use crate::settings::Settings;
use crate::state::AppCore;
use crate::subscription;
use crate::vault::VaultPayload;

fn err(message: LString) -> String {
    message.to_json()
}

fn core_of(app: &AppHandle) -> Result<tauri::State<'_, AppCore>, String> {
    app.try_state::<AppCore>()
        .ok_or_else(|| err(l("برنامه هنوز آماده نیست", "The app is not ready yet")))
}

fn main_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| err(l("پنجرهٔ برنامه پیدا نشد", "App window not found")))
}

/* ------------------------------------------------------------------- state */

#[tauri::command]
pub async fn get_state(app: AppHandle) -> Result<crate::models::AppState, String> {
    Ok(core_of(&app)?.snapshot_state())
}

#[tauri::command]
pub async fn app_info(app: AppHandle) -> Result<AppInfo, String> {
    let core = core_of(&app)?;
    let version = app.package_info().version.to_string();
    Ok(AppInfo {
        version,
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        electron: "—".into(),
        node: "—".into(),
        chrome: "—".into(),
        protection: "aes-256-gcm".into(),
        user_data: core.base_dir.to_string_lossy().into_owned(),
        logs_dir: core.base_dir.join("logs").to_string_lossy().into_owned(),
    })
}

#[tauri::command]
pub async fn app_check_update(app: AppHandle) -> Result<AppUpdateInfo, String> {
    let version = app.package_info().version.to_string();
    // The Rust edition has no self-updater yet; packages come from GitHub Releases.
    Ok(AppUpdateInfo { current: version, latest: None, update_available: false, release_url: None })
}

#[tauri::command]
pub async fn app_install_update() -> Result<bool, String> {
    Ok(false)
}

#[tauri::command]
pub async fn app_is_admin() -> Result<bool, String> {
    Ok(false)
}

#[tauri::command]
pub async fn app_relaunch_elevated() -> Result<bool, String> {
    Ok(false)
}

#[tauri::command]
pub async fn app_exit(app: AppHandle) -> Result<bool, String> {
    app.exit(0);
    Ok(true)
}

/* ----------------------------------------------------------------- servers */

#[tauri::command]
pub async fn servers_list(app: AppHandle) -> Result<Vec<ServerView>, String> {
    Ok(core_of(&app)?.server_views(false))
}

#[tauri::command]
pub async fn servers_reveal(app: AppHandle, id: String) -> Result<ServerView, String> {
    let core = core_of(&app)?;
    let view = {
        let g = core.lock();
        let pinned = g.vault.pinned.contains(&id);
        g.vault.servers.iter().find(|s| s.id == id).map(|s| to_server_view(s, true, pinned))
    };
    match view {
        Some(view) => {
            core.log("info", "servers", "user revealed sensitive fields for one server");
            Ok(view)
        }
        None => Err(err(l("سرور پیدا نشد", "Server not found"))),
    }
}

#[tauri::command]
pub async fn servers_select(app: AppHandle, id: String) -> Result<String, String> {
    let core = core_of(&app)?;
    let found = {
        let mut g = core.lock();
        let found = g.vault.servers.iter().any(|s| s.id == id);
        if found {
            g.vault.selected_server_id = Some(id.clone());
            g.state.selected_server_id = Some(id.clone());
        }
        found
    };
    if !found {
        return Err(err(l("سرور پیدا نشد", "Server not found")));
    }
    core.save_vault();
    core.emit_state();
    Ok(id)
}

#[tauri::command]
pub async fn servers_remove(app: AppHandle, id: String) -> Result<usize, String> {
    let core = core_of(&app)?;
    let remaining = {
        let mut g = core.lock();
        g.vault.servers.retain(|s| s.id != id);
        if g.vault.selected_server_id.as_deref() == Some(id.as_str()) {
            g.vault.selected_server_id =
                g.vault.servers.iter().find(|s| s.supported).map(|s| s.id.clone());
            g.state.selected_server_id = g.vault.selected_server_id.clone();
        }
        g.vault.servers.len()
    };
    core.save_vault();
    core.sync_subscriptions();
    core.bump_servers();
    Ok(remaining)
}

#[tauri::command]
pub async fn servers_clear(app: AppHandle) -> Result<bool, String> {
    let core = core_of(&app)?;
    {
        let mut g = core.lock();
        g.vault.servers.clear();
        g.vault.selected_server_id = None;
        g.state.selected_server_id = None;
    }
    core.save_vault();
    core.sync_subscriptions();
    core.bump_servers();
    Ok(true)
}

#[tauri::command]
pub async fn servers_pin(app: AppHandle, id: String) -> Result<Vec<String>, String> {
    let core = core_of(&app)?;
    let pinned = {
        let mut g = core.lock();
        if g.vault.pinned.contains(&id) {
            g.vault.pinned.retain(|entry| entry != &id);
        } else {
            g.vault.pinned.push(id.clone());
        }
        g.vault.pinned.clone()
    };
    core.save_vault();
    core.log(
        "info",
        "servers",
        &format!("server pin toggled ({})", if pinned.contains(&id) { "pinned" } else { "unpinned" }),
    );
    core.bump_servers();
    Ok(pinned)
}

#[tauri::command]
pub async fn servers_test(app: AppHandle, id: String) -> Result<Option<u64>, String> {
    Ok(manager::test_server(&app, &id).await)
}

#[tauri::command]
pub async fn servers_test_all(app: AppHandle) -> Result<u64, String> {
    Ok(manager::test_all(&app).await)
}

#[tauri::command]
pub async fn servers_latency(app: AppHandle) -> Result<HashMap<String, Option<u64>>, String> {
    let core = core_of(&app)?;
    let map = {
        let g = core.lock();
        g.vault.servers.iter().map(|s| (s.id.clone(), s.latency_ms)).collect()
    };
    Ok(map)
}

#[tauri::command]
pub async fn clipboard_write_link(app: AppHandle, server_id: String) -> Result<bool, String> {
    let core = core_of(&app)?;
    let raw = {
        let g = core.lock();
        g.vault.servers.iter().find(|s| s.id == server_id).and_then(|s| s.raw.clone())
    };
    let Some(raw) = raw else {
        return Err(err(l(
            "لینک این کانفیگ در دسترس نیست",
            "The link for this config is unavailable",
        )));
    };
    app.clipboard()
        .write_text(raw)
        .map_err(|e| err(l(&format!("کپی در کلیپ‌بورد ناموفق: {}", e), &format!("Clipboard write failed: {}", e))))?;
    core.log("info", "clipboard", "a config link was copied to the clipboard (contents not logged)");
    Ok(true)
}

#[tauri::command]
pub async fn panic_disconnect(app: AppHandle) -> Result<bool, String> {
    Ok(manager::do_panic(&app).await)
}

/* ------------------------------------------------------------ subscription */

#[tauri::command]
pub async fn subscription_save(app: AppHandle, url: String) -> Result<FetchReport, String> {
    let core = core_of(&app)?;
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err(err(l("لینک اشتراک خالی است", "Subscription URL is empty")));
    }
    let parsed = ::url::Url::parse(trimmed).map_err(|_| {
        err(l(
            "لینک اشتراک معتبر نیست (باید با http:// یا https:// شروع شود)",
            "Invalid subscription URL (must start with http:// or https://)",
        ))
    })?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(err(l(
            "فقط لینک‌های http و https پشتیبانی می‌شوند",
            "Only http and https links are supported",
        )));
    }
    let id = subscription::subscription_id_for(trimmed);
    {
        let mut g = core.lock();
        if !g.vault.subscriptions.iter().any(|entry| entry.id == id) {
            g.vault.subscriptions.push(StoredSubscription {
                id: id.clone(),
                url: trimmed.to_string(),
                name: None,
                userinfo: None,
                updated_at: None,
                last_error: None,
                file_path: None,
                password: None,
            });
        }
    }
    core.save_vault();
    core.sync_subscriptions();
    subscription::refresh_one(&app, &id).await.map_err(err)
}

#[tauri::command]
pub async fn subscription_refresh(
    app: AppHandle,
    id: Option<String>,
) -> Result<Vec<FetchReport>, String> {
    let core = core_of(&app)?;
    let targets: Vec<String> = {
        let g = core.lock();
        match &id {
            Some(id) => g.vault.subscriptions.iter().filter(|s| &s.id == id).map(|s| s.id.clone()).collect(),
            None => g.vault.subscriptions.iter().map(|s| s.id.clone()).collect(),
        }
    };
    if targets.is_empty() {
        return Err(err(l("ابتدا یک اشتراک اضافه کنید", "Add a subscription first")));
    }
    let mut reports: Vec<FetchReport> = Vec::new();
    let mut first_error: Option<LString> = None;
    for target in targets {
        match subscription::refresh_one(&app, &target).await {
            Ok(report) => reports.push(report),
            Err(message) => {
                if first_error.is_none() {
                    first_error = Some(message);
                }
            }
        }
    }
    if let Some(message) = first_error {
        if id.is_some() || reports.is_empty() {
            return Err(err(message));
        }
    }
    Ok(reports)
}

#[tauri::command]
pub async fn subscription_remove(app: AppHandle, id: String) -> Result<bool, String> {
    let core = core_of(&app)?;
    let owned_active = {
        let g = core.lock();
        let active = g.state.active_server_id.clone();
        g.runner.is_some()
            && active
                .as_ref()
                .map(|active_id| {
                    g.vault
                        .servers
                        .iter()
                        .any(|s| &s.id == active_id && s.subscription_id.as_deref() == Some(id.as_str()))
                })
                .unwrap_or(false)
    };
    if owned_active {
        manager::do_disconnect(&app, "subscription-removed").await;
    }
    let owned_count = {
        let mut g = core.lock();
        let owned = g.vault.servers.iter().filter(|s| s.subscription_id.as_deref() == Some(id.as_str())).count();
        let remaining: Vec<ServerConfig> = g
            .vault
            .servers
            .iter()
            .filter(|s| s.subscription_id.as_deref() != Some(id.as_str()))
            .cloned()
            .collect();
        g.vault.subscriptions.retain(|entry| entry.id != id);
        let selected_ok = g
            .vault
            .selected_server_id
            .as_ref()
            .map(|sel| remaining.iter().any(|s| &s.id == sel))
            .unwrap_or(false);
        if !selected_ok {
            g.vault.selected_server_id = remaining.iter().find(|s| s.supported).map(|s| s.id.clone());
        }
        g.vault.servers = remaining;
        g.state.selected_server_id = g.vault.selected_server_id.clone();
        owned
    };
    core.save_vault();
    core.sync_subscriptions();
    core.bump_servers();
    core.log("info", "subscription", &format!("subscription removed with {} configs", owned_count));
    Ok(true)
}

#[tauri::command]
pub async fn subscription_reveal(app: AppHandle, id: String) -> Result<Option<String>, String> {
    let core = core_of(&app)?;
    let value = {
        let g = core.lock();
        g.vault
            .subscriptions
            .iter()
            .find(|entry| entry.id == id)
            .map(|entry| entry.file_path.clone().unwrap_or_else(|| entry.url.clone()))
    };
    core.log("info", "subscription", "user revealed a stored subscription source (value not logged)");
    Ok(value)
}

#[tauri::command]
pub async fn subscription_clear(app: AppHandle) -> Result<bool, String> {
    let core = core_of(&app)?;
    if core.is_connected() {
        manager::do_disconnect(&app, "subscription-cleared").await;
    }
    {
        let mut g = core.lock();
        g.vault = VaultPayload::default();
        g.state.selected_server_id = None;
        g.state.active_server_id = None;
        g.state.active_subscription_id = None;
        g.state.active_server_name = None;
        g.state.active_server_address_masked = None;
    }
    crate::vault::wipe(&core.base_dir);
    core.sync_subscriptions();
    core.bump_servers();
    core.log("info", "vault", "vault wiped by user request");
    Ok(true)
}

#[tauri::command]
pub async fn subscription_import_file(
    _app: AppHandle,
    file_path: Option<String>,
    password: Option<String>,
) -> Result<FetchReport, String> {
    let _ = (file_path, password);
    Err(err(l(
        "وارد کردن فایل در نسخهٔ Rust هنوز پشتیبانی نمی‌شود",
        "File import is not supported in the Rust edition yet",
    )))
}

#[tauri::command]
pub async fn speed_test(app: AppHandle) -> Result<SpeedResult, String> {
    let core = core_of(&app)?;
    if !core.is_connected() {
        return Err(err(l(
            "برای تست سرعت ابتدا متصل شوید",
            "Connect first to run a speed test",
        )));
    }
    let http_port = { core.lock().state.http_port };
    let targets = [
        "https://speed.cloudflare.com/__down?bytes=16000000",
        "https://proof.ovh.net/files/10Mb.dat",
    ];
    for target in targets {
        let result = crate::net::measure_throughput("127.0.0.1", http_port, target, 12 * 1024 * 1024, 15000).await;
        if result.ok && result.ms > 0 {
            let mbps = (result.bytes as f64) * 8.0 / (result.ms as f64) / 1000.0;
            let mbps = (mbps * 10.0).round() / 10.0;
            return Ok(SpeedResult { mbps, bytes: result.bytes, ms: result.ms });
        }
    }
    Err(err(l(
        "تست سرعت ناموفق بود؛ سرورهای اندازه‌گیری در دسترس نیستند",
        "Speed test failed — measurement servers are unreachable",
    )))
}

/* -------------------------------------------------------------- connection */

#[tauri::command]
pub async fn connect(app: AppHandle, server_id: Option<String>) -> Result<String, String> {
    manager::do_connect(&app, server_id).await.map_err(err)
}

#[tauri::command]
pub async fn disconnect(app: AppHandle) -> Result<String, String> {
    Ok(manager::do_disconnect(&app, "user").await)
}

/* ---------------------------------------------------------------- settings */

#[tauri::command]
pub async fn settings_get(app: AppHandle) -> Result<Settings, String> {
    Ok(core_of(&app)?.lock().settings.clone())
}

#[tauri::command]
pub async fn settings_set(app: AppHandle, patch: serde_json::Value) -> Result<Settings, String> {
    let core = core_of(&app)?;
    let next = {
        let mut g = core.lock();
        g.settings = crate::settings::merge_patch(&g.settings, patch);
        g.state.socks_port = g.settings.socks_port;
        g.state.http_port = g.settings.http_port;
        g.state.system_proxy_enabled = g.settings.apply_system_proxy;
        g.settings.clone()
    };
    core.save_settings_now();
    core.emit_state();
    manager::schedule_auto_refresh(&app);
    core.log("info", "settings", "settings updated");
    Ok(next)
}

/* -------------------------------------------------------------------- core */

#[tauri::command]
pub async fn core_ensure(app: AppHandle) -> Result<CoreStatus, String> {
    let core = core_of(&app)?;
    manager::ensure_core(&app).await.map_err(err)?;
    Ok(core.snapshot_state().core)
}

#[tauri::command]
pub async fn core_pick(_app: AppHandle) -> Result<CoreStatus, String> {
    Err(err(l(
        "انتخاب دستی هسته در نسخهٔ Rust پشتیبانی نمی‌شود",
        "Picking a custom core is not supported in the Rust edition yet",
    )))
}

#[tauri::command]
pub async fn core_check_update(app: AppHandle) -> Result<CoreUpdateInfo, String> {
    let core = core_of(&app)?;
    let current = {
        let g = core.lock();
        g.core_loc
            .as_ref()
            .and_then(|loc| loc.version.clone())
            .or_else(|| g.state.core.version.clone())
    };
    let latest = crate::xray_core::latest_release_tag()
        .await
        .map(|tag| tag.trim_start_matches('v').to_string());
    let update_available = current.is_some() && latest.is_some() && current != latest;
    Ok(CoreUpdateInfo { current, latest, update_available })
}

/* -------------------------------------------------------------------- logs */

#[tauri::command]
pub async fn logs_get(app: AppHandle) -> Result<Vec<LogEntry>, String> {
    Ok(core_of(&app)?.logs_snapshot())
}

#[tauri::command]
pub async fn logs_clear(app: AppHandle) -> Result<bool, String> {
    core_of(&app)?.clear_logs();
    Ok(true)
}

/* ------------------------------------------------------------------ window */

#[tauri::command]
pub async fn window_minimize(app: AppHandle) -> Result<bool, String> {
    main_window(&app)?
        .minimize()
        .map_err(|e| err(l(&format!("کمینه‌کردن پنجره ناموفق: {}", e), "Failed to minimize the window")))?;
    Ok(true)
}

#[tauri::command]
pub async fn window_toggle_maximize(app: AppHandle) -> Result<bool, String> {
    let win = main_window(&app)?;
    if win.is_maximized().unwrap_or(false) {
        let _ = win.unmaximize();
    } else {
        let _ = win.maximize();
    }
    Ok(win.is_maximized().unwrap_or(false))
}

#[tauri::command]
pub async fn window_close(app: AppHandle) -> Result<bool, String> {
    // Routes through CloseRequested → guarded_close (exit-warning dialog).
    main_window(&app)?
        .close()
        .map_err(|_| err(l("بستن پنجره ناموفق بود", "Failed to close the window")))?;
    Ok(true)
}

/* ------------------------------------------------------------------- shell */

const ALLOWED_EXTERNAL: [&str; 6] = [
    "github.com/Manixpcshot/Naxlo-tun",
    "github.com/XTLS/Xray-core",
    "github.com/rastikerdar/vazirmatn",
    "xray.org.cn",
    "electronjs.org",
    "react.dev",
];

fn is_allowed_external_url(raw: &str) -> bool {
    let Ok(parsed) = ::url::Url::parse(raw) else { return false };
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return false;
    }
    let host = parsed.host_str().unwrap_or("").trim_start_matches("www.");
    let target = format!("{}{}", host, parsed.path());
    ALLOWED_EXTERNAL.iter().any(|allowed| target.starts_with(allowed))
}

#[tauri::command]
pub async fn shell_open(app: AppHandle, url: String) -> Result<bool, String> {
    if !is_allowed_external_url(&url) {
        if let Ok(core) = core_of(&app) {
            core.log("warn", "shell", "blocked external link request");
        }
        return Err(err(l(
            "باز کردن این آدرس مجاز نیست",
            "Opening this address is not allowed",
        )));
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&url).spawn();
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
    }
    Ok(true)
}
