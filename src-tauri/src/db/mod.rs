use tauri::{App, Manager};

pub fn prepare_app_storage(app: &App) -> tauri::Result<()> {
    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(app_data_dir)?;
    Ok(())
}
