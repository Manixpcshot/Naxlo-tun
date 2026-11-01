//! Xray core discovery/download — port of `src/main/lib/xray/core.ts`.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use futures_util::StreamExt;
use serde_json::Value;
use sha2::{Digest, Sha256, Sha512};

use crate::l10n::{l, LString};
use crate::models::CoreLocation;

/// Pinned core release — same pin as the Electron edition (`PINNED_XRAY_VERSION`).
pub const PINNED_XRAY_VERSION: &str = "v26.10.31";
const REPO: &str = "XTLS/Xray-core";

pub fn executable_name() -> &'static str {
    if cfg!(windows) {
        "xray.exe"
    } else {
        "xray"
    }
}

pub fn asset_name() -> &'static str {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "aarch64") => "Xray-windows-arm64-v8a.zip",
        ("windows", "x86") => "Xray-windows-32.zip",
        ("windows", _) => "Xray-windows-64.zip",
        ("macos", "aarch64") => "Xray-macos-arm64-v8a.zip",
        ("macos", _) => "Xray-macos-64.zip",
        (_, "aarch64") => "Xray-linux-arm64-v8a.zip",
        _ => "Xray-linux-64.zip",
    }
}

pub fn target_dir(base: &Path) -> PathBuf {
    base.join("xray").join(PINNED_XRAY_VERSION)
}

fn http_client() -> Result<reqwest::Client, LString> {
    reqwest::Client::builder()
        .user_agent("naxlo")
        .build()
        .map_err(|e| l(&format!("ساخت کلاینت شبکه ناموفق: {}", e), &format!("Failed to create an HTTP client: {}", e)))
}

/// Locate a usable core: user override first, then the managed download dir.
pub fn find_core(custom: Option<&str>, base: &Path) -> Option<CoreLocation> {
    if let Some(path) = custom.filter(|p| !p.trim().is_empty()) {
        let p = Path::new(path);
        if p.is_file() {
            let version = read_version(p);
            return Some(CoreLocation { path: p.to_path_buf(), version, source: "custom".into() });
        }
    }
    let downloaded = target_dir(base).join(executable_name());
    if downloaded.is_file() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&downloaded, fs::Permissions::from_mode(0o755));
        }
        let version = read_version(&downloaded);
        return Some(CoreLocation { path: downloaded, version, source: "downloaded".into() });
    }
    None
}

/// `<xray> version` → normalized version string (leading `v` stripped).
pub fn read_version(path: &Path) -> Option<String> {
    let out = std::process::Command::new(path).arg("version").output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout).into_owned();
    for line in text.lines() {
        let mut words = line.split_whitespace();
        while let Some(word) = words.next() {
            if word.eq_ignore_ascii_case("Xray") {
                if let Some(candidate) = words.next() {
                    let cut = candidate.split('(').next().unwrap_or(candidate);
                    let first_ok = cut.chars().next().map(|c| c.is_ascii_digit() || c == 'v').unwrap_or(false);
                    if first_ok {
                        return Some(cut.trim_start_matches('v').to_string());
                    }
                }
            }
        }
    }
    text.lines().find(|line| !line.trim().is_empty()).map(|line| line.trim().to_string())
}

pub async fn latest_release_tag() -> Option<String> {
    let client = http_client().ok()?;
    let resp = client
        .get(format!("https://api.github.com/repos/{}/releases/latest", REPO))
        .header("Accept", "application/vnd.github+json")
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let value: Value = resp.json().await.ok()?;
    value.get("tag_name").and_then(|v| v.as_str()).map(String::from)
}

