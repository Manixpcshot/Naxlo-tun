//! The shared application core: state, vault, settings, log ring and events.
//!
//! Lock discipline: every helper locks `inner` for the shortest possible
//! time, clones what it needs, drops the guard, and only then emits events
//! or performs I/O. Never hold the guard across an `.await`.

use std::collections::{HashMap, HashSet, VecDeque};
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

use tauri::{AppHandle, Emitter, Manager};

use crate::l10n::LString;
use crate::mask::mask_url;
use crate::models::{
    to_server_view, AppState, CoreLocation, CoreStatus, LastError, LogEntry, ServerView,
    SubscriptionView, Toast, UpdateState,
};
use crate::settings::Settings;
use crate::util::{file_name_of, now_ms, rand_hex};
use crate::vault::VaultPayload;

pub const STATE_EVENT: &str = "naxlo-state";
pub const LOG_EVENT: &str = "naxlo-log";
pub const TOAST_EVENT: &str = "naxlo-toast";
const LOG_CAP: usize = 500;

pub struct AppCore {
    pub app: AppHandle,
    pub base_dir: PathBuf,
    pub inner: Mutex<Core>,
}

pub struct Core {
    pub state: AppState,
    pub vault: VaultPayload,
    pub settings: Settings,
    pub core_loc: Option<CoreLocation>,
    pub runner: Option<crate::runner::RunnerHandle>,
    pub busy: bool,
    pub stopping: bool,
    pub probe_failures: u32,
    pub active_server_id: Option<String>,
    pub sysproxy_applied: bool,
    pub logs: VecDeque<LogEntry>,
    pub log_seq: u64,
    pub sub_fetching: HashMap<String, bool>,
    /// Bumped on disconnect/failure so latency timers know to exit.
    pub latency_gen: u64,
    /// Bumped when auto-refresh settings change so old timers exit.
    pub refresh_gen: u64,
}

fn build_subscription_views(vault: &VaultPayload, fetching: &HashMap<String, bool>) -> Vec<SubscriptionView> {
    vault
        .subscriptions
        .iter()
        .map(|entry| {
            let owned: Vec<&crate::models::ServerConfig> = vault
                .servers
                .iter()
                .filter(|s| s.subscription_id.as_deref() == Some(entry.id.as_str()))
                .collect();
            let total = owned.len();
            let supported = owned.iter().filter(|s| s.supported).count();
            SubscriptionView {
                id: entry.id.clone(),
                name: entry.name.clone(),
                masked_url: match &entry.file_path {
                    Some(path) => file_name_of(path),
                    None => mask_url(&entry.url),
                },
                is_file: entry.file_path.is_some(),
                updated_at: entry.updated_at,
                userinfo: entry.userinfo.clone(),
                last_error: entry.last_error.clone(),
                fetching: fetching.get(&entry.id).copied().unwrap_or(false),
                total_configs: total,
                supported_configs: supported,
            }
        })
        .collect()
}

impl AppCore {
    pub fn new(app: AppHandle, base_dir: PathBuf) -> AppCore {
        let _ = std::fs::create_dir_all(&base_dir);
        let settings = crate::settings::load(&base_dir);
        let vault = crate::vault::load(&base_dir);
        let subscriptions = build_subscription_views(&vault, &HashMap::new());
        let state = AppState {
            connection: "idle".into(),
            servers_revision: 0,
            selected_server_id: vault.selected_server_id.clone(),
            active_server_id: None,
            active_subscription_id: None,
            active_server_name: None,
            active_server_address_masked: None,
            socks_port: settings.socks_port,
            http_port: settings.http_port,
            system_proxy_enabled: settings.apply_system_proxy,
            system_proxy_applied: false,
            started_at: None,
            last_error: None,
            latency_ms: None,
            identity: None,
            update: UpdateState::default(),
            core: CoreStatus::default(),
            subscriptions,
        };
        AppCore {
            app,
            base_dir,
            inner: Mutex::new(Core {
                state,
                vault,
                settings,
                core_loc: None,
                runner: None,
                busy: false,
                stopping: false,
                probe_failures: 0,
                active_server_id: None,
                sysproxy_applied: false,
                logs: VecDeque::new(),
                log_seq: 0,
                sub_fetching: HashMap::new(),
                latency_gen: 0,
                refresh_gen: 0,
            }),
        }
    }

