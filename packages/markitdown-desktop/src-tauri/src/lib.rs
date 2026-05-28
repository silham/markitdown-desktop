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
    // Resolve the python-backend directory relative to src-tauri at dev time,
    // or relative to the resource dir at runtime.
    let backend_dir = {
        let manifest = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let raw = manifest.join("../python-backend");
        std::fs::canonicalize(&raw)
            .map_err(|e| format!("Cannot resolve backend dir '{}': {e}", raw.display()))?
    };

    let python = if cfg!(target_os = "windows") {
        backend_dir.join(".venv/Scripts/python.exe")
    } else {
        backend_dir.join(".venv/bin/python")
    };

    let mut cmd = Command::new(&python);
    cmd.arg(backend_dir.join("server.py"));
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::inherit());
    cmd.current_dir(&backend_dir);

    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to start Python sidecar at '{}': {e}",
            python.display()
        )
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
