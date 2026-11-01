//! Settings persistence — mirrors `src/main/lib/settings.ts`.
//! Values are non-secret; anything identifying lives in the encrypted vault.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub socks_port: u16,
    pub http_port: u16,
    pub listen_address: String,
    pub apply_system_proxy: bool,
    /// The Rust edition always runs in proxy mode; the field is kept for shape parity.
    pub connection_mode: String,
    pub route_mode: String,
    pub block_ads: bool,
    pub mux_enabled: bool,
    pub mux_concurrency: u32,
    pub allow_insecure: bool,
    pub test_url: String,
    pub auto_start: bool,
    pub auto_update: bool,
    pub auto_refresh_minutes: u32,
    pub auto_connect_last: bool,
    pub minimize_to_tray: bool,
    pub auto_failover: bool,
    pub log_level: String,
    pub accent: String,
    pub reduce_motion: bool,
    pub core_path: Option<String>,
    pub xray_log_level: String,
    pub language: String,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            socks_port: 10808,
            http_port: 10809,
            listen_address: "127.0.0.1".into(),
            apply_system_proxy: true,
            connection_mode: "proxy".into(),
            route_mode: "all-proxy".into(),
            block_ads: false,
            mux_enabled: false,
            mux_concurrency: 8,
            allow_insecure: false,
            test_url: "https://www.gstatic.com/generate_204".into(),
            auto_start: false,
            auto_update: true,
            auto_refresh_minutes: 0,
            auto_connect_last: false,
            minimize_to_tray: true,
            auto_failover: true,
            log_level: "info".into(),
            accent: "cyan".into(),
            reduce_motion: false,
            core_path: None,
            xray_log_level: "warning".into(),
            language: "fa".into(),
        }
    }
}

fn file(dir: &Path) -> std::path::PathBuf {
    dir.join("settings.json")
}

pub fn load(dir: &Path) -> Settings {
    match fs::read_to_string(file(dir)) {
        Ok(raw) => match serde_json::from_str::<serde_json::Value>(&raw) {
            Ok(value) => serde_json::from_value::<Settings>(value).unwrap_or_default(),
            Err(_) => Settings::default(),
        },
        Err(_) => {
            let settings = Settings::default();
            save(dir, &settings);
            settings
        }
    }
}

pub fn save(dir: &Path, settings: &Settings) {
    let _ = fs::create_dir_all(dir);
    let target = file(dir);
    let tmp = target.with_extension("json.tmp");
    let json = match serde_json::to_string_pretty(settings) {
        Ok(j) => j,
        Err(_) => return,
    };
    if fs::write(&tmp, json).is_err() {
        return;
    }
    set_owner_only(&tmp);
    let _ = fs::rename(&tmp, &target);
}

/// Merge a partial JSON patch into the current settings (unknown keys ignored).
pub fn merge_patch(current: &Settings, patch: serde_json::Value) -> Settings {
    let mut base = match serde_json::to_value(current) {
        Ok(v) => v,
        Err(_) => return current.clone(),
    };
    merge_json(&mut base, patch);
    serde_json::from_value::<Settings>(base).unwrap_or_else(|_| current.clone())
}

fn merge_json(base: &mut serde_json::Value, patch: serde_json::Value) {
    match (base, patch) {
        (serde_json::Value::Object(base_map), serde_json::Value::Object(patch_map)) => {
            for (key, value) in patch_map {
                merge_json(base_map.entry(key).or_insert(serde_json::Value::Null), value);
            }
        }
        (base_slot, patch) => *base_slot = patch,
    }
}

pub fn set_owner_only(path: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
}
