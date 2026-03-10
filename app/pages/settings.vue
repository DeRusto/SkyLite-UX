<script setup lang="ts">
import { consola } from "consola";

import type { Integration } from "~/types/database";

import SettingsHouseholdCalendars from "~/components/settings/settingsHouseholdCalendars.vue";
import SettingsIntegrationsSection from "~/components/settings/settingsIntegrationsSection.vue";
import SettingsPinChangeDialog from "~/components/settings/settingsPinChangeDialog.vue";
import SettingsUsersSection from "~/components/settings/settingsUsersSection.vue";
import { useAlertToast } from "~/composables/useAlertToast";
import { getSlogan } from "~/types/global";

const { showSuccess } = useAlertToast();
const { integrations } = useIntegrations();
const { triggerImmediateSync } = useSyncManager();

const colorMode = useColorMode();
const isDark = computed({
  get() {
    return colorMode.value === "dark";
  },
  set() {
    colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
  },
});

onMounted(() => {
  if (!colorMode.value) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    colorMode.preference = prefersDark ? "dark" : "light";
  }
});

const logoLoaded = ref(true);

// Household settings (needed by SettingsIntegrationsSection + SettingsHouseholdCalendars)
const householdSettings = ref<any>(null);

onMounted(async () => {
  try {
    const settings = await $fetch<any>("/api/household/settings");
    householdSettings.value = settings;
  }
  catch (err) {
    consola.warn("Settings: Failed to load household settings:", err);
  }
});

// PIN change dialog
const isPinChangeDialogOpen = ref(false);

function handlePinChanged() {
  isPinChangeDialogOpen.value = false;
  if (householdSettings.value) {
    householdSettings.value.hasAdultPin = true;
  }
  showSuccess("PIN Changed", "Adult PIN has been updated successfully");
}

// Trigger calendar sync when user colors change
function handleUserSaved() {
  const calendarIntegrations = (integrations.value as Integration[] || []).filter(i => i.type === "calendar" && i.enabled);
  for (const integration of calendarIntegrations) {
    if (integration.service === "google-calendar") {
      consola.debug(`Settings: Triggering sync for integration ${integration.id} to update user colors`);
      triggerImmediateSync("calendar", integration.id).catch((err) => {
        consola.warn(`Settings: Failed to trigger sync for ${integration.id}:`, err);
      });
    }
  }
}

// Trigger sync when household calendars change
function handleTriggerSync() {
  const calendarIntegrations = (integrations.value as Integration[]).filter(i => i.type === "calendar" && i.enabled);
  calendarIntegrations.forEach(i => triggerImmediateSync("calendar", i.id));
}
</script>

<template>
  <div class="flex w-full flex-col rounded-lg">
    <div class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default">
      <GlobalDateHeader />
    </div>

    <div class="flex-1 bg-default p-6">
      <div class="max-w-4xl mx-auto">
        <!-- Users Section -->
        <SettingsUsersSection @user-saved="handleUserSaved" />

        <!-- Household PIN Section -->
        <div class="bg-default rounded-lg shadow-sm border border-default p-6 mb-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-lg font-semibold text-highlighted">
                <UIcon name="i-lucide-lock" class="h-4 w-4 inline mr-2" />
                Household Settings
              </h2>
              <p class="text-sm text-muted">
                Manage household security settings
              </p>
            </div>
            <UButton
              icon="i-lucide-settings"
              @click="isPinChangeDialogOpen = true"
            >
              Change PIN
            </UButton>
          </div>
          <div class="flex items-center justify-between py-3 border-b border-default mb-4">
            <div>
              <p class="font-medium text-highlighted">
                Current PIN
              </p>
              <p class="text-sm text-muted">
                Used to access settings and integrations
              </p>
            </div>
            <p class="text-sm text-muted">
              ••••
            </p>
          </div>
          <p class="text-xs text-muted">
            The default PIN is "1234". You should change this to secure your household settings.
          </p>
        </div>

        <!-- Integrations Section -->
        <SettingsIntegrationsSection :household-settings="householdSettings" />

        <!-- Household Calendars Section -->
        <SettingsHouseholdCalendars
          :household-settings="householdSettings"
          :integrations="integrations as Integration[]"
          @update:household-settings="householdSettings = $event"
          @trigger-sync="handleTriggerSync"
        />

        <!-- Screensaver Settings -->
        <div class="bg-default rounded-lg shadow-sm border border-default p-6 mb-6">
          <h2 class="text-lg font-semibold text-highlighted mb-4">
            <UIcon name="i-lucide-monitor" class="h-5 w-5 inline mr-1" />
            Screensaver Settings
          </h2>
          <SettingsScreensaver />
        </div>

        <!-- Application Settings -->
        <div class="bg-default rounded-lg shadow-sm border border-default p-6 mb-6">
          <h2 class="text-lg font-semibold text-highlighted mb-4">
            Application Settings
          </h2>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-highlighted">
                  Dark Mode
                </p>
                <p class="text-sm text-muted">
                  Toggle between light and dark themes (Coming Soon™)
                </p>
              </div>
              <USwitch
                v-model="isDark"
                color="primary"
                checked-icon="i-lucide-moon"
                unchecked-icon="i-lucide-sun"
                size="xl"
                aria-label="Toggle dark mode"
              />
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-highlighted">
                  Notifications
                </p>
                <p class="text-sm text-muted">
                  Enable push notifications (Coming Soon™)
                </p>
              </div>
              <USwitch
                color="primary"
                checked-icon="i-lucide-alarm-clock-check"
                unchecked-icon="i-lucide-alarm-clock-off"
                size="xl"
                aria-label="Toggle notifications"
              />
            </div>
          </div>
        </div>

        <!-- About -->
        <div class="bg-default rounded-lg shadow-sm border border-default p-6">
          <h2 class="text-lg font-semibold text-highlighted mb-4">
            About
          </h2>
          <div class="flex items-center gap-4 mb-6 p-4 bg-muted/30 rounded-lg border border-muted">
            <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <img
                v-if="logoLoaded"
                src="/skylite.svg"
                alt="SkyLite UX Logo"
                class="w-8 h-8"
                style="object-fit: contain"
                @error="logoLoaded = false"
              >
              <UIcon
                v-else
                name="i-lucide-sun"
                class="w-6 h-6 text-primary"
              />
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-lg font-semibold text-highlighted">
                  SkyLite UX
                </h3>
                <span class="text-xs font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-md">
                  v{{ $config.public.skyliteVersion }}
                </span>
              </div>
              <p class="text-sm text-muted">
                {{ getSlogan() }}
              </p>
            </div>
          </div>
          <div class="mt-6 pt-4 border-t border-muted">
            <p class="text-xs text-muted text-center">
              Built with ❤️ by the community using Nuxt {{ $config.public.nuxtVersion.replace("^", "") }} & Nuxt UI {{ $config.public.nuxtUiVersion.replace("^", "") }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <SettingsPinChangeDialog
      :is-open="isPinChangeDialogOpen"
      :has-adult-pin="!!householdSettings?.hasAdultPin"
      @close="isPinChangeDialogOpen = false"
      @saved="handlePinChanged"
    />
  </div>
</template>
