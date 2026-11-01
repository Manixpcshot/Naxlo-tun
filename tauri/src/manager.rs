//! Connection orchestration — port of `src/main/lib/xray/manager.ts`
//! (lean scope: proxy mode only, no TUN, no failover cascade).

use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

use crate::l10n::{l, LString};
use crate::mask::mask_address;
use crate::models::{CoreLocation, ServerConfig};
use crate::net;
use crate::runner;
use crate::settings::Settings;
use crate::state::{AppCore, STATE_EVENT};
use crate::sysproxy;
use crate::util::now_ms;
use crate::xray_config::{build_xray_config, validate_config};
use crate::xray_core;

/// Pseudo server id: let Naxlo pick the best healthy server.
pub const AUTO_SERVER_ID: &str = "auto";

/// Mirrors `pickBestServer`: supported first, lowest latency wins
/// (unmeasured = last), newest breaks ties.
pub fn pick_best(servers: &[ServerConfig]) -> Option<&ServerConfig> {
    servers
        .iter()
        .filter(|s| s.supported)
        .min_by(|a, b| {
            let la = a.latency_ms.unwrap_or(u64::MAX);
            let lb = b.latency_ms.unwrap_or(u64::MAX);
            la.cmp(&lb).then_with(|| b.added_at.cmp(&a.added_at))
        })
}

fn listen_host(settings: &Settings) -> String {
    if settings.listen_address.is_empty() {
        "127.0.0.1".to_string()
    } else {
        settings.listen_address.clone()
    }
}

enum Prep {
    Busy,
    /// Expected failure: set the error state + toast, return the state.
    Soft(LString),
    /// Thrown back to the caller (mirrors the auto-select guard in ipc.ts).
    Hard(LString),
    Ready { server: ServerConfig, settings: Settings, auto_name: Option<String> },
}

