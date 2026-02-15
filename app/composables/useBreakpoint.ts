export function useBreakpoint() {
  const isDesktop = ref(true);

  if (import.meta.client) {
    const query = window.matchMedia("(min-width: 1024px)");
    isDesktop.value = query.matches;

    const handler = (e: MediaQueryListEvent) => {
      isDesktop.value = e.matches;
    };
    query.addEventListener("change", handler);

    onScopeDispose(() => {
      query.removeEventListener("change", handler);
    });
  }

  const isMobile = computed(() => !isDesktop.value);

  return { isDesktop, isMobile };
}
