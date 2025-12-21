//! Modifier-only keyboard shortcut support using rdev.
//!
//! This module enables using a single modifier key (e.g., right Command on macOS)
//! as a push-to-talk trigger. It runs independently of the tauri-plugin-global-shortcut
//! system, which only supports modifier+key combinations.

use log::{debug, error, info, warn};
use rdev::{listen, Event, EventType, Key};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Instant;
use tauri::AppHandle;

use crate::actions::ACTION_MAP;
use crate::settings::get_settings;

/// Tracks the state of the modifier shortcut listener
struct ModifierState {
    /// The modifier key we're watching for
    target_key: Option<Key>,
    /// Whether the target modifier is currently pressed
    modifier_pressed: bool,
    /// Whether any other key was pressed while modifier is held (indicates a combo)
    other_key_pressed: bool,
    /// Timestamp when modifier was pressed (for debouncing)
    press_time: Option<Instant>,
    /// App handle for triggering actions
    app_handle: Option<AppHandle>,
}

impl Default for ModifierState {
    fn default() -> Self {
        Self {
            target_key: None,
            modifier_pressed: false,
            other_key_pressed: false,
            press_time: None,
            app_handle: None,
        }
    }
}

/// Global state for the modifier listener
static LISTENER_RUNNING: AtomicBool = AtomicBool::new(false);

lazy_static::lazy_static! {
    static ref MODIFIER_STATE: Arc<Mutex<ModifierState>> = Arc::new(Mutex::new(ModifierState::default()));
}

/// Parse a key string into an rdev Key
pub fn parse_modifier_key(key_str: &str) -> Option<Key> {
    match key_str {
        "MetaRight" => Some(Key::MetaRight),
        "MetaLeft" => Some(Key::MetaLeft),
        "AltRight" => Some(Key::Alt), // rdev doesn't distinguish Alt sides on all platforms
        "AltLeft" => Some(Key::Alt),
        "ControlRight" => Some(Key::ControlRight),
        "ControlLeft" => Some(Key::ControlLeft),
        "ShiftRight" => Some(Key::ShiftRight),
        "ShiftLeft" => Some(Key::ShiftLeft),
        _ => None,
    }
}

/// Get display name for a modifier key
pub fn get_modifier_display_name(key_str: &str) -> &'static str {
    match key_str {
        "MetaRight" => "Right Command",
        "MetaLeft" => "Left Command",
        "AltRight" => "Right Option",
        "AltLeft" => "Left Option",
        "ControlRight" => "Right Control",
        "ControlLeft" => "Left Control",
        "ShiftRight" => "Right Shift",
        "ShiftLeft" => "Left Shift",
        _ => "Unknown",
    }
}

/// Handle a keyboard event
fn handle_event(event: Event) {
    let mut state = match MODIFIER_STATE.lock() {
        Ok(s) => s,
        Err(e) => {
            error!("Failed to lock modifier state: {}", e);
            return;
        }
    };

    let target_key = match &state.target_key {
        Some(k) => k.clone(),
        None => return, // No target key configured
    };

    match event.event_type {
        EventType::KeyPress(key) => {
            if key == target_key {
                // Target modifier pressed - start recording
                if !state.modifier_pressed {
                    debug!("Modifier key pressed: {:?}", key);
                    state.modifier_pressed = true;
                    state.other_key_pressed = false;
                    state.press_time = Some(Instant::now());

                    // Start recording immediately
                    if let Some(app) = &state.app_handle {
                        let app_clone = app.clone();
                        drop(state);
                        trigger_start(&app_clone);
                    }
                }
            } else {
                // Some other key pressed while modifier might be held
                if state.modifier_pressed {
                    debug!("Other key pressed while modifier held: {:?}", key);
                    state.other_key_pressed = true;
                }
            }
        }
        EventType::KeyRelease(key) => {
            if key == target_key && state.modifier_pressed {
                debug!("Modifier key released");

                // Reset state
                state.modifier_pressed = false;
                state.other_key_pressed = false;
                state.press_time = None;

                // Stop recording
                if let Some(app) = &state.app_handle {
                    let app_clone = app.clone();
                    drop(state);
                    trigger_stop(&app_clone);
                }
            }
        }
        _ => {}
    }
}