/// Full connect flow. Returns the resulting connection state string.
pub async fn do_connect(app: &AppHandle, server_id: Option<String>) -> Result<String, LString> {
    let Some(core) = app.try_state::<AppCore>() else {
        return Err(l("برنامه هنوز آماده نیست", "The app is not ready yet"));
    };

    let prep = {
        let mut g = core.lock();
        if g.busy {
            Prep::Busy
        } else {
            let mut target = server_id.clone().or_else(|| g.vault.selected_server_id.clone());
            let mut auto_name: Option<String> = None;
            let mut hard: Option<LString> = None;
            if target.as_deref() == Some(AUTO_SERVER_ID) {
                match pick_best(&g.vault.servers) {
                    Some(best) => {
                        auto_name = Some(best.name.clone());
                        target = Some(best.id.clone());
                    }
                    None => {
                        hard = Some(l(
                            "سرور پشتیبانی‌شده‌ای برای انتخاب خودکار وجود ندارد",
                            "No supported server is available for auto selection",
                        ));
                    }
                }
            }
            if let Some(message) = hard {
                Prep::Hard(message)
            } else {
                match target.and_then(|id| g.vault.servers.iter().find(|s| s.id == id).cloned()) {
                    None => Prep::Soft(l(
                        "سروری برای اتصال انتخاب نشده است",
                        "No server is selected",
                    )),
                    Some(server) => match validate_config(&server) {
                        Err(message) => Prep::Soft(message),
                        Ok(()) => {
                            g.busy = true;
                            g.stopping = false;
                            g.probe_failures = 0;
                            g.vault.selected_server_id = Some(server.id.clone());
                            g.active_server_id = Some(server.id.clone());
                            g.state.selected_server_id = Some(server.id.clone());
                            g.state.active_server_id = Some(server.id.clone());
                            g.state.active_subscription_id = server.subscription_id.clone();
                            g.state.active_server_name = Some(server.name.clone());
                            g.state.active_server_address_masked = Some(mask_address(&server.address));
                            g.state.last_error = None;
                            g.state.identity = None;
                            g.state.latency_ms = None;
                            g.state.started_at = None;
                            g.state.connection = "preparing".into();
                            let settings = g.settings.clone();
                            Prep::Ready { server, settings, auto_name }
                        }
                    },
                }
            }
        }
    };
    let ready = matches!(prep, Prep::Ready { .. });
    core.emit_state();
    if ready {
        core.save_vault();
    }

    match prep {
        Prep::Busy => {
            core.toast(
                "warning",
                l("یک عملیات دیگر در جریان است", "Another operation is already running"),
                None,
            );
            Ok(core.snapshot_state().connection)
        }
        Prep::Soft(message) => {
            core.set_connection("error", Some(message.clone().into()));
            core.toast("error", message, None);
            Ok(core.snapshot_state().connection)
        }
        Prep::Hard(message) => Err(message),
        Prep::Ready { server, settings, auto_name } => {
            if let Some(name) = auto_name {
                core.log("info", "connect", "auto selection picked the best server");
                core.toast(
                    "info",
                    l(
                        &format!("انتخاب خودکار: {}", name),
                        &format!("Auto-picked: {}", name),
                    ),
                    None,
                );
            }

            let listen = listen_host(&settings);

            // 1. core ready?
            let loc = match ensure_core(app).await {
                Ok(loc) => loc,
                Err(message) => {
                    fail_connect(app, message).await;
                    return Ok(core.snapshot_state().connection);
                }
            };

            // 2. local ports must be free
            if net::port_in_use(&listen, settings.socks_port).await {
                fail_connect(
                    app,
                    l(
                        &format!("پورت {} توسط برنامهٔ دیگری اشغال شده است", settings.socks_port),
                        &format!("Port {} is already in use by another app", settings.socks_port),
                    ),
                )
                .await;
                return Ok(core.snapshot_state().connection);
            }
            if net::port_in_use(&listen, settings.http_port).await {
                fail_connect(
                    app,
                    l(
                        &format!("پورت {} توسط برنامهٔ دیگری اشغال شده است", settings.http_port),
                        &format!("Port {} is already in use by another app", settings.http_port),
                    ),
                )
                .await;
                return Ok(core.snapshot_state().connection);
            }

            // 3. the Rust edition is proxy-only
            if settings.connection_mode == "tun" {
                core.log(
                    "warn",
                    "connect",
                    "TUN mode is not available in the Rust edition — using proxy mode",
                );
            }

            // 4. start the core
            core.set_connection("starting", None);
            let config = build_xray_config(&server, &settings);
            let handle = match runner::start(core.app.clone(), &loc.path, &config, &core.base_dir) {
                Ok(handle) => handle,
                Err(e) => {
                    fail_connect(
                        app,
                        l(
                            &format!("اجرای هستهٔ Xray ناموفق بود: {}", e),
                            &format!("Failed to start the Xray core: {}", e),
                        ),
                    )
                    .await;
                    return Ok(core.snapshot_state().connection);
                }
            };
            {
                core.lock().runner = Some(handle);
            }

            // 5. wait for the local HTTP proxy port
            if !net::wait_for_port(&listen, settings.http_port, 9000).await {
                fail_connect(
                    app,
                    l(
                        "پروکسی محلی راه‌اندازی نشد",
                        "The local proxy did not start in time",
                    ),
                )
                .await;
                return Ok(core.snapshot_state().connection);
            }

            // 6. system proxy (failure is a warning — keep going)
            if settings.apply_system_proxy {
                let base = core.base_dir.clone();
                let host = listen.clone();
                let port = settings.http_port;
                let applied = tauri::async_runtime::spawn_blocking(move || sysproxy::apply(&base, &host, port)).await;
                match applied {
                    Ok(Ok(())) => {
                        core.patch_state(|s| s.system_proxy_applied = true);
                        core.lock().sysproxy_applied = true;
                        core.log("info", "proxy", "system proxy applied");
                    }
                    Ok(Err(message)) => {
                        core.log("warn", "proxy", "system proxy could not be applied");
                        core.toast("warning", message, None);
                    }
                    Err(_) => {}
                }
            }

            // 7. probe through the proxy
            let probe = net::request_through_proxy(&listen, settings.http_port, &settings.test_url, 15000).await;
            if !probe.ok {
                let message = probe
                    .error
                    .unwrap_or_else(|| l("تست اتصال ناموفق بود", "Connection test failed"));
                fail_connect(app, message).await;
                return Ok(core.snapshot_state().connection);
            }

            // 8. connected
            let started_at = now_ms();
            core.patch_state(|s| {
                s.started_at = Some(started_at);
                s.latency_ms = Some(probe.ms);
            });
            core.set_connection("connected", None);
            let gen = {
                let mut g = core.lock();
                g.vault.last_connected_at = Some(started_at);
                g.latency_gen += 1;
                g.latency_gen
            };
            core.save_vault();
            spawn_latency_timer(app, gen);
            core.toast(
                "success",
                l("اتصال برقرار شد", "Connected"),
                Some(l(
                    &format!("{} • {}ms", server.name, probe.ms),
                    &format!("{} • {}ms", server.name, probe.ms),
                )),
            );
            core.lock().busy = false;

            // 9. public identity in the background
            let app2 = app.clone();
            tauri::async_runtime::spawn(async move { refresh_identity(&app2).await; });

            Ok("connected".to_string())
        }
    }
}

