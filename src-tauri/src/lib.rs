mod db;
mod pty;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use pty::{
    PlatformPtyBackend, PtyBackend, PtyBackendStatus, PtyError, PtyOutput, PtySessionId, PtySize,
    ShellProfile, ShellProfileKind,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

struct PtyState {
    backend: Arc<dyn PtyBackend>,
}

struct GitWatchState {
    watchers: Mutex<HashMap<String, GitWatchEntry>>,
}

struct GitWatchEntry {
    _watcher: RecommendedWatcher,
    subscribers: usize,
}

const GITHUB_OWNER: &str = "devjuliusotto";
const GITHUB_REPO: &str = "cortex";

const GIT_WATCH_EVENT: &str = "git-working-tree-changed";

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
struct GitBranchInfo {
    name: String,
    is_current: bool,
    is_remote: bool,
    upstream: Option<String>,
    last_commit: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitCommitInfo {
    hash: String,
    short_hash: String,
    message: String,
    author: String,
    date: String,
    files: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitOverview {
    is_repo: bool,
    root: Option<String>,
    current_branch: Option<String>,
    remote_name: Option<String>,
    remote_url: Option<String>,
    clean: bool,
    modified_count: usize,
    staged_count: usize,
    untracked_count: usize,
    ahead: u32,
    behind: u32,
    latest_commit: Option<GitCommitInfo>,
    refreshed_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitFileChange {
    path: String,
    original_path: Option<String>,
    status: String,
    staged: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitStatusSnapshot {
    is_repo: bool,
    root: Option<String>,
    files: Vec<GitFileChange>,
    staged_count: usize,
    modified_count: usize,
    untracked_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitBranchesSnapshot {
    is_repo: bool,
    current_branch: Option<String>,
    dirty: bool,
    local: Vec<GitBranchInfo>,
    remote: Vec<GitBranchInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitReleaseInfo {
    is_repo: bool,
    current_branch: Option<String>,
    clean: bool,
    package_version: Option<String>,
    tauri_version: Option<String>,
    cargo_version: Option<String>,
    latest_tag: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitReleaseOptions {
    update_package_json: bool,
    update_tauri_conf: bool,
    update_cargo_toml: bool,
    commit_changes: bool,
    create_git_tag: bool,
    push_branch: bool,
    push_tag: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitWatchEvent {
    root: String,
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

fn create_git_watch_state() -> GitWatchState {
    GitWatchState {
        watchers: Mutex::new(HashMap::new()),
    }
}

fn pty_error(error: PtyError) -> String {
    error.to_string()
}

fn is_allowed_external_url(url: &str) -> bool {
    if url.starts_with(&format!(
        "https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/issues/new"
    )) {
        return true;
    }

    let Some(without_scheme) = url
        .strip_prefix("http://")
        .or_else(|| url.strip_prefix("https://"))
    else {
        return false;
    };
    let authority = without_scheme.split(['/', '?', '#']).next().unwrap_or_default();
    let host = if let Some(rest) = authority.strip_prefix('[') {
        rest.split(']').next().unwrap_or_default()
    } else {
        authority.split(':').next().unwrap_or_default()
    };

    matches!(host, "localhost" | "127.0.0.1" | "::1")
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

fn now_unix_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn workspace_path(path: String) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Workspace path is empty.".to_string());
    }
    let path = PathBuf::from(trimmed);
    path.canonicalize()
        .map_err(|_| format!("Workspace path was not found: {trimmed}"))
}

fn run_git_internal(cwd: &Path, args: &[String], timeout: Duration) -> Result<String, String> {
    let mut command = Command::new("git");
    command
        .args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command.spawn().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            "Git executable was not found in PATH.".to_string()
        } else {
            error.to_string()
        }
    })?;

    let started = SystemTime::now();
    loop {
        match child.try_wait().map_err(|error| error.to_string())? {
            Some(_) => break,
            None => {
                if started.elapsed().unwrap_or_default() > timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!("Git operation timed out: git {}", args.join(" ")));
                }
                thread::sleep(Duration::from_millis(25));
            }
        }
    }

    let output = child.wait_with_output().map_err(|error| error.to_string())?;
    if output.status.success() {
        return String::from_utf8(output.stdout).map_err(|error| error.to_string());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        format!("git {} failed", args.join(" "))
    } else {
        stderr
    })
}

fn git_panel_command(cwd: &Path, args: &[&str]) -> Result<String, String> {
    let owned_args = args.iter().map(|value| value.to_string()).collect::<Vec<_>>();
    run_git_internal(cwd, &owned_args, Duration::from_secs(20))
}

fn git_panel_command_owned(cwd: &Path, args: Vec<String>) -> Result<String, String> {
    run_git_internal(cwd, &args, Duration::from_secs(20))
}

fn git_panel_root(workspace: &Path) -> Result<PathBuf, String> {
    let root = git_panel_command(workspace, &["rev-parse", "--show-toplevel"])?;
    Ok(PathBuf::from(root.trim()).canonicalize().unwrap_or_else(|_| PathBuf::from(root.trim())))
}

fn optional_git_panel_command(cwd: &Path, args: &[&str]) -> Option<String> {
    git_panel_command(cwd, args)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn parse_git_status(status: &str) -> Vec<GitFileChange> {
    status
        .lines()
        .filter_map(|line| {
            if line.len() < 3 {
                return None;
            }

            let mut chars = line.chars();
            let x = chars.next().unwrap_or(' ');
            let y = chars.next().unwrap_or(' ');
            let raw_path = line.get(3..).unwrap_or_default().trim();
            if raw_path.is_empty() {
                return None;
            }

            let (path, original_path) = if let Some((old_path, new_path)) = raw_path.split_once(" -> ") {
                (new_path.to_string(), Some(old_path.to_string()))
            } else {
                (raw_path.to_string(), None)
            };

            let status = if x == '?' && y == '?' {
                "Untracked"
            } else if x == 'R' || y == 'R' {
                "Renamed"
            } else if x == 'D' || y == 'D' {
                "Deleted"
            } else if x == 'A' || y == 'A' {
                "Added"
            } else {
                "Modified"
            };
            let staged = x != ' ' && x != '?';

            Some(GitFileChange {
                path,
                original_path,
                status: status.to_string(),
                staged,
            })
        })
        .collect()
}

fn git_status_files(root: &Path) -> Result<Vec<GitFileChange>, String> {
    let status = git_panel_command(root, &["status", "--porcelain=v1", "-uall"])?;
    Ok(parse_git_status(&status))
}

fn git_status_counts(files: &[GitFileChange]) -> (usize, usize, usize) {
    let staged_count = files.iter().filter(|file| file.staged).count();
    let untracked_count = files.iter().filter(|file| file.status == "Untracked").count();
    let modified_count = files
        .iter()
        .filter(|file| file.status != "Untracked" && !file.staged)
        .count();
    (staged_count, modified_count, untracked_count)
}

fn git_watch_should_ignore(path: &Path) -> bool {
    path.components().any(|component| {
        let value = component.as_os_str().to_string_lossy();
        matches!(
            value.as_ref(),
            "node_modules" | "target" | "dist" | "build" | ".vite" | ".next"
        )
    })
}

fn git_watch_event_is_relevant(paths: &[PathBuf]) -> bool {
    paths.is_empty() || paths.iter().any(|path| !git_watch_should_ignore(path))
}

#[tauri::command]
fn git_watch_start(
    app: AppHandle,
    state: State<'_, GitWatchState>,
    path: String,
) -> Result<String, String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    let root_key = root.to_string_lossy().to_string();
    let mut watchers = state.watchers.lock().map_err(|error| error.to_string())?;

    if let Some(entry) = watchers.get_mut(&root_key) {
        entry.subscribers += 1;
        return Ok(root_key);
    }

    let event_root = root_key.clone();
    let event_app = app.clone();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        let Ok(event) = result else {
            return;
        };
        if !git_watch_event_is_relevant(&event.paths) {
            return;
        }
        let _ = event_app.emit(
            GIT_WATCH_EVENT,
            GitWatchEvent {
                root: event_root.clone(),
            },
        );
    })
    .map_err(|error| error.to_string())?;

