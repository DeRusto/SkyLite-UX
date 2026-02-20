import { consola } from "consola";

import type { CreateShoppingListItemInput, Integration, ShoppingList, ShoppingListItem, UpdateShoppingListItemInput } from "~/types/database";
import type { IntegrationService } from "~/types/integrations";

import { getErrorMessage } from "~/utils/error";
import { performOptimisticUpdate } from "~/utils/optimistic";

import { useAlertToast } from "./useAlertToast";
import { useIntegrations } from "./useIntegrations";
import { useSyncManager } from "./useSyncManager";

export function useShoppingIntegrations() {
  const { integrations, loading: integrationsLoading, error: integrationsError, getService } = useIntegrations();
  const { getShoppingSyncData, getCachedIntegrationData, updateIntegrationCache } = useSyncManager();
  const { showError } = useAlertToast();

  const allShoppingLists = computed(() => {
    const lists: (ShoppingList & { source: "integration"; integrationId?: string; integrationName?: string })[] = [];

    const shoppingIntegrations = (integrations.value as readonly Integration[] || []).filter(integration =>
      integration.type === "shopping" && integration.enabled,
    );

    shoppingIntegrations.forEach((integration) => {
      try {
        const integrationLists = getCachedIntegrationData("shopping", integration.id) as ShoppingList[];
        if (integrationLists && Array.isArray(integrationLists)) {
          const listsWithIntegration = integrationLists.map((list: ShoppingList) => ({
            ...list,
            source: "integration" as const,
            integrationId: integration.id,
            integrationName: integration.name || "Unknown",
          }));
          lists.push(...listsWithIntegration);
        }
      }
      catch (error) {
        consola.warn(`Use Shopping Integrations: Failed to get shopping lists for integration ${integration.id}:`, error);
      }
    });

    return lists;
  });

  const shoppingIntegrations = computed(() => {
    return (integrations.value as readonly Integration[] || []).filter(integration =>
      integration.type === "shopping" && integration.enabled,
    );
  });

  const shoppingServices = computed(() => {
    const services: Map<string, IntegrationService> = new Map();
    shoppingIntegrations.value.forEach((integration) => {
      const service = getService(integration.id);
      if (service) {
        services.set(integration.id, service);
      }
    });
    return services;
  });

  const shoppingSyncStatus = computed(() => {
    try {
      return getShoppingSyncData([...(integrations.value as Integration[])]);
    }
    catch {
      return [];
    }
  });

  const loading = ref(false);
  const error = ref<string | null>(null);
  const syncing = ref(false);

  const refreshShoppingLists = async () => {
    loading.value = true;
    error.value = null;

    try {
      await refreshNuxtData("native-shopping-lists");
    }
    catch (err) {
      error.value = getErrorMessage(err, "Failed to refresh shopping lists");
      consola.error("Use Shopping Integrations: Error refreshing shopping lists:", err);
      throw err;
    }
    finally {
      loading.value = false;
    }
  };

  const addItemToList = async (
    integrationId: string,
    listId: string,
    itemData: CreateShoppingListItemInput,
  ): Promise<ShoppingListItem> => {
    const service = shoppingServices.value.get(integrationId);
    if (!service) {
      throw new Error(`Integration service not found for ${integrationId}`);
    }

    const integrationLists = getCachedIntegrationData("shopping", integrationId) as ShoppingList[];
    const previousLists = structuredClone(integrationLists ?? []);

    const tempId = crypto.randomUUID();
    const newItem: ShoppingListItem = {
      id: tempId,
      name: itemData.name ?? itemData.notes ?? "Unknown",
      checked: itemData.checked ?? false,
      order: itemData.order ?? 0,
      notes: itemData.notes ?? null,
      quantity: itemData.quantity ?? 1,
      unit: itemData.unit ?? null,
      label: itemData.label ?? null,
      food: itemData.food ?? null,
      source: "integration",
      integrationId,
    };

    try {
      const item = await performOptimisticUpdate(
        async () => {
          const fn = (service as unknown as { addItemToList?: (listId: string, itemData: CreateShoppingListItemInput) => Promise<ShoppingListItem> }).addItemToList;
          if (!fn)
            throw new Error(`Integration service ${integrationId} does not support adding items`);
          return fn(listId, itemData);
        },
        () => {
          if (integrationLists && Array.isArray(integrationLists)) {
            const listIndex = integrationLists.findIndex((l: ShoppingList) => l.id === listId);
            if (listIndex !== -1) {
              const list = integrationLists[listIndex];
              if (list) {
                const updatedItems = [...(list.items || []), newItem];
                const updatedList = { ...list, items: updatedItems };
                if (updatedList._count) {
                  updatedList._count = { ...updatedList._count, items: (updatedList._count.items || 0) + 1 };
                }
                const updatedLists = [...integrationLists];
                updatedLists[listIndex] = updatedList;
                updateIntegrationCache("shopping", integrationId, updatedLists);
              }
            }
          }
        },
        () => {
          updateIntegrationCache("shopping", integrationId, previousLists);
        },
      );

      if (!item) {
        throw new Error("Failed to add item to list");
      }

      // Reconciliation: Update temp item with real item
      const currentLists = getCachedIntegrationData("shopping", integrationId) as ShoppingList[];
      if (currentLists && Array.isArray(currentLists)) {
        const listIndex = currentLists.findIndex((l: ShoppingList) => l.id === listId);
        if (listIndex !== -1) {
          const list = currentLists[listIndex];
          if (list && list.items) {
            const tempIndex = list.items.findIndex(i => i.id === tempId);
            if (tempIndex !== -1) {
              const updatedItems = [...list.items];
              updatedItems[tempIndex] = item;
              const updatedList = { ...list, items: updatedItems };
              const updatedLists = [...currentLists];
              updatedLists[listIndex] = updatedList;
              updateIntegrationCache("shopping", integrationId, updatedLists);
            }
          }
        }
      }

      return item;
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to add item to integration list");
      showError("Error", message);
      throw err;
    }
  };

  const updateShoppingListItem = async (
    integrationId: string,
    itemId: string,
    updates: UpdateShoppingListItemInput,
  ): Promise<ShoppingListItem> => {
    const service = shoppingServices.value.get(integrationId);
    if (!service) {
      throw new Error(`Integration service not found for ${integrationId}`);
    }

    const integrationLists = getCachedIntegrationData("shopping", integrationId) as ShoppingList[];
    const previousLists = structuredClone(integrationLists ?? []);

    try {
      const updatedItem = await performOptimisticUpdate(
        async () => {
          const fn = (service as unknown as { updateShoppingListItem?: (itemId: string, updates: UpdateShoppingListItemInput) => Promise<ShoppingListItem> }).updateShoppingListItem;
          if (!fn)
            throw new Error(`Integration service ${integrationId} does not support updating items`);
          return fn(itemId, updates);
        },
        () => {
          if (integrationLists && Array.isArray(integrationLists)) {
            let itemFound = false;
            const updatedLists = integrationLists.map((list: ShoppingList) => {
              const itemIndex = list.items?.findIndex((i: ShoppingListItem) => i.id === itemId);
              if (itemIndex !== -1 && itemIndex !== undefined && list.items) {
                itemFound = true;
                const updatedItems = [...list.items];
                updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...updates } as any;
                return { ...list, items: updatedItems } as any;
              }
              return list;
            });

            if (itemFound) {
              updateIntegrationCache("shopping", integrationId, updatedLists);
            }
          }
        },
        () => {
          updateIntegrationCache("shopping", integrationId, previousLists);
        },
      );

      // Reconciliation
      const currentLists = getCachedIntegrationData("shopping", integrationId) as ShoppingList[];
      if (currentLists && Array.isArray(currentLists)) {
        let reconciled = false;
        const reconciledLists = currentLists.map((list: ShoppingList) => {
          const itemIndex = list.items?.findIndex((i: ShoppingListItem) => i.id === itemId);
          if (itemIndex !== -1 && itemIndex !== undefined && list.items) {
            reconciled = true;
            const reconciledItems = [...list.items];
            reconciledItems[itemIndex] = updatedItem;
            return { ...list, items: reconciledItems };
          }
          return list;
        });

        if (reconciled) {
          updateIntegrationCache("shopping", integrationId, reconciledLists);
        }
      }

      return updatedItem;
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to update integration item");
      showError("Error", message);
      throw err;
    }
  };

  const toggleItem = async (integrationId: string, itemId: string, checked: boolean): Promise<void> => {
    await updateShoppingListItem(integrationId, itemId, { checked });
  };

  const clearCompletedItems = async (integrationId: string, listId: string, completedItemIds?: string[]): Promise<void> => {
    const service = shoppingServices.value.get(integrationId);
    if (!service) {
      throw new Error(`Integration service not found for ${integrationId}`);
    }

    const integrationLists = getCachedIntegrationData("shopping", integrationId) as ShoppingList[];
    const previousLists = structuredClone(integrationLists ?? []);

    let itemsToDelete: string[] = [];
    if (completedItemIds && completedItemIds.length > 0) {
      itemsToDelete = completedItemIds;
    }
    else if (integrationLists && Array.isArray(integrationLists)) {
      const targetList = integrationLists.find(l => l.id === listId);
      if (targetList && targetList.items) {
        itemsToDelete = targetList.items.filter(i => i.checked).map(i => i.id);
      }
    }

    if (itemsToDelete.length === 0) {
      consola.warn(`Use Shopping Integrations: No completed items to clear from list ${listId}`);
      return;
    }

    try {
      await performOptimisticUpdate(
        async () => {
          const serviceObj = service as unknown as { deleteShoppingListItems?: (ids: string[]) => Promise<void> };
          if (typeof serviceObj.deleteShoppingListItems !== "function") {
            throw new TypeError(`Integration service ${integrationId} does not implement deleteShoppingListItems. Cannot clear items: ${itemsToDelete.join(", ")}`);
          }
          await serviceObj.deleteShoppingListItems(itemsToDelete);
        },
        () => {
          if (integrationLists && Array.isArray(integrationLists)) {
            const listIndex = integrationLists.findIndex(l => l.id === listId);
            if (listIndex !== -1) {
              const list = integrationLists[listIndex];
              if (list) {
                const updatedItems = list.items?.filter(i => !itemsToDelete.includes(i.id)) || [];
                const updatedList = { ...list, items: updatedItems };
                if (updatedList._count) {
                  updatedList._count = { ...updatedList._count, items: Math.max(0, (updatedList._count.items || 0) - itemsToDelete.length) };
                }
                const updatedLists = [...integrationLists];
                updatedLists[listIndex] = updatedList;
                updateIntegrationCache("shopping", integrationId, updatedLists);
              }
            }
          }
        },
        () => {
          updateIntegrationCache("shopping", integrationId, previousLists);
        },
      );
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to clear completed items");
      showError("Error", message);
      throw err;
    }
  };

  return {
    shoppingLists: readonly(allShoppingLists),
    shoppingIntegrations: readonly(shoppingIntegrations),
    shoppingServices: readonly(shoppingServices),
    shoppingSyncStatus: readonly(shoppingSyncStatus),

    loading: readonly(loading),
    syncing: readonly(syncing),
    integrationsLoading: readonly(integrationsLoading),
    integrationsError: readonly(integrationsError),

    refreshShoppingLists,
    addItemToList,
    updateShoppingListItem,
    toggleItem,
    clearCompletedItems,
  };
}