async fn fail_connect(app: &AppHandle, message: LString) {
    cleanup_after_failure(app, message.clone()).await;
    if let Some(core) = app.try_state::<AppCore>() {
        core.toast("error", message, None);
    }
}

/// Disconnect; returns the resulting connection state.
pub async fn do_disconnect(app: &AppHandle, reason: &str) -> String {
    let Some(core) = app.try_state::<AppCore>() else {
        return "idle".to_string();
    };
    let handle = {
        let mut g = core.lock();
        g.stopping = true;
        g.latency_gen += 1;
        g.probe_failures = 0;
        let handle = g.runner.take();
        if handle.is_some() {
            g.state.connection = "stopping".into();
        }
        handle
    };
    core.emit_state();
    if let Some(handle) = handle {
        let reason = reason.to_string();
        let _ = tauri::async_runtime::spawn_blocking(move || handle.stop(&reason)).await;
    }
    restore_proxy_if_ours(app).await;
    {
        let mut g = core.lock();
        g.sysproxy_applied = false;
        g.stopping = false;
        g.busy = false;
        g.active_server_id = None;
        g.state.system_proxy_applied = false;
        g.state.started_at = None;
        g.state.latency_ms = None;
        g.state.identity = None;
        g.state.active_server_id = None;
        g.state.active_subscription_id = None;
        g.state.active_server_name = None;
        g.state.active_server_address_masked = None;
    }
    core.set_connection("idle", None);
    core.log("info", "connection", &format!("disconnected ({})", reason));
    if reason == "user" {
        core.toast("info", l("اتصال قطع شد", "Disconnected"), None);
    }
    core.snapshot_state().connection
}

/// Emergency stop: disconnect, force the proxy off, warn (port of `panicNow`).
pub async fn do_panic(app: &AppHandle) -> bool {
    let Some(core) = app.try_state::<AppCore>() else { return false };
    core.log("warn", "panic", "PANIC triggered — emergency disconnect");
    if core.is_connected() {
        do_disconnect(app, "panic").await;
    }
    let base = core.base_dir.clone();
    let _ = tauri::async_runtime::spawn_blocking(move || sysproxy::restore(&base)).await;
    core.patch_state(|s| s.system_proxy_applied = false);
    core.lock().sysproxy_applied = false;
    core.toast(
        "warning",
        l("قطع اضطراری انجام شد", "Panic disconnect completed"),
        None,
    );
    true
}

/// Teardown after a failed/lost connection: stop core, restore proxy, error state.
pub async fn cleanup_after_failure(app: &AppHandle, message: LString) {
    let Some(core) = app.try_state::<AppCore>() else { return };
    let handle = {
        let mut g = core.lock();
        g.stopping = true;
        g.latency_gen += 1;
        g.probe_failures = 0;
        g.runner.take()
    };
    if let Some(handle) = handle {
        let _ = tauri::async_runtime::spawn_blocking(move || handle.stop("failure")).await;
    }
    restore_proxy_if_ours(app).await;
    {
        let mut g = core.lock();
        g.sysproxy_applied = false;
        g.stopping = false;
        g.busy = false;
        g.active_server_id = None;
        g.state.system_proxy_applied = false;
        g.state.started_at = None;
        g.state.latency_ms = None;
        g.state.identity = None;
    }
    core.set_connection("error", Some(message.into()));
    core.log("error", "connection", "connection failed — state cleaned up");
}

