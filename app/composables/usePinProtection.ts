import { consola } from "consola";

export function usePinProtection() {
  // Use useState() instead of module-level refs for proper SSR request isolation.
  // On the server each request gets its own state; on the client the key-based
  // lookup gives us the same session-scoped singleton behaviour we had before.
  const _isUnlocked = useState<boolean>("pinProtection_isUnlocked", () => false);
  const _pinProtectionEnabled = useState<boolean>("pinProtection_pinProtectionEnabled", () => true);
  const _settingsLoaded = useState<boolean>("pinProtection_settingsLoaded", () => false);

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
        // Leave _settingsLoaded false so the next composable access can retry.
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
