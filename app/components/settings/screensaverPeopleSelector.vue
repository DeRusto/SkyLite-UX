<script setup lang="ts">
import type { ImmichPerson } from "~/types/screensaver";

const props = defineProps<{
  people: ImmichPerson[];
  pets: ImmichPerson[];
  selectedPeople: string[];
  loading: boolean;
  error: string | null;
  selectedAlbums: string[];
}>();

const emit = defineEmits<{
  peopleSelected: [ids: string[]];
  retry: [];
}>();

function isPersonSelected(personId: string): boolean {
  return props.selectedPeople.includes(personId);
}

function togglePerson(personId: string) {
  const current = [...props.selectedPeople];
  const index = current.indexOf(personId);
  if (index === -1) {
    current.push(personId);
  }
  else {
    current.splice(index, 1);
  }
  emit("peopleSelected", current);
}

function selectAllPeople() {
  const allPeopleIds = props.people.map(p => p.id);
  const currentPetIds = props.selectedPeople.filter(id => props.pets.some(pet => pet.id === id));
  emit("peopleSelected", [...new Set([...allPeopleIds, ...currentPetIds])]);
}

function selectAllPets() {
  const allPetIds = props.pets.map(p => p.id);
  const currentPeopleIds = props.selectedPeople.filter(id => props.people.some(person => person.id === id));
  emit("peopleSelected", [...new Set([...currentPeopleIds, ...allPetIds])]);
}

function clearPeople() {
  const currentPetIds = props.selectedPeople.filter(id => props.pets.some(pet => pet.id === id));
  emit("peopleSelected", currentPetIds);
}

function clearPets() {
  const currentPeopleIds = props.selectedPeople.filter(id => props.people.some(person => person.id === id));
  emit("peopleSelected", currentPeopleIds);
}
</script>

