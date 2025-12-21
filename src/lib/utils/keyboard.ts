/**
 * Keyboard utility functions for handling keyboard events
 */

export type OSType = "macos" | "windows" | "linux" | "unknown";

/**
 * Extract a consistent key name from a KeyboardEvent
 * This function provides cross-platform keyboard event handling
 * and returns key names appropriate for the target operating system
 */
export const getKeyName = (
  e: KeyboardEvent,
  osType: OSType = "unknown",
): string => {
  // Handle special cases first
  if (e.code) {
    const code = e.code;

    // Handle function keys (F1-F24)
    if (code.match(/^F\d+$/)) {
      return code.toLowerCase(); // F1, F2, ..., F14, F15, etc.
    }

    // Handle regular letter keys (KeyA -> a)
    if (code.match(/^Key[A-Z]$/)) {
      return code.replace("Key", "").toLowerCase();
    }

    // Handle digit keys (Digit0 -> 0)
    if (code.match(/^Digit\d$/)) {
      return code.replace("Digit", "");
    }

    // Handle numpad digit keys (Numpad0 -> numpad 0)
    if (code.match(/^Numpad\d$/)) {
      return code.replace("Numpad", "numpad ").toLowerCase();
    }

    // Handle modifier keys - OS-specific naming
    const getModifierName = (baseModifier: string): string => {
      switch (baseModifier) {
        case "shift":
          return "shift";
        case "ctrl":
          return osType === "macos" ? "ctrl" : "ctrl";
        case "alt":
          return osType === "macos" ? "option" : "alt";
        case "meta":
          // Windows key on Windows/Linux, Command key on Mac
          if (osType === "macos") return "command";
          return "super";
        default:
          return baseModifier;
      }
    };

    // For modifier keys, we preserve the left/right distinction using the code
    // This allows detecting "MetaRight" vs "MetaLeft" for modifier-only shortcuts
    const modifierCodeMap: Record<string, string> = {
      ShiftLeft: "ShiftLeft",
      ShiftRight: "ShiftRight",
      ControlLeft: "ControlLeft",
      ControlRight: "ControlRight",
      AltLeft: "AltLeft",
      AltRight: "AltRight",
      MetaLeft: "MetaLeft",
      MetaRight: "MetaRight",
      OSLeft: "MetaLeft",
      OSRight: "MetaRight",
    };

    // Return the raw code for modifiers to preserve left/right distinction
    if (modifierCodeMap[code]) {
      return modifierCodeMap[code];
    }

    const modifierMap: Record<string, string> = {
      CapsLock: "caps lock",
      Tab: "tab",
      Enter: "enter",
      Space: "space",
      Backspace: "backspace",
      Delete: "delete",
      Escape: "esc",
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      Home: "home",
      End: "end",
      PageUp: "page up",
      PageDown: "page down",
      Insert: "insert",
      PrintScreen: "print screen",
      ScrollLock: "scroll lock",
      Pause: "pause",
      ContextMenu: "menu",
      NumpadMultiply: "numpad *",
      NumpadAdd: "numpad +",
      NumpadSubtract: "numpad -",
      NumpadDecimal: "numpad .",
      NumpadDivide: "numpad /",
      NumLock: "num lock",
    };

    if (modifierMap[code]) {
      return modifierMap[code];
    }

    // Handle punctuation and special characters
    const punctuationMap: Record<string, string> = {
      Semicolon: ";",
      Equal: "=",
      Comma: ",",
      Minus: "-",
      Period: ".",
      Slash: "/",
      Backquote: "`",
      BracketLeft: "[",
      Backslash: "\\",
      BracketRight: "]",
      Quote: "'",
    };

    if (punctuationMap[code]) {
      return punctuationMap[code];
    }

    // For any other codes, try to convert to a reasonable format
    return code.toLowerCase().replace(/([a-z])([A-Z])/g, "$1 $2");
  }

  // Fallback to e.key if e.code is not available
  if (e.key) {
    const key = e.key;

    // Handle special key names with OS-specific formatting
    const keyMap: Record<string, string> = {
      Control: osType === "macos" ? "ctrl" : "ctrl",
      Alt: osType === "macos" ? "option" : "alt",
      Shift: "shift",
      Meta:
        osType === "macos" ? "command" : osType === "windows" ? "win" : "super",
      OS:
        osType === "macos" ? "command" : osType === "windows" ? "win" : "super",
      CapsLock: "caps lock",
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      Escape: "esc",
      " ": "space",
    };

    if (keyMap[key]) {
      return keyMap[key];
    }

    return key.toLowerCase();
  }

  // Last resort fallback
  return `unknown-${e.keyCode || e.which || 0}`;
};

/**
 * Check if a key string represents a modifier-only shortcut
 */
