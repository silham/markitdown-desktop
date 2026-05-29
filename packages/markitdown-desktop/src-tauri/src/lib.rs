use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

// ---------------------------------------------------------------------------
// Sidecar state
// ---------------------------------------------------------------------------

pub struct SidecarState {
    pub port: Mutex<Option<u16>>,
    pub child: Mutex<Option<Child>>,
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Returns the sidecar port so the frontend can build the base URL.
#[tauri::command]
fn get_sidecar_port(state: State<SidecarState>) -> Option<u16> {
    *state.port.lock().unwrap()
}

// ---------------------------------------------------------------------------
// Sidecar launcher
// ---------------------------------------------------------------------------

fn start_sidecar(app: &AppHandle) -> Result<(), String> {
    // In a packaged/installed app the PyInstaller sidecar sits next to the
    // main executable.  In dev we fall back to running server.py via the
    // local .venv so `pnpm tauri dev` keeps working without a build step.
    let sidecar_name = if cfg!(target_os = "windows") {
        "markitdown-sidecar.exe"
    } else {
        "markitdown-sidecar"
    };

    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Cannot locate current exe: {e}"))?
        .parent()
        .ok_or("Cannot get exe parent directory")?
        .to_path_buf();

    let production_sidecar = exe_dir.join(sidecar_name);

    let mut cmd = if production_sidecar.exists() {
        // ── Production: run the bundled PyInstaller binary ────────────────
        let mut c = Command::new(&production_sidecar);
        c.stdout(Stdio::piped());
        c.stderr(Stdio::inherit());
        c
    } else {
        // ── Dev: run server.py via the python-backend .venv ───────────────
        let manifest = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let raw = manifest.join("../python-backend");
        let backend_dir = std::fs::canonicalize(&raw)
            .map_err(|e| format!("Cannot resolve backend dir '{}': {e}", raw.display()))?;

        let python = if cfg!(target_os = "windows") {
            backend_dir.join(".venv/Scripts/python.exe")
        } else {
            backend_dir.join(".venv/bin/python")
        };

        let mut c = Command::new(&python);
        c.arg(backend_dir.join("server.py"));
        c.stdout(Stdio::piped());
        c.stderr(Stdio::inherit());
        c.current_dir(&backend_dir);
        c
    };

    let mut child = cmd.spawn().map_err(|e| {
        format!("Failed to start sidecar: {e}")
    })?;

    // Read the port from the first stdout line: "SIDECAR_PORT=XXXX"
    let port = {
        let stdout = child.stdout.take().ok_or("No stdout from sidecar")?;
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        reader.read_line(&mut line).map_err(|e| e.to_string())?;
        parse_port(&line)?
    };

    let state = app.state::<SidecarState>();
    *state.port.lock().unwrap() = Some(port);
    *state.child.lock().unwrap() = Some(child);

    // Notify the webview
    app.emit("sidecar-port", port).ok();
    Ok(())
}

fn parse_port(line: &str) -> Result<u16, String> {
    let line = line.trim();
    if let Some(rest) = line.strip_prefix("SIDECAR_PORT=") {
        rest.parse::<u16>()
            .map_err(|e| format!("Invalid port '{rest}': {e}"))
    } else {
        Err(format!("Unexpected sidecar output: {line}"))
    }
}

// ---------------------------------------------------------------------------
// App entry
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(SidecarState {
            port: Mutex::new(None),
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![get_sidecar_port])
        .setup(|app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Err(e) = start_sidecar(&handle) {
                    eprintln!("Sidecar start error: {e}");
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