/// Watcher callback: the core process exited without being asked to.
pub fn on_core_exited(app: &AppHandle, code: Option<i32>) {
    let Some(core) = app.try_state::<AppCore>() else { return };
    if core.lock().stopping {
        return;
    }
    let desc = code.map(|c| c.to_string()).unwrap_or_else(|| "unknown".to_string());
    core.log("error", "xray", &format!("core exited unexpectedly (code {})", desc));
    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        cleanup_after_failure(
            &app2,
            l(
                &format!("هستهٔ Xray به شکل غیرمنتظره بسته شد (کد {})", desc),
                &format!("The Xray core exited unexpectedly (code {})", desc),
            ),
        )
        .await;
        if let Some(core) = app2.try_state::<AppCore>() {
            core.toast(
                "error",
                l("اتصال قطع شد", "Connection dropped"),
                Some(l(
                    "هستهٔ Xray به شکل غیرمنتظره بسته شد",
                    "The Xray core exited unexpectedly",
                )),
            );
        }
    });
}

/// Restore the user's proxy settings only when we still own them.
async fn restore_proxy_if_ours(app: &AppHandle) {
    let Some(core) = app.try_state::<AppCore>() else { return };
    let (applied, base, expected) = {
        let g = core.lock();
        let expected = format!("{}:{}", listen_host(&g.settings), g.settings.http_port);
        (g.sysproxy_applied, core.base_dir.clone(), expected)
    };
    if !applied {
        return;
    }
    let probe = {
        let base = base.clone();
        tauri::async_runtime::spawn_blocking(move || sysproxy::read(&base)).await
    };
    let snapshot = probe.ok().and_then(|r| r.ok());
    let ours = snapshot
        .map(|s| s.applied && s.server.as_deref() == Some(expected.as_str()))
        .unwrap_or(false);
    if ours {
        let _ = tauri::async_runtime::spawn_blocking(move || sysproxy::restore(&base)).await;
        core.log("info", "proxy", "system proxy restored");
    }
}

/// Find or download the pinned Xray core, streaming progress into `state.core`.
pub async fn ensure_core(app: &AppHandle) -> Result<CoreLocation, LString> {
    let Some(core) = app.try_state::<AppCore>() else {
        return Err(l("برنامه هنوز آماده نیست", "The app is not ready yet"));
    };
    let custom = { core.lock().settings.core_path.clone() };
    if let Some(loc) = xray_core::find_core(custom.as_deref(), &core.base_dir) {
        {
            let mut g = core.lock();
            g.core_loc = Some(loc.clone());
        }
        core.patch_core(|c| {
            c.ready = true;
            c.path = Some(loc.path.to_string_lossy().into_owned());
            c.version = loc.version.clone();
            c.source = Some(loc.source.clone());
            c.downloading = false;
            c.progress = None;
            c.error = None;
        });
        return Ok(loc);
    }

    core.patch_core(|c| {
        c.downloading = true;
        c.progress = Some(0.0);
        c.error = None;
    });
    core.toast(
        "info",
        l("در حال دریافت هستهٔ Xray", "Downloading the Xray core"),
        Some(l("این کار فقط یک بار انجام می‌شود", "This happens only once")),
    );

    let base = core.base_dir.clone();
    let app2 = app.clone();
    let result = xray_core::download_core(&base, move |received, total| {
        if let Some(core) = app2.try_state::<AppCore>() {
            let frac = total.map(|t| (received as f64 / t as f64).min(1.0));
            core.patch_core(|c| c.progress = frac);
        }
    })
    .await;

    match result {
        Ok(path) => {
            let version = xray_core::read_version(&path);
            let loc = CoreLocation { path: path.clone(), version: version.clone(), source: "downloaded".into() };
            {
                let mut g = core.lock();
                g.core_loc = Some(loc.clone());
            }
            let path_str = path.to_string_lossy().into_owned();
            core.patch_core(move |c| {
                c.ready = true;
                c.path = Some(path_str);
                c.version = version;
                c.source = Some("downloaded".into());
                c.downloading = false;
                c.progress = None;
                c.error = None;
            });
            core.patch_state(|s| {
                if s.connection == "core-missing" {
                    s.connection = "idle".into();
                }
            });
            core.toast(
                "success",
                l("هستهٔ Xray آماده شد", "The Xray core is ready"),
                None,
            );
            Ok(loc)
        }
        Err(message) => {
            let for_state = message.clone();
            core.patch_core(move |c| {
                c.downloading = false;
                c.progress = None;
                c.error = Some(for_state.into());
            });
            core.toast(
                "error",
                l("دریافت هستهٔ Xray ناموفق بود", "Downloading the Xray core failed"),
                Some(message.clone()),
            );
            Err(message)
        }
    }
}

