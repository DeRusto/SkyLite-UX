<script setup lang="ts">
import { consola } from "consola";

import type { CreateIntegrationInput, Integration } from "~/types/database";
import type { ConnectionTestResult } from "~/types/ui";

import SettingsIntegrationDialog from "~/components/settings/settingsIntegrationDialog.vue";
import SettingsIntegrationList from "~/components/settings/settingsIntegrationList.vue";
import SettingsPinDialog from "~/components/settings/settingsPinDialog.vue";
import { useAlertToast } from "~/composables/useAlertToast";
import { useIntegrationStatus } from "~/composables/useIntegrationStatus";
import { integrationServices } from "~/plugins/02.appInit";
import { createIntegrationService, integrationRegistry } from "~/types/integrations";

const { showError, showSuccess } = useAlertToast();
const { fetchIntegrationStatus, isStatusLoading } = useIntegrationStatus();
const { users } = useUsers();
const { integrations, loading: integrationsLoading, servicesInitializing, createIntegration, updateIntegration, deleteIntegration, refreshIntegrations } = useIntegrations();
const { checkIntegrationCache, purgeIntegrationCache, triggerImmediateSync } = useSyncManager();

const selectedIntegration = ref<Integration | null>(null);
const isIntegrationDialogOpen = ref(false);
const connectionTestResult = ref<ConnectionTestResult>(null);

// PIN protection
const isPinDialogOpen = ref(false);
const isIntegrationsSectionUnlocked = ref(false);
const selectedAdultId = ref<string | null>(null);

const adultUsers = computed(() => users.value.filter(u => u.role === "ADULT"));

watch(adultUsers, (adults) => {
  if (adults.length === 0) {
    isIntegrationsSectionUnlocked.value = true;
  }
  if (!selectedAdultId.value && adults.length > 0) {
    selectedAdultId.value = adults[0].id;
  }
}, { immediate: true });

// Fetch statuses when section is unlocked
watch(isIntegrationsSectionUnlocked, async (unlocked) => {
  if (unlocked) {
    for (const integration of integrations.value as Integration[]) {
      if (integration.enabled) {
        fetchIntegrationStatus(integration.id);
      }
    }
  }
}, { immediate: true });

// Refresh statuses when integrations change
watch(() => (integrations.value as Integration[]).filter(i => i.enabled).map(i => i.id), (enabledIds) => {
  if (isIntegrationsSectionUnlocked.value) {
    for (const id of enabledIds) {
      if (!isStatusLoading(id)) {
        fetchIntegrationStatus(id);
      }
    }
  }
}, { deep: true });

const activeIntegrationTab = ref<string>("");

const availableIntegrationTypes = computed(() => {
  const types = new Set<string>();
  integrationRegistry.forEach(config => types.add(config.type));
  return Array.from(types);
});

onMounted(() => {
  if (availableIntegrationTypes.value.length > 0) {
    activeIntegrationTab.value = availableIntegrationTypes.value[0] || "";
  }
});

const filteredIntegrations = computed(() => {
  return (integrations.value as Integration[]).filter(i => i.type === activeIntegrationTab.value);
});

function handleUnlockIntegrations() {
  if (adultUsers.value.length === 0) {
    isIntegrationsSectionUnlocked.value = true;
    return;
  }
  if (!selectedAdultId.value) {
    selectedAdultId.value = adultUsers.value[0]?.id ?? null;
  }
  isPinDialogOpen.value = true;
}

function handlePinVerified() {
  isIntegrationsSectionUnlocked.value = true;
}

function openIntegrationDialog(integration: Integration | null = null) {
  if (!activeIntegrationTab.value && availableIntegrationTypes.value.length > 0) {
    activeIntegrationTab.value = availableIntegrationTypes.value[0] || "";
  }
  selectedIntegration.value = integration;
  isIntegrationDialogOpen.value = true;
}

