<script setup lang="ts">
import GlobalAppLoading from "~/components/global/globalAppLoading.vue";
import GlobalDock from "~/components/global/globalDock.vue";

const dock = false;
const { isLoading, loadingMessage, setLoading } = useGlobalLoading();
const { startIdleDetection, stopIdleDetection } = useScreensaver();

setLoading(true);

onNuxtReady(() => {
  setLoading(false);
  // Start screensaver idle detection when app is ready
  startIdleDetection();
});

onUnmounted(() => {
  // Clean up idle detection when app unmounts
  stopIdleDetection();
});
</script>

<template>
  <UApp>
    <div :class="app - layout">
      <div :class="app - container">
        <GlobalAppLoading :is-loading="isLoading" :loading-message="loadingMessage || ''" />

        <NuxtLayout>
          <div v-if="dock" class="flex h-full">
            <div class="flex flex-col flex-1">
              <div class="flex-1">
                <NuxtPage />
              </div>
              <GlobalDock />
            </div>
          </div>
          <NuxtPage v-else />
        </NuxtLayout>
      </div>
    </div>
  </UApp>
</template>

<style>
/* Hide scrollbars globally */
* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

*::-webkit-scrollbar {
  display: none;
}

/* Base Layout (Mobile First - Fullscreen) */
.app-layout {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background-color: var(--ui-bg-default, #ffffff);
}

.app-container {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: var(--ui-bg-default, #ffffff);
  overflow: hidden;
}

/* Dark mode support */
.dark .app-layout {
  background-color: var(--ui-bg-default, #141f38);
}

.dark .app-container {
  background-color: var(--ui-bg-default, #141f38);
}

/* Desktop Layout (Letterbox) */
@media (min-width: 1024px) {
  .app-layout {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #000;
  }

  .dark .app-layout {
    background-color: #000;
  }

  .app-container {
    max-width: calc(100vh * (16 / 9));
    max-height: calc(100vw * (9 / 16));
  }
}
</style>