    watcher
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|error| error.to_string())?;

    watchers.insert(
        root_key.clone(),
        GitWatchEntry {
            _watcher: watcher,
            subscribers: 1,
        },
    );

    Ok(root_key)
}

#[tauri::command]
fn git_watch_stop(state: State<'_, GitWatchState>, root: String) -> Result<(), String> {
    let mut watchers = state.watchers.lock().map_err(|error| error.to_string())?;
    let trimmed = root.trim();
    if trimmed.is_empty() {
        return Ok(());
    }

    let should_remove = if let Some(entry) = watchers.get_mut(trimmed) {
        entry.subscribers = entry.subscribers.saturating_sub(1);
        entry.subscribers == 0
    } else {
        false
    };

    if should_remove {
        watchers.remove(trimmed);
    }

    Ok(())
}

fn validate_repo_file_path(file: &str) -> Result<String, String> {
    let trimmed = file.trim().replace('\\', "/");
    if trimmed.is_empty() || trimmed.starts_with('/') || trimmed.contains("../") || trimmed == ".." {
        return Err("Invalid repository file path.".to_string());
    }
    Ok(trimmed)
}

fn parse_commit_line(line: &str) -> Option<GitCommitInfo> {
    let parts = line.split('\x1f').collect::<Vec<_>>();
    if parts.len() < 5 {
        return None;
    }
    Some(GitCommitInfo {
        hash: parts[0].to_string(),
        short_hash: parts[1].to_string(),
        author: parts[2].to_string(),
        date: parts[3].to_string(),
        message: parts[4].to_string(),
        files: Vec::new(),
    })
}