async function handleIntegrationSave(integrationData: CreateIntegrationInput) {
  try {
    connectionTestResult.value = { success: false, message: "Testing connection...", isLoading: true };

    if (selectedIntegration.value?.id) {
      const { data: cachedIntegrations } = useNuxtData("integrations");
      const previousIntegrations = cachedIntegrations.value ? [...cachedIntegrations.value] : [];

      if (cachedIntegrations.value && Array.isArray(cachedIntegrations.value)) {
        const idx = cachedIntegrations.value.findIndex((i: Integration) => i.id === selectedIntegration.value!.id);
        if (idx !== -1) {
          cachedIntegrations.value[idx] = { ...cachedIntegrations.value[idx], ...integrationData, updatedAt: new Date() };
        }
      }

      try {
        connectionTestResult.value = { success: false, message: "Updating integration...", isLoading: true };
        await updateIntegration(selectedIntegration.value.id, {
          ...integrationData,
          createdAt: selectedIntegration.value.createdAt,
          updatedAt: new Date(),
        });
        connectionTestResult.value = { success: true, message: "Integration updated successfully!", isLoading: false };
      }
      catch (error) {
        if (cachedIntegrations.value && previousIntegrations.length > 0) {
          cachedIntegrations.value.splice(0, cachedIntegrations.value.length, ...previousIntegrations);
        }
        throw error;
      }
    }
    else {
      const { data: cachedIntegrations } = useNuxtData("integrations");
      const previousIntegrations = cachedIntegrations.value ? [...cachedIntegrations.value] : [];
      const newIntegration = { id: `temp-${Date.now()}`, ...integrationData, createdAt: new Date(), updatedAt: new Date(), enabled: false };

      if (cachedIntegrations.value && Array.isArray(cachedIntegrations.value)) {
        cachedIntegrations.value.push(newIntegration);
      }

      try {
        connectionTestResult.value = { success: false, message: "Creating integration...", isLoading: true };
        const created = await createIntegration({ ...integrationData, createdAt: new Date(), updatedAt: new Date() });

        if (cachedIntegrations.value && Array.isArray(cachedIntegrations.value)) {
          const tempIdx = cachedIntegrations.value.findIndex((i: Integration) => i.id === newIntegration.id);
          if (tempIdx !== -1)
            cachedIntegrations.value[tempIdx] = created;
        }
        connectionTestResult.value = { success: true, message: "Integration created successfully!", isLoading: false };
      }
      catch (error) {
        if (cachedIntegrations.value && previousIntegrations.length > 0) {
          cachedIntegrations.value.splice(0, cachedIntegrations.value.length, ...previousIntegrations);
        }
        throw error;
      }
    }

    await refreshNuxtData("integrations");
    await refreshIntegrations();
    setTimeout(() => {
      isIntegrationDialogOpen.value = false;
      selectedIntegration.value = null;
      connectionTestResult.value = null;
    }, 1500);
  }
  catch (error) {
    consola.error("SettingsIntegrationsSection: Failed to save integration:", error);
    connectionTestResult.value = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save integration",
      isLoading: false,
    };
  }
}

async function handleIntegrationDelete(integrationId: string) {
  try {
    const { data: cachedIntegrations } = useNuxtData("integrations");
    const previousIntegrations = cachedIntegrations.value ? [...cachedIntegrations.value] : [];

    if (cachedIntegrations.value && Array.isArray(cachedIntegrations.value)) {
      cachedIntegrations.value.splice(0, cachedIntegrations.value.length, ...cachedIntegrations.value.filter((i: Integration) => i.id !== integrationId));
    }

    try {
      await deleteIntegration(integrationId);
      consola.debug("SettingsIntegrationsSection: Integration deleted successfully");
      showSuccess("Integration Deleted", "Integration has been removed successfully");
    }
    catch (err) {
      if (cachedIntegrations.value && previousIntegrations.length > 0) {
        cachedIntegrations.value.splice(0, cachedIntegrations.value.length, ...previousIntegrations);
      }
      throw err;
    }

    await refreshNuxtData("integrations");
    await refreshIntegrations();
    isIntegrationDialogOpen.value = false;
    selectedIntegration.value = null;
  }
  catch (err) {
    consola.error("SettingsIntegrationsSection: Failed to delete integration:", err);
    showError("Failed to Delete Integration", err instanceof Error ? err.message : "An unexpected error occurred");
  }
}

