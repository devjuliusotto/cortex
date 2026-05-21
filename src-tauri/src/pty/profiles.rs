use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellProfile {
    pub id: String,
    pub label: String,
    pub executable: String,
    pub args: Vec<String>,
    pub kind: ShellProfileKind,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ShellProfileKind {
    PowerShell,
    Cmd,
    Wsl,
}

impl ShellProfile {
    pub fn new(kind: ShellProfileKind) -> Self {
        match kind {
            ShellProfileKind::PowerShell => Self {
                id: "powershell".into(),
                label: "PowerShell".into(),
                executable: "powershell.exe".into(),
                args: vec!["-NoLogo".into()],
                kind,
            },
            ShellProfileKind::Cmd => Self {
                id: "cmd".into(),
                label: "Command Prompt".into(),
                executable: "cmd.exe".into(),
                args: Vec::new(),
                kind,
            },
            ShellProfileKind::Wsl => Self {
                id: "wsl-ubuntu".into(),
                label: "WSL Ubuntu".into(),
                executable: "wsl.exe".into(),
                args: vec!["-d".into(), "Ubuntu".into()],
                kind,
            },
        }
    }

    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            "powershell" => Some(Self::new(ShellProfileKind::PowerShell)),
            "cmd" => Some(Self::new(ShellProfileKind::Cmd)),
            "wsl-ubuntu" | "wsl" => Some(Self::new(ShellProfileKind::Wsl)),
            _ => None,
        }
    }
}
