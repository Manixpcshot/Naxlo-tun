//! Naxlo — Rust (Tauri) edition.
//!
//! Lean scope: the same React UI as the Electron app, backed by Rust
//! commands. Subscriptions, server lists, local-proxy connect/disconnect,
//! settings, the encrypted vault and trilingual errors all mirror the
//! Electron main process; TUN mode, tray, auto-start, self-update and
//! file import are Electron-only for now.

mod commands;
mod ids;
mod l10n;
mod manager;
mod mask;
mod models;
mod net;
mod parse;
mod runner;
mod settings;
mod state;
mod submeta;
mod subscription;
mod sysproxy;
mod util;
mod vault;
mod xray_config;
mod xray_core;

use state::AppCore;
use tauri::{Manager, WindowEvent};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let base_dir = app.path().app_data_dir()?;
            let core = AppCore::new(handle, base_dir);
            app.manage(core);
            let core = app.state::<AppCore>();
            core.bootstrap();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_state,
            commands::app_info,
            commands::app_check_update,
            commands::app_install_update,
            commands::app_is_admin,
            commands::app_relaunch_elevated,
            commands::app_exit,
            commands::servers_list,
            commands::servers_reveal,
            commands::servers_select,
            commands::servers_remove,
            commands::servers_clear,
            commands::servers_pin,
            commands::servers_test,
            commands::servers_test_all,
            commands::servers_latency,
            commands::clipboard_write_link,
            commands::panic_disconnect,
            commands::subscription_save,
            commands::subscription_refresh,
            commands::subscription_remove,
            commands::subscription_reveal,
            commands::subscription_clear,
            commands::subscription_import_file,
            commands::speed_test,
            commands::connect,
            commands::disconnect,
            commands::settings_get,
            commands::settings_set,
            commands::core_ensure,
            commands::core_pick,
            commands::core_check_update,
            commands::logs_get,
            commands::logs_clear,
            commands::window_minimize,
            commands::window_toggle_maximize,
            commands::window_close,
            commands::shell_open
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    // Mirror the Electron exit-warning: never close silently
                    // while the proxy is running.
                    api.prevent_close();
                    let handle = window.app_handle().clone();
                    std::thread::spawn(move || manager::guarded_close(&handle));
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building naxlo")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                manager::cleanup_sync(app_handle);
            }
        });
}
