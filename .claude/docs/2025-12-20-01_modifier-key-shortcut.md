# Modifier-Only Shortcut Support

**Title:** Support single modifier keys (e.g., right Command) as push-to-talk trigger
**Created:** 2025-12-20
**Last Updated:** 2025-12-20
**Tags:** feature, keyboard, shortcuts, rdev

## Overview

Enable users to use a single modifier key (like right Command, right Option, etc.) as their push-to-talk trigger, similar to apps like Superwhisper and Whisper Transcription.

## Problem

The current shortcut system uses `tauri-plugin-global-shortcut`, which only supports traditional modifier+key combinations. The validation in `shortcut.rs` explicitly rejects modifier-only shortcuts:

```rust
fn validate_shortcut_string(raw: &str) -> Result<(), String> {
    let modifiers = ["ctrl", "control", "shift", "alt", "option", "meta", "command", ...];
    // Rejects if all parts are modifiers
}
```

## Solution

Add a parallel keyboard listener using the `rdev` crate (already a dependency) that can detect individual modifier key press/release events. This will be:

1. **Additive** - Existing shortcut system remains unchanged
2. **Optional** - User explicitly enables this mode
3. **Isolated** - New module with minimal coupling to existing code

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Keyboard Input                          │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│ tauri-plugin-global-     │    │ modifier_shortcut.rs (NEW)   │
│ shortcut                 │    │ Uses rdev::listen            │
│                          │    │                              │
│ Handles: Cmd+Space, etc. │    │ Handles: RightMeta, etc.     │
└──────────────────────────┘    └──────────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
                    ┌─────────────────┐
                    │   ACTION_MAP    │
                    │ (actions.rs)    │
                    └─────────────────┘
```

## Implementation Plan

### Step 1: Add Settings (settings.rs)

Add new fields to `AppSettings`:

```rust
/// Enable using a single modifier key as the transcription trigger
#[serde(default)]
pub modifier_shortcut_enabled: bool,

/// Which modifier key to use (e.g., "MetaRight", "MetaLeft", "AltRight")
#[serde(default)]
pub modifier_shortcut_key: Option<String>,
```

### Step 2: Create Modifier Shortcut Module (modifier_shortcut.rs)

New module that:
- Uses `rdev::listen` to capture low-level keyboard events
- Detects specific modifier key press/release (e.g., `Key::MetaRight`)
- Filters out modifier presses that are part of combos (e.g., Cmd+C)
- Calls the same `ShortcutAction` interface as existing shortcuts

Key logic for combo detection:
```rust
// Track if other keys were pressed while modifier is held
// If modifier released AND no other keys pressed during hold → trigger action
// If other keys pressed during hold → it's a combo, ignore
```

### Step 3: Add Tauri Commands (shortcut.rs)

```rust
#[tauri::command]
#[specta::specta]
pub fn change_modifier_shortcut_enabled(app: AppHandle, enabled: bool) -> Result<(), String>

#[tauri::command]
#[specta::specta]
pub fn change_modifier_shortcut_key(app: AppHandle, key: String) -> Result<(), String>
```

### Step 4: Initialize Listener (lib.rs)

In `initialize_core_logic`:
```rust
// Start modifier shortcut listener if enabled
modifier_shortcut::init_modifier_listener(&app_handle);
```

### Step 5: Frontend UI Changes

Add to GeneralSettings.tsx or create ModifierShortcut.tsx:
- Toggle: "Use modifier key as shortcut"
- Dropdown: Select which modifier (Right Command, Right Option, etc.)
- Note: "Works in push-to-talk mode only"

## Supported Modifier Keys

| Display Name     | rdev Key        | Platform    |
|------------------|-----------------|-------------|
| Right Command    | Key::MetaRight  | macOS       |
| Left Command     | Key::MetaLeft   | macOS       |
| Right Option     | Key::Alt        | macOS       |
| Right Ctrl       | Key::ControlRight | All       |
| Right Shift      | Key::ShiftRight | All         |

## Edge Cases & Considerations

1. **Combo detection**: If user presses Cmd+C, we must NOT trigger recording
   - Solution: Track if any other key was pressed while modifier held
   - Only trigger on release if modifier was pressed alone

2. **Quick taps vs holds**:
   - For toggle mode: Press triggers start, release does nothing; next press triggers stop
   - For PTT mode: Press → start, Release → stop

3. **Platform differences**:
   - macOS: MetaLeft/MetaRight = Command keys
   - Windows: MetaLeft/MetaRight = Windows keys
   - Linux: MetaLeft/MetaRight = Super keys

4. **Coexistence with regular shortcuts**:
   - Both systems can be active simultaneously
   - If user has both Cmd+Space AND right Cmd configured, both work

5. **rdev thread safety**:
   - `rdev::listen` blocks, must run in separate thread
   - Use channels to communicate with main Tauri runtime

## Files to Create/Modify

### New Files
- `src-tauri/src/modifier_shortcut.rs` - Core listener logic

### Modified Files
- `src-tauri/src/settings.rs` - Add new settings fields
- `src-tauri/src/shortcut.rs` - Add Tauri commands
- `src-tauri/src/lib.rs` - Register module, init listener, add commands
- `src/components/settings/general/GeneralSettings.tsx` - Add UI toggle
- `src/components/settings/ModifierShortcut.tsx` (new) - Modifier key selector

## Testing

1. Set right Command as trigger
2. Press and hold right Command → recording starts
3. Release → recording stops, transcription runs
4. Press Cmd+C → should NOT trigger recording
5. Press Cmd+Space (if configured) → should still work via regular shortcut system

## Rollback / Disable

If issues arise, user can:
1. Disable via settings toggle
2. The regular shortcut system continues to work independently
