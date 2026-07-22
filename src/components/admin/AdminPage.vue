<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Venue, Language, Sport } from '../../../types';
import { db } from '../../../db';

type SportItem = { id: number; name: string; name_zh?: string | null; slug: string; sort_order?: number | null };

const props = defineProps<{
  venues: Venue[];
  sports: SportItem[];
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  isSuperAdmin: boolean;
  superAdminSyncPassword?: string;
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
const isSortEditing = ref(false);
const draftAdminOrder = ref<number[]>([]);

const byGlobalSortOrder = (a: Venue, b: Venue) => {
  const ao = a.sort_order ?? 9999;
  const bo = b.sort_order ?? 9999;
  if (ao !== bo) return ao - bo;
  return String(a.name || '').localeCompare(String(b.name || ''));
};

const bySportSortOrder = (slug: string) => (a: Venue, b: Venue) => {
  const ao = a.sport_orders?.[slug] ?? a.sport_data?.find((d: any) => (d.slug || '').toLowerCase() === slug)?.sort_order ?? 9999;
  const bo = b.sport_orders?.[slug] ?? b.sport_data?.find((d: any) => (d.slug || '').toLowerCase() === slug)?.sort_order ?? 9999;
  if (ao !== bo) return ao - bo;
  return byGlobalSortOrder(a, b);
};

const adminVenues = computed(() => {
  let list = [...props.venues];
  if (props.adminStatus.type === 'court') {
    list = list.filter((v) => props.adminStatus.allowedIds.includes(v.id));
  }
  if (adminSportFilter.value === 'all') {
    return list.sort(byGlobalSortOrder);
  }
  const slug = adminSportFilter.value;
  return list
    .filter((v) => {
      const types = v.sport_types;
      const data = v.sport_data;
      if (Array.isArray(data)) return data.some((d: any) => (d.slug || '').toLowerCase() === slug);
      if (Array.isArray(types)) return types.some((t: string) => String(t).toLowerCase().replace(/\s+/g, '-') === slug);
      return false;
    })
    .sort(bySportSortOrder(slug));
});

const getBaseAdminOrder = (): number[] => adminVenues.value.map((v) => v.id);

const displayIndexById = computed(() => {
  const order = isSortEditing.value ? draftAdminOrder.value : getBaseAdminOrder();
  const map = new Map<number, number>();
  order.forEach((id, idx) => map.set(id, idx));
  return map;
});

/** While editing, list rows follow draft order so up/down and drag are visible. */
const displayedAdminVenues = computed(() => {
  if (!isSortEditing.value || !draftAdminOrder.value.length) return adminVenues.value;
  const byId = new Map(adminVenues.value.map((v) => [v.id, v]));
  const ordered: Venue[] = [];
  for (const id of draftAdminOrder.value) {
    const v = byId.get(id);
    if (v) {
      ordered.push(v);
      byId.delete(id);
    }
  }
  byId.forEach((v) => ordered.push(v));
  return ordered;
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

/** Switch All / sport filter; if sort-editing, discard dirty draft and continue edit on the new filter. */
const setAdminSportFilter = (slug: string) => {
  if (slug === adminSportFilter.value) return;
  if (isSortEditing.value) {
    if (isDraftDirty.value) {
      const ok = confirm(
        props.language === 'en'
          ? 'Discard unsaved sort changes and switch sport type?'
          : '放棄未儲存的排序並切換運動類型？'
      );
      if (!ok) return;
    }
    cancelSortEdit();
    adminSportFilter.value = slug;
    startSortEdit();
    return;
  }
  adminSportFilter.value = slug;
};

const saveSortEdit = async () => {
  if (!isSortEditing.value) return;
  const next = draftAdminOrder.value.length ? [...draftAdminOrder.value] : getBaseAdminOrder();
  const sportSlug = adminSportFilter.value;
  const sportId = sportSlug === 'all' ? undefined : props.sports.find((s) => s.slug === sportSlug)?.id;
  try {
    await db.updateVenueOrder(next, sportId);
    emit('reloadVenues');
  } catch (err) {
    console.error('Failed to persist order:', err);
  } finally {
    cancelSortEdit();
  }
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
    setAdminSportFilter(created.slug);
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
    if (adminSportFilter.value === slug) setAdminSportFilter('all');
    isEditingSports.value = false;
  } catch (err: any) {
    alert(err?.message || 'Failed to delete sport');
  }
};

const isReorderingSports = ref(false);
const isBlogSyncing = ref(false);

const syncBlogFromNotion = async () => {
  if (!props.isSuperAdmin || isBlogSyncing.value) return;
  isBlogSyncing.value = true;
  try {
    let result;
    try {
      result = await db.syncBlogFromNotion(props.superAdminSyncPassword || undefined);
    } catch (err: any) {
      const msg = String(err?.message || '');
      const needsPassword = msg.toLowerCase().includes('super admin');
      if (!needsPassword || props.superAdminSyncPassword) throw err;
      const pwd = window.prompt(
        props.language === 'en'
          ? 'Enter the global super admin password to sync from Notion:'
          : '請輸入全域超級管理員密碼以從 Notion 同步：',
      );
      if (!pwd) throw new Error(props.t('blogSyncFailed'));
      result = await db.syncBlogFromNotion(pwd);
    }
    const count = result?.synced ?? 0;
    emit(
      'notify',
      'success',
      props.language === 'en'
        ? `${props.t('blogSyncSuccess')} (${count})`
        : `${props.t('blogSyncSuccess')}（${count}）`,
    );
  } catch (err: any) {
    emit('notify', 'error', err?.message || props.t('blogSyncFailed'));
  } finally {
    isBlogSyncing.value = false;
  }
};

const moveSportType = async (sportId: number, direction: -1 | 1) => {
  if (isReorderingSports.value) return;
  const list = [...props.sports];
  const idx = list.findIndex((x) => x.id === sportId);
  const j = idx + direction;
  if (idx < 0 || j < 0 || j >= list.length) return;
  [list[idx], list[j]] = [list[j], list[idx]];
  const withOrder = list.map((s, i) => ({ ...s, sort_order: i }));
  emit('update:sports', withOrder);
  isReorderingSports.value = true;
  try {
    await db.updateSportsOrder(withOrder.map((s) => s.id));
    emit('notify', 'success', props.language === 'en' ? 'Sport order saved.' : '運動類型順序已儲存。');
  } catch (err: any) {
    emit('notify', 'error', err?.message || (props.language === 'en' ? 'Failed to save sport order.' : '儲存運動類型順序失敗。'));
    try {
      const fresh = await db.getSports();
      if (fresh?.length) emit('update:sports', fresh);
    } catch (_) {}
  } finally {
    isReorderingSports.value = false;
  }
};
</script>

<template>
  <div class="container mx-auto p-4 md:p-8 pb-32 md:pb-8 space-y-8 animate-in fade-in duration-500">
    <div
      v-if="isSuperAdmin"
      class="p-4 md:p-5 rounded-2xl border flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'"
    >
      <div>
        <p class="text-xs font-bold uppercase tracking-wider text-[#007a67] mb-1">Blog</p>
        <p class="text-sm" :class="darkMode ? 'text-gray-300' : 'text-gray-600'">
          {{ language === 'en'
            ? 'Pull published posts from your Notion database into Courts.'
            : '從 Notion 資料庫拉取已發佈文章至 Courts。' }}
        </p>
      </div>
      <button
        type="button"
        class="px-4 py-3 rounded-lg font-black text-sm bg-[#007a67] text-white disabled:opacity-60"
        :disabled="isBlogSyncing"
        @click="syncBlogFromNotion"
      >
        {{ isBlogSyncing ? t('blogSyncing') : t('blogSync') }}
      </button>
    </div>

    <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
      <div class="flex flex-col gap-2">
        <h2 class="text-3xl md:text-4xl font-black tracking-tight">Manage Courts</h2>
        <div v-if="isSuperAdmin" class="flex flex-wrap gap-2 items-center">
          <span class="text-xs font-bold uppercase tracking-wider opacity-60">Sport:</span>
          <button
            type="button"
            class="px-3 py-2 rounded-lg font-bold text-sm transition-all"
            :class="adminSportFilter === 'all' ? 'bg-[#007a67] text-white' : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')"
            @click="setAdminSportFilter('all')"
          >
            All
          </button>
          <button
            v-for="s in sports"
            :key="s.id"
            type="button"
            class="px-3 py-2 rounded-lg font-bold text-sm transition-all"
            :class="adminSportFilter === s.slug ? 'bg-[#007a67] text-white' : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')"
            @click="setAdminSportFilter(s.slug)"
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
          <p class="text-xs font-bold uppercase tracking-wider opacity-70">
            {{ language === 'en' ? 'Edit sport names & order' : '編輯運動名稱與順序' }}
          </p>
          <div
            v-for="(s, sIdx) in adminSportsList"
            :key="s.id"
            class="flex flex-wrap gap-2 items-center"
          >
            <div class="flex flex-col items-center gap-0.5 flex-shrink-0">
              <button
                type="button"
                class="p-1.5 rounded-lg text-xs transition-colors"
                :class="sIdx === 0 || isReorderingSports ? 'opacity-30 cursor-not-allowed' : (darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600')"
                :disabled="sIdx === 0 || isReorderingSports"
                :aria-label="language === 'en' ? 'Move sport up' : '上移運動類型'"
                @click="moveSportType(s.id, -1)"
              >
                ▲
              </button>
              <span class="text-[10px] font-black tabular-nums opacity-50">{{ sIdx + 1 }}</span>
              <button
                type="button"
                class="p-1.5 rounded-lg text-xs transition-colors"
                :class="sIdx === adminSportsList.length - 1 || isReorderingSports ? 'opacity-30 cursor-not-allowed' : (darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600')"
                :disabled="sIdx === adminSportsList.length - 1 || isReorderingSports"
                :aria-label="language === 'en' ? 'Move sport down' : '下移運動類型'"
                @click="moveSportType(s.id, 1)"
              >
                ▼
              </button>
            </div>
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
        v-for="(v, index) in displayedAdminVenues"
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
              :class="!isSortEditing ? 'opacity-30 cursor-not-allowed' : ((displayIndexById.get(v.id) ?? index) === displayedAdminVenues.length - 1 ? 'opacity-30 cursor-not-allowed' : (darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600'))"
              :disabled="!isSortEditing || (displayIndexById.get(v.id) ?? index) === displayedAdminVenues.length - 1"
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