    /// One-time startup work: stale-config cleanup, core discovery, proxy
    /// reconciliation (off-thread — PowerShell can be slow) and auto-refresh.
    pub fn bootstrap(&self) {
        crate::runner::cleanup_stale_configs(&self.base_dir);
        self.refresh_core_status();
        let app = self.app.clone();
        std::thread::spawn(move || {
            let Some(core) = app.try_state::<AppCore>() else { return };
            let (listen, port) = {
                let g = core.lock();
                (g.settings.listen_address.clone(), g.settings.http_port)
            };
            let listen = if listen.is_empty() { "127.0.0.1".to_string() } else { listen };
            crate::sysproxy::reconcile_on_startup(&core.base_dir, &format!("{}:{}", listen, port));
        });
        crate::manager::schedule_auto_refresh(&self.app);
        self.log("info", "app", "naxlo (rust edition) started");
    }

    pub fn lock(&self) -> MutexGuard<'_, Core> {
        self.inner.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn snapshot_state(&self) -> AppState {
        self.lock().state.clone()
    }

    pub fn emit_state(&self) {
        let state = self.snapshot_state();
        let _ = self.app.emit(STATE_EVENT, &state);
    }

    pub fn patch_state<F: FnOnce(&mut AppState)>(&self, f: F) {
        let state = {
            let mut g = self.lock();
            f(&mut g.state);
            g.state.clone()
        };
        let _ = self.app.emit(STATE_EVENT, &state);
    }

    /// Mirrors `setConnection` in `src/main/lib/state.ts`.
    pub fn set_connection(&self, connection: &str, error: Option<LastError>) {
        self.patch_state(move |s| {
            s.connection = connection.to_string();
            match error {
                Some(e) => s.last_error = Some(e),
                None => {
                    if connection != "error" {
                        s.last_error = None;
                    }
                }
            }
        });
    }

    pub fn bump_servers(&self) {
        self.patch_state(|s| s.servers_revision += 1);
    }

    pub fn sync_subscriptions(&self) {
        let state = {
            let mut g = self.lock();
            g.state.subscriptions = build_subscription_views(&g.vault, &g.sub_fetching);
            g.state.clone()
        };
        let _ = self.app.emit(STATE_EVENT, &state);
    }

    pub fn set_subscription_fetching(&self, id: &str, fetching: bool) {
        {
            let mut g = self.lock();
            if fetching {
                g.sub_fetching.insert(id.to_string(), true);
            } else {
                g.sub_fetching.remove(id);
            }
        }
        self.sync_subscriptions();
    }

    pub fn patch_core<F: FnOnce(&mut CoreStatus)>(&self, f: F) {
        self.patch_state(|s| f(&mut s.core));
    }

    /// Find the core on disk and refresh `state.core` (port of `refreshCoreStatus`).
    pub fn refresh_core_status(&self) {
        let custom = { self.lock().settings.core_path.clone() };
        let found = crate::xray_core::find_core(custom.as_deref(), &self.base_dir);
        let state = {
            let mut g = self.lock();
            g.core_loc = found.clone();
            match &found {
                Some(loc) => {
                    g.state.core = CoreStatus {
                        ready: true,
                        path: Some(loc.path.to_string_lossy().into_owned()),
                        version: loc.version.clone(),
                        source: Some(loc.source.clone()),
                        downloading: false,
                        progress: None,
                        error: None,
                    };
                    if g.state.connection == "core-missing" {
                        g.state.connection = "idle".into();
                    }
                }
                None => {
                    g.state.core = CoreStatus {
                        ready: false,
                        path: None,
                        version: None,
                        source: None,
                        downloading: g.state.core.downloading,
                        progress: g.state.core.progress,
                        error: g.state.core.error.clone(),
                    };
                    if g.state.connection != "connected" {
                        g.state.connection = "core-missing".into();
                    }
                }
            }
            g.state.clone()
        };
        let _ = self.app.emit(STATE_EVENT, &state);
    }

