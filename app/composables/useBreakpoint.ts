const isDesktop = ref(true);
let initialized = false;

export function useBreakpoint() {
  if (import.meta.client && !initialized) {
    initialized = true;
    const query = window.matchMedia("(min-width: 1024px)");
    isDesktop.value = query.matches;

    const handler = (e: MediaQueryListEvent) => {
      isDesktop.value = e.matches;
    };
    query.addEventListener("change", handler);
  }

  const isMobile = computed(() => !isDesktop.value);

  return { isDesktop, isMobile };
}
