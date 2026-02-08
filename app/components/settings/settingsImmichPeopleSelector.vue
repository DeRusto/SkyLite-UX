<script setup lang="ts">
type ImmichPersonResponse = {
  id: string;
  name: string;
  thumbnailUrl?: string;
  birthDate?: string | null;
  type?: "person" | "pet";
};

const props = defineProps<{
  integrationId: string;
  selectedPeople?: string[];
}>();

const emit = defineEmits<{
  (e: "peopleSelected", peopleIds: string[]): void;
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const people = ref<ImmichPersonResponse[]>([]);
const selectedPeopleIds = ref<string[]>(props.selectedPeople || []);

// Watch for prop changes
watch(() => props.selectedPeople, (newVal) => {
  if (newVal) {
    selectedPeopleIds.value = [...newVal];
  }
}, { immediate: true });

// Fetch people on mount
onMounted(async () => {
  await fetchPeople();
});

async function fetchPeople() {
  if (!props.integrationId) {
    error.value = "Integration ID is required";
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const response = await $fetch<{ people: ImmichPersonResponse[]; pets?: ImmichPersonResponse[]; total: number }>(
      "/api/integrations/immich/people",
      {
        query: { integrationId: props.integrationId },
      },
    );
    // Combine people and pets into one list for selection
    const allPeople = [...(response.people || [])];
    if (response.pets && response.pets.length > 0) {
      allPeople.push(...response.pets);
    }
    people.value = allPeople;
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to fetch people from Immich";
  }
  finally {
    loading.value = false;
  }
}

function getFaceThumbnailUrl(person: ImmichPersonResponse): string {
  return `/api/integrations/immich/thumbnail?integrationId=${props.integrationId}&assetId=${person.id}&type=person`;
}

function togglePerson(personId: string) {
  const index = selectedPeopleIds.value.indexOf(personId);
  if (index === -1) {
    selectedPeopleIds.value.push(personId);
  }
  else {
    selectedPeopleIds.value.splice(index, 1);
  }
  emit("peopleSelected", selectedPeopleIds.value);
}

function isSelected(personId: string): boolean {
  return selectedPeopleIds.value.includes(personId);
}

function selectAll() {
  selectedPeopleIds.value = people.value.map(p => p.id);
  emit("peopleSelected", selectedPeopleIds.value);
}

function deselectAll() {
  selectedPeopleIds.value = [];
  emit("peopleSelected", selectedPeopleIds.value);
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <label class="block text-sm font-medium text-highlighted">
        Select People for Screensaver
      </label>
      <div class="flex gap-2">
        <UButton
          v-if="people.length > 0"
          size="xs"
          variant="ghost"
          @click="selectAll"
        >
          Select All
        </UButton>
        <UButton
          v-if="selectedPeopleIds.length > 0"
          size="xs"
          variant="ghost"
          @click="deselectAll"
        >
          Clear
        </UButton>
      </div>
    </div>

    <p class="text-sm text-muted">
      Filter screensaver photos by specific people recognized in your Immich library.
    </p>

    <div
      v-if="error"
      role="alert"
      class="bg-error/10 text-error rounded-md px-3 py-2 text-sm flex items-center gap-2"
    >
      <UIcon name="i-lucide-alert-circle" class="h-4 w-4 flex-shrink-0" />
      {{ error }}
    </div>

    <div v-if="loading" class="text-center py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 mx-auto mb-3 text-primary" />
      <p class="text-sm text-muted">
        Loading people from Immich...
      </p>
    </div>

    <div v-else-if="people.length === 0 && !error" class="text-center py-8">
      <UIcon name="i-lucide-users" class="h-12 w-12 mx-auto mb-3 text-muted" />
      <p class="text-sm text-muted">
        No recognized people found in your Immich library.
      </p>
      <p class="text-xs text-muted mt-1">
        Immich will recognize faces as you add more photos.
      </p>
    </div>

    <!-- People Grid with Face Thumbnails -->
    <div v-else class="max-h-80 overflow-y-auto">
      <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
        <div
          v-for="person in people"
          :key="person.id"
          class="relative flex flex-col items-center cursor-pointer transition-all duration-200 group"
          role="checkbox"
          :aria-checked="isSelected(person.id)"
          :aria-label="person.name || 'Unknown person'"
          tabindex="0"
          @click="togglePerson(person.id)"
          @keydown.enter.prevent="togglePerson(person.id)"
          @keydown.space.prevent="togglePerson(person.id)"
        >
          <!-- Face Thumbnail (circular) -->
          <div
            class="relative w-16 h-16 rounded-full overflow-hidden border-2 transition-all duration-200"
            :class="[
              isSelected(person.id)
                ? 'border-primary ring-2 ring-primary/30 shadow-md'
                : 'border-default group-hover:border-muted group-hover:shadow-sm',
            ]"
          >
            <img
              :src="getFaceThumbnailUrl(person)"
              :alt="person.name || 'Unknown'"
              class="w-full h-full object-cover"
              loading="lazy"
            >

            <!-- Selection Checkmark Overlay -->
            <div
              v-if="isSelected(person.id)"
              class="absolute inset-0 bg-primary/20 flex items-center justify-center"
            >
              <div class="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow">
                <UIcon name="i-lucide-check" class="h-3 w-3 text-white" />
              </div>
            </div>
          </div>

          <!-- Person Name -->
          <p
            class="mt-1.5 text-xs font-medium truncate max-w-full text-center px-1"
            :class="isSelected(person.id) ? 'text-primary' : 'text-highlighted'"
            :title="person.name || 'Unknown'"
          >
            {{ person.name || 'Unknown' }}
          </p>
        </div>
      </div>
    </div>

    <div v-if="selectedPeopleIds.length > 0" class="text-sm text-muted">
      {{ selectedPeopleIds.length }} {{ selectedPeopleIds.length === 1 ? 'person' : 'people' }} selected
    </div>
  </div>
</template>