async function handleToggleIntegration(integrationId: string, enabled: boolean) {
  try {
    const integration = (integrations.value as Integration[]).find(i => i.id === integrationId);
    if (!integration)
      throw new Error("Integration not found");

    const { data: cachedIntegrations } = useNuxtData("integrations");
    const previousIntegrations = cachedIntegrations.value ? [...cachedIntegrations.value] : [];

    if (cachedIntegrations.value && Array.isArray(cachedIntegrations.value)) {
      const idx = cachedIntegrations.value.findIndex((i: Integration) => i.id === integrationId);
      if (idx !== -1)
        cachedIntegrations.value[idx] = { ...cachedIntegrations.value[idx], enabled };
    }

    // Manage integration service lifecycle
    if (enabled) {
      try {
        const service = await createIntegrationService(integration);
        if (service) {
          integrationServices.set(integrationId, service);
          service.initialize().catch(err => consola.warn(`Background init failed for ${integration.name}:`, err));
        }
      }
      catch (err) {
        consola.warn(`Failed to create integration service for ${integration.name}:`, err);
      }
    }
    else {
      try {
        integrationServices.delete(integrationId);
      }
      catch (err) {
        consola.warn(`Failed to remove integration service for ${integration.name}:`, err);
      }
    }

    try {
      if (enabled) {
        await updateIntegration(integrationId, { enabled });
        if (!checkIntegrationCache(integration.type, integrationId)) {
          consola.debug(`No cache for ${integration.type}:${integrationId}, triggering sync`);
          await triggerImmediateSync(integration.type, integrationId);
        }
      }
      else {
        await updateIntegration(integrationId, { enabled });
        purgeIntegrationCache(integration.type, integrationId);
        consola.debug(`Purged cache for disabled ${integration.type}:${integrationId}`);
      }
    }
    catch (error) {
      consola.warn(`Rolling back optimistic update for ${integrationId}:`, error);
      if (cachedIntegrations.value && previousIntegrations.length > 0) {
        cachedIntegrations.value.splice(0, cachedIntegrations.value.length, ...previousIntegrations);
      }
      // Rollback service state
      if (enabled) {
        try {
          integrationServices.delete(integrationId);
        }
        catch (err) {
          consola.warn(`Failed to rollback service creation for ${integration.name}:`, err);
        }
      }
      else {
        try {
          const service = await createIntegrationService(integration);
          if (service) {
            integrationServices.set(integrationId, service);
            service.initialize().catch(err => consola.warn(`Background init failed for ${integration.name}:`, err));
          }
        }
        catch (err) { consola.warn(`Failed to rollback service removal for ${integration.name}:`, err); }
      }
      throw error;
    }
  }
  catch (err) {
    consola.error("SettingsIntegrationsSection: Failed to toggle integration:", err);
    showError("Failed to Toggle Integration", err instanceof Error ? err.message : "An unexpected error occurred");
  }
}
</script>

<template>
  <div class="bg-default rounded-lg shadow-sm border border-default p-6 mb-6">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-2">
        <h2 class="text-lg font-semibold text-highlighted">
          Integrations
        </h2>
        <UIcon
          v-if="adultUsers.length > 0 && !isIntegrationsSectionUnlocked"
          name="i-lucide-lock"
          class="h-4 w-4 text-muted"
        />
      </div>
      <UButton
        v-if="isIntegrationsSectionUnlocked"
        icon="i-lucide-plug"
        @click="openIntegrationDialog()"
      >
        Add Integration
      </UButton>
      <UButton
        v-else-if="adultUsers.length > 0"
        icon="i-lucide-lock"
        variant="outline"
        @click="handleUnlockIntegrations"
      >
        Unlock
      </UButton>
    </div>

    <!-- Locked state -->
    <div
      v-if="adultUsers.length > 0 && !isIntegrationsSectionUnlocked"
      class="text-center py-12"
    >
      <div class="flex flex-col items-center gap-4">
        <div class="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
          <UIcon name="i-lucide-lock" class="h-8 w-8 text-muted" />
        </div>
        <div class="text-center">
          <p class="text-lg font-medium text-highlighted">
            Access Restricted
          </p>
          <p class="text-muted mt-1">
            Verify with an adult profile PIN to unlock integration settings
          </p>
        </div>
        <div v-if="adultUsers.length > 1" class="flex items-center gap-2">
          <label class="text-sm text-muted">Adult:</label>
          <select
            v-model="selectedAdultId"
            class="border border-default rounded px-2 py-1 text-sm bg-default"
          >
            <option
              v-for="adult in adultUsers"
              :key="adult.id"
              :value="adult.id"
            >
              {{ adult.name }}
            </option>
          </select>
        </div>
        <UButton
          icon="i-lucide-key"
          @click="handleUnlockIntegrations"
        >
          Enter PIN
        </UButton>
      </div>
    </div>

    <!-- Unlocked content -->
    <SettingsIntegrationList
      v-else
      :integrations="filteredIntegrations"
      :integrations-loading="integrationsLoading"
      :services-initializing="servicesInitializing"
      :active-tab="activeIntegrationTab"
      :available-tabs="availableIntegrationTypes"
      @toggle="handleToggleIntegration"
      @edit="openIntegrationDialog"
      @change-tab="activeIntegrationTab = $event"
    />

    <SettingsIntegrationDialog
      :integration="selectedIntegration"
      :is-open="isIntegrationDialogOpen"
      :existing-integrations="integrations as Integration[]"
      :connection-test-result="connectionTestResult"
      @close="() => { isIntegrationDialogOpen = false; selectedIntegration = null; }"
      @open="isIntegrationDialogOpen = true"
      @save="handleIntegrationSave"
      @delete="handleIntegrationDelete"
    />

    <SettingsPinDialog
      v-if="selectedAdultId"
      :is-open="isPinDialogOpen"
      :user-id="selectedAdultId"
      title="Access Integrations"
      @close="isPinDialogOpen = false"
      @verified="handlePinVerified"
    />
  </div>
</template>
