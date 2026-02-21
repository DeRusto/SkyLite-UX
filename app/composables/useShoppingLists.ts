import { consola } from "consola";

import type { CreateShoppingListInput, CreateShoppingListItemInput, ShoppingListItem, ShoppingListWithOrder, ShoppingListWithOrderResponse, UpdateShoppingListItemInput } from "~/types/database";

import { useAlertToast } from "~/composables/useAlertToast";
import { getErrorMessage } from "~/utils/error";
import { performOptimisticUpdate } from "~/utils/optimistic";

export function useShoppingLists() {
  const loading = useState<boolean>("shopping-lists-loading", () => false);
  const error = useState<string | null>("shopping-lists-error", () => null);

  const { data: shoppingLists } = useNuxtData<ShoppingListWithOrderResponse[]>("native-shopping-lists");
  const { showError } = useAlertToast();

  const currentShoppingLists = computed(() => (shoppingLists.value || []).map(list => ({
    ...list,
    createdAt: new Date(list.createdAt),
    updatedAt: new Date(list.updatedAt),
  })) as ShoppingListWithOrder[]);

  const getShoppingLists = async () => {
    loading.value = true;
    error.value = null;
    try {
      await refreshNuxtData("native-shopping-lists");
      consola.debug("Use Shopping Lists: Shopping lists refreshed successfully");
    }
    catch (err) {
      error.value = getErrorMessage(err, "Failed to fetch shopping lists");
      consola.error("Use Shopping Lists: Error fetching shopping lists:", err);
      throw err;
    }
    finally {
      loading.value = false;
    }
  };

  const createShoppingList = async (listData: CreateShoppingListInput) => {
    const previousLists = structuredClone(shoppingLists.value ?? []);
    const tempId = crypto.randomUUID();
    const newList: ShoppingListWithOrderResponse = {
      id: tempId,
      name: listData.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: listData.order ?? (shoppingLists.value?.length || 0) + 1,
      items: [],
      _count: { items: 0 },
    };

    try {
      const createdList = await performOptimisticUpdate(
        () => $fetch<ShoppingListWithOrderResponse>("/api/shopping-lists", {
          method: "POST",
          body: listData,
        }),
        () => {
          if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
            shoppingLists.value.push(newList);
          }
        },
        () => {
          if (shoppingLists.value) {
            shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
          }
        },
      );

      if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
        const tempIndex = shoppingLists.value.findIndex((l: ShoppingListWithOrderResponse) => l.id === tempId);
        if (tempIndex !== -1) {
          shoppingLists.value[tempIndex] = createdList;
        }
      }

      return createdList;
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to create shopping list");
      showError("Error", message);
      throw err;
    }
  };

  const updateShoppingList = async (listId: string, updates: { name?: string }) => {
    const previousLists = structuredClone(shoppingLists.value ?? []);

    try {
      const updatedListFromResponse = await performOptimisticUpdate(
        () => $fetch<ShoppingListWithOrderResponse>(`/api/shopping-lists/${listId}`, {
          method: "PUT",
          body: updates,
        }),
        () => {
          if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
            const listIndex = shoppingLists.value.findIndex((l: ShoppingListWithOrderResponse) => l.id === listId);
            if (listIndex !== -1) {
              shoppingLists.value[listIndex] = { ...shoppingLists.value[listIndex], ...updates } as any;
            }
          }
        },
        () => {
          if (shoppingLists.value) {
            shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
          }
        },
      );

      // Reconciliation
      if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
        const listIndex = shoppingLists.value.findIndex((l: ShoppingListWithOrderResponse) => l.id === listId);
        if (listIndex !== -1) {
          shoppingLists.value[listIndex] = updatedListFromResponse;
        }
      }

      return updatedListFromResponse;
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to update shopping list");
      showError("Error", message);
      throw err;
    }
  };

  const updateShoppingListItem = async (itemId: string, updates: UpdateShoppingListItemInput) => {
    const previousLists = structuredClone(shoppingLists.value ?? []);

    try {
      const updatedItem = await performOptimisticUpdate(
        () => $fetch<ShoppingListItem>(`/api/shopping-list-items/${itemId}`, {
          method: "PUT",
          body: updates,
        }),
        () => {
          if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
            for (let listIndex = 0; listIndex < shoppingLists.value.length; listIndex++) {
              const list = shoppingLists.value[listIndex];
              if (list) {
                const itemIndex = (list.items as any[])?.findIndex((i: any) => i.id === itemId);
                if (itemIndex !== -1 && itemIndex !== undefined && list.items) {
                  const updatedItems = [...list.items] as any[];
                  updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...updates };
                  shoppingLists.value[listIndex] = { ...list, items: updatedItems } as any;
                  break;
                }
              }
            }
          }
        },
        () => {
          if (shoppingLists.value) {
            shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
          }
        },
      );

      // Reconciliation
      if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
        for (let listIndex = 0; listIndex < shoppingLists.value.length; listIndex++) {
          const list = shoppingLists.value[listIndex];
          if (list) {
            const itemIndex = (list.items as any[])?.findIndex((i: any) => i.id === itemId);
            if (itemIndex !== -1 && itemIndex !== undefined && list.items) {
              const confirmedItems = [...list.items] as any[];
              confirmedItems[itemIndex] = updatedItem;
              shoppingLists.value[listIndex] = { ...list, items: confirmedItems } as any;
              break;
            }
          }
        }
      }

      return updatedItem;
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to update item");
      showError("Error", message);
      throw err;
    }
  };

  const addItemToList = async (listId: string, itemData: CreateShoppingListItemInput) => {
    const previousLists = structuredClone(shoppingLists.value ?? []);
    const tempId = crypto.randomUUID();
    const newItem: ShoppingListItem = {
      id: tempId,
      name: itemData.name ?? "",
      checked: itemData.checked ?? false,
      order: itemData.order ?? 0,
      notes: itemData.notes ?? null,
      quantity: itemData.quantity ?? 1,
      unit: itemData.unit ?? null,
      label: itemData.label ?? null,
      food: itemData.food ?? null,
      source: "native",
    };

    try {
      const createdItem = await performOptimisticUpdate(
        () => $fetch<ShoppingListItem>(`/api/shopping-lists/${listId}/items`, {
          method: "POST",
          body: itemData,
        }),
        () => {
          if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
            const listIndex = shoppingLists.value.findIndex((l: ShoppingListWithOrderResponse) => l.id === listId);
            if (listIndex !== -1) {
              const list = shoppingLists.value[listIndex];
              if (list) {
                const updatedItems = [...(list.items || []), newItem] as any[];
                const newCount = list._count ? { ...list._count, items: (list._count.items || 0) + 1 } : { items: 1 };
                shoppingLists.value[listIndex] = { ...list, items: updatedItems, _count: newCount } as any;
              }
            }
          }
        },
        () => {
          if (shoppingLists.value) {
            shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
          }
        },
      );

      if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
        const listIndex = shoppingLists.value.findIndex((l: ShoppingListWithOrderResponse) => l.id === listId);
        if (listIndex !== -1) {
          const list = shoppingLists.value[listIndex];
          if (list && list.items) {
            const tempIndex = (list.items as any[]).findIndex((i: any) => i.id === tempId);
            if (tempIndex !== -1) {
              const updatedItems = [...list.items] as any[];
              updatedItems[tempIndex] = createdItem;
              shoppingLists.value[listIndex] = { ...list, items: updatedItems } as any;
            }
          }
        }
      }

      return createdItem;
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to add item");
      showError("Error", message);
      throw err;
    }
  };

  const deleteShoppingList = async (listId: string) => {
    const previousLists = structuredClone(shoppingLists.value ?? []);

    try {
      return await performOptimisticUpdate(
        async () => {
          await $fetch<void>(`/api/shopping-lists/${listId}`, {
            method: "DELETE",
          });
          return true;
        },
        () => {
          if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
            const listIndex = shoppingLists.value.findIndex((l: ShoppingListWithOrderResponse) => l.id === listId);
            if (listIndex !== -1) {
              shoppingLists.value.splice(listIndex, 1);
            }
          }
        },
        () => {
          if (shoppingLists.value) {
            shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
          }
        },
      );
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to delete shopping list");
      showError("Error", message);
      throw err;
    }
  };

  const toggleItem = async (itemId: string, checked: boolean) => {
    return updateShoppingListItem(itemId, { checked });
  };

  const reorderShoppingList = async (listId: string, direction: "up" | "down") => {
    const previousLists = structuredClone(shoppingLists.value ?? []);
    try {
      const sortedLists = [...currentShoppingLists.value].sort((a, b) => (a.order || 0) - (b.order || 0));
      const currentIndex = sortedLists.findIndex(list => list.id === listId);

      if (currentIndex === -1)
        return;

      let targetIndex;
      if (direction === "up" && currentIndex > 0) {
        targetIndex = currentIndex - 1;
      }
      else if (direction === "down" && currentIndex < sortedLists.length - 1) {
        targetIndex = currentIndex + 1;
      }
      else {
        return;
      }

      const currentList = sortedLists[currentIndex];
      const targetUserList = sortedLists[targetIndex];

      if (!currentList || !targetUserList)
        return;

      const currentOrder = currentList.order || 0;
      const targetOrder = targetUserList.order || 0;

      const updatedLists = currentShoppingLists.value.map((list) => {
        if (list.id === currentList.id) {
          return { ...list, order: targetOrder };
        }
        if (list.id === targetUserList.id) {
          return { ...list, order: currentOrder };
        }
        return list;
      });

      const newOrder = updatedLists
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(list => list.id);

      await performOptimisticUpdate(
        // @ts-expect-error - Excessive stack depth in Nuxt route types
        () => $fetch("/api/shopping-lists/reorder", {
          method: "PUT",
          body: { listIds: newOrder },
        }),
        () => {
          if (shoppingLists.value) {
            // Update the cache with correctly typed objects
            const updatedCache = updatedLists.map(list => ({
              ...list,
              createdAt: list.createdAt.toISOString(),
              updatedAt: list.updatedAt.toISOString(),
            }));
            shoppingLists.value.splice(0, shoppingLists.value.length, ...updatedCache as any);
          }
        },
        () => {
          if (shoppingLists.value) {
            shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
          }
        },
      );
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to reorder shopping list");
      showError("Error", message);
      throw err;
    }
  };

  const reorderItem = async (itemId: string, direction: "up" | "down") => {
    const previousLists = structuredClone(shoppingLists.value ?? []);
    try {
      const listIndex = currentShoppingLists.value.findIndex(list =>
        (list.items as any[])?.some(item => item.id === itemId),
      );

      if (listIndex === -1)
        return;

      const list = currentShoppingLists.value[listIndex];
      if (!list?.items)
        return;

      const sortedItems = [...list.items].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      const currentIndex = sortedItems.findIndex((item: any) => item.id === itemId);

      if (currentIndex === -1)
        return;

      let targetIndex;
      if (direction === "up" && currentIndex > 0) {
        targetIndex = currentIndex - 1;
      }
      else if (direction === "down" && currentIndex < sortedItems.length - 1) {
        targetIndex = currentIndex + 1;
      }
      else {
        return;
      }

      const currentItem = sortedItems[currentIndex] as any;
      const targetItem = sortedItems[targetIndex] as any;

      if (!currentItem || !targetItem)
        return;

      const currentOrder = currentItem.order || 0;
      const targetOrder = targetItem.order || 0;

      const updatedItems = (list.items as any[]).map((item) => {
        if (item.id === currentItem.id) {
          return { ...item, order: targetOrder };
        }
        if (item.id === targetItem.id) {
          return { ...item, order: currentOrder };
        }
        return item;
      });

      const newOrder = [...updatedItems]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(item => item.id);

      await performOptimisticUpdate(
        () => $fetch("/api/shopping-list-items/reorder", {
          method: "PUT",
          body: { itemIds: newOrder },
        }),
        () => {
          if (shoppingLists.value && shoppingLists.value[listIndex]) {
            shoppingLists.value[listIndex] = { ...list, items: updatedItems } as any;
          }
        },
        () => {
          if (shoppingLists.value) {
            shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
          }
        },
      );
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to reorder item");
      showError("Error", message);
      throw err;
    }
  };

  const deleteCompletedItems = async (listId: string, completedItemIds?: string[]) => {
    const previousLists = structuredClone(shoppingLists.value ?? []);

    try {
      await performOptimisticUpdate(
        () => $fetch(`/api/shopping-lists/${listId}/items/clear-completed`, {
          method: "POST",
          body: { action: "delete", completedItemIds },
        }),
        () => {
          if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
            const listIndex = shoppingLists.value.findIndex((l: ShoppingListWithOrderResponse) => l.id === listId);
            if (listIndex !== -1) {
              const list = shoppingLists.value[listIndex];
              if (list) {
                const items = list.items as any[];
                const itemsToDelete = completedItemIds || items.filter(item => item.checked).map(item => item.id) || [];
                if (itemsToDelete.length > 0) {
                  const updatedItems = items.filter(item => !itemsToDelete.includes(item.id)) || [];
                  const newCount = list._count ? { ...list._count, items: Math.max(0, (list._count.items || 0) - itemsToDelete.length) } : { items: updatedItems.length };
                  shoppingLists.value[listIndex] = { ...list, items: updatedItems, _count: newCount } as any;
                }
              }
            }
          }
        },
        () => {
          if (shoppingLists.value) {
            shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
          }
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
    shoppingLists: readonly(currentShoppingLists),
    loading: readonly(loading),
    error: readonly(error),
    getShoppingLists,
    createShoppingList,
    updateShoppingList,
    updateShoppingListItem,
    addItemToList,
    deleteShoppingList,
    toggleItem,
    reorderShoppingList,
    reorderItem,
    deleteCompletedItems,
  };
}
