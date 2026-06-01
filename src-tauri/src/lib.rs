mod db;
mod pty;

use pty::{
    PlatformPtyBackend, PtyBackend, PtyBackendStatus, PtyError, PtyOutput, PtySessionId, PtySize,
    ShellProfile, ShellProfileKind,
};
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State};

struct PtyState {
    backend: Arc<dyn PtyBackend>,
}

const GITHUB_OWNER: &str = "devjuliusotto";
const GITHUB_REPO: &str = "cortex";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PtyDataEvent {
    session_id: PtySessionId,
    data: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PtyExitEvent {
    session_id: PtySessionId,
    code: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PtyErrorEvent {
    session_id: PtySessionId,
    error: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ValidatedWorkingDirectory {
    cwd: Option<String>,
    warning: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitMetadata {
    branch: Option<String>,
    dirty: bool,
    ahead: Option<u32>,
    behind: Option<u32>,
    latest_commit: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalPort {
    port: u16,
    protocol: String,
}

fn create_pty_state(app: AppHandle) -> PtyState {
    let backend = PlatformPtyBackend::new(move |session_id, output| match output {
        PtyOutput::Data(data) => {
            let _ = app.emit("pty-output", PtyDataEvent { session_id, data });
        }
        PtyOutput::Exit { code } => {
            let _ = app.emit("pty-exit", PtyExitEvent { session_id, code });
        }
        PtyOutput::Error(error) => {
            let _ = app.emit("pty-error", PtyErrorEvent { session_id, error });
        }
    });

    PtyState {
        backend: Arc::new(backend),
    }
}

fn pty_error(error: PtyError) -> String {
    error.to_string()
}

fn is_allowed_external_url(url: &str) -> bool {
    url.starts_with("https://") || url.starts_with("http://")
}

fn app_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("cortex-state.json"))
        .map_err(|error| error.to_string())
}

fn normalize_persisted_state(mut state: Value) -> Value {
    if let Some(sessions) = state.get_mut("sessions").and_then(Value::as_array_mut) {
        for session in sessions {
            if let Some(status) = session.get_mut("status") {
                *status = Value::String("inactive".into());
            }
        }
    }

    state
}

fn restore_window_state(app: &AppHandle) {
    let Ok(path) = app_state_path(app) else {
        return;
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return;
    };
    let Ok(state) = serde_json::from_str::<Value>(&raw) else {
        return;
    };
    let Some(window_state) = state.get("windowState") else {
        return;
    };
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    if let (Some(width), Some(height)) = (
        window_state.get("width").and_then(Value::as_u64),
        window_state.get("height").and_then(Value::as_u64),
    ) {
        let _ = window.set_size(PhysicalSize::new(width as u32, height as u32));
    }

    if let (Some(x), Some(y)) = (
        window_state.get("x").and_then(Value::as_i64),
        window_state.get("y").and_then(Value::as_i64),
    ) {
        let _ = window.set_position(PhysicalPosition::new(x as i32, y as i32));
    }

    if window_state
        .get("maximized")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        let _ = window.maximize();
    }
}

#[tauri::command]
fn list_shell_profiles() -> Vec<ShellProfile> {
    vec![
        ShellProfile::new(ShellProfileKind::PowerShell),
        ShellProfile::new(ShellProfileKind::Cmd),
        ShellProfile::new(ShellProfileKind::Wsl),
    ]
}

#[tauri::command]
fn pty_backend_status() -> PtyBackendStatus {
    PtyBackendStatus::current()
}

#[tauri::command]
fn load_persisted_state(app: AppHandle) -> Result<Option<Value>, String> {
    let path = app_state_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let state = serde_json::from_str::<Value>(&raw).map_err(|error| error.to_string())?;
    Ok(Some(normalize_persisted_state(state)))
}

#[tauri::command]
fn save_persisted_state(app: AppHandle, state: Value) -> Result<(), String> {
    let path = app_state_path(&app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "App data path has no parent directory".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let state = normalize_persisted_state(state);
    let raw = serde_json::to_string_pretty(&state).map_err(|error| error.to_string())?;
    fs::write(path, raw).map_err(|error| error.to_string())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    if !is_allowed_external_url(&url) {
        return Err("Only Cortex GitHub issue URLs can be opened from this action".into());
    }

    #[cfg(windows)]
    {
        std::process::Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", &url])
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Opening external URLs is not supported on this platform".into())
}

#[tauri::command]
fn read_clipboard_text() -> Result<String, String> {
    #[cfg(windows)]
    {
        let output = std::process::Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-Command",
                "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); [Console]::Out.Write((Get-Clipboard -Raw))",
            ])
            .output()
            .map_err(|error| error.to_string())?;

        if output.status.success() {
            return String::from_utf8(output.stdout).map_err(|error| error.to_string());
        }

        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if error.is_empty() {
            "Clipboard text could not be read".into()
        } else {
            error
        });
    }

    #[cfg(not(windows))]
    {
        Ok(String::new())
    }
}

#[tauri::command]
fn write_clipboard_text(text: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        let mut child = std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-Command", "Set-Clipboard -Value ([Console]::In.ReadToEnd())"])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|error| error.to_string())?;

        if let Some(mut stdin) = child.stdin.take() {
            use std::io::Write;
            stdin
                .write_all(text.as_bytes())
                .map_err(|error| error.to_string())?;
        }

        let output = child.wait_with_output().map_err(|error| error.to_string())?;
        if output.status.success() {
            return Ok(());
        }

        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if error.is_empty() {
            "Clipboard text could not be written".into()
        } else {
            error
        });
    }

    #[cfg(not(windows))]
    {
        let _ = text;
        Ok(())
    }
}

