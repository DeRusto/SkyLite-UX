import { consola } from "consola";

// Module-level singleton state — shared across all composable instances within the session
const _isUnlocked = ref(false);
const _pinProtectionEnabled = ref(true);
const _settingsLoaded = ref(false);

export function usePinProtection() {
  if (import.meta.client && !_settingsLoaded.value) {
    $fetch<{ pinProtectionEnabled?: boolean }>("/api/household/settings")
      .then((settings) => {
        _pinProtectionEnabled.value = settings.pinProtectionEnabled ?? true;
        if (!_pinProtectionEnabled.value) {
          _isUnlocked.value = true;
        }
        _settingsLoaded.value = true;
      })
      .catch((err) => {
        consola.warn("usePinProtection: Failed to load settings:", err);
      });
  }

  // Whether a PIN prompt is needed (protection enabled and not yet unlocked this session)
  const requiresPin = computed(() => _pinProtectionEnabled.value && !_isUnlocked.value);

  function unlock() {
    _isUnlocked.value = true;
  }

  function lock() {
    if (_pinProtectionEnabled.value) {
      _isUnlocked.value = false;
    }
  }

  function setPinProtectionEnabled(enabled: boolean) {
    _pinProtectionEnabled.value = enabled;
    if (!enabled) {
      _isUnlocked.value = true;
    }
    else {
      _isUnlocked.value = false;
    }
  }

  return {
    isUnlocked: readonly(_isUnlocked),
    pinProtectionEnabled: readonly(_pinProtectionEnabled),
    settingsLoaded: readonly(_settingsLoaded),
    requiresPin,
    unlock,
    lock,
    setPinProtectionEnabled,
  };
}
