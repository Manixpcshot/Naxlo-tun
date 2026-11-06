//! Subscription fetching/merging — port of `src/main/lib/subscription.ts`.

use std::collections::{HashMap, HashSet};
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::ids::stable_id;
use crate::l10n::{l, LString};
use crate::mask::mask_url;
use crate::models::{FetchReport, ServerConfig, StoredSubscription, SubUserinfo};
use crate::parse::{extract_links, is_linkish, parse_proxy_link, try_decode_base64};
use crate::state::AppCore;
use crate::submeta::{parse_profile_title, parse_subscription_userinfo};
use crate::util::now_ms;

const USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 naxlo/1.0";

pub fn subscription_id_for(url: &str) -> String {
    stable_id(url)
}

struct Downloaded {
    text: String,
    userinfo: Option<SubUserinfo>,
    title: Option<String>,
}

fn http_client() -> Result<reqwest::Client, LString> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| {
            l(
                &format!("ساخت کلاینت شبکه ناموفق: {}", e),
                &format!("Failed to create an HTTP client: {}", e),
            )
        })
}

fn friendly_fetch_error(err: &reqwest::Error) -> LString {
    if err.is_timeout() {
        return l(
            "دریافت اشتراک بیش از ۲۵ ثانیه طول کشید",
            "Fetching the subscription timed out",
        );
    }
    if err.is_connect() {
        let text = err.to_string();
        if text.contains("dns") || text.contains("resolve") || text.contains("ENOTFOUND") {
            return l(
                "آدرس سرور اشتراک پیدا نشد",
                "Could not resolve the subscription host",
            );
        }
        return l(
            "اتصال به سرور اشتراک برقرار نشد",
            "Could not reach the subscription server",
        );
    }
    if err.is_request() {
        return l(
            "خطای TLS در اتصال به سرور اشتراک",
            "TLS error while contacting the subscription server",
        );
    }
    l(
        &format!("دریافت اشتراک ناموفق بود: {}", err),
        &format!("Subscription fetch failed: {}", err),
    )
}

fn friendly_status_error(status: u16) -> LString {
    match status {
        401 | 403 => l(
            &format!("دسترسی به اشتراک رد شد ({})", status),
            &format!("Subscription access denied ({})", status),
        ),
        404 => l(
            "اشتراک پیدا نشد (۴۰۴)",
            "Subscription not found (404)",
        ),
        429 => l(
            "سرور اشتراک درخواست‌ها را محدود کرده است (۴۲۹)",
            "Subscription server rate-limited the request (429)",
        ),
        s if s >= 500 => l(
            &format!("سرور اشتراک پاسخ خطا داد ({})", s),
            &format!("Subscription server error ({})", s),
        ),
        s => l(
            &format!("سرور اشتراک پاسخ غیرمنتظره داد ({})", s),
            &format!("Unexpected subscription response ({})", s),
        ),
    }
}

/// Mirrors `decodeSubscriptionPayload`: raw links win, then base64, then JSON hint.
fn decode_payload(raw: &str, content_type: &str) -> String {
    let trimmed = raw.trim();
    if is_linkish(trimmed) {
        return trimmed.to_string();
    }
    if let Some(decoded) = try_decode_base64(trimmed) {
        if is_linkish(&decoded) || !content_type.contains("json") {
            return decoded;
        }
    }
    trimmed.to_string()
}

async fn download(url: &str) -> Result<Downloaded, LString> {
    let client = http_client()?;
    let request = client
        .get(url)
        .header("Accept", "text/plain, application/octet-stream, */*")
        .header("Accept-Language", "fa-IR,fa;q=0.9,en;q=0.5")
        .header("profile-update-interval", "0");
    let resp = tokio::time::timeout(Duration::from_secs(25), request.send())
        .await
        .map_err(|_| {
            l(
                "دریافت اشتراک بیش از ۲۵ ثانیه طول کشید",
                "Fetching the subscription timed out",
            )
        })?
        .map_err(|e| friendly_fetch_error(&e))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(friendly_status_error(status.as_u16()));
    }
    let headers = resp.headers().clone();
    let content_type = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();
    let userinfo = parse_subscription_userinfo(
        headers.get("subscription-userinfo").and_then(|v| v.to_str().ok()),
    );
    let title = parse_profile_title(headers.get("profile-title").and_then(|v| v.to_str().ok()));
    let bytes = tokio::time::timeout(Duration::from_secs(25), resp.bytes())
        .await
        .map_err(|_| {
            l(
                "دریافت اشتراک بیش از ۲۵ ثانیه طول کشید",
                "Fetching the subscription timed out",
            )
        })?
        .map_err(|e| friendly_fetch_error(&e))?;
    let raw = String::from_utf8_lossy(&bytes).into_owned();
    let text = decode_payload(&raw, &content_type);
    if text.trim().is_empty() {
        return Err(l("پاسخ اشتراک خالی بود", "The subscription response was empty"));
    }
    Ok(Downloaded { text, userinfo, title })
}

