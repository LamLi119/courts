<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Venue, Language, Sport } from '../../../types';
import { db } from '../../../db';

type SportItem = { id: number; name: string; name_zh?: string | null; slug: string };

const props = defineProps<{
  venues: Venue[];
  sports: SportItem[];
  language: Language;
  darkMode: boolean;
  isSuperAdmin: boolean;
  adminStatus: { type: 'none' | 'super' | 'court'; allowedIds: number[] };
}>();

const emit = defineEmits<{
  addVenue: [];
  editVenue: [venue: Venue];
  deleteVenue: [venue: Venue];
  logout: [];
  'update:venues': [venues: Venue[]];
  'update:sports': [sports: SportItem[]];
  reloadVenues: [];
  notify: [type: 'success' | 'error', message: string];
}>();

const sportDisplayName = (s: { name: string; name_zh?: string | null }) =>
  props.language === 'zh' && s.name_zh ? s.name_zh : s.name;

const adminSportFilter = ref<string>('all');
const showAddSportInput = ref(false);
const newSportName = ref('');
const newSportNameZh = ref('');
const addSportError = ref<string | null>(null);
const isAddingSport = ref(false);
const isEditingSports = ref(false);
const adminSportsList = computed<Sport[]>(() => props.sports as Sport[]);

const draggedVenueId = ref<number | null>(null);
const adminOrder = ref<number[]>([]);
const isSortEditing = ref(false);
const draftAdminOrder = ref<number[]>([]);

const adminVenues = computed(() => {
  let list = props.venues;
  if (props.adminStatus.type === 'court') {
    return list.filter((v) => props.adminStatus.allowedIds.includes(v.id));
  }
  if (adminSportFilter.value === 'all') return props.venues;
  const slug = adminSportFilter.value;
  return props.venues
    .filter((v) => {
      const types = v.sport_types;
      const data = v.sport_data;
      if (Array.isArray(data)) return data.some((d: any) => (d.slug || '').toLowerCase() === slug);
      if (Array.isArray(types)) return types.some((t: string) => String(t).toLowerCase().replace(/\s+/g, '-') === slug);
      return false;
    })
    .sort((a, b) => {
      const ao = a.sport_orders?.[slug] ?? a.sport_data?.find((d: any) => (d.slug || '').toLowerCase() === slug)?.sort_order ?? 9999;
      const bo = b.sport_orders?.[slug] ?? b.sport_data?.find((d: any) => (d.slug || '').toLowerCase() === slug)?.sort_order ?? 9999;
      return ao - bo;
    });
});

const getBaseAdminOrder = (): number[] => {
  if (adminSportFilter.value === 'all') return adminOrder.value.length ? [...adminOrder.value] : props.venues.map((v) => v.id);
  return adminVenues.value.map((v) => v.id);
};

const displayIndexById = computed(() => {
  const order = isSortEditing.value ? draftAdminOrder.value : getBaseAdminOrder();
  const map = new Map<number, number>();
  order.forEach((id, idx) => map.set(id, idx));
  return map;
});

const isDraftDirty = computed(() => {
  if (!isSortEditing.value) return false;
  const base = getBaseAdminOrder();
  const draft = draftAdminOrder.value;
  if (base.length !== draft.length) return true;
  for (let i = 0; i < base.length; i++) {
    if (base[i] !== draft[i]) return true;
  }
  return false;
});

const saveAdminOrder = () => {
  try {
    localStorage.setItem('pickleball_admin_order', JSON.stringify(adminOrder.value));
  } catch {
    // ignore
  }
};

const applyAdminOrder = () => {
  if (!adminOrder.value.length) return;
  const idToVenue = new Map(props.venues.map((v) => [v.id, v]));
  const ordered: Venue[] = [];
  adminOrder.value.forEach((id) => {
    const v = idToVenue.get(id);
    if (v) {
      ordered.push(v);
      idToVenue.delete(id);
    }
  });
  idToVenue.forEach((v) => ordered.push(v));
  emit('update:venues', ordered);
};

onMounted(() => {
  try {
    const raw = localStorage.getItem('pickleball_admin_order');
    adminOrder.value = raw ? JSON.parse(raw) : [];
  } catch {
    adminOrder.value = [];
  }
  if (props.venues.length && !adminOrder.value.length) {
    adminOrder.value = props.venues.map((v) => v.id);
    saveAdminOrder();
  }
});

const handleDragStart = (id: number) => {
  if (!isSortEditing.value) return;
  draggedVenueId.value = id;
};

const reorderDraft = (newOrder: number[]) => {
  draftAdminOrder.value = newOrder;
};

