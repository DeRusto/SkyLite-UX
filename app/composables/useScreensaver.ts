const DEFAULT_IDLE_TIMEOUT = 5 * 60 * 1000;

const IDLE_EVENTS = ["mousedown", "mousemove", "keydown", "touchstart", "scroll"] as const;

const isScreensaverActive = ref(false);
const idleTimeout = ref(DEFAULT_IDLE_TIMEOUT);
const lastActivity = ref(Date.now());

let idleTimer: ReturnType<typeof setTimeout> | null = null;

export function useScreensaver() {
  const router = useRouter();

  const activateScreensaver = () => {
    isScreensaverActive.value = true;
    router.push("/screensaver");
  };

  const resetIdleTimer = () => {
    lastActivity.value = Date.now();

    if (idleTimer) {
      clearTimeout(idleTimer);
    }

    if (!isScreensaverActive.value) {
      idleTimer = setTimeout(() => {
        activateScreensaver();
      }, idleTimeout.value);
    }
  };

  const deactivateScreensaver = () => {
    isScreensaverActive.value = false;
    resetIdleTimer();
    router.push("/calendar");
  };

  const startIdleDetection = () => {
    IDLE_EVENTS.forEach((event) => {
      if (typeof document !== "undefined") {
        document.addEventListener(event, resetIdleTimer, { passive: true });
      }
    });

    resetIdleTimer();
  };

  const stopIdleDetection = () => {
    IDLE_EVENTS.forEach((event) => {
      if (typeof document !== "undefined") {
        document.removeEventListener(event, resetIdleTimer);
      }
    });

    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const setIdleTimeout = (timeout: number) => {
    idleTimeout.value = timeout;
    resetIdleTimer();
  };

  const triggerScreensaver = activateScreensaver;

  return {
    isScreensaverActive: readonly(isScreensaverActive),
    idleTimeout: readonly(idleTimeout),
    lastActivity: readonly(lastActivity),
    startIdleDetection,
    stopIdleDetection,
    deactivateScreensaver,
    setIdleTimeout,
    triggerScreensaver,
    resetIdleTimer,
  };
}
