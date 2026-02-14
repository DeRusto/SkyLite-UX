<script setup lang="ts">
import GlobalBottomTabBar from "~/components/global/globalBottomTabBar.vue";
import GlobalSideBar from "~/components/global/globalSideBar.vue";

const { isDesktop } = useBreakpoint();
</script>

<template>
  <div class="flex h-full">
    <GlobalSideBar v-if="isDesktop" />
    <div class="flex flex-col flex-1 overflow-hidden">
      <div
        class="flex-1 overflow-auto"
        :class="{ 'pb-20': !isDesktop }"
      >
        <slot />
      </div>
    </div>
    <GlobalBottomTabBar v-if="!isDesktop" />
  </div>
</template>