/// TCP ping one server and store the result (port of `manager.testServer`).
pub async fn test_server(app: &AppHandle, id: &str) -> Option<u64> {
    let core = app.try_state::<AppCore>()?;
    let target = {
        let g = core.lock();
        g.vault
            .servers
            .iter()
            .find(|s| s.id == id)
            .map(|s| (s.address.clone(), s.port))
    }?;
    if target.0.is_empty() {
        return None;
    }
    let ms = net::tcp_ping(&target.0, target.1, 5000).await;
    core.store_latency(id, ms);
    ms
}

/// Test every supported server with bounded concurrency (port of `manager.testAll`).
pub async fn test_all(app: &AppHandle) -> u64 {
    use futures_util::{stream, StreamExt};
    let Some(core) = app.try_state::<AppCore>() else { return 0 };
    let targets: Vec<(String, String, u16)> = {
        let g = core.lock();
        g.vault
            .servers
            .iter()
            .filter(|s| s.supported && !s.address.is_empty())
            .take(400)
            .map(|s| (s.id.clone(), s.address.clone(), s.port))
            .collect()
    };
    let total = targets.len() as u64;
    if total == 0 {
        return 0;
    }
    let app_c = app.clone();
    let results: Vec<(String, Option<u64>)> = stream::iter(targets.into_iter().map(|(id, address, port)| {
        let app2 = app_c.clone();
        async move {
            let ms = net::tcp_ping(&address, port, 4000).await;
            if let Some(core) = app2.try_state::<AppCore>() {
                core.store_latency(&id, ms);
            }
            (id, ms)
        }
    }))
    .buffer_unordered(12)
    .collect()
    .await;

    let reachable = results.iter().filter(|(_, ms)| ms.is_some()).count();
    core.log(
        "info",
        "servers",
        &format!("tested {} servers ({} reachable)", results.len(), reachable),
    );
    core.toast(
        "success",
        l("تست سرورها تمام شد", "Server test finished"),
        Some(l(
            &format!("{} از {} سرور در دسترس بود", reachable, results.len()),
            &format!("{} of {} servers were reachable", reachable, results.len()),
        )),
    );
    core.bump_servers();
    total
}

/// 25s health-probe loop; three consecutive misses tear the connection down.
fn spawn_latency_timer(app: &AppHandle, gen: u64) {
    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(25)).await;
            let Some(core) = app2.try_state::<AppCore>() else { return };
            let (settings, alive) = {
                let g = core.lock();
                (g.settings.clone(), g.latency_gen == gen && g.runner.is_some())
            };
            if !alive {
                return;
            }
            let listen = listen_host(&settings);
            let probe = net::request_through_proxy(&listen, settings.http_port, &settings.test_url, 8000).await;
            let mut g = core.lock();
            if g.latency_gen != gen || g.runner.is_none() {
                return;
            }
            if probe.ok {
                g.probe_failures = 0;
                g.state.latency_ms = Some(probe.ms);
                let state = g.state.clone();
                drop(g);
                let _ = core.app.emit(STATE_EVENT, &state);
            } else {
                g.probe_failures += 1;
                let failures = g.probe_failures;
                drop(g);
                core.log("warn", "connection", &format!("latency probe failed ({}/3)", failures));
                if failures >= 3 {
                    cleanup_after_failure(
                        &app2,
                        l(
                            "اتصال قطع شد — پروکسی پاسخ نمی‌دهد",
                            "Connection lost — the proxy stopped responding",
                        ),
                    )
                    .await;
                    core.toast(
                        "error",
                        l("اتصال قطع شد", "Connection dropped"),
                        Some(l(
                            "پروکسی به تست‌های پیاپی پاسخ نداد",
                            "The proxy failed repeated health checks",
                        )),
                    );
                    return;
                }
            }
        }
    });
}