/// Fetch + parse + merge one subscription into the vault.
pub async fn refresh_subscription(app: &AppHandle, url: &str) -> Result<FetchReport, LString> {
    let Some(core) = app.try_state::<AppCore>() else {
        return Err(l("برنامه هنوز آماده نیست", "The app is not ready yet"));
    };
    let id = stable_id(url);
    core.log("info", "subscription", &format!("refreshing {}", mask_url(url)));

    let payload = download(url).await?;
    let links = extract_links(&payload.text);
    if links.is_empty() {
        return Err(l(
            "لینک معتبری در پاسخ اشتراک پیدا نشد",
            "No valid proxy links were found in the response",
        ));
    }

    let mut servers: Vec<ServerConfig> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for link in &links {
        match parse_proxy_link(link, "subscription") {
            Some(mut parsed) => {
                for warning in parsed.warnings.drain(..) {
                    if !warnings.contains(&warning) {
                        warnings.push(warning);
                    }
                }
                parsed.server.subscription_id = Some(id.clone());
                if seen.insert(parsed.server.id.clone()) {
                    servers.push(parsed.server);
                }
            }
            None => {
                let warning = "یک لینک قابل تجزیه نبود و نادیده گرفته شد".to_string();
                if !warnings.contains(&warning) {
                    warnings.push(warning);
                }
            }
        }
    }
    let merged_new = servers.len();
    let now = now_ms();
    let entry = {
        let g = core.lock();
        let existing = g.vault.subscriptions.iter().find(|s| s.id == id).cloned();
        StoredSubscription {
            id: id.clone(),
            url: url.to_string(),
            name: payload
                .title
                .clone()
                .or_else(|| existing.as_ref().and_then(|e| e.name.clone())),
            userinfo: payload
                .userinfo
                .clone()
                .or_else(|| existing.as_ref().and_then(|e| e.userinfo.clone())),
            updated_at: Some(now),
            last_error: None,
            file_path: existing.as_ref().and_then(|e| e.file_path.clone()),
            password: existing.as_ref().and_then(|e| e.password.clone()),
        }
    };
    let (total, supported) = merge_and_store(&core, &id, servers, entry);
    core.log(
        "info",
        "subscription",
        &format!("refreshed {} new configs ({} total)", merged_new, total),
    );

    Ok(FetchReport {
        ok: true,
        total,
        supported,
        merged: merged_new,
        error: None,
        warnings,
        subscription_id: Some(id),
        title: payload.title,
        userinfo: payload.userinfo,
        need_password: false,
        wrong_password: false,
        file_path: None,
    })
}

/// Replace one subscription's servers in the vault (latency measurements and
/// other subscriptions/manually imported configs are preserved) and store its
/// metadata entry. Returns `(total, supported)`.
fn merge_and_store(
    core: &AppCore,
    id: &str,
    mut servers: Vec<ServerConfig>,
    entry: StoredSubscription,
) -> (usize, usize) {
    let (total, supported) = {
        let mut g = core.lock();
        // Preserve latency measurements across refreshes.
        let prev: HashMap<String, (Option<u64>, Option<i64>)> = g
            .vault
            .servers
            .iter()
            .map(|s| (s.id.clone(), (s.latency_ms, s.latency_at)))
            .collect();
        for server in servers.iter_mut() {
            if let Some((ms, at)) = prev.get(&server.id) {
                server.latency_ms = *ms;
                server.latency_at = *at;
            }
        }
        let kept: Vec<ServerConfig> = g
            .vault
            .servers
            .iter()
            .filter(|s| s.subscription_id.as_deref() != Some(id))
            .cloned()
            .collect();
        let mut all = servers;
        all.extend(kept);

        let selected_ok = g
            .vault
            .selected_server_id
            .as_ref()
            .map(|sel| all.iter().any(|s| &s.id == sel))
            .unwrap_or(false);
        if !selected_ok {
            g.vault.selected_server_id = all
                .iter()
                .find(|s| s.supported)
                .map(|s| s.id.clone())
                .or_else(|| all.first().map(|s| s.id.clone()));
        }
        let total = all.len();
        let supported = all.iter().filter(|s| s.supported).count();
        g.vault.servers = all;
        g.vault.subscriptions.retain(|s| s.id != id);
        g.vault.subscriptions.push(entry);
        g.vault.last_updated_at = Some(now_ms());
        g.state.selected_server_id = g.vault.selected_server_id.clone();
        (total, supported)
    };
    core.save_vault();
    core.bump_servers();
    core.sync_subscriptions();
    (total, supported)
}