fn run_command_output(program: &str, args: &[&str]) -> Result<String, String> {
    let output = std::process::Command::new(program)
        .args(args)
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
fn get_git_metadata(path: String) -> Result<Option<GitMetadata>, String> {
    let clean_path = path.trim();
    if clean_path.is_empty() || !Path::new(clean_path).is_dir() {
        return Ok(None);
    }

    let git_dir = run_command_output("git", &["-C", clean_path, "rev-parse", "--git-dir"]);
    if git_dir.is_err() {
        return Ok(None);
    }

    let branch = run_command_output("git", &["-C", clean_path, "branch", "--show-current"])
        .ok()
        .filter(|value| !value.is_empty())
        .or_else(|| {
            run_command_output("git", &["-C", clean_path, "rev-parse", "--short", "HEAD"])
                .ok()
                .filter(|value| !value.is_empty())
        });
    let status = run_command_output("git", &["-C", clean_path, "status", "--porcelain"]).unwrap_or_default();
    let latest_commit = run_command_output(
        "git",
        &["-C", clean_path, "log", "-1", "--pretty=format:%h %s"],
    )
    .ok()
    .filter(|value| !value.is_empty());

    let ahead_behind = run_command_output(
        "git",
        &["-C", clean_path, "rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    )
    .ok();
    let (ahead, behind) = ahead_behind
        .as_deref()
        .and_then(|value| {
            let mut parts = value.split_whitespace();
            let ahead = parts.next()?.parse::<u32>().ok()?;
            let behind = parts.next()?.parse::<u32>().ok()?;
            Some((Some(ahead), Some(behind)))
        })
        .unwrap_or((None, None));

    Ok(Some(GitMetadata {
        branch,
        dirty: !status.is_empty(),
        ahead,
        behind,
        latest_commit,
    }))
}

#[tauri::command]
fn get_local_ports() -> Result<Vec<LocalPort>, String> {
    let raw = if cfg!(windows) {
        run_command_output("netstat", &["-ano", "-p", "TCP"]).unwrap_or_default()
    } else {
        run_command_output("ss", &["-ltn"]).unwrap_or_default()
    };

    let common_ports = [1420_u16, 5173, 3000, 3001, 4173, 5174, 8080, 8000, 5000];
    let mut ports = Vec::new();
    for line in raw.lines() {
        let lower = line.to_ascii_lowercase();
        if !(lower.contains("listen") || lower.contains("listening")) {
            continue;
        }
        for token in line.split_whitespace() {
            let Some(port_text) = token.rsplit(':').next() else {
                continue;
            };
            let Ok(port) = port_text.parse::<u16>() else {
                continue;
            };
            if common_ports.contains(&port) && !ports.iter().any(|item: &LocalPort| item.port == port) {
                ports.push(LocalPort {
                    port,
                    protocol: "tcp".into(),
                });
            }
        }
    }

    ports.sort_by_key(|item| item.port);
    Ok(ports)
}

fn home_dir() -> Option<String> {
    std::env::var("USERPROFILE")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| std::env::var("HOME").ok())
}

fn fallback_working_directory(profile_id: &str) -> Option<String> {
    let home = home_dir()?;
    if profile_id.starts_with("wsl") && is_windows_absolute_path(&home) {
        return windows_path_to_wsl_path(&home);
    }

    Some(home)
}

fn is_windows_absolute_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 3 && bytes[1] == b':' && (bytes[2] == b'\\' || bytes[2] == b'/')
}

fn windows_path_to_wsl_path(path: &str) -> Option<String> {
    if !is_windows_absolute_path(path) {
        return None;
    }

    let mut chars = path.chars();
    let drive = chars.next()?.to_ascii_lowercase();
    chars.next()?;
    chars.next()?;

    let rest = chars
        .as_str()
        .replace('\\', "/")
        .trim_start_matches('/')
        .to_string();

    if rest.is_empty() {
        Some(format!("/mnt/{drive}"))
    } else {
        Some(format!("/mnt/{drive}/{rest}"))
    }
}

fn wsl_mount_path_to_windows_path(path: &str) -> Option<String> {
    let normalized = path.replace('\\', "/");
    let mut parts = normalized.split('/');
    if parts.next()? != "" || parts.next()? != "mnt" {
        return None;
    }

    let drive = parts.next()?;
    if drive.len() != 1 || !drive.as_bytes()[0].is_ascii_alphabetic() {
        return None;
    }

    let rest = parts.collect::<Vec<_>>().join("\\");
    if rest.is_empty() {
        Some(format!("{}:\\", drive.to_ascii_uppercase()))
    } else {
        Some(format!("{}:\\{rest}", drive.to_ascii_uppercase()))
    }
}

fn resolve_working_directory(profile_id: &str, cwd: Option<String>) -> ValidatedWorkingDirectory {
    let Some(raw_cwd) = cwd
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    else {
        return ValidatedWorkingDirectory {
            cwd: fallback_working_directory(profile_id),
            warning: None,
        };
    };

    if profile_id.starts_with("wsl") {
        if is_windows_absolute_path(&raw_cwd) {
            if Path::new(&raw_cwd).is_dir() {
                return ValidatedWorkingDirectory {
                    cwd: windows_path_to_wsl_path(&raw_cwd),
                    warning: None,
                };
            }

            return ValidatedWorkingDirectory {
                cwd: fallback_working_directory(profile_id),
                warning: Some(format!(
                    "Default working directory was not found, so this WSL terminal started in its home directory: {raw_cwd}"
                )),
            };
        }

        if let Some(windows_path) = wsl_mount_path_to_windows_path(&raw_cwd) {
            if Path::new(&windows_path).is_dir() {
                return ValidatedWorkingDirectory {
                    cwd: Some(raw_cwd),
                    warning: None,
                };
            }
        }

        return ValidatedWorkingDirectory {
            cwd: fallback_working_directory(profile_id),
            warning: Some(format!(
                "WSL working directory could not be validated, so this terminal started in its home directory: {raw_cwd}"
            )),
        };
    }

    if Path::new(&raw_cwd).is_dir() {
        return ValidatedWorkingDirectory {
            cwd: Some(raw_cwd),
            warning: None,
        };
    }

    ValidatedWorkingDirectory {
        cwd: fallback_working_directory(profile_id),
        warning: Some(format!(
            "Default working directory was not found, so this terminal started in your home directory: {raw_cwd}"
        )),
    }
}

#[tauri::command]
fn validate_working_directory(
    profile_id: String,
    cwd: Option<String>,
) -> Result<ValidatedWorkingDirectory, String> {
    Ok(resolve_working_directory(&profile_id, cwd))
}

#[tauri::command]
fn spawn_terminal(
    state: State<'_, PtyState>,
    profile_id: String,
    cwd: Option<String>,
    rows: u16,
    cols: u16,
) -> Result<PtySessionId, String> {
    let profile = ShellProfile::from_id(&profile_id)
        .ok_or_else(|| format!("Unknown shell profile: {profile_id}"))?;
    let working_directory = resolve_working_directory(&profile_id, cwd);
    state
        .backend
        .spawn(profile, working_directory.cwd, PtySize { rows, cols })
        .map_err(pty_error)
}

#[cfg(test)]
mod tests {
    use super::{windows_path_to_wsl_path, wsl_mount_path_to_windows_path};

    #[test]
    fn converts_windows_paths_to_wsl_paths() {
        assert_eq!(
            windows_path_to_wsl_path(r"C:\Users\Name\Projects\Test"),
            Some("/mnt/c/Users/Name/Projects/Test".into())
        );
        assert_eq!(
            windows_path_to_wsl_path(r"C:\Users\Name\OneDrive - Org\Projects\Test"),
            Some("/mnt/c/Users/Name/OneDrive - Org/Projects/Test".into())
        );
    }

    #[test]
    fn converts_wsl_mount_paths_to_windows_paths() {
        assert_eq!(
            wsl_mount_path_to_windows_path("/mnt/c/Users/Name/Projects/Test"),
            Some(r"C:\Users\Name\Projects\Test".into())
        );
        assert_eq!(
            wsl_mount_path_to_windows_path("/mnt/c/Users/Name/OneDrive - Org/Projects/Test"),
            Some(r"C:\Users\Name\OneDrive - Org\Projects\Test".into())
        );
        assert_eq!(wsl_mount_path_to_windows_path("/home/name/project"), None);
    }
}

#[tauri::command]
fn write_terminal(
    state: State<'_, PtyState>,
    session_id: PtySessionId,
    data: String,
) -> Result<(), String> {
    state
        .backend
        .write(session_id, data.as_bytes())
        .map_err(pty_error)
}

#[tauri::command]
fn resize_terminal(
    state: State<'_, PtyState>,
    session_id: PtySessionId,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    state
        .backend
        .resize(session_id, PtySize { rows, cols })
        .map_err(pty_error)
}

#[tauri::command]
fn terminate_terminal(state: State<'_, PtyState>, session_id: PtySessionId) -> Result<(), String> {
    match state.backend.terminate(session_id) {
        Ok(()) | Err(PtyError::SessionNotFound) => Ok(()),
        Err(error) => Err(pty_error(error)),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            list_shell_profiles,
            pty_backend_status,
            load_persisted_state,
            save_persisted_state,
            open_external_url,
            get_git_metadata,
            get_local_ports,
            read_clipboard_text,
            write_clipboard_text,
            validate_working_directory,
            spawn_terminal,
            write_terminal,
            resize_terminal,
            terminate_terminal
        ])
        .setup(|app| {
            db::prepare_app_storage(app)?;
            app.manage(create_pty_state(app.handle().clone()));
            restore_window_state(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Cortex");
}
