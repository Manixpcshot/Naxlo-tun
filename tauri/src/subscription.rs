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
            .filter(|s| s.subscription_id.as_deref() != Some(id.as_str()))
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
            g.vault.selected_server_id = all.iter().find(|s| s.supported).map(|s| s.id.clone());
        }
        let total = all.len();
        let supported = all.iter().filter(|s| s.supported).count();
        g.vault.servers = all;

        let now = now_ms();
        let existing = g.vault.subscriptions.iter().find(|s| s.id == id).cloned();
        let entry = StoredSubscription {
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
        };
        g.vault.subscriptions.retain(|s| s.id != id);
        g.vault.subscriptions.push(entry);
        g.vault.last_updated_at = Some(now);
        g.state.selected_server_id = g.vault.selected_server_id.clone();
        (total, supported)
    };
    core.save_vault();
    core.bump_servers();
    core.sync_subscriptions();
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
    })
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
    if entry.file_path.is_some() {
        return Err(l(
            "اشتراک‌های فایل‌محور در نسخهٔ Rust پشتیبانی نمی‌شوند",
            "File-based subscriptions are not supported in the Rust edition",
        ));
    }
    core.set_subscription_fetching(id, true);
    let result = refresh_subscription(app, &entry.url).await;
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