fn git_latest_commit(root: &Path) -> Option<GitCommitInfo> {
    let output = optional_git_panel_command(
        root,
        &["log", "-1", "--date=iso-strict", "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s"],
    )?;
    parse_commit_line(&output)
}

fn git_current_branch(root: &Path) -> Option<String> {
    optional_git_panel_command(root, &["branch", "--show-current"])
        .or_else(|| optional_git_panel_command(root, &["rev-parse", "--short", "HEAD"]))
}

fn git_remote_url(root: &Path) -> Option<String> {
    optional_git_panel_command(root, &["config", "--get", "remote.origin.url"])
}

fn git_push_current_branch(root: &Path) -> Result<(), String> {
    if git_remote_url(root).is_none() {
        return Err("Connect this project to a GitHub repository before pushing.".to_string());
    }

    let branch = optional_git_panel_command(root, &["branch", "--show-current"])
        .ok_or_else(|| "Switch to a branch before pushing to GitHub.".to_string())?;
    let has_upstream = git_panel_command(
        root,
        &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    )
    .is_ok();

    if has_upstream {
        git_panel_command(root, &["push"])?;
    } else {
        git_panel_command_owned(
            root,
            vec![
                "push".into(),
                "--set-upstream".into(),
                "origin".into(),
                branch,
            ],
        )?;
    }

    Ok(())
}

fn git_release_version_from_json(path: &Path) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    let value = serde_json::from_str::<Value>(&content).ok()?;
    value.get("version").and_then(Value::as_str).map(ToString::to_string)
}

fn git_release_version_from_cargo(path: &Path) -> Option<String> {
    fs::read_to_string(path).ok()?.lines().find_map(|line| {
        let trimmed = line.trim();
        trimmed
            .strip_prefix("version")
            .and_then(|rest| rest.split_once('"'))
            .and_then(|(_, rest)| rest.split_once('"'))
            .map(|(version, _)| version.to_string())
    })
}