/// Start recording
fn trigger_start(app: &AppHandle) {
    debug!("Modifier shortcut: starting recording");
    if let Some(action) = ACTION_MAP.get("transcribe") {
        action.start(app, "transcribe", "modifier_shortcut");
    }
}

/// Stop recording
fn trigger_stop(app: &AppHandle) {
    debug!("Modifier shortcut: stopping recording");
    if let Some(action) = ACTION_MAP.get("transcribe") {
        action.stop(app, "transcribe", "modifier_shortcut");
    }
}

/// Get the modifier key from the transcribe binding if it's a modifier-only shortcut
fn get_modifier_from_binding(app: &AppHandle) -> Option<String> {
    let settings = get_settings(app);
    if let Some(binding) = settings.bindings.get("transcribe") {
        let key_str = &binding.current_binding;
        // Check if it's a valid modifier-only key
        if parse_modifier_key(key_str).is_some() {
            return Some(key_str.clone());
        }
    }
    None
}

/// Start the modifier key listener
fn start_listener(app_handle: AppHandle) {
    if LISTENER_RUNNING.swap(true, Ordering::SeqCst) {
        warn!("Modifier listener already running");
        return;
    }

    // Check if the transcribe binding is a modifier-only shortcut
    let key_str = match get_modifier_from_binding(&app_handle) {
        Some(k) => k,
        None => {
            debug!("No modifier-only shortcut configured for transcribe");
            LISTENER_RUNNING.store(false, Ordering::SeqCst);
            return;
        }
    };

    let target_key = match parse_modifier_key(&key_str) {
        Some(k) => k,
        None => {
            warn!("Invalid modifier key configured: {}", key_str);
            LISTENER_RUNNING.store(false, Ordering::SeqCst);
            return;
        }
    };

    info!(
        "Starting modifier shortcut listener for: {} ({:?})",
        get_modifier_display_name(&key_str),
        target_key
    );

    // Set up the state
    {
        let mut state = MODIFIER_STATE.lock().unwrap();
        state.target_key = Some(target_key);
        state.app_handle = Some(app_handle.clone());
        state.modifier_pressed = false;
        state.other_key_pressed = false;
        state.press_time = None;
    }

    // Start listener in background thread
    thread::spawn(move || {
        if let Err(e) = listen(handle_event) {
            error!("Error in modifier key listener: {:?}", e);
        }
        LISTENER_RUNNING.store(false, Ordering::SeqCst);
    });
}

/// Stop the modifier key listener
pub fn stop_listener() {
    // Note: rdev::listen doesn't have a built-in stop mechanism
    // The listener will stop when the app exits
    // For now, we just clear the target key to effectively disable it
    if let Ok(mut state) = MODIFIER_STATE.lock() {
        state.target_key = None;
        state.app_handle = None;
    }
    LISTENER_RUNNING.store(false, Ordering::SeqCst);
    info!("Modifier shortcut listener disabled");
}

/// Initialize the modifier shortcut listener
pub fn init_modifier_listener(app: &AppHandle) {
    let settings = get_settings(app);
    if settings.modifier_shortcut_enabled && settings.modifier_shortcut_key.is_some() {
        start_listener(app.clone());
    }
}

/// Update the modifier listener when settings change
pub fn update_modifier_listener(app: &AppHandle) {
    // Check if the transcribe binding uses a modifier-only shortcut
    if get_modifier_from_binding(app).is_some() {
        // Restart with new settings
        stop_listener();
        start_listener(app.clone());
    } else {
        stop_listener();
    }
}
