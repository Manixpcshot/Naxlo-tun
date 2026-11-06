//! System tray — port of the Electron `tray.ts`.
//!
//! Shows the connection state, quick connect/disconnect actions, an
//! "open" item and a guarded quit. `refresh` is called from
//! `AppCore::emit_state` so the menu/tooltip always match the app state.

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Manager};

use crate::manager;
use crate::state::AppCore;

pub const TRAY_ID: &str = "naxlo-tray";

fn is_fa(app: &AppHandle) -> bool {
    app.try_state::<AppCore>()
        .map(|core| core.lock().settings.language == "fa")
        .unwrap_or(false)
}

fn labels(app: &AppHandle) -> Vec<&'static str> {
    if is_fa(app) {
        vec![
            "وضعیت",
            "متصل شو",
            "قطع کن",
            "باز کردن naxlo",
            "خروج",
        ]
    } else {
        vec!["Status", "Connect", "Disconnect", "Open naxlo", "Quit"]
    }
}

fn build_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let t = labels(app);
    let (connected, active_name) = app
        .try_state::<AppCore>()
        .map(|core| {
            let g = core.lock();
            (g.runner.is_some(), g.state.active_server_name.clone())
        })
        .unwrap_or((false, None));
    let status_text = if connected {
        match active_name {
            Some(name) => format!("{} — {}", t[0], name),
            None => t[0].to_string(),
        }
    } else {
        t[0].to_string()
    };
    MenuBuilder::new(app)
        .item(
            &MenuItemBuilder::with_id("state", status_text)
                .enabled(false)
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("connect", t[1])
                .enabled(!connected)
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("disconnect", t[2])
                .enabled(connected)
                .build(app)?,
        )
        .separator()
        .item(&MenuItemBuilder::with_id("open", t[3]).build(app)?)
        .item(&MenuItemBuilder::with_id("quit", t[4]).build(app)?)
        .build()
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Create the tray icon (called once from `setup`).
pub fn init(app: &App) -> tauri::Result<()> {
    let menu = build_menu(app.handle())?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))?)
        .icon_as_template(false)
        .tooltip("naxlo")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "open" => show_main_window(app),
                "connect" => {
                    let handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = manager::do_connect(&handle, None).await;
                    });
                }
                "disconnect" => {
                    let handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        manager::do_disconnect(&handle, "tray").await;
                    });
                }
                "quit" => {
                    // Same guard as the window close button.
                    let handle = app.clone();
                    std::thread::spawn(move || manager::guarded_close(&handle, false));
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

/// Rebuild the tray menu + tooltip from the current state.
pub fn refresh(app: &AppHandle) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else { return };
    if let Ok(menu) = build_menu(app) {
        let _ = tray.set_menu(Some(menu));
    }
    let fa = is_fa(app);
    let connected = app
        .try_state::<AppCore>()
        .map(|core| core.lock().runner.is_some())
        .unwrap_or(false);
    let status = if connected {
        if fa { "متصل" } else { "Connected" }
    } else {
        if fa { "قطع" } else { "Not connected" }
    };
    let _ = tray.set_tooltip(Some(&format!("naxlo — {}", status)));
}
