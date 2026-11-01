//! Xray process management — port of `src/main/lib/xray/runner.ts`.

use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde_json::Value;
use tauri::AppHandle;

use crate::util::rand_hex;

pub struct RunnerHandle {
    pid: u32,
    slot: Arc<Mutex<Option<Child>>>,
    config_file: PathBuf,
    stopped: Arc<AtomicBool>,
}

pub fn config_dir(base: &Path) -> PathBuf {
    base.join("xray").join("run")
}

/// Remove stale `naxlo-*.json` run configs left behind by a crash.
pub fn cleanup_stale_configs(base: &Path) {
    let dir = config_dir(base);
    let Ok(entries) = fs::read_dir(&dir) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with("naxlo-") && name.ends_with(".json") {
            let _ = fs::remove_file(entry.path());
        }
    }
}

/// Spawn `xray run -c <temp config>`; stream output into the log ring and
/// watch for an unexpected exit.
pub fn start(app: AppHandle, core_path: &Path, config: &Value, base: &Path) -> std::io::Result<RunnerHandle> {
    let dir = config_dir(base);
    fs::create_dir_all(&dir)?;
    cleanup_stale_configs(base);

    let file = dir.join(format!("naxlo-{}.json", rand_hex(6)));
    let json = serde_json::to_vec_pretty(config)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    fs::write(&file, json)?;
    crate::settings::set_owner_only(&file);

    let asset_dir = core_path.parent().unwrap_or(core_path).to_path_buf();
    let mut cmd = Command::new(core_path);
    cmd.arg("run")
        .arg("-c")
        .arg(&file)
        .env("XRAY_LOCATION_ASSET", &asset_dir)
        .env("XRAY_CONFDIR", "")
        .env("NO_COLOR", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        // Own process group so the whole tree can be signalled at once.
        unsafe {
            cmd.process_group(0);
        }
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = cmd.spawn()?;
    let pid = child.id();

    let mut pipes: Vec<Box<dyn Read + Send>> = Vec::new();
    if let Some(out) = child.stdout.take() {
        pipes.push(Box::new(out));
    }
    if let Some(err) = child.stderr.take() {
        pipes.push(Box::new(err));
    }
    for pipe in pipes {
        let app2 = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(pipe);
            for line in reader.lines().map_while(Result::ok) {
                let line = line.trim().to_string();
                if line.is_empty() {
                    continue;
                }
                crate::state::push_core_output(&app2, &line);
            }
        });
    }

    let slot = Arc::new(Mutex::new(Some(child)));
    let stopped = Arc::new(AtomicBool::new(false));
    {
        let slot = slot.clone();
        let stopped = stopped.clone();
        let cfg = file.clone();
        let app3 = app.clone();
        std::thread::spawn(move || {
            let status = loop {
                std::thread::sleep(Duration::from_millis(200));
                let mut guard = slot.lock().unwrap_or_else(|e| e.into_inner());
                let Some(child) = guard.as_mut() else { break None };
                match child.try_wait() {
                    Ok(Some(s)) => break Some(s),
                    Ok(None) => {}
                    Err(_) => break None,
                }
            };
            let _ = fs::remove_file(&cfg);
            if !stopped.load(Ordering::SeqCst) {
                if let Some(s) = status {
                    crate::manager::on_core_exited(&app3, s.code());
                }
            }
        });
    }

    Ok(RunnerHandle { pid, slot, config_file: file, stopped })
}

impl RunnerHandle {
    /// Synchronous teardown: kill the tree, reap it, delete the run config.
    pub fn stop(&self, _reason: &str) {
        self.stopped.store(true, Ordering::SeqCst);
        let taken = {
            let mut guard = self.slot.lock().unwrap_or_else(|e| e.into_inner());
            guard.take()
        };
        if let Some(mut child) = taken {
            kill_pid(self.pid, false);
            let deadline = Instant::now() + Duration::from_millis(1200);
            while Instant::now() < deadline {
                if let Ok(Some(_)) = child.try_wait() {
                    break;
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            kill_pid(self.pid, true);
            let _ = child.wait(); // reap to avoid zombies
        }
        let _ = fs::remove_file(&self.config_file);
    }

    pub fn is_alive(&self) -> bool {
        self.slot.lock().unwrap_or_else(|e| e.into_inner()).is_some()
    }
}

fn kill_pid(pid: u32, force: bool) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let _ = force; // taskkill /T /F already kills the whole tree
        let _ = Command::new("taskkill")
            .args(["/pid", &pid.to_string(), "/T", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
    #[cfg(unix)]
    {
        let signal = if force { libc::SIGKILL } else { libc::SIGTERM };
        unsafe {
            // Negative pid → the whole process group created with process_group(0).
            libc::kill(-(pid as i32), signal);
            libc::kill(pid as i32, signal);
        }
    }
    #[cfg(not(any(windows, unix)))]
    {
        let _ = (pid, force);
    }
}