fn update_json_version(path: &Path, version: &str) -> Result<(), String> {
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut value = serde_json::from_str::<Value>(&content).map_err(|error| error.to_string())?;
    if let Some(object) = value.as_object_mut() {
        object.insert("version".to_string(), Value::String(version.to_string()));
    }
    let next = serde_json::to_string_pretty(&value).map_err(|error| error.to_string())?;
    fs::write(path, format!("{next}\n")).map_err(|error| error.to_string())
}

fn update_cargo_version(path: &Path, version: &str) -> Result<(), String> {
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut replaced = false;
    let next = content
        .lines()
        .map(|line| {
            if !replaced && line.trim_start().starts_with("version") {
                replaced = true;
                format!("version = \"{version}\"")
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    fs::write(path, format!("{next}\n")).map_err(|error| error.to_string())
}

#[tauri::command]
fn git_detect_repo(path: String) -> Result<bool, String> {
    let workspace = workspace_path(path)?;
    Ok(git_panel_root(&workspace).is_ok())
}

#[tauri::command]
fn git_init_repo(path: String) -> Result<(), String> {
    let workspace = workspace_path(path)?;
    git_panel_command(&workspace, &["init"])?;
    git_panel_command(&workspace, &["checkout", "-B", "main"]).map(|_| ())
}

fn validate_remote_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("GitHub repository URL is empty.".to_string());
    }

    let is_supported = trimmed.starts_with("https://github.com/")
        || trimmed.starts_with("http://github.com/")
        || trimmed.starts_with("git@github.com:")
        || trimmed.starts_with("ssh://git@github.com/");

    if !is_supported {
        return Err("Use a GitHub HTTPS or SSH repository URL.".to_string());
    }

    Ok(trimmed.to_string())
}

#[tauri::command]
fn git_set_origin(path: String, url: String) -> Result<(), String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    let url = validate_remote_url(&url)?;
    if git_remote_url(&root).is_some() {
        git_panel_command_owned(&root, vec!["remote".into(), "set-url".into(), "origin".into(), url])
    } else {
        git_panel_command_owned(&root, vec!["remote".into(), "add".into(), "origin".into(), url])
    }
    .map(|_| ())
}

#[tauri::command]
fn git_get_overview(path: String) -> Result<GitOverview, String> {
    let workspace = workspace_path(path)?;
    let Ok(root) = git_panel_root(&workspace) else {
        return Ok(GitOverview {
            is_repo: false,
            root: None,
            current_branch: None,
            remote_name: None,
            remote_url: None,
            clean: true,
            modified_count: 0,
            staged_count: 0,
            untracked_count: 0,
            ahead: 0,
            behind: 0,
            latest_commit: None,
            refreshed_at: now_unix_string(),
        });
    };

    let status = git_panel_command(&root, &["status", "--short", "--branch"])?;
    let (branch, _, ahead, behind) = parse_branch_line(&status);
    let files = git_status_files(&root)?;
    let (staged_count, modified_count, untracked_count) = git_status_counts(&files);

    Ok(GitOverview {
        is_repo: true,
        root: Some(root.to_string_lossy().to_string()),
        current_branch: Some(branch),
        remote_name: git_remote_url(&root).map(|_| "origin".to_string()),
        remote_url: git_remote_url(&root),
        clean: files.is_empty(),
        modified_count,
        staged_count,
        untracked_count,
        ahead,
        behind,
        latest_commit: git_latest_commit(&root),
        refreshed_at: now_unix_string(),
    })
}

#[tauri::command]
fn git_get_status(path: String) -> Result<GitStatusSnapshot, String> {
    let workspace = workspace_path(path)?;
    let Ok(root) = git_panel_root(&workspace) else {
        return Ok(GitStatusSnapshot {
            is_repo: false,
            root: None,
            files: Vec::new(),
            staged_count: 0,
            modified_count: 0,
            untracked_count: 0,
        });
    };
    let files = git_status_files(&root)?;
    let (staged_count, modified_count, untracked_count) = git_status_counts(&files);
    Ok(GitStatusSnapshot {
        is_repo: true,
        root: Some(root.to_string_lossy().to_string()),
        files,
        staged_count,
        modified_count,
        untracked_count,
    })
}

