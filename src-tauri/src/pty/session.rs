use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Eq, PartialEq, Hash, Deserialize, Serialize)]
#[serde(transparent)]
pub struct PtySessionId(Uuid);

impl PtySessionId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl fmt::Display for PtySessionId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}", self.0)
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyBackendStatus {
    pub platform: &'static str,
    pub conpty_available: bool,
    pub implementation: &'static str,
}

impl PtyBackendStatus {
    pub fn current() -> Self {
        Self {
            platform: std::env::consts::OS,
            conpty_available: cfg!(windows),
            implementation: if cfg!(windows) {
                "portable-pty-conpty"
            } else {
                "unsupported-host"
            },
        }
    }
}