const handleDrop = async (targetId: number) => {
  if (!isSortEditing.value) return;
  if (draggedVenueId.value === null || draggedVenueId.value === targetId) return;
  const currentOrder = draftAdminOrder.value.length ? [...draftAdminOrder.value] : getBaseAdminOrder();
  const fromIndex = currentOrder.indexOf(draggedVenueId.value);
  const toIndex = currentOrder.indexOf(targetId);
  if (fromIndex === -1 || toIndex === -1) return;

  const [moved] = currentOrder.splice(fromIndex, 1);
  currentOrder.splice(toIndex, 0, moved);
  reorderDraft(currentOrder);
  draggedVenueId.value = null;
};

const handleMoveUp = async (id: number) => {
  if (!isSortEditing.value) return;
  const currentOrder = draftAdminOrder.value.length ? [...draftAdminOrder.value] : getBaseAdminOrder();
  const idx = currentOrder.indexOf(id);
  if (idx <= 0) return;
  const next = [...currentOrder];
  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
  reorderDraft(next);
};

const handleMoveDown = async (id: number) => {
  if (!isSortEditing.value) return;
  const currentOrder = draftAdminOrder.value.length ? [...draftAdminOrder.value] : getBaseAdminOrder();
  const idx = currentOrder.indexOf(id);
  if (idx === -1 || idx >= currentOrder.length - 1) return;
  const next = [...currentOrder];
  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
  reorderDraft(next);
};

const startSortEdit = () => {
  isSortEditing.value = true;
  draftAdminOrder.value = getBaseAdminOrder();
  draggedVenueId.value = null;
};

const cancelSortEdit = () => {
  isSortEditing.value = false;
  draftAdminOrder.value = [];
  draggedVenueId.value = null;
};

const saveSortEdit = async () => {
  if (!isSortEditing.value) return;
  const next = draftAdminOrder.value.length ? [...draftAdminOrder.value] : getBaseAdminOrder();
  const sportSlug = adminSportFilter.value;
  const sportId = sportSlug === 'all' ? undefined : props.sports.find((s) => s.slug === sportSlug)?.id;
  if (sportSlug === 'all') {
    adminOrder.value = next;
    saveAdminOrder();
    applyAdminOrder();
  }
  try {
    await db.updateVenueOrder(next, sportId);
  } catch (err) {
    console.error('Failed to persist order:', err);
  } finally {
    cancelSortEdit();
  }
  if (sportSlug !== 'all') emit('reloadVenues');
};

const handleAddSport = async () => {
  const name_en = newSportName.value.trim();
  if (!name_en) return;
  addSportError.value = null;
  isAddingSport.value = true;
  try {
    const created = await db.createSport({ name_en, name_zh: newSportNameZh.value.trim() || undefined });
    emit('update:sports', [...props.sports, created]);
    newSportName.value = '';
    newSportNameZh.value = '';
    showAddSportInput.value = false;
    adminSportFilter.value = created.slug;
    emit('notify', 'success', props.language === 'en' ? 'Sport type added.' : '運動類型已新增。');
  } catch (err: any) {
    addSportError.value = err?.message || 'Failed to add sport.';
    emit('notify', 'error', err?.message || (props.language === 'en' ? 'Failed to add sport.' : '新增運動類型失敗。'));
  } finally {
    isAddingSport.value = false;
  }
};

const cancelAddSport = () => {
  showAddSportInput.value = false;
  newSportName.value = '';
  newSportNameZh.value = '';
  addSportError.value = null;
};

const updateSportApiCall = async (s: Sport) => {
  try {
    const updated = await db.updateSport(s.id, { name: s.name, name_zh: s.name_zh ?? undefined });
    const idx = props.sports.findIndex((x) => x.id === s.id);
    if (idx !== -1) {
      emit(
        'update:sports',
        props.sports.map((x, i) => (i === idx ? { ...x, ...updated } : x))
      );
    }
    emit('notify', 'success', props.language === 'en' ? 'Sport type saved.' : '運動類型已儲存。');
  } catch (err: any) {
    emit('notify', 'error', err?.message || (props.language === 'en' ? 'Failed to update sport.' : '儲存運動類型失敗。'));
  }
};

const deleteSportApiCall = async (sportId: number) => {
  if (!confirm(props.language === 'en' ? 'Delete this sport? Venues will lose this tag.' : '刪除此運動？場地將移除此標籤。')) return;
  const slug = props.sports.find((x) => x.id === sportId)?.slug;
  try {
    await db.deleteSport(sportId);
    emit(
      'update:sports',
      props.sports.filter((x) => x.id !== sportId)
    );
    if (adminSportFilter.value === slug) adminSportFilter.value = 'all';
    isEditingSports.value = false;
  } catch (err: any) {
    alert(err?.message || 'Failed to delete sport');
  }
};
</script>