/// Refresh one stored subscription with fetching flags + lastError bookkeeping
/// (port of `refreshOne` in `src/main/ipc.ts`).
pub async fn refresh_one(app: &AppHandle, id: &str) -> Result<FetchReport, LString> {
    let Some(core) = app.try_state::<AppCore>() else {
        return Err(l("برنامه هنوز آماده نیست", "The app is not ready yet"));
    };
    let entry = {
        let g = core.lock();
        g.vault.subscriptions.iter().find(|s| s.id == id).cloned()
    };
    let Some(entry) = entry else {
        return Err(l("اشتراک پیدا نشد", "Subscription not found"));
    };
    core.set_subscription_fetching(id, true);
    let result = if let Some(path) = entry.file_path.clone() {
        let password = entry.password.clone();
        let report = match refresh_file_subscription(app, &path, password.as_deref()).await {
            Ok(report) => report,
            Err(e) => {
                {
                    let mut g = core.lock();
                    if let Some(stored) = g.vault.subscriptions.iter_mut().find(|s| s.id == id) {
                        stored.last_error = Some(e.clone().into());
                    }
                }
                core.save_vault();
                core.sync_subscriptions();
                core.set_subscription_fetching(id, false);
                return Err(e);
            }
        };
        if report.need_password {
            // Stored file needs a password the vault does not have (yet).
            let message = l(
                "این فایل رمز دارد؛ رمز را از «وارد کردن از فایل» وارد کنید تا ذخیره شود",
                "This file is password-protected; enter its password via \"Import from file\" so it can be stored",
            );
            {
                let mut g = core.lock();
                if let Some(stored) = g.vault.subscriptions.iter_mut().find(|s| s.id == id) {
                    stored.last_error = Some(message.clone().into());
                }
            }
            core.save_vault();
            core.sync_subscriptions();
            core.set_subscription_fetching(id, false);
            return Err(message);
        }
        Ok(report)
    } else {
        refresh_subscription(app, &entry.url).await
    };
    match &result {
        Ok(_) => {}
        Err(e) => {
            {
                let mut g = core.lock();
                if let Some(stored) = g.vault.subscriptions.iter_mut().find(|s| s.id == id) {
                    stored.last_error = Some(e.clone().into());
                }
            }
            core.save_vault();
            core.sync_subscriptions();
        }
    }
    core.set_subscription_fetching(id, false);
    result
}

/* ----------------------------------------------------------- file import */

/// Local config file outcomes that are *not* hard errors (the UI reacts).
pub enum FileError {
    NeedPassword,
    WrongPassword,
    Message(LString),
}

fn is_text_entry(name: &str) -> bool {
    let low = name.to_lowercase();
    low.ends_with(".txt")
        || low.ends_with(".text")
        || low.ends_with(".json")
        || low.ends_with(".conf")
        || low.ends_with(".sub")
}