#[tauri::command]
fn git_stage_file(path: String, file: String) -> Result<(), String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    let file = validate_repo_file_path(&file)?;
    git_panel_command_owned(&root, vec!["add".into(), "--".into(), file]).map(|_| ())
}

#[tauri::command]
fn git_unstage_file(path: String, file: String) -> Result<(), String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    let file = validate_repo_file_path(&file)?;
    git_panel_command_owned(&root, vec!["restore".into(), "--staged".into(), "--".into(), file])
        .map(|_| ())
}

#[tauri::command]
fn git_stage_all(path: String) -> Result<(), String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    git_panel_command(&root, &["add", "-A"]).map(|_| ())
}

#[tauri::command]
fn git_unstage_all(path: String) -> Result<(), String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    git_panel_command(&root, &["restore", "--staged", "."]).map(|_| ())
}

#[tauri::command]
fn git_discard_file(path: String, file: String) -> Result<(), String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    let file = validate_repo_file_path(&file)?;
    git_panel_command_owned(
        &root,
        vec![
            "restore".into(),
            "--source=HEAD".into(),
            "--staged".into(),
            "--worktree".into(),
            "--".into(),
            file.clone(),
        ],
    )
    .or_else(|_| git_panel_command_owned(&root, vec!["clean".into(), "-f".into(), "--".into(), file]))
    .map(|_| ())
}

#[tauri::command]
fn git_commit(path: String, message: String) -> Result<(), String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    let message = message.trim();
    if message.is_empty() {
        return Err("Commit message cannot be empty.".to_string());
    }
    git_panel_command_owned(&root, vec!["commit".into(), "-m".into(), message.to_string()]).map(|_| ())
}

#[tauri::command]
fn git_push(path: String) -> Result<(), String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    git_push_current_branch(&root)
}

#[tauri::command]
fn git_pull(path: String) -> Result<(), String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    git_panel_command(&root, &["pull", "--ff-only"]).map(|_| ())
}

#[tauri::command]
fn git_fetch(path: String) -> Result<(), String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    git_panel_command(&root, &["fetch", "--all", "--prune"]).map(|_| ())
}

#[tauri::command]
fn git_get_history(path: String, limit: Option<u32>) -> Result<Vec<GitCommitInfo>, String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    let limit = limit.unwrap_or(50).clamp(1, 100).to_string();
    let output = git_panel_command_owned(
        &root,
        vec![
            "log".into(),
            "-n".into(),
            limit,
            "--date=iso-strict".into(),
            "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s".into(),
        ],
    )?;
    Ok(output.lines().filter_map(parse_commit_line).collect())
}

#[tauri::command]
fn git_get_commit_details(path: String, hash: String) -> Result<GitCommitInfo, String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    let hash = hash.trim();
    let line = git_panel_command_owned(
        &root,
        vec![
            "show".into(),
            "-s".into(),
            "--date=iso-strict".into(),
            "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s".into(),
            hash.to_string(),
        ],
    )?;
    let mut commit = parse_commit_line(&line).ok_or_else(|| "Commit was not found.".to_string())?;
    let files = git_panel_command_owned(
        &root,
        vec!["show".into(), "--name-only".into(), "--pretty=format:".into(), hash.to_string()],
    )?;
    commit.files = files
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToString::to_string)
        .collect();
    Ok(commit)
}

#[tauri::command]
fn git_get_branches(path: String) -> Result<GitBranchesSnapshot, String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    let status = git_panel_command(&root, &["status", "--short", "--branch"])?;
    let (branch, _, _, _) = parse_branch_line(&status);
    let branches = read_git_branches(&root.to_string_lossy(), &branch)?;
    Ok(GitBranchesSnapshot {
        is_repo: true,
        current_branch: Some(branch),
        dirty: status.lines().any(|line| !line.starts_with("## ")),
        local: branches.iter().filter(|item| !item.is_remote).cloned().collect(),
        remote: branches.into_iter().filter(|item| item.is_remote).collect(),
    })
}