/// Download + verify + extract the pinned core. `on_progress(received, total)`.
pub async fn download_core<F>(base: &Path, on_progress: F) -> Result<PathBuf, LString>
where
    F: Fn(usize, Option<u64>),
{
    let client = http_client()?;
    let url = format!(
        "https://github.com/{}/releases/download/{}/{}",
        REPO,
        PINNED_XRAY_VERSION,
        asset_name()
    );
    let dgst_url = format!("{}.dgst", url);

    let bytes = tokio::time::timeout(Duration::from_secs(300), async {
        let resp = client
            .get(&url)
            .send()
            .await
            .map_err(|e| l(&format!("دریافت هستهٔ Xray ناموفق بود: {}", e), &format!("Failed to download the Xray core: {}", e)))?;
        if !resp.status().is_success() {
            return Err(l(
                &format!("خطای HTTP {} هنگام دریافت هستهٔ Xray", resp.status().as_u16()),
                &format!("HTTP {} while downloading the Xray core", resp.status().as_u16()),
            ));
        }
        let total = resp.content_length();
        let mut stream = resp.bytes_stream();
        let mut buf: Vec<u8> = Vec::new();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk
                .map_err(|e| l(&format!("دریافت هستهٔ Xray قطع شد: {}", e), &format!("Xray core download interrupted: {}", e)))?;
            buf.extend_from_slice(&chunk);
            on_progress(buf.len(), total);
        }
        Ok::<Vec<u8>, LString>(buf)
    })
    .await
    .map_err(|_| {
        l(
            "دریافت هستهٔ Xray بیش از پنج دقیقه طول کشید",
            "Downloading the Xray core timed out after five minutes",
        )
    })??;

    if let Err(e) = verify(&bytes, &dgst_url, &client).await {
        let _ = fs::remove_dir_all(target_dir(base));
        return Err(e);
    }

    let dest = target_dir(base);
    if dest.exists() {
        let _ = fs::remove_dir_all(&dest);
    }
    fs::create_dir_all(&dest)
        .map_err(|e| l(&format!("ساخت پوشهٔ هسته ناموفق: {}", e), &format!("Failed to create the core directory: {}", e)))?;
    extract(&bytes, &dest)?;

    let exe = dest.join(executable_name());
    if exe.is_file() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&exe, fs::Permissions::from_mode(0o755));
        }
        return Ok(exe);
    }
    // Some archives nest the binary in a folder — locate it as a fallback.
    if let Ok(entries) = fs::read_dir(&dest) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if entry.path().is_file() && name.to_ascii_lowercase().starts_with("xray") {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let _ = fs::set_permissions(&entry.path(), fs::Permissions::from_mode(0o755));
                }
                return Ok(entry.path());
            }
        }
    }
    let _ = fs::remove_dir_all(&dest);
    Err(l(
        "فایل اجرایی Xray در آرشیو پیدا نشد",
        "The Xray executable was not found in the archive",
    ))
}

/// Compare against the release `.dgst` sidecar (base64 digests).
async fn verify(bytes: &[u8], dgst_url: &str, client: &reqwest::Client) -> Result<(), LString> {
    let text = match client.get(dgst_url).timeout(Duration::from_secs(30)).send().await {
        Ok(resp) if resp.status().is_success() => resp.text().await.unwrap_or_default(),
        _ => return Ok(()), // digest unavailable → skip verification like the TS flow
    };
    for line in text.lines() {
        let Some((alg, expected)) = parse_dgst_line(line) else { continue };
        let actual = match alg.as_str() {
            "SHA512" => B64.encode(Sha512::digest(bytes)),
            "SHA256" => B64.encode(Sha256::digest(bytes)),
            _ => continue,
        };
        if actual == expected {
            return Ok(());
        }
        return Err(l(
            "امضای فایل هستهٔ Xray مطابقت نکرد؛ دریافت لغو شد",
            "The Xray core digest did not match; the download was rejected",
        ));
    }
    Ok(())
}

fn parse_dgst_line(line: &str) -> Option<(String, String)> {
    let (left, right) = line.split_once('=')?;
    let normalized = left.replace(char::is_whitespace, "").to_uppercase();
    if !normalized.contains("(BASE64)") {
        return None;
    }
    let alg = normalized.split('(').next()?.to_string();
    let token: String = right
        .trim()
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric() || *c == '+' || *c == '/' || *c == '=')
        .collect();
    if token.is_empty() {
        None
    } else {
        Some((alg, token))
    }
}

fn extract(bytes: &[u8], dest: &Path) -> Result<(), LString> {
    use std::io::Read;
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|_| l("فایل هستهٔ Xray یک آرشیو zip معتبر نیست", "The Xray core archive is not a valid zip"))?;
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| l(&format!("خواندن آرشیو ناموفق: {}", e), &format!("Failed to read the archive: {}", e)))?;
        let Some(name) = file.enclosed_name() else { continue };
        let out = dest.join(&name);
        if !out.starts_with(dest) {
            continue; // zip-slip guard
        }
        if file.is_dir() {
            let _ = fs::create_dir_all(&out);
            continue;
        }
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| l(&format!("ساخت پوشه ناموفق: {}", e), &format!("Failed to create a directory: {}", e)))?;
        }
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)
            .map_err(|e| l(&format!("استخراج ناموفق: {}", e), &format!("Extraction failed: {}", e)))?;
        fs::write(&out, &buf)
            .map_err(|e| l(&format!("نوشتن فایل ناموفق: {}", e), &format!("Failed to write a file: {}", e)))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let is_exe = out.file_name().map(|n| n == executable_name()).unwrap_or(false);
            let mode = if is_exe { 0o755 } else { 0o644 };
            let _ = fs::set_permissions(&out, fs::Permissions::from_mode(mode));
        }
    }
    Ok(())
}

pub fn purge_downloaded_cores(base: &Path) {
    let _ = fs::remove_dir_all(base.join("xray"));
}