export const isModifierOnlyKey = (key: string): boolean => {
  const modifierCodes = [
    "MetaLeft",
    "MetaRight",
    "ShiftLeft",
    "ShiftRight",
    "ControlLeft",
    "ControlRight",
    "AltLeft",
    "AltRight",
  ];
  return modifierCodes.includes(key);
};

/**
 * Get display-friendly name for a modifier key code
 */
export const getModifierDisplayName = (
  code: string,
  osType: OSType,
): string => {
  const displayNames: Record<string, Record<OSType | "unknown", string>> = {
    MetaRight: {
      macos: "Right ⌘",
      windows: "Right Win",
      linux: "Right Super",
      unknown: "Right Meta",
    },
    MetaLeft: {
      macos: "Left ⌘",
      windows: "Left Win",
      linux: "Left Super",
      unknown: "Left Meta",
    },
    ShiftRight: {
      macos: "Right ⇧",
      windows: "Right Shift",
      linux: "Right Shift",
      unknown: "Right Shift",
    },
    ShiftLeft: {
      macos: "Left ⇧",
      windows: "Left Shift",
      linux: "Left Shift",
      unknown: "Left Shift",
    },
    ControlRight: {
      macos: "Right ⌃",
      windows: "Right Ctrl",
      linux: "Right Ctrl",
      unknown: "Right Ctrl",
    },
    ControlLeft: {
      macos: "Left ⌃",
      windows: "Left Ctrl",
      linux: "Left Ctrl",
      unknown: "Left Ctrl",
    },
    AltRight: {
      macos: "Right ⌥",
      windows: "Right Alt",
      linux: "Right Alt",
      unknown: "Right Alt",
    },
    AltLeft: {
      macos: "Left ⌥",
      windows: "Left Alt",
      linux: "Left Alt",
      unknown: "Left Alt",
    },
  };

  return displayNames[code]?.[osType] || code;
};

/**
 * Get display-friendly key combination string for the current OS
 * Returns basic plus-separated format with correct platform key names
 */
export const formatKeyCombination = (
  combination: string,
  osType: OSType,
): string => {
  // Check if this is a modifier-only shortcut
  if (isModifierOnlyKey(combination)) {
    return getModifierDisplayName(combination, osType);
  }

  // For regular combinations, format each part
  return combination
    .split("+")
    .map((part) => {
      const trimmed = part.trim();
      if (isModifierOnlyKey(trimmed)) {
        return getModifierDisplayName(trimmed, osType);
      }
      return trimmed;
    })
    .join("+");
};

/**
 * Convert a modifier key code to a normalized name for use in combinations
 * e.g., "MetaLeft" -> "command" (on macOS)
 */
export const normalizeModifierForCombination = (
  key: string,
  osType: OSType = "unknown",
): string => {
  const normalizations: Record<string, Record<OSType | "unknown", string>> = {
    MetaLeft: {
      macos: "command",
      windows: "super",
      linux: "super",
      unknown: "meta",
    },
    MetaRight: {
      macos: "command",
      windows: "super",
      linux: "super",
      unknown: "meta",
    },
    ShiftLeft: {
      macos: "shift",
      windows: "shift",
      linux: "shift",
      unknown: "shift",
    },
    ShiftRight: {
      macos: "shift",
      windows: "shift",
      linux: "shift",
      unknown: "shift",
    },
    ControlLeft: {
      macos: "ctrl",
      windows: "ctrl",
      linux: "ctrl",
      unknown: "ctrl",
    },
    ControlRight: {
      macos: "ctrl",
      windows: "ctrl",
      linux: "ctrl",
      unknown: "ctrl",
    },
    AltLeft: {
      macos: "option",
      windows: "alt",
      linux: "alt",
      unknown: "alt",
    },
    AltRight: {
      macos: "option",
      windows: "alt",
      linux: "alt",
      unknown: "alt",
    },
  };

  return normalizations[key]?.[osType] || key;
};

/**
 * Normalize modifier keys for use in key combinations
 * For modifier-only shortcuts, preserve the full code (e.g., "MetaRight")
 * For combinations, normalize to the base modifier name
 */
export const normalizeKey = (key: string): string => {
  // If it's a standalone modifier key code, keep it as-is
  if (isModifierOnlyKey(key)) {
    return key;
  }

  // Handle left/right variants of modifier keys (legacy format)
  if (key.startsWith("left ") || key.startsWith("right ")) {
    const parts = key.split(" ");
    if (parts.length === 2) {
      // Return just the modifier name without left/right prefix
      return parts[1];
    }
  }
  return key;
};

/**
 * Check if we're recording a modifier-only shortcut
 * Returns true if only modifier keys have been pressed (no regular keys)
 */
export const isRecordingModifierOnly = (keys: string[]): boolean => {
  return keys.length > 0 && keys.every((key) => isModifierOnlyKey(key));
};