#[tauri::command]
fn git_create_branch(path: String, name: String) -> Result<(), String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    let name = name.trim();
    if name.is_empty() {
        return Err("Branch name cannot be empty.".to_string());
    }
    git_panel_command_owned(&root, vec!["switch".into(), "-c".into(), name.to_string()]).map(|_| ())
}

#[tauri::command]
fn git_switch_branch(path: String, name: String) -> Result<(), String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    let name = name.trim();
    if name.is_empty() {
        return Err("Branch name cannot be empty.".to_string());
    }
    git_panel_command_owned(&root, vec!["switch".into(), name.to_string()]).map(|_| ())
}

#[tauri::command]
fn git_delete_branch(path: String, name: String) -> Result<(), String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    let name = name.trim();
    let current = git_current_branch(&root).unwrap_or_default();
    if name.is_empty() || name == current {
        return Err("Cannot delete the current branch.".to_string());
    }
    git_panel_command_owned(&root, vec!["branch".into(), "-d".into(), name.to_string()]).map(|_| ())
}

#[tauri::command]
fn git_get_release_info(path: String) -> Result<GitReleaseInfo, String> {
    let workspace = workspace_path(path)?;
    let root = git_panel_root(&workspace)?;
    let files = git_status_files(&root)?;
    Ok(GitReleaseInfo {
        is_repo: true,
        current_branch: git_current_branch(&root),
        clean: files.is_empty(),
        package_version: git_release_version_from_json(&root.join("package.json")),
        tauri_version: git_release_version_from_json(&root.join("src-tauri").join("tauri.conf.json")),
        cargo_version: git_release_version_from_cargo(&root.join("src-tauri").join("Cargo.toml")),
        latest_tag: optional_git_panel_command(&root, &["describe", "--tags", "--abbrev=0"]),
    })
}

#[tauri::command]
fn git_create_release(
    path: String,
    version: String,
    notes: String,
    options: GitReleaseOptions,
) -> Result<(), String> {
    let root = git_panel_root(&workspace_path(path)?)?;
    let version = version.trim();
    if version.is_empty() {
        return Err("Version cannot be empty.".to_string());
    }
    let tag = format!("v{version}");
    if git_panel_command_owned(&root, vec!["rev-parse".into(), "-q".into(), "--verify".into(), format!("refs/tags/{tag}")]).is_ok() {
        return Err(format!("Tag {tag} already exists."));
    }

    if options.update_package_json {
        update_json_version(&root.join("package.json"), version)?;
    }
    if options.update_tauri_conf {
        update_json_version(&root.join("src-tauri").join("tauri.conf.json"), version)?;
    }
    if options.update_cargo_toml {
        update_cargo_version(&root.join("src-tauri").join("Cargo.toml"), version)?;
    }
    if options.commit_changes {
        let mut add_args = vec!["add".to_string()];
        if options.update_package_json && root.join("package.json").exists() {
            add_args.push("package.json".to_string());
        }
        if options.update_tauri_conf && root.join("src-tauri").join("tauri.conf.json").exists() {
            add_args.push("src-tauri/tauri.conf.json".to_string());
        }
        if options.update_cargo_toml && root.join("src-tauri").join("Cargo.toml").exists() {
            add_args.push("src-tauri/Cargo.toml".to_string());
        }
        if add_args.len() > 1 {
            git_panel_command_owned(&root, add_args)?;
        }
        git_panel_command_owned(&root, vec!["commit".into(), "-m".into(), format!("Release {tag}")])?;
    }
    if options.create_git_tag {
        let notes = if notes.trim().is_empty() {
            format!("Release {tag}")
        } else {
            notes.trim().to_string()
        };
        git_panel_command_owned(&root, vec!["tag".into(), "-a".into(), tag.clone(), "-m".into(), notes])?;
    }
    if options.push_branch {
        git_push_current_branch(&root)?;
    }
    if options.push_tag {
        git_panel_command_owned(&root, vec!["push".into(), "origin".into(), tag])?;
    }
    Ok(())
}