/// Read a local config payload: plain text, base64 or a ZIP archive
/// (including classic ZipCrypto / AES password-protected archives).
pub fn read_config_file(path: &str, password: Option<&str>) -> Result<String, FileError> {
    use std::io::Read;
    let bytes = std::fs::read(path).map_err(|_| FileError::Message(l("فایل پیدا نشد", "File not found")))?;
    if bytes.len() > 4 && bytes[0] == 0x50 && bytes[1] == 0x4b && bytes[2] == 0x03 && bytes[3] == 0x04 {
        let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes.as_slice()))
            .map_err(|_| FileError::Message(l("ساختار زیپ خراب است", "The zip archive is malformed")))?;
        let count = archive.len();
        let names: Vec<String> = (0..count)
            .map(|i| archive.name_for_index(i).unwrap_or("").to_string())
            .collect();
        let pick = names
            .iter()
            .position(|n| !n.ends_with('/') && is_text_entry(n) && !n.is_empty())
            .or_else(|| names.iter().position(|n| !n.ends_with('/')))
            .ok_or_else(|| FileError::Message(l("آرشیو خالی بود", "The archive was empty")))?;
        let encrypted = archive
            .by_index(pick)
            .map(|f| f.is_encrypted())
            .unwrap_or(true);
        let mut file = match (encrypted, password) {
            (false, _) => archive
                .by_index(pick)
                .map_err(|_| FileError::Message(l("خواندن آرشیو ناموفق بود", "Could not read the archive")))?,
            (true, None) => return Err(FileError::NeedPassword),
            (true, Some(pwd)) => archive
                .by_index_decrypt(pick, pwd.as_bytes())
                .map_err(|_| FileError::WrongPassword)?,
        };
        let mut text = String::new();
        file.read_to_string(&mut text)
            .map_err(|_| FileError::WrongPassword)?;
        return Ok(decode_payload(&text, ""));
    }
    let raw = String::from_utf8_lossy(&bytes).into_owned();
    Ok(decode_payload(&raw, ""))
}

/// Import (or re-import) a subscription from a local file — parity with the
/// Electron `refreshFileSubscription`.
pub async fn refresh_file_subscription(
    app: &AppHandle,
    path: &str,
    password: Option<&str>,
) -> Result<FetchReport, LString> {
    let Some(core) = app.try_state::<AppCore>() else {
        return Err(l("برنامه هنوز آماده نیست", "The app is not ready yet"));
    };
    let text = match read_config_file(path, password) {
        Ok(text) => text,
        Err(FileError::NeedPassword) => {
            return Ok(empty_file_report(path, false));
        }
        Err(FileError::WrongPassword) => {
            return Ok(empty_file_report(path, true));
        }
        Err(FileError::Message(message)) => return Err(message),
    };
    let id = stable_id(&format!("file:{}", path));
    let links = extract_links(&text);
    if links.is_empty() {
        return Err(l("هیچ کانفیگی در فایل پیدا نشد", "No configs were found in the file"));
    }
    let mut servers: Vec<ServerConfig> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for link in &links {
        match parse_proxy_link(link, "import") {
            Some(mut parsed) => {
                for warning in parsed.warnings.drain(..) {
                    if !warnings.contains(&warning) {
                        warnings.push(warning);
                    }
                }
                parsed.server.subscription_id = Some(id.clone());
                if seen.insert(parsed.server.id.clone()) {
                    servers.push(parsed.server);
                }
            }
            None => {
                let warning = "یک لینک قابل تجزیه نبود و نادیده گرفته شد".to_string();
                if !warnings.contains(&warning) {
                    warnings.push(warning);
                }
            }
        }
    }
    let merged_new = servers.len();
    let file_name = path.rsplit(['/', '\\']).next().unwrap_or(path).to_string();
    let entry = {
        let g = core.lock();
        let existing = g.vault.subscriptions.iter().find(|s| s.id == id).cloned();
        StoredSubscription {
            id: id.clone(),
            url: String::new(),
            name: existing
                .as_ref()
                .and_then(|e| e.name.clone())
                .or(Some(file_name)),
            userinfo: None,
            updated_at: Some(now_ms()),
            last_error: None,
            file_path: Some(path.to_string()),
            password: password
                .map(|p| p.to_string())
                .or_else(|| existing.as_ref().and_then(|e| e.password.clone())),
        }
    };
    let (total, supported) = merge_and_store(&core, &id, servers, entry);
    core.log(
        "info",
        "subscription",
        &format!("file subscription refreshed: {} configs ({} total)", merged_new, total),
    );
    Ok(FetchReport {
        ok: true,
        total,
        supported,
        merged: merged_new,
        error: None,
        warnings,
        subscription_id: Some(id),
        title: None,
        userinfo: None,
        need_password: false,
        wrong_password: false,
        file_path: Some(path.to_string()),
    })
}

fn empty_file_report(path: &str, wrong: bool) -> FetchReport {
    FetchReport {
        ok: false,
        total: 0,
        supported: 0,
        merged: 0,
        error: None,
        warnings: Vec::new(),
        subscription_id: None,
        title: None,
        userinfo: None,
        need_password: true,
        wrong_password: wrong,
        file_path: Some(path.to_string()),
    }
}
