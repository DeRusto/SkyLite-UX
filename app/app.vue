<script setup lang="ts">
import GlobalAppLoading from "~/components/global/globalAppLoading.vue";
import GlobalDock from "~/components/global/globalDock.vue";

const dock = false;
const { isLoading, loadingMessage, setLoading } = useGlobalLoading();
const { isDesktop } = useBreakpoint();
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
    <div :class="isDesktop ? 'app-letterbox' : 'app-fullscreen'">
      <div :class="isDesktop ? 'app-container-16-9' : 'app-container-full'">
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

/* Letterbox container - black background for bars (desktop only) */
.app-letterbox {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #000;
  overflow: hidden;
}

/* 16:9 aspect ratio container (desktop only) */
.app-container-16-9 {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: calc(100vh * (16 / 9));
  max-height: calc(100vw * (9 / 16));
  background-color: var(--ui-bg-default, #ffffff);
  overflow: hidden;
}

/* Fullscreen container - fills entire viewport (mobile/tablet) */
.app-fullscreen {
  position: fixed;
  inset: 0;
  overflow: hidden;
}

/* Full viewport container (mobile/tablet) */
.app-container-full {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: var(--ui-bg-default, #ffffff);
  overflow: hidden;
}

/* Dark mode support */
.dark .app-letterbox {
  background-color: #000;
}

.dark .app-container-16-9 {
  background-color: var(--ui-bg-default, #141f38);
}

.dark .app-container-full {
  background-color: var(--ui-bg-default, #141f38);
}
</style>