<template>
  <div class="border-t border-default pt-6">
    <h3 class="text-base font-semibold text-highlighted mb-4">
      <UIcon name="i-lucide-users" class="h-4 w-4 inline mr-1" />
      People & Pets
    </h3>

    <p class="text-sm text-muted mb-4">
      Select people and pets to filter which photos appear in the screensaver slideshow.
      <template v-if="props.selectedAlbums.length > 0">
        <template v-if="props.selectedPeople.length > 0">
          Only photos of selected people/pets <strong>from selected albums</strong> will be shown.
        </template>
        <template v-else>
          Photos of <strong>anyone</strong> from selected albums will be shown (no people filter applied).
        </template>
      </template>
      <template v-else>
        When no albums are selected, all photos of the selected people/pets will be shown.
      </template>
    </p>

    <!-- Selection summary -->
    <div v-if="props.selectedPeople.length > 0" class="mb-4 p-2 bg-primary/10 rounded-lg text-sm text-primary flex items-center gap-2">
      <UIcon name="i-lucide-check-circle" class="h-4 w-4 flex-shrink-0" />
      {{ props.selectedPeople.length }} {{ props.selectedPeople.length === 1 ? 'person/pet' : 'people/pets' }} selected for screensaver
      <UButton
        size="xs"
        variant="ghost"
        color="primary"
        class="ml-auto"
        @click="emit('peopleSelected', [])"
      >
        Clear All
      </UButton>
    </div>

    <!-- Loading state -->
    <div v-if="props.loading" class="text-center py-6">
      <UIcon name="i-lucide-loader-2" class="animate-spin h-6 w-6 mx-auto mb-2 text-primary" />
      <p class="text-sm text-muted">
        Loading people from Immich...
      </p>
    </div>

    <!-- Error state -->
    <div
      v-else-if="props.error"
      role="alert"
      class="bg-error/10 text-error rounded-md px-3 py-2 text-sm flex items-center gap-2"
    >
      <UIcon name="i-lucide-alert-circle" class="h-4 w-4 flex-shrink-0" />
      {{ props.error }}
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        class="ml-auto"
        @click="emit('retry')"
      >
        Retry
      </UButton>
    </div>

    <template v-else>
      <!-- People Section -->
      <div v-if="props.people.length > 0" class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-medium text-highlighted">
            <UIcon name="i-lucide-user" class="h-3.5 w-3.5 inline mr-1" />
            People ({{ props.people.length }})
          </h4>
          <div class="flex gap-2">
            <UButton
              size="xs"
              variant="ghost"
              @click="selectAllPeople"
            >
              Select All
            </UButton>
            <UButton
              v-if="props.people.some(p => isPersonSelected(p.id))"
              size="xs"
              variant="ghost"
              @click="clearPeople"
            >
              Clear
            </UButton>
          </div>
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          <div
            v-for="person in props.people"
            :key="person.id"
            class="flex flex-col items-center gap-1.5 p-2 rounded-lg cursor-pointer transition-all duration-200 group"
            role="checkbox"
            :aria-checked="isPersonSelected(person.id)"
            :aria-label="person.name"
            tabindex="0"
            @click="togglePerson(person.id)"
            @keydown.enter.prevent="togglePerson(person.id)"
            @keydown.space.prevent="togglePerson(person.id)"
          >
            <div
              class="relative w-14 h-14 rounded-full overflow-hidden border-2 transition-all duration-200"
              :class="[
                isPersonSelected(person.id)
                  ? 'border-primary ring-2 ring-primary/30 shadow-md'
                  : 'border-default group-hover:border-muted group-hover:shadow-sm',
              ]"
            >
              <img
                :src="person.thumbnailUrl"
                :alt="person.name"
                class="w-full h-full object-cover"
                loading="lazy"
                @error="(e: Event) => (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&size=56&background=6BCBCB&color=fff`"
              >
              <!-- Selection checkmark overlay -->
              <div
                v-if="isPersonSelected(person.id)"
                class="absolute inset-0 bg-primary/20 flex items-center justify-center"
              >
                <div class="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow">
                  <UIcon name="i-lucide-check" class="h-3 w-3 text-white" />
                </div>
              </div>
            </div>
            <p
              class="text-xs text-center truncate w-full"
              :class="isPersonSelected(person.id) ? 'text-primary font-medium' : 'text-highlighted'"
            >
              {{ person.name }}
            </p>
          </div>
        </div>
      </div>

      <!-- Pets Section -->
      <div v-if="props.pets.length > 0" class="mb-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-medium text-highlighted">
            <UIcon name="i-lucide-paw-print" class="h-3.5 w-3.5 inline mr-1" />
            Pets ({{ props.pets.length }})
          </h4>
          <div class="flex gap-2">
            <UButton
              size="xs"
              variant="ghost"
              @click="selectAllPets"
            >
              Select All
            </UButton>
            <UButton
              v-if="props.pets.some(p => isPersonSelected(p.id))"
              size="xs"
              variant="ghost"
              @click="clearPets"
            >
              Clear
            </UButton>
          </div>
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          <div
            v-for="pet in props.pets"
            :key="pet.id"
            class="flex flex-col items-center gap-1.5 p-2 rounded-lg cursor-pointer transition-all duration-200 group"
            role="checkbox"
            :aria-checked="isPersonSelected(pet.id)"
            :aria-label="pet.name"
            tabindex="0"
            @click="togglePerson(pet.id)"
            @keydown.enter.prevent="togglePerson(pet.id)"
            @keydown.space.prevent="togglePerson(pet.id)"
          >
            <div
              class="relative w-14 h-14 rounded-full overflow-hidden border-2 transition-all duration-200"
              :class="[
                isPersonSelected(pet.id)
                  ? 'border-primary ring-2 ring-primary/30 shadow-md'
                  : 'border-default group-hover:border-muted group-hover:shadow-sm',
              ]"
            >
              <img
                :src="pet.thumbnailUrl"
                :alt="pet.name"
                class="w-full h-full object-cover"
                loading="lazy"
                @error="(e: Event) => (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(pet.name)}&size=56&background=FFD93D&color=fff`"
              >
              <!-- Selection checkmark overlay -->
              <div
                v-if="isPersonSelected(pet.id)"
                class="absolute inset-0 bg-primary/20 flex items-center justify-center"
              >
                <div class="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow">
                  <UIcon name="i-lucide-check" class="h-3 w-3 text-white" />
                </div>
              </div>
            </div>
            <p
              class="text-xs text-center truncate w-full"
              :class="isPersonSelected(pet.id) ? 'text-primary font-medium' : 'text-highlighted'"
            >
              {{ pet.name }}
            </p>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="props.people.length === 0 && props.pets.length === 0" class="text-center py-6 bg-muted/20 rounded-lg">
        <UIcon name="i-lucide-user-x" class="h-10 w-10 mx-auto mb-3 text-muted" />
        <p class="text-sm text-muted">
          No people or pets found in your Immich library.
        </p>
        <p class="text-xs text-muted mt-1">
          Immich will identify faces automatically as it processes your photos.
        </p>
      </div>
    </template>
  </div>
</template>
