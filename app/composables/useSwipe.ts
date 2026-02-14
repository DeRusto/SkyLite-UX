type SwipeCallbacks = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

export function useSwipe(el: Ref<HTMLElement | null>, callbacks: SwipeCallbacks, options?: { threshold?: number }) {
  const threshold = options?.threshold ?? 50;
  let startX = 0;
  let startY = 0;

  function onTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    if (touch) {
      startX = touch.clientX;
      startY = touch.clientY;
    }
  }

  function onTouchEnd(e: TouchEvent) {
    const touch = e.changedTouches[0];
    if (!touch)
      return;

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) >= threshold) {
      if (deltaX < 0) {
        callbacks.onSwipeLeft?.();
      }
      else {
        callbacks.onSwipeRight?.();
      }
    }
  }

  onMounted(() => {
    const element = el.value;
    if (element) {
      element.addEventListener("touchstart", onTouchStart, { passive: true });
      element.addEventListener("touchend", onTouchEnd, { passive: true });
    }
  });

  onUnmounted(() => {
    const element = el.value;
    if (element) {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchend", onTouchEnd);
    }
  });
}