<template>
  <div class="container mx-auto p-4 md:p-8 pb-32 md:pb-8 space-y-8 animate-in fade-in duration-500">
    <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
      <div class="flex flex-col gap-2">
        <h2 class="text-3xl md:text-4xl font-black tracking-tight">Manage Courts</h2>
        <div v-if="isSuperAdmin" class="flex flex-wrap gap-2 items-center">
          <span class="text-xs font-bold uppercase tracking-wider opacity-60">Sport:</span>
          <button
            type="button"
            class="px-3 py-2 rounded-lg font-bold text-sm transition-all"
            :class="adminSportFilter === 'all' ? 'bg-[#007a67] text-white' : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')"
            @click="adminSportFilter = 'all'"
          >
            All
          </button>
          <button
            v-for="s in sports"
            :key="s.id"
            type="button"
            class="px-3 py-2 rounded-lg font-bold text-sm transition-all"
            :class="adminSportFilter === s.slug ? 'bg-[#007a67] text-white' : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')"
            @click="adminSportFilter = s.slug"
          >
            {{ sportDisplayName(s) }}
          </button>
          <template v-if="isSuperAdmin && showAddSportInput">
            <input
              v-model="newSportName"
              type="text"
              class="px-3 py-2 rounded-lg text-sm font-bold border-2 border-[#007a67] focus:outline-none min-w-[100px]"
              :class="darkMode ? 'bg-gray-800 text-white border-[#007a67]' : 'bg-white text-gray-900'"
              placeholder="English name"
              @keydown.enter="handleAddSport"
              @keydown.escape="cancelAddSport"
            />
            <input
              v-model="newSportNameZh"
              type="text"
              class="px-3 py-2 rounded-lg text-sm font-bold border-2 border-[#007a67] focus:outline-none min-w-[100px]"
              :class="darkMode ? 'bg-gray-800 text-white border-[#007a67]' : 'bg-white text-gray-900'"
              placeholder="中文名稱"
              @keydown.enter="handleAddSport"
              @keydown.escape="cancelAddSport"
            />
            <button
              type="button"
              class="px-3 py-2 rounded-lg text-sm font-bold bg-[#007a67] text-white"
              :disabled="!newSportName.trim() || isAddingSport"
              @click="handleAddSport"
            >
              {{ isAddingSport ? '…' : 'Add' }}
            </button>
            <button
              type="button"
              class="px-3 py-2 rounded-lg text-sm font-bold"
              :class="darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'"
              @click="cancelAddSport"
            >
              Cancel
            </button>
          </template>
          <button
            v-else-if="isSuperAdmin"
            type="button"
            class="px-3 py-2 rounded-lg text-sm font-bold border-2 border-dashed"
            :class="darkMode ? 'border-gray-500 text-gray-400 hover:border-[#007a67] hover:text-[#007a67]' : 'border-gray-400 text-gray-500 hover:border-[#007a67] hover:text-[#007a67]'"
            @click="showAddSportInput = true; addSportError = null;"
          >
            + Add sport
          </button>
          <button
            v-if="isSuperAdmin"
            type="button"
            class="px-3 py-2 rounded-lg text-sm font-bold"
            :class="darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
            @click="isEditingSports = !isEditingSports"
          >
            {{ isEditingSports ? 'Hide' : 'Manage Sports' }}
          </button>
        </div>
        <div v-if="isSuperAdmin && isEditingSports" class="grid gap-2 mt-4 p-4 rounded-xl border" :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'">
          <p class="text-xs font-bold uppercase tracking-wider opacity-70">Edit sport names</p>
          <div v-for="s in adminSportsList" :key="s.id" class="flex flex-wrap gap-2 items-center">
            <input v-model="s.name" type="text" class="px-3 py-2 rounded-lg text-sm border max-w-[140px]" :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'" placeholder="Name" />
            <input v-model="s.name_zh" type="text" class="px-3 py-2 rounded-lg text-sm border max-w-[120px]" :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'" placeholder="中文" />
            <button type="button" class="px-3 py-2 rounded-lg text-sm font-bold bg-[#007a67] text-white" @click="updateSportApiCall(s)">Save</button>
            <button type="button" class="px-3 py-2 rounded-lg text-sm font-bold bg-red-500/20 text-red-500" @click="deleteSportApiCall(s.id)">Delete</button>
          </div>
        </div>
        <p v-if="addSportError" class="text-red-500 text-xs font-bold mt-1">{{ addSportError }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-if="isSuperAdmin && !isSortEditing"
          class="px-4 py-3 md:px-6 md:py-3 bg-gray-500/10 text-gray-700 rounded-lg font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-xs md:text-base"
          :class="darkMode ? 'text-gray-200 bg-gray-700/40' : ''"
          @click="startSortEdit"
        >
          EDIT SORT
        </button>
        <button
          v-else-if="isSuperAdmin"
          class="px-4 py-3 md:px-6 md:py-3 rounded-lg font-black shadow-xl active:scale-95 transition-all text-xs md:text-base"
          :class="isDraftDirty ? 'bg-[#007a67] text-white hover:scale-105' : (darkMode ? 'bg-gray-700 text-gray-400 opacity-60 cursor-not-allowed' : 'bg-gray-200 text-gray-400 opacity-60 cursor-not-allowed')"
          :disabled="!isDraftDirty"
          @click="saveSortEdit"
        >
          SAVE SORT
        </button>
        <button
          v-if="isSuperAdmin && isSortEditing"
          class="px-4 py-3 md:px-6 md:py-3 bg-gray-500/10 text-gray-700 rounded-lg font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-xs md:text-base"
          :class="darkMode ? 'text-gray-200 bg-gray-700/40' : ''"
          @click="cancelSortEdit"
        >
          CANCEL
        </button>
        <button
          v-if="isSuperAdmin && !isSortEditing"
          class="px-4 py-3 md:px-6 md:py-3 bg-[#007a67] text-white rounded-lg font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-xs md:text-base"
          @click="emit('addVenue')"
        >
          + ADD NEW
        </button>
        <button
          v-if="!isSortEditing"
          class="px-4 py-3 md:px-6 md:py-3 bg-red-500 text-white rounded-lg font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-xs md:text-base"
          @click="emit('logout')"
        >
          LOGOUT
        </button>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="(v, index) in adminVenues"
        :key="v.id"
        class="p-4 border rounded-3xl shadow-md flex items-center justify-between group transition-all hover:shadow-xl gap-2"
        :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'"
        :draggable="isSuperAdmin && isSortEditing"
        @dragstart="handleDragStart(v.id)"
        @dragover.prevent
        @drop="handleDrop(v.id)"
      >
        <div v-if="isSuperAdmin" class="flex items-center gap-2 flex-shrink-0">
          <div class="flex flex-col items-center gap-0.5">
            <button
              type="button"
              class="p-2 rounded-lg transition-colors touch-manipulation"
              :class="!isSortEditing ? 'opacity-30 cursor-not-allowed' : (displayIndexById.get(v.id) === 0 ? 'opacity-30 cursor-not-allowed' : (darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600'))"
              :disabled="!isSortEditing || displayIndexById.get(v.id) === 0"
              :aria-label="language === 'en' ? 'Move up' : '上移'"
              @click.stop="handleMoveUp(v.id)"
            >
              ▲
            </button>
            <span
              class="text-sm font-black tabular-nums min-w-[1.25rem] text-center"
              :class="darkMode ? 'text-gray-400' : 'text-gray-500'"
            >
              {{ (displayIndexById.get(v.id) ?? index) + 1 }}
            </span>
            <button
              type="button"
              class="p-2 rounded-lg transition-colors touch-manipulation"
              :class="!isSortEditing ? 'opacity-30 cursor-not-allowed' : ((displayIndexById.get(v.id) ?? index) === adminVenues.length - 1 ? 'opacity-30 cursor-not-allowed' : (darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600'))"
              :disabled="!isSortEditing || (displayIndexById.get(v.id) ?? index) === adminVenues.length - 1"
              :aria-label="language === 'en' ? 'Move down' : '下移'"
              @click.stop="handleMoveDown(v.id)"
            >
              ▼
            </button>
          </div>
        </div>
        <div class="flex items-center gap-4 min-w-0 flex-1">
          <div class="w-16 h-16 rounded-xl overflow-hidden shadow-inner flex-shrink-0">
            <img :src="v.org_icon || v.images[0] || '/placeholder.svg'" class="w-full h-full object-cover" alt="" />
          </div>
          <div class="min-w-0">
            <p class="font-black truncate">{{ v.name }}</p>
            <p class="text-[10px] font-bold opacity-50 uppercase tracking-widest">
              ${{ v.startingPrice }}/HR
            </p>
          </div>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <button
            class="p-3 bg-blue-500/10 text-blue-500 rounded-xl"
            @click="emit('editVenue', v)"
          >
            ✏️
          </button>
          <button
            v-if="isSuperAdmin"
            class="p-3 bg-red-500/10 text-red-500 rounded-xl"
            @click.stop="emit('deleteVenue', v)"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
