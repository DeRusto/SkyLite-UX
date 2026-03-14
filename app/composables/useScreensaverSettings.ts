import { consola } from "consola";

import type { ImmichPerson, ScreensaverSettingsData } from "~/types/screensaver";

export function useScreensaverSettings() {
  const { showError, showSuccess } = useAlertToast();

  const settings = ref<ScreensaverSettingsData | null>(null);
  const loading = ref(true);
  const people = ref<ImmichPerson[]>([]);
  const pets = ref<ImmichPerson[]>([]);
  const loadingPeople = ref(false);
  const peopleError = ref<string | null>(null);
  const syncing = ref(false);
  const lastSync = ref<Date | null>(null);

  const immichIntegration = computed(() => {
    if (!settings.value)
      return null;
    return settings.value.photoIntegrations.find(i => i.service === "immich") || null;
  });

  const selectedPhotoIntegration = computed(() => {
    if (!settings.value)
      return null;
    if (!settings.value.selectedPhotoSource)
      return settings.value.photoIntegrations[0] || null;
    return settings.value.photoIntegrations.find(i => i.id === settings.value?.selectedPhotoSource) || settings.value.photoIntegrations[0] || null;
  });

  const selectedImmichAlbums = computed(() => {
    const s = immichIntegration.value?.settings as Record<string, unknown> | null;
    return Array.isArray(s?.selectedAlbums) ? s!.selectedAlbums as string[] : [];
  });

  const selectedPeople = computed(() => {
    const s = immichIntegration.value?.settings as Record<string, unknown> | null;
    return Array.isArray(s?.selectedPeople) ? s!.selectedPeople as string[] : [];
  });

  async function fetchSettings() {
    loading.value = true;
    try {
      settings.value = await $fetch<ScreensaverSettingsData>("/api/screensaver/settings");
      lastSync.value = null;
    }
    catch (err) {
      consola.error("Failed to fetch screensaver settings:", err);
      showError("Error", "Failed to load screensaver settings");
    }
    finally {
      loading.value = false;
    }
  }

  async function saveSettings(updates: Partial<ScreensaverSettingsData>) {
    try {
      const data = await $fetch<ScreensaverSettingsData>("/api/screensaver/settings", {
        method: "PUT",
        body: updates,
      });
      if (settings.value)
        Object.assign(settings.value, data);
      showSuccess("Saved", "Screensaver settings updated");
    }
    catch (err) {
      consola.error("Failed to save screensaver settings:", err);
      showError("Error", "Failed to save screensaver settings");
    }
  }

  async function updateIntegrationAlbums(service: "immich" | "google-photos", albumIds: string[]) {
    const integration = settings.value?.photoIntegrations.find(i => i.service === service);
    if (!integration)
      return;
    try {
      await $fetch(`/api/integrations/${integration.id}`, {
        method: "PUT",
        body: { settings: { ...(integration.settings as Record<string, unknown> || {}), selectedAlbums: albumIds } },
      });
      if (integration.settings) {
        (integration.settings as Record<string, unknown>).selectedAlbums = albumIds;
      }
      else {
        integration.settings = { selectedAlbums: albumIds } as Record<string, unknown>;
      }
      showSuccess("Albums Updated", `${albumIds.length} album${albumIds.length === 1 ? "" : "s"} selected for screensaver`);
    }
    catch (err) {
      consola.error(`Failed to update ${service} album selection:`, err);
      showError("Error", "Failed to save album selection");
    }
  }

  async function handlePeopleSelected(peopleIds: string[]) {
    if (!immichIntegration.value)
      return;
    try {
      await $fetch(`/api/integrations/${immichIntegration.value.id}`, {
        method: "PUT",
        body: { settings: { ...(immichIntegration.value.settings as Record<string, unknown> || {}), selectedPeople: peopleIds } },
      });
      if (immichIntegration.value.settings) {
        (immichIntegration.value.settings as Record<string, unknown>).selectedPeople = peopleIds;
      }
      else {
        immichIntegration.value.settings = { selectedPeople: peopleIds } as Record<string, unknown>;
      }
      showSuccess("People Updated", `${peopleIds.length} ${peopleIds.length === 1 ? "person" : "people/pets"} selected for screensaver`);
    }
    catch (err) {
      consola.error("Failed to update people selection:", err);
      showError("Error", "Failed to save people selection");
    }
  }

  async function fetchPeople() {
    if (!immichIntegration.value)
      return;
    loadingPeople.value = true;
    peopleError.value = null;
    try {
      const data = await $fetch<{ people: ImmichPerson[]; pets: ImmichPerson[]; total: number }>("/api/integrations/immich/people", {
        query: { integrationId: immichIntegration.value.id },
      });
      people.value = data.people || [];
      pets.value = data.pets || [];
    }
    catch (err: unknown) {
      consola.error("Failed to fetch people from Immich:", err);
      const fetchError = err as { data?: { message?: string }; statusMessage?: string; message?: string };
      const errorMessage = fetchError?.data?.message
        || fetchError?.statusMessage
        || (err instanceof Error ? err.message : null)
        || "Failed to fetch people from Immich";
      const isUnreachable = ["fetch failed", "ECONNREFUSED", "EHOSTUNREACH", "ETIMEDOUT", "ENOTFOUND", "network", "Could not connect"]
        .some(s => errorMessage.includes(s));
      peopleError.value = isUnreachable
        ? "Could not connect to Immich server. Please check that your Immich server is running and accessible."
        : errorMessage;
    }
    finally {
      loadingPeople.value = false;
    }
  }

  async function syncNow() {
    if (!immichIntegration.value || syncing.value)
      return;
    syncing.value = true;
    try {
      const result = await $fetch<{ success: boolean; message: string; lastSync: string }>("/api/integrations/immich/sync", {
        method: "POST",
        body: { integrationId: immichIntegration.value.id },
      });
      lastSync.value = new Date(result.lastSync);
      if (result.success) {
        showSuccess("Sync Complete", "Successfully synced with Immich");
        await fetchPeople();
      }
      else {
        showError("Sync Failed", result.message);
      }
    }
    catch (err) {
      consola.error("Failed to sync with Immich:", err);
      showError("Sync Error", "Failed to sync with Immich");
    }
    finally {
      syncing.value = false;
    }
  }

  return {
    settings,
    loading,
    people,
    pets,
    loadingPeople,
    peopleError,
    syncing,
    lastSync,
    immichIntegration,
    selectedPhotoIntegration,
    selectedImmichAlbums,
    selectedPeople,
    fetchSettings,
    saveSettings,
    updateIntegrationAlbums,
    handlePeopleSelected,
    fetchPeople,
    syncNow,
  };
}
