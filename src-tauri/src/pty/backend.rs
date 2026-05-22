use super::{PtySessionId, ShellProfile};
use thiserror::Error;

pub type PtyResult<T> = Result<T, PtyError>;

#[derive(Debug, Clone, Copy)]
pub struct PtySize {
    pub rows: u16,
    pub cols: u16,
}

#[derive(Debug, Error)]
pub enum PtyError {
    #[error("PTY backend is not available on this platform")]
    #[allow(dead_code)]
    UnsupportedPlatform,
    #[error("PTY session was not found")]
    SessionNotFound,
    #[error("PTY operation failed: {0}")]
    OperationFailed(String),
}

pub trait PtyBackend: Send + Sync {
    fn spawn(
        &self,
        profile: ShellProfile,
        cwd: Option<String>,
        size: PtySize,
    ) -> PtyResult<PtySessionId>;
    fn write(&self, session_id: PtySessionId, data: &[u8]) -> PtyResult<()>;
    fn resize(&self, session_id: PtySessionId, size: PtySize) -> PtyResult<()>;
    fn terminate(&self, session_id: PtySessionId) -> PtyResult<()>;
}

#[cfg(windows)]
mod windows {
    use super::{PtyBackend, PtyError, PtyResult};
    use crate::pty::{PtySessionId, PtySize, ShellProfile};
    use portable_pty::{
        native_pty_system, Child, ChildKiller, CommandBuilder, MasterPty, PtySystem,
    };
    use std::collections::HashMap;
    use std::io::{Read, Write};
    use std::sync::{Arc, Mutex};
    use std::thread;

    type OutputHandler = Arc<dyn Fn(PtySessionId, PtyOutput) + Send + Sync>;

    #[derive(Debug, Clone)]
    pub enum PtyOutput {
        Data(String),
        Exit { code: Option<u32> },
        Error(String),
    }

    pub struct WindowsConptyBackend {
        pty_system: Mutex<Box<dyn PtySystem + Send>>,
        sessions: Arc<Mutex<HashMap<PtySessionId, WindowsPtySession>>>,
        output: OutputHandler,
    }

    struct WindowsPtySession {
        _master: Box<dyn MasterPty + Send>,
        writer: Box<dyn Write + Send>,
        killer: Box<dyn ChildKiller + Send + Sync>,
    }

    impl WindowsConptyBackend {
        pub fn new(output: impl Fn(PtySessionId, PtyOutput) + Send + Sync + 'static) -> Self {
            Self {
                pty_system: Mutex::new(native_pty_system()),
                sessions: Arc::new(Mutex::new(HashMap::new())),
                output: Arc::new(output),
            }
        }

        fn portable_size(size: PtySize) -> portable_pty::PtySize {
            portable_pty::PtySize {
                rows: size.rows.max(1),
                cols: size.cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            }
        }

        fn operation_error(error: impl std::fmt::Display) -> PtyError {
            PtyError::OperationFailed(error.to_string())
        }

        fn build_command(mut profile: ShellProfile, cwd: Option<String>) -> CommandBuilder {
            let cwd = cwd.filter(|value| !value.trim().is_empty());
            if matches!(profile.kind, crate::pty::ShellProfileKind::Wsl) {
                if let Some(cwd) = cwd {
                    profile.args.push("--cd".into());
                    profile.args.push(cwd);
                }
                let mut command = CommandBuilder::new(profile.executable);
                command.args(profile.args);
                command.env("TERM", "xterm-256color");
                command.env("COLORTERM", "truecolor");
                return command;
            }

            let mut command = CommandBuilder::new(profile.executable);
            command.args(profile.args);
            if let Some(cwd) = cwd {
                command.cwd(cwd);
            }
            command.env("TERM", "xterm-256color");
            command.env("COLORTERM", "truecolor");
            command
        }

        fn spawn_reader(
            session_id: PtySessionId,
            mut reader: Box<dyn Read + Send>,
            output: OutputHandler,
        ) {
            thread::spawn(move || {
                let mut buffer = [0_u8; 8192];
                loop {
                    match reader.read(&mut buffer) {
                        Ok(0) => break,
                        Ok(count) => {
                            let data = String::from_utf8_lossy(&buffer[..count]).to_string();
                            output(session_id, PtyOutput::Data(data));
                        }
                        Err(error) => {
                            output(session_id, PtyOutput::Error(error.to_string()));
                            break;
                        }
                    }
                }
            });
        }

        fn spawn_waiter(
            session_id: PtySessionId,
            mut child: Box<dyn Child + Send + Sync>,
            sessions: Arc<Mutex<HashMap<PtySessionId, WindowsPtySession>>>,
            output: OutputHandler,
        ) {
            thread::spawn(move || {
                let status = child.wait();
                if let Ok(mut sessions) = sessions.lock() {
                    sessions.remove(&session_id);
                }
                match status {
                    Ok(status) => output(
                        session_id,
                        PtyOutput::Exit {
                            code: Some(status.exit_code()),
                        },
                    ),
                    Err(error) => output(session_id, PtyOutput::Error(error.to_string())),
                }
            });
        }
    }