    fn level_passes(level: &str, setting: &str) -> bool {
        if level == "core" || level == "error" {
            return true;
        }
        let order = |l: &str| match l {
            "error" => 0,
            "warn" => 1,
            "info" => 2,
            "debug" => 3,
            _ => -1, // "none" and unknown settings
        };
        let entry = order(level);
        let threshold = order(setting);
        threshold >= 0 && entry <= threshold
    }

    pub fn log(&self, level: &str, scope: &str, message: &str) {
        let entry = {
            let mut g = self.lock();
            if !Self::level_passes(level, &g.settings.log_level) {
                return;
            }
            g.log_seq += 1;
            let entry = LogEntry {
                id: g.log_seq,
                at: now_ms(),
                level: level.to_string(),
                scope: scope.to_string(),
                // Xray's own config masks addresses ("maskAddress": "quarter"),
                // and we never log subscription URLs or credentials.
                message: message.to_string(),
            };
            g.logs.push_back(entry.clone());
            while g.logs.len() > LOG_CAP {
                g.logs.pop_front();
            }
            entry
        };
        let _ = self.app.emit(LOG_EVENT, &entry);
    }

    pub fn logs_snapshot(&self) -> Vec<LogEntry> {
        self.lock().logs.iter().cloned().collect()
    }

    pub fn clear_logs(&self) {
        self.lock().logs.clear();
    }

    pub fn toast(&self, kind: &str, title: LString, message: Option<LString>) {
        let toast = Toast {
            id: format!("{}-{}", now_ms(), rand_hex(3)),
            kind: kind.to_string(),
            title: title.into(),
            message: message.map(Into::into),
        };
        let _ = self.app.emit(TOAST_EVENT, &toast);
    }

    pub fn save_vault(&self) {
        let payload = { self.lock().vault.clone() };
        if let Err(e) = crate::vault::save(&self.base_dir, &payload) {
            self.log("error", "vault", &format!("vault persistence failed: {}", e));
        }
    }

    pub fn save_settings_now(&self) {
        let settings = { self.lock().settings.clone() };
        crate::settings::save(&self.base_dir, &settings);
    }

    pub fn server_views(&self, reveal: bool) -> Vec<ServerView> {
        let g = self.lock();
        let pinned: HashSet<&str> = g.vault.pinned.iter().map(String::as_str).collect();
        g.vault
            .servers
            .iter()
            .map(|s| to_server_view(s, reveal, pinned.contains(s.id.as_str())))
            .collect()
    }

    /// Store a latency measurement in the vault (port of `storeLatency`).
    pub fn store_latency(&self, id: &str, ms: Option<u64>) {
        {
            let mut g = self.lock();
            if let Some(server) = g.vault.servers.iter_mut().find(|s| s.id == id) {
                server.latency_ms = ms;
                server.latency_at = if ms.is_some() { Some(now_ms()) } else { server.latency_at };
            }
        }
        self.save_vault();
    }

    pub fn is_connected(&self) -> bool {
        self.lock().runner.is_some()
    }
}

/// Called from the runner's output threads.
pub fn push_core_output(app: &AppHandle, line: &str) {
    let Some(core) = app.try_state::<AppCore>() else { return };
    core.log("core", "xray:runner", line);
    if crate::util::contains_ignore_case(line, &["failed", "error", "panic"]) {
        core.log("warn", "xray:out", line);
    }
}