fn parse_branch_line(status: &str) -> (String, Option<String>, u32, u32) {
    let mut branch = "detached".to_string();
    let mut upstream = None;
    let mut ahead = 0;
    let mut behind = 0;

    for line in status.lines() {
        if let Some(rest) = line.strip_prefix("## ") {
            let branch_part = rest.split_whitespace().next().unwrap_or(rest);
            if let Some((name, tracking)) = branch_part.split_once("...") {
                branch = name.to_string();
                upstream = Some(tracking.to_string());
            } else {
                branch = branch_part.to_string();
            }

            if let Some(summary) = rest.split_once('[').and_then(|(_, value)| value.split_once(']')) {
                for part in summary.0.split(',') {
                    let clean = part.trim();
                    if let Some(value) = clean.strip_prefix("ahead ") {
                        ahead = value.parse().unwrap_or(0);
                    } else if let Some(value) = clean.strip_prefix("behind ") {
                        behind = value.parse().unwrap_or(0);
                    }
                }
            } else if let Some(value) = rest.split_once("ahead ").map(|(_, value)| value) {
                if let Some(value) = value.split_whitespace().next() {
                    ahead = value.parse().unwrap_or(0);
                }
            } else if let Some(value) = rest.split_once("behind ").map(|(_, value)| value) {
                if let Some(value) = value.split_whitespace().next() {
                    behind = value.parse().unwrap_or(0);
                }
            }
            break;
        }
    }

    (branch, upstream, ahead, behind)
}

fn read_git_branches(root: &str, current_branch: &str) -> Result<Vec<GitBranchInfo>, String> {
    let branches = git_panel_command(
        Path::new(root),
        &[
            "for-each-ref",
            "--format=%(refname)%09%(refname:short)%09%(upstream:short)%09%(objectname:short)%09%(subject)",
            "refs/heads",
            "refs/remotes",
        ],
    )?;

    let mut items = Vec::new();
    for line in branches.lines() {
        let mut parts = line.splitn(5, '\t');
        let refname = parts.next().map(str::trim).unwrap_or_default();
        let Some(name) = parts.next().map(str::trim).filter(|value| !value.is_empty()) else {
            continue;
        };
        if name.ends_with("/HEAD") {
            continue;
        }

        let upstream = parts
            .next()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string);
        let hash = parts.next().map(str::trim).unwrap_or_default();
        let subject = parts.next().map(str::trim).unwrap_or_default();
        let last_commit = if subject.is_empty() {
            hash.to_string()
        } else {
            format!("{hash} {subject}")
        };

        items.push(GitBranchInfo {
            name: name.to_string(),
            is_current: name == current_branch,
            is_remote: refname.starts_with("refs/remotes/"),
            upstream,
            last_commit,
        });
    }

    Ok(items)
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
            read_clipboard_text,
            write_clipboard_text,
            validate_working_directory,
            git_detect_repo,
            git_init_repo,
            git_set_origin,
            git_get_overview,
            git_get_status,
            git_watch_start,
            git_watch_stop,
            git_stage_file,
            git_unstage_file,
            git_stage_all,
            git_unstage_all,
            git_discard_file,
            git_commit,
            git_push,
            git_pull,
            git_fetch,
            git_get_history,
            git_get_commit_details,
            git_get_branches,
            git_create_branch,
            git_switch_branch,
            git_delete_branch,
            git_get_release_info,
            git_create_release,
            spawn_terminal,
            write_terminal,
            resize_terminal,
            terminate_terminal
        ])
        .setup(|app| {
            db::prepare_app_storage(app)?;
            app.manage(create_pty_state(app.handle().clone()));
            app.manage(create_git_watch_state());
            restore_window_state(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Cortex");
}