    impl PtyBackend for WindowsConptyBackend {
        fn spawn(
            &self,
            profile: ShellProfile,
            cwd: Option<String>,
            size: PtySize,
        ) -> PtyResult<PtySessionId> {
            let pair = self
                .pty_system
                .lock()
                .map_err(|_| PtyError::OperationFailed("PTY system lock was poisoned".into()))?
                .openpty(Self::portable_size(size))
                .map_err(Self::operation_error)?;
            let command = Self::build_command(profile, cwd);
            let child = pair
                .slave
                .spawn_command(command)
                .map_err(Self::operation_error)?;
            let reader = pair
                .master
                .try_clone_reader()
                .map_err(Self::operation_error)?;
            let writer = pair.master.take_writer().map_err(Self::operation_error)?;
            let killer = child.clone_killer();
            let session_id = PtySessionId::new();

            self.sessions
                .lock()
                .map_err(|_| PtyError::OperationFailed("PTY session lock was poisoned".into()))?
                .insert(
                    session_id,
                    WindowsPtySession {
                        _master: pair.master,
                        writer,
                        killer,
                    },
                );

            Self::spawn_reader(session_id, reader, Arc::clone(&self.output));
            Self::spawn_waiter(
                session_id,
                child,
                Arc::clone(&self.sessions),
                Arc::clone(&self.output),
            );

            Ok(session_id)
        }

        fn write(&self, session_id: PtySessionId, data: &[u8]) -> PtyResult<()> {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|_| PtyError::OperationFailed("PTY session lock was poisoned".into()))?;
            let session = sessions
                .get_mut(&session_id)
                .ok_or(PtyError::SessionNotFound)?;
            session
                .writer
                .write_all(data)
                .map_err(Self::operation_error)?;
            session.writer.flush().map_err(Self::operation_error)
        }

        fn resize(&self, session_id: PtySessionId, size: PtySize) -> PtyResult<()> {
            let sessions = self
                .sessions
                .lock()
                .map_err(|_| PtyError::OperationFailed("PTY session lock was poisoned".into()))?;
            let session = sessions.get(&session_id).ok_or(PtyError::SessionNotFound)?;
            session
                ._master
                .resize(Self::portable_size(size))
                .map_err(Self::operation_error)
        }

        fn terminate(&self, session_id: PtySessionId) -> PtyResult<()> {
            let mut session = self
                .sessions
                .lock()
                .map_err(|_| PtyError::OperationFailed("PTY session lock was poisoned".into()))?
                .remove(&session_id)
                .ok_or(PtyError::SessionNotFound)?;
            session.killer.kill().map_err(Self::operation_error)
        }
    }

    impl Drop for WindowsConptyBackend {
        fn drop(&mut self) {
            if let Ok(mut sessions) = self.sessions.lock() {
                for (_, mut session) in sessions.drain() {
                    let _ = session.killer.kill();
                }
            }
        }
    }

    pub use PtyOutput as WindowsPtyOutput;
    pub use WindowsConptyBackend as PlatformPtyBackend;
}

#[cfg(not(windows))]
mod unsupported {
    use super::{PtyBackend, PtyError, PtyResult};
    use crate::pty::{PtySessionId, PtySize, ShellProfile};

    #[derive(Debug, Clone)]
    pub enum PtyOutput {
        Data(String),
        Exit { code: Option<u32> },
        Error(String),
    }

    pub struct UnsupportedPtyBackend;

    impl UnsupportedPtyBackend {
        pub fn new(_output: impl Fn(PtySessionId, PtyOutput) + Send + Sync + 'static) -> Self {
            Self
        }
    }

    impl PtyBackend for UnsupportedPtyBackend {
        fn spawn(
            &self,
            _profile: ShellProfile,
            _cwd: Option<String>,
            _size: PtySize,
        ) -> PtyResult<PtySessionId> {
            Err(PtyError::UnsupportedPlatform)
        }

        fn write(&self, _session_id: PtySessionId, _data: &[u8]) -> PtyResult<()> {
            Err(PtyError::UnsupportedPlatform)
        }

        fn resize(&self, _session_id: PtySessionId, _size: PtySize) -> PtyResult<()> {
            Err(PtyError::UnsupportedPlatform)
        }

        fn terminate(&self, _session_id: PtySessionId) -> PtyResult<()> {
            Err(PtyError::UnsupportedPlatform)
        }
    }

    pub use PtyOutput as WindowsPtyOutput;
    pub use UnsupportedPtyBackend as PlatformPtyBackend;
}

#[cfg(not(windows))]
pub use unsupported::{PlatformPtyBackend, WindowsPtyOutput as PtyOutput};
#[cfg(windows)]
pub use windows::{PlatformPtyBackend, WindowsPtyOutput as PtyOutput};