/// One-shot public identity lookup through the proxy after connecting.
pub async fn refresh_identity(app: &AppHandle) {
    let Some(core) = app.try_state::<AppCore>() else { return };
    let (listen, port) = {
        let g = core.lock();
        if g.runner.is_none() {
            return;
        }
        (listen_host(&g.settings), g.settings.http_port)
    };
    if let Some(identity) = net::fetch_identity(&listen, port, 10000).await {
        let mut g = core.lock();
        if g.runner.is_none() {
            return;
        }
        g.state.identity = Some(identity);
        let state = g.state.clone();
        drop(g);
        let _ = core.app.emit(STATE_EVENT, &state);
        core.log("info", "identity", "public identity refreshed");
    }
}

/// (Re)schedule the periodic subscription refresh from settings.
pub fn schedule_auto_refresh(app: &AppHandle) {
    let Some(core) = app.try_state::<AppCore>() else { return };
    let (minutes, gen) = {
        let mut g = core.lock();
        g.refresh_gen += 1;
        (g.settings.auto_refresh_minutes, g.refresh_gen)
    };
    if minutes == 0 {
        return;
    }
    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60 * minutes as u64)).await;
            let Some(core) = app2.try_state::<AppCore>() else { return };
            let (still, ids) = {
                let g = core.lock();
                let still = g.refresh_gen == gen && g.settings.auto_refresh_minutes == minutes;
                let ids: Vec<String> = g
                    .vault
                    .subscriptions
                    .iter()
                    .filter(|s| s.file_path.is_none())
                    .map(|s| s.id.clone())
                    .collect();
                (still, ids)
            };
            if !still {
                return;
            }
            for id in ids {
                let _ = crate::subscription::refresh_one(&app2, &id).await;
            }
            core.log("info", "subscription", "auto-refresh cycle finished");
        }
    });
}

/// Close guard: warn while connected, offering to disconnect before exit.
pub fn guarded_close(app: &AppHandle) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

    let Some(core) = app.try_state::<AppCore>() else {
        app.exit(0);
        return;
    };
    let (connected, lang) = {
        let g = core.lock();
        (g.runner.is_some(), g.settings.language.clone())
    };
    if !connected {
        app.exit(0);
        return;
    }
    core.log("info", "window", "close requested while connected — showing the exit warning");
    let fa = lang == "fa";
    let (title, body, ok, cancel) = if fa {
        (
            "اتصال هنوز برقرار است!",
            "پروکسی ناکسلو فعال است. قبل از بستن برنامه آن را خاموش کنیم؟",
            "خاموش کن و ببند",
            "لغو",
        )
    } else {
        (
            "You are still connected!",
            "The Naxlo proxy is still active. Turn it off before closing?",
            "Disconnect and close",
            "Cancel",
        )
    };
    let app2 = app.clone();
    app.dialog()
        .message(body)
        .title(title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(ok.to_string(), cancel.to_string()))
        .show(move |confirmed| {
            if confirmed {
                let app3 = app2.clone();
                tauri::async_runtime::spawn(async move {
                    do_disconnect(&app3, "exit").await;
                    app3.exit(0);
                });
            }
        });
}

/// Final synchronous teardown on RunEvent::Exit.
pub fn cleanup_sync(app: &AppHandle) {
    let Some(core) = app.try_state::<AppCore>() else { return };
    let (handle, applied, base) = {
        let mut g = core.lock();
        g.stopping = true;
        (g.runner.take(), g.sysproxy_applied, core.base_dir.clone())
    };
    if let Some(handle) = handle {
        handle.stop("shutdown");
    }
    if applied {
        let _ = sysproxy::restore(&base);
    }
    core.log("info", "app", "shutdown cleanup finished");
}
