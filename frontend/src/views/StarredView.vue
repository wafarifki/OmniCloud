<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { IconChevronDown, IconChevronUp, IconCheck, IconDownload, IconEdit, IconEye, IconFileDescription, IconFileText, IconFileTypePdf, IconFileZip, IconFolder, IconPhoto, IconMusic, IconPlayerPlay, IconStar, IconStarFilled, IconTrash, IconVideo, IconInfoCircle, IconCloud, IconCloudFilled, IconLayoutGrid, IconLayoutGridFilled, IconList, IconListDetailsFilled, IconSearch, IconX, IconArchiveFilled, IconFileDescriptionFilled, IconFileFilled, IconFileMusicFilled, IconFileTextFilled, IconFolderFilled, IconPhotoFilled, IconVideoFilled, } from '@tabler/icons-vue';
import dropboxLogo from '../assets/dropbox.svg';
import googleDriveLogo from '../assets/google-drive.svg';
import megaLogo from '../assets/mega.svg';
import oneDriveLogo from '../assets/microsoft-onedrive.svg';
import DriveShell from '../components/DriveShell.vue';
import FloatingProgressToast from '../components/FloatingProgressToast.vue';
import TruncateMarquee from '../components/TruncateMarquee.vue';
import { useFileTreeStore } from '../stores/fileTree';
import { useUploadQueueStore } from '../stores/uploadQueue';
import { api } from '../services/api';

const { t } = useI18n();
const router = useRouter();
const fileTreeStore = useFileTreeStore();
const uploadQueueStore = useUploadQueueStore();
const { uploads, totalProgress } = storeToRefs(uploadQueueStore);
const loading = ref(false);
const errorMessage = ref('');
const searchTerm = ref('');
const isGridView = ref(false);
const sortBy = ref('updated_at');
const sortDirection = ref('desc');
const activeFilterMenu = ref(null);
const selectedTypeFilter = ref('all');
const selectedOwnerFilter = ref('all');
const selectedUpdatedFilter = ref('all');
const selectedFileIds = ref(new Set());
const lastSelectedFileId = ref(null);
const contextMenu = ref({ visible: false, x: 0, y: 0, file: null });
const detailsFile = ref(null);
const isDetailsOpen = ref(false);
const previewFile = ref(null);
const isPreviewOpen = ref(false);
const isPreviewLoading = ref(false);
const contextMenuRef = ref(null);
const files = ref([]);
let refreshTimer = null;

const filteredFiles = computed(() => files.value.filter((file) => {
	const query = searchTerm.value.trim().toLowerCase();
	if (query) {
		const matchesQuery = [file.file_name, file.email, file.provider, file.virtual_path]
			.filter(Boolean)
			.some((value) => String(value).toLowerCase().includes(query));
		if (!matchesQuery) return false;
	}
	const typeMatches = selectedTypeFilter.value === 'all' || getFileCategory(file) === selectedTypeFilter.value;
	const ownerMatches = selectedOwnerFilter.value === 'all' || file.email === selectedOwnerFilter.value;
	const updatedMatches = selectedUpdatedFilter.value === 'all' || matchesUpdatedFilter(getModifiedTime(file), selectedUpdatedFilter.value);
	return typeMatches && ownerMatches && updatedMatches;
}));

const sortedFiles = computed(() => {
	const items = [...filteredFiles.value];
	const direction = sortDirection.value === 'asc' ? 1 : -1;
	return items.sort((left, right) => {
		let leftValue;
		let rightValue;
		switch (sortBy.value) {
			case 'file_name':
				leftValue = (left.file_name || '').toLowerCase();
				rightValue = (right.file_name || '').toLowerCase();
				break;
			case 'email':
				leftValue = (left.email || '').toLowerCase();
				rightValue = (right.email || '').toLowerCase();
				break;
			case 'size':
				leftValue = Number(left.size || 0);
				rightValue = Number(right.size || 0);
				break;
			default:
				leftValue = new Date(getModifiedTime(left) || 0).getTime();
				rightValue = new Date(getModifiedTime(right) || 0).getTime();
				break;
		}
		if (leftValue < rightValue) return -1 * direction;
		if (leftValue > rightValue) return 1 * direction;
		return 0;
	});
});

const selectedFiles = computed(() => sortedFiles.value.filter((file) => selectedFileIds.value.has(file.id)));
const selectedCount = computed(() => selectedFiles.value.length);
const primarySelectedFile = computed(() => selectedFiles.value[0] || null);
const canPreviewSelection = computed(() => selectedCount.value === 1 && canPreviewFile(primarySelectedFile.value));
const canDownloadSelection = computed(() => selectedFiles.value.some((file) => !file.is_folder));
const canRenameSelection = computed(() => selectedCount.value === 1);
const canUnstarSelection = computed(() => selectedFiles.value.length > 0 && selectedFiles.value.every((file) => file.capabilities?.starred));

const canToggleStarSelection = computed(() => {
	if (selectedCount.value !== 1) return false;
	const file = primarySelectedFile.value;
	return Boolean(file && file.capabilities?.starred);
});

const isPrimarySelectedStarred = computed(() => Boolean(primarySelectedFile.value?.is_starred));

const ownerOptions = computed(() => {
	const ownerMap = new Map();
	files.value.forEach((file) => {
		if (!file.email || ownerMap.has(file.email)) return;
		ownerMap.set(file.email, {
			email: file.email,
			provider: file.provider || null
		});
	});
	return [...ownerMap.values()].sort((a, b) => a.email.localeCompare(b.email, 'id'));
});

const typeOptions = computed(() => [{
	value: 'all',
	label: t('filters.allTypes')
},
{
	value: 'folder',
	label: t('filters.folder')
},
{
	value: 'document',
	label: t('filters.document')
},
{
	value: 'image',
	label: t('filters.image')
},
{
	value: 'pdf',
	label: t('filters.pdf')
},
{
	value: 'video',
	label: t('filters.video')
},
{
	value: 'audio',
	label: t('filters.audio')
},
{
	value: 'archive',
	label: t('filters.archive')
},
]);

const updatedOptions = computed(() => [{
	value: 'all',
	label: t('filters.allTimes')
},
{
	value: 'today',
	label: t('filters.today')
},
{
	value: 'last7',
	label: t('filters.last7')
},
{
	value: 'last30',
	label: t('filters.last30')
},
{
	value: 'thisYear',
	label: t('filters.thisYear')
},
{
	value: 'lastYear',
	label: t('filters.lastYear')
},
]);

function formatBytes(value) {
	if (!value) return '—';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let amount = Number(value);
	let index = 0;
	while (amount >= 1024 && index < units.length - 1) {
		amount /= 1024;
		index += 1;
	}
	return `${amount.toFixed(amount >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
	if (!value) return '—';
	return new Intl.DateTimeFormat('id-ID', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	}).format(new Date(value));
}

function getCreatedTime(file) {
	return file.createdTime;
}

function getModifiedTime(file) {
	return file.modifiedTime;
}

function providerLabel(provider) {
	if (provider === 'google_drive') return 'Google Drive';
	if (provider === 'onedrive') return 'OneDrive';
	if (provider === 'dropbox') return 'Dropbox';
	if (provider === 'mega') return 'MEGA';
	return provider || 'Provider';
}

function providerIcon(provider) {
	if (provider === 'google_drive') return googleDriveLogo;
	if (provider === 'onedrive') return oneDriveLogo;
	if (provider === 'dropbox') return dropboxLogo;
	if (provider === 'mega') return megaLogo;
	return null;
}

function getFileExtension(file) {
	const source = file.file_name || '';
	const parts = source.toLowerCase().split('.');
	return parts.length > 1 ? parts.at(-1) : '';
}

function getFileCategory(file) {
	if (file.is_folder) return 'folder';
	const mimeType = (file.mime_type || file.mimeType || '').toLowerCase();
	const extension = getFileExtension(file);
	if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf';
	if (mimeType.startsWith('image/')) return 'image';
	if (mimeType.startsWith('video/')) return 'video';
	if (mimeType.startsWith('audio/')) return 'audio';
	if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || mimeType.includes('tar') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 'archive';
	return 'document';
}

function getFileIcon(file, filled = false) {
	if (file.is_folder) return filled ? IconFolderFilled : IconFolder;
	switch (getFileCategory(file)) {
		case 'image':
			return filled ? IconPhotoFilled : IconPhoto;
		case 'pdf':
			return filled ? IconFileFilled : IconFileTypePdf;
		case 'video':
			return filled ? IconVideoFilled : IconVideo;
		case 'audio':
			return filled ? IconFileMusicFilled : IconMusic;
		case 'archive':
			return filled ? IconArchiveFilled : IconFileZip;
		default:
			return filled ? IconFileTextFilled : IconFileText;
	}
}

function getTypeFilterIcon(value, filled = false) {
	switch (value) {
		case 'folder':
			return filled ? IconFolderFilled : IconFolder;
		case 'image':
			return filled ? IconPhotoFilled : IconPhoto;
		case 'pdf':
			return filled ? IconFileFilled : IconFileTypePdf;
		case 'video':
			return filled ? IconVideoFilled : IconVideo;
		case 'audio':
			return filled ? IconFileMusicFilled : IconMusic;
		case 'archive':
			return filled ? IconArchiveFilled : IconFileZip;
		case 'document':
			return filled ? IconFileTextFilled : IconFileText;
		default:
			return filled ? IconFileDescriptionFilled : IconFileDescription;
	}
}

function getFilterLabel(type, value) {
	if (type === 'type') return typeOptions.value.find((option) => option.value === value)?.label || t('filters.type');
	if (type === 'updated') return updatedOptions.value.find((option) => option.value === value)?.label || t('filters.modified');
	return value;
}

function matchesUpdatedFilter(value, filter) {
	if (!value) return false;
	const fileDate = new Date(value);
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const last7Start = new Date(todayStart);
	last7Start.setDate(last7Start.getDate() - 6);
	const last30Start = new Date(todayStart);
	last30Start.setDate(last30Start.getDate() - 29);
	const thisYearStart = new Date(now.getFullYear(), 0, 1);
	const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
	const lastYearEnd = new Date(now.getFullYear(), 0, 1);
	switch (filter) {
		case 'today':
			return fileDate >= todayStart;
		case 'last7':
			return fileDate >= last7Start;
		case 'last30':
			return fileDate >= last30Start;
		case 'thisYear':
			return fileDate >= thisYearStart;
		case 'lastYear':
			return fileDate >= lastYearStart && fileDate < lastYearEnd;
		default:
			return true;
	}
}

function toggleFilterMenu(menu) {
	activeFilterMenu.value = activeFilterMenu.value === menu ? null : menu;
}

function applyFilter(type, value) {
	if (type === 'type') selectedTypeFilter.value = value;
	if (type === 'owner') selectedOwnerFilter.value = value;
	if (type === 'updated') selectedUpdatedFilter.value = value;
	activeFilterMenu.value = null;
}

function clearFilter(type) {
	if (type === 'type') selectedTypeFilter.value = 'all';
	if (type === 'owner') selectedOwnerFilter.value = 'all';
	if (type === 'updated') selectedUpdatedFilter.value = 'all';
}

function isFilterActive(type) {
	if (type === 'type') return selectedTypeFilter.value !== 'all';
	if (type === 'owner') return selectedOwnerFilter.value !== 'all';
	if (type === 'updated') return selectedUpdatedFilter.value !== 'all';
	return false;
}

function renderOwnerLabel(value) {
	return value === 'all' ? t('filters.allOwners') : value;
}

function openFolder(file) {
	if (!file.is_folder) return;
	clearSelection();

	const parent = file.virtual_path || '/';
	const inside = `${parent === '/' ? '' : parent}${file.file_name}/`;
	const targetPath = inside.startsWith('/') ? inside : `/${inside}`;
	fileTreeStore.pendingPath = targetPath;
	router.push({ path: '/my-drive' });
}

function openSelectedItem() {
	const file = primarySelectedFile.value || contextMenu.value.file;
	closeContextMenu();
	if (!file?.is_folder) return;
	openFolder(file);
}

function replaceSelection(file) {
	selectedFileIds.value = new Set([file.id]);
	lastSelectedFileId.value = file.id;
}

function toggleSelection(file) {
	const next = new Set(selectedFileIds.value);
	if (next.has(file.id)) next.delete(file.id);
	else next.add(file.id);
	selectedFileIds.value = next;
	lastSelectedFileId.value = file.id;
}

function selectRange(file) {
	const items = sortedFiles.value;
	const currentIndex = items.findIndex((item) => item.id === file.id);
	const anchorIndex = items.findIndex((item) => item.id === lastSelectedFileId.value);
	if (currentIndex === -1 || anchorIndex === -1) {
		replaceSelection(file);
		return;
	}
	const [start, end] = currentIndex < anchorIndex ? [currentIndex, anchorIndex] : [anchorIndex, currentIndex];
	selectedFileIds.value = new Set(items.slice(start, end + 1).map((item) => item.id));
}

function selectItem(event, file) {
	event.preventDefault();
	event.stopPropagation();
	closeContextMenu();
	if (event.shiftKey) {
		selectRange(file);
		return;
	}
	if (event.ctrlKey || event.metaKey) {
		toggleSelection(file);
		return;
	}
	replaceSelection(file);
}

function clearSelection() {
	selectedFileIds.value = new Set();
	lastSelectedFileId.value = null;
}

function isSelected(file) {
	return selectedFileIds.value.has(file.id);
}

function openItemOnDoubleClick(file) {
	if (file.is_folder) {
		openFolder(file);
		return;
	}
	if (canPreviewFile(file)) {
		openPreview(file);
	}
}

function sortIndicator(field) {
	if (sortBy.value !== field) return null;
	return sortDirection.value === 'asc' ? IconChevronUp : IconChevronDown;
}

function toggleSort(field) {
	if (sortBy.value === field) {
		sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
		return;
	}
	sortBy.value = field;
	sortDirection.value = field === 'file_name' || field === 'email' ? 'asc' : 'desc';
}

function toggleViewMode(mode) {
	isGridView.value = mode === 'grid';
}

function closeContextMenu() {
	contextMenu.value = {
		visible: false,
		x: 0,
		y: 0,
		file: null
	};
}
async function openContextMenu(event, file) {
	event.preventDefault();
	event.stopPropagation();
	if (!selectedFileIds.value.has(file.id)) replaceSelection(file);
	contextMenu.value = {
		visible: true,
		x: event.clientX,
		y: event.clientY,
		file
	};

	await nextTick();

	const menu = contextMenuRef.value;
	if (!menu) return;

	const padding = 12;
	const rect = menu.getBoundingClientRect();
	contextMenu.value = {
		...contextMenu.value,
		x: Math.max(padding, Math.min(event.clientX, window.innerWidth - rect.width - padding)),
		y: Math.max(padding, Math.min(event.clientY, window.innerHeight - rect.height - padding)),
	};
}

function getActionFiles(fallbackFile = contextMenu.value.file) {
	return selectedFiles.value.length ? selectedFiles.value : (fallbackFile ? [fallbackFile] : []);
}

function canPreviewFile(file) {
	return Boolean(file && !file.is_folder && ['image', 'video', 'audio', 'pdf', 'document'].includes(getFileCategory(file)));
}
async function openPreview(file = contextMenu.value.file) {
	if (!canPreviewFile(file)) return;
	closeContextMenu();
	isPreviewLoading.value = true;
	previewFile.value = {
		...file,
		previewType: getFileCategory(file),
		previewUrl: api.previewUrl(file.id)
	};
	isPreviewOpen.value = true;
}

function closeDetails() {
	isDetailsOpen.value = false;
	detailsFile.value = null;
}

function closePreview() {
	isPreviewOpen.value = false;
	previewFile.value = null;
	isPreviewLoading.value = false;
}

function handlePreviewLoaded() {
	isPreviewLoading.value = false;
}

function handlePreviewFailed() {
	isPreviewLoading.value = false;
	errorMessage.value = t('preview.failed');
}

async function refreshStarred() {
	loading.value = true;
	errorMessage.value = '';
	try {
		const {
			data
		} = await api.listStarredFiles();
		files.value = Array.isArray(data) ? data : [];
		selectedFileIds.value = new Set([...selectedFileIds.value].filter((id) => files.value.some((file) => file.id === id)));
	} catch (error) {
		errorMessage.value = error.message;
	} finally {
		loading.value = false;
	}
}

async function showSelectedFileDetails() {
	const file = primarySelectedFile.value || contextMenu.value.file;
	if (!file) return;
	closeContextMenu();
	errorMessage.value = '';
	try {
		const {
			data
		} = await api.getFileDetails(file.id);
		detailsFile.value = data;
		isDetailsOpen.value = true;
	} catch (error) {
		errorMessage.value = error.message;
	}
}

async function renameSelectedFile() {
	const file = primarySelectedFile.value || contextMenu.value.file;
	if (!file) return;
	const nextName = window.prompt(t('drive.newNamePrompt'), file.file_name);
	closeContextMenu();
	if (!nextName?.trim() || nextName.trim() === file.file_name) return;
	errorMessage.value = '';
	try {
		await api.renameFile(file.id, {
			name: nextName.trim()
		});
		await refreshStarred();
	} catch (error) {
		errorMessage.value = error.message;
	}
}

async function deleteSelectedFile() {
	const targets = getActionFiles();
	if (!targets.length) return;
	const confirmed = window.confirm(
		targets.length === 1 ?
			t('drive.deleteConfirm', {
				name: targets[0].file_name
			}) :
			t('drive.deleteConfirm', {
				name: targets.length + ' ' + t('common.items')
			}),
	);
	closeContextMenu();
	if (!confirmed) return;
	errorMessage.value = '';
	try {
		if (targets.length === 1) {
			await api.deleteFile(targets[0].id);
		} else {
			await api.deleteFiles(targets.map((f) => f.id));
		}
		clearSelection();
		await refreshStarred();
	} catch (error) {
		errorMessage.value = error.message;
	}
}

function triggerDownload(file) {
	closeContextMenu();
	if (file?.is_folder) return;
	uploadQueueStore.downloadFile(file).catch((error) => {
		errorMessage.value = error.message;
	});
}

function downloadSelection() {
	const downloadableFiles = getActionFiles().filter((file) => !file.is_folder);
	closeContextMenu();
	uploadQueueStore.downloadFiles(downloadableFiles).catch((error) => {
		errorMessage.value = error.message;
	});
}
async function unstarSelection() {
	const targets = [...selectedFiles.value].filter((file) => file.capabilities?.starred);
	if (!targets.length) return;
	await Promise.all(targets.map((file) => api.toggleStar(file.id, false)));
	clearSelection();
	await refreshStarred();
}

async function toggleSelectedFileStar() {
	const file = primarySelectedFile.value || contextMenu.value.file;
	if (!file || !file.capabilities?.starred) return;
	const nextStarred = !Boolean(file.is_starred);
	closeContextMenu();
	errorMessage.value = '';
	try {
		await api.toggleStar(file.id, nextStarred);
		await refreshStarred();
	} catch (error) {
		errorMessage.value = error.message;
	}
}

function handleGlobalPointer() {
	if (contextMenu.value.visible) closeContextMenu();
	activeFilterMenu.value = null;
}

onMounted(() => {
	refreshStarred();
	refreshTimer = window.setInterval(refreshStarred, 30000);
	window.addEventListener('click', handleGlobalPointer);
	window.addEventListener('scroll', handleGlobalPointer, true);
});

onBeforeUnmount(() => {
	if (refreshTimer) window.clearInterval(refreshTimer);
	window.removeEventListener('click', handleGlobalPointer);
	window.removeEventListener('scroll', handleGlobalPointer, true);
});
</script>

<template>
	<DriveShell current-section="starred">
		<div class="relative min-h-[calc(100vh-84px)] rounded-[24px] bg-white px-4 py-[18px] pb-5 text-[#202124] dark:bg-slate-800 dark:text-slate-100 sm:px-6">
			<div class="mb-2 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
				<h1 class="m-0 text-2xl font-normal text-[#202124] dark:text-slate-100">{{ t('nav.starred') }}</h1>
				<div class="flex items-center gap-2">
					<button type="button" class="grid size-9 place-items-center rounded-full transition" :class="!isGridView ? 'bg-[#e8f0fe] text-[#1a73e8] dark:bg-sky-500/15 dark:text-sky-300' : 'text-[#5f6368] hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/8'" @click="toggleViewMode('list')">
						<component :is="!isGridView ? IconListDetailsFilled : IconList" :size="18" :stroke="!isGridView ? 0 : 2" />
					</button>
					<button type="button" class="grid size-9 place-items-center rounded-full transition" :class="isGridView ? 'bg-[#e8f0fe] text-[#1a73e8] dark:bg-sky-500/15 dark:text-sky-300' : 'text-[#5f6368] hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/8'" @click="toggleViewMode('grid')">
						<component :is="isGridView ? IconLayoutGridFilled : IconLayoutGrid" :size="18" :stroke="isGridView ? 0 : 2" />
					</button>
				</div>
			</div>

			<div class="mb-4 flex flex-wrap items-center justify-end gap-2.5">
				<div class="relative">
					<button type="button" class="inline-flex items-center gap-2 rounded-2xl border border-[#e0e3e7] bg-[#f8fafd] px-3.5 py-2 text-sm font-medium text-[#3c4043] transition hover:border-[#c7d2e0] hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800" @click.stop="toggleFilterMenu('type')">
						<span>{{ getFilterLabel('type', selectedTypeFilter) }}</span>
						<IconX v-if="isFilterActive('type')" :size="16" :stroke="2" class="text-[#5f6368] transition hover:text-[#1a73e8] dark:text-slate-400 dark:hover:text-sky-300" @click.stop="clearFilter('type')" />
						<IconChevronDown v-else :size="16" :stroke="2" class="text-[#5f6368] dark:text-slate-400" />
					</button>
					<div v-if="activeFilterMenu === 'type'" class="absolute right-0 top-full z-30 mt-2 min-w-[220px] overflow-hidden rounded-2xl border border-[#e0e3e7] bg-white p-2 shadow-[0_16px_40px_rgba(32,33,36,0.16)] dark:border-slate-700 dark:bg-slate-800">
						<button v-for="option in typeOptions" :key="option.value" type="button" class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition text-[#202124] hover:bg-[#f8fafd] dark:text-slate-100 dark:hover:bg-slate-700/70" @click="applyFilter('type', option.value)">
							<span class="flex items-center gap-2">
								<component :is="getTypeFilterIcon(option.value, selectedTypeFilter === option.value)" :size="16" :stroke="selectedTypeFilter === option.value ? 0 : 1.8" :class="selectedTypeFilter === option.value ? 'text-[#1a73e8] dark:text-sky-300' : 'text-[#5f6368] dark:text-slate-400'" /><span>{{ option.label }}</span>
							</span>
							<IconCheck v-if="selectedTypeFilter === option.value" :size="16" :stroke="2" class="text-[#1a73e8] dark:text-sky-300" />
						</button>
					</div>
				</div>
				<div class="relative">
					<button type="button" class="inline-flex items-center gap-2 rounded-2xl border border-[#e0e3e7] bg-[#f8fafd] px-3.5 py-2 text-sm font-medium text-[#3c4043] transition hover:border-[#c7d2e0] hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800" @click.stop="toggleFilterMenu('owner')">
						<span>{{ renderOwnerLabel(selectedOwnerFilter) }}</span>
						<IconX v-if="isFilterActive('owner')" :size="16" :stroke="2" class="text-[#5f6368] transition hover:text-[#1a73e8] dark:text-slate-400 dark:hover:text-sky-300" @click.stop="clearFilter('owner')" />
						<IconChevronDown v-else :size="16" :stroke="2" class="text-[#5f6368] dark:text-slate-400" />
					</button>
					<div v-if="activeFilterMenu === 'owner'" class="absolute right-0 top-full z-30 mt-2 min-w-[260px] overflow-hidden rounded-2xl border border-[#e0e3e7] bg-white p-2 shadow-[0_16px_40px_rgba(32,33,36,0.16)] dark:border-slate-700 dark:bg-slate-800">
						<button type="button" class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-[#202124] hover:bg-[#f8fafd] dark:text-slate-100 dark:hover:bg-slate-700/70" @click="applyFilter('owner', 'all')">
							<span class="flex min-w-0 items-center gap-2"><span class="flex size-5 shrink-0 items-center justify-center">
									<component :is="selectedOwnerFilter === 'all' ? IconCloudFilled : IconCloud" :size="16" :stroke="selectedOwnerFilter === 'all' ? 0 : 1.8" :class="selectedOwnerFilter === 'all' ? 'text-[#1a73e8] dark:text-sky-300' : 'text-[#5f6368] dark:text-slate-400'" />
								</span><span>{{ t('filters.allOwners') }}</span></span>
							<IconCheck v-if="selectedOwnerFilter === 'all'" :size="16" :stroke="2" class="text-[#1a73e8] dark:text-sky-300" />
						</button>
						<button v-for="owner in ownerOptions" :key="owner.email" type="button" class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-[#202124] hover:bg-[#f8fafd] dark:text-slate-100 dark:hover:bg-slate-700/70" @click="applyFilter('owner', owner.email)">
							<span class="flex min-w-0 items-center gap-2">
								<div v-if="providerIcon(owner.provider)" class="flex size-5 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900/70"><img :src="providerIcon(owner.provider)" :alt="providerLabel(owner.provider)" class="size-3.5 object-contain" /></div>
								<div v-else class="size-5 shrink-0"></div>
								<span class="truncate">{{ owner.email }}</span>
							</span>
							<IconCheck v-if="selectedOwnerFilter === owner.email" :size="16" :stroke="2" class="text-[#1a73e8] dark:text-sky-300" />
						</button>
					</div>
				</div>
				<div class="relative">
					<button type="button" class="inline-flex items-center gap-2 rounded-2xl border border-[#e0e3e7] bg-[#f8fafd] px-3.5 py-2 text-sm font-medium text-[#3c4043] transition hover:border-[#c7d2e0] hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800" @click.stop="toggleFilterMenu('updated')">
						<span>{{ getFilterLabel('updated', selectedUpdatedFilter) }}</span>
						<IconX v-if="isFilterActive('updated')" :size="16" :stroke="2" class="text-[#5f6368] transition hover:text-[#1a73e8] dark:text-slate-400 dark:hover:text-sky-300" @click.stop="clearFilter('updated')" />
						<IconChevronDown v-else :size="16" :stroke="2" class="text-[#5f6368] dark:text-slate-400" />
					</button>
					<div v-if="activeFilterMenu === 'updated'" class="absolute right-0 top-full z-30 mt-2 min-w-[240px] overflow-hidden rounded-2xl border border-[#e0e3e7] bg-white p-2 shadow-[0_16px_40px_rgba(32,33,36,0.16)] dark:border-slate-700 dark:bg-slate-800">
						<button v-for="option in updatedOptions" :key="option.value" type="button" class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-[#202124] hover:bg-[#f8fafd] dark:text-slate-100 dark:hover:bg-slate-700/70" @click="applyFilter('updated', option.value)">
							<span>{{ option.label }}</span>
							<IconCheck v-if="selectedUpdatedFilter === option.value" :size="16" :stroke="2" class="text-[#1a73e8] dark:text-sky-300" />
						</button>
					</div>
				</div>
			</div>

			<div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div v-if="selectedCount" class="flex flex-wrap items-center gap-1.5 rounded-full bg-[#e8f0fe] px-2 py-1 text-[#174ea6] dark:bg-sky-500/15 dark:text-sky-200">
					<button type="button" class="inline-flex size-9 items-center justify-center rounded-full transition hover:bg-[#d2e3fc] dark:hover:bg-sky-500/20" :title="t('drive.deselectAll')" @click="clearSelection">
						<IconX :size="18" :stroke="2" />
					</button>
					<span class="pr-2 text-sm font-semibold">{{ selectedCount }} {{ t('drive.selected') }}</span>
					<button v-if="primarySelectedFile?.is_folder && selectedCount === 1" type="button" class="inline-flex size-9 items-center justify-center rounded-full transition hover:bg-[#d2e3fc] dark:hover:bg-sky-500/20" :title="t('common.open')" @click="openSelectedItem">
						<IconFolder :size="18" :stroke="2" />
					</button>
					<button v-if="selectedCount === 1 && !primarySelectedFile?.is_folder" type="button" class="inline-flex size-9 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:bg-[#d2e3fc] dark:enabled:hover:bg-sky-500/20" :title="t('drive.preview')" :disabled="!canPreviewSelection" @click="openPreview(primarySelectedFile)">
						<IconEye :size="18" :stroke="2" />
					</button>
					<button v-if="canToggleStarSelection" type="button" class="inline-flex size-9 items-center justify-center rounded-full transition enabled:hover:bg-[#d2e3fc] dark:enabled:hover:bg-sky-500/20" :title="isPrimarySelectedStarred ? t('drive.unstar') : t('drive.star')" @click="toggleSelectedFileStar">
						<component :is="isPrimarySelectedStarred ? IconStarFilled : IconStar" :size="18" :stroke="isPrimarySelectedStarred ? 0 : 2" />
					</button>
					<button type="button" class="inline-flex size-9 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:bg-[#d2e3fc] dark:enabled:hover:bg-sky-500/20" :title="t('common.download')" :disabled="!canDownloadSelection" @click="downloadSelection">
						<IconDownload :size="18" :stroke="2" />
					</button>
					<button type="button" class="inline-flex size-9 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:bg-[#d2e3fc] dark:enabled:hover:bg-sky-500/20" :title="t('common.edit')" :disabled="!canRenameSelection" @click="renameSelectedFile">
						<IconEdit :size="18" :stroke="2" />
					</button>
					<button type="button" class="inline-flex size-9 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:bg-[#d2e3fc] dark:enabled:hover:bg-sky-500/20" :title="t('drive.details')" :disabled="selectedCount !== 1" @click="showSelectedFileDetails">
						<IconInfoCircle :size="18" :stroke="2" />
					</button>
					<button type="button" class="inline-flex size-9 items-center justify-center rounded-full text-[#c5221f] transition hover:bg-[#fce8e6] dark:text-red-300 dark:hover:bg-red-950/30" :title="t('common.delete')" @click="deleteSelectedFile">
						<IconTrash :size="18" :stroke="2" />
					</button>
				</div>
				<h2 v-else class="m-0 text-base font-medium text-[#202124] dark:text-slate-100">{{ t('nav.starred') }}</h2>
				<div class="relative w-full sm:w-[280px]">
					<IconSearch :size="18" :stroke="2" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-slate-400" />
					<input class="h-11 w-full rounded-full border border-[#dadce0] bg-white pl-11 pr-4 text-sm text-[#202124] outline-none transition focus:border-[#1a73e8] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-400" type="search" :value="searchTerm" :placeholder="t('drive.searchInFolder')" @input="searchTerm = $event.target.value" />
				</div>
			</div>

			<p v-if="errorMessage" class="mb-4 rounded-2xl bg-[#fce8e6] px-4 py-3 text-sm text-[#c5221f] dark:bg-red-950/40 dark:text-red-300">{{ errorMessage }}</p>

			<div v-if="!isGridView" class="custom-scrollbar overflow-x-auto rounded-2xl border border-[#e0e3e7] bg-white dark:border-slate-700 dark:bg-slate-800">
				<div class="min-w-[760px]">
					<div class="sticky top-0 z-10 grid min-h-11 grid-cols-[minmax(260px,2fr)_minmax(180px,1.1fr)_minmax(150px,1fr)_140px] items-center gap-3 border-b border-[#e8eaed] bg-[#f8fafd]/95 px-[18px] text-[13px] text-[#5f6368] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-400">
						<button type="button" class="flex items-center gap-1 text-left hover:text-[#1a73e8]" @click="toggleSort('file_name')"><span>{{ t('drive.sortByName') }}</span>
							<component :is="sortIndicator('file_name')" v-if="sortIndicator('file_name')" :size="14" :stroke="2" />
						</button>
						<button type="button" class="flex items-center gap-1 text-left hover:text-[#1a73e8]" @click="toggleSort('email')"><span>{{ t('home.fileOwner') }}</span>
							<component :is="sortIndicator('email')" v-if="sortIndicator('email')" :size="14" :stroke="2" />
						</button>
						<button type="button" class="flex items-center gap-1 text-left hover:text-[#1a73e8]" @click="toggleSort('updated_at')"><span>{{ t('home.fileModified') }}</span>
							<component :is="sortIndicator('updated_at')" v-if="sortIndicator('updated_at')" :size="14" :stroke="2" />
						</button>
						<button type="button" class="flex items-center gap-1 text-left hover:text-[#1a73e8]" @click="toggleSort('size')"><span>{{ t('drive.size') }}</span>
							<component :is="sortIndicator('size')" v-if="sortIndicator('size')" :size="14" :stroke="2" />
						</button>
					</div>
					<div class="custom-scrollbar max-h-[min(52vh,520px)] overflow-y-auto overflow-x-hidden">
						<div v-for="item in sortedFiles" :key="item.id" class="group grid min-h-[52px] cursor-default select-none grid-cols-[minmax(260px,2fr)_minmax(180px,1.1fr)_minmax(150px,1fr)_140px] items-center gap-3 border-t border-[#eceff1] px-[18px] transition first:border-t-0 dark:border-slate-700" :class="isSelected(item) ? 'bg-gradient-to-r from-[#e8f0fe] to-[#f8fbff] shadow-[inset_4px_0_0_#1a73e8] dark:from-sky-500/15 dark:to-slate-800 dark:shadow-[inset_4px_0_0_#38bdf8]' : 'hover:bg-black/[0.02] dark:hover:bg-white/6'" @click="selectItem($event, item)" @dblclick="openItemOnDoubleClick(item)" @contextmenu="openContextMenu($event, item)">
							<div class="flex min-w-0 items-center gap-2.5 text-[#202124] dark:text-slate-100">
								<component :is="getFileIcon(item, isSelected(item))" :size="18" :stroke="isSelected(item) ? 0 : 1.8" class="transition-transform duration-200 group-hover:scale-110" :class="isSelected(item) ? 'text-[#1a73e8] drop-shadow-sm dark:text-sky-300' : 'text-[#5f6368] dark:text-slate-400'" />
								<TruncateMarquee :text="item.file_name" />
								<IconStarFilled v-if="item.is_starred && item.capabilities?.starred" :size="14" :stroke="0" class="shrink-0 text-amber-400" />
							</div>
							<div class="flex min-w-0 items-center gap-2 text-[#5f6368] dark:text-slate-400">
								<div v-if="providerIcon(item.provider)" class="flex size-6 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900/70"><img :src="providerIcon(item.provider)" :alt="providerLabel(item.provider)" class="size-3.5 object-contain" /></div>
								<TruncateMarquee class="min-w-0" :text="item.email" />
							</div>
							<span class="text-[#5f6368] dark:text-slate-400">{{ formatDate(getModifiedTime(item)) }}</span>
							<span class="text-[#5f6368] dark:text-slate-400">{{ item.is_folder ? '—' : formatBytes(item.size) }}</span>
						</div>
						<div v-if="!sortedFiles.length && !loading" class="p-[18px] text-[#5f6368] dark:text-slate-400">{{ t('drive.noFiles') }}</div>
						<div v-if="loading" class="p-[18px] text-[#5f6368] dark:text-slate-400">{{ t('drive.loadingMetadata') }}</div>
					</div>
				</div>
			</div>

			<div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<div v-for="item in sortedFiles" :key="item.id" class="group select-none rounded-[22px] border p-4 transition hover:-translate-y-0.5 hover:border-[#d2e3fc] hover:shadow-[0_10px_30px_rgba(32,33,36,0.08)] dark:hover:border-slate-500" :class="isSelected(item) ? 'border-[#1a73e8] bg-gradient-to-br from-[#e8f0fe] to-[#f8fbff] shadow-[0_14px_34px_rgba(26,115,232,0.14)] dark:border-sky-400 dark:from-sky-500/15 dark:to-slate-800' : 'border-[#e0e3e7] bg-white dark:border-slate-700 dark:bg-slate-800'" @click="selectItem($event, item)" @dblclick="openItemOnDoubleClick(item)" @contextmenu="openContextMenu($event, item)">
					<button type="button" class="flex w-full flex-col items-start gap-4 text-left">
						<div class="flex w-full items-start justify-between gap-3">
							<div class="grid size-12 place-items-center rounded-2xl transition" :class="isSelected(item) ? 'bg-[#d3e3fd] text-[#1a73e8] shadow-inner dark:bg-sky-500/20 dark:text-sky-300' : 'bg-[#f1f3f4] text-[#5f6368] dark:bg-slate-700 dark:text-slate-300'">
								<component :is="getFileIcon(item, isSelected(item))" :size="22" :stroke="isSelected(item) ? 0 : 1.8" class="transition-transform duration-200 group-hover:scale-110" />
							</div>
							<IconStarFilled v-if="item.is_starred && item.capabilities?.starred" :size="16" :stroke="0" class="shrink-0 text-amber-400" />
						</div>
						<div class="min-w-0">
							<TruncateMarquee as="p" class="text-sm font-semibold text-[#202124] dark:text-slate-100" :text="item.file_name" />
							<div class="mt-1 flex min-w-0 items-center gap-2 text-xs text-[#5f6368] dark:text-slate-400">
								<div v-if="providerIcon(item.provider)" class="flex size-6 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900/70"><img :src="providerIcon(item.provider)" :alt="providerLabel(item.provider)" class="size-3.5 object-contain" /></div>
								<TruncateMarquee as="p" class="min-w-0" :text="item.email || t('drive.noOwner')" />
							</div>
						</div>
						<div class="flex w-full items-center justify-between text-xs text-[#5f6368] dark:text-slate-400">
							<span>{{ formatDate(getModifiedTime(item)) }}</span>
							<span>{{ item.is_folder ? t('drive.folder') : formatBytes(item.size) }}</span>
						</div>
					</button>
				</div>
				<div v-if="!sortedFiles.length && !loading" class="col-span-full rounded-2xl border border-dashed border-[#dadce0] bg-white px-5 py-8 text-center text-[#5f6368] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">{{ t('drive.noFiles') }}</div>
				<div v-if="loading" class="col-span-full rounded-2xl border border-dashed border-[#dadce0] bg-white px-5 py-8 text-center text-[#5f6368] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">{{ t('drive.loadingMetadata') }}</div>
			</div>

			<div v-if="contextMenu.visible" ref="contextMenuRef" class="fixed z-50 min-w-[220px] overflow-hidden rounded-2xl border border-[#e0e3e7] bg-white py-2 shadow-[0_16px_40px_rgba(32,33,36,0.2)] dark:border-slate-700 dark:bg-slate-800 dark:shadow-[0_16px_40px_rgba(15,23,42,0.45)]" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @click.stop @contextmenu.stop>
				<button v-if="primarySelectedFile?.is_folder && selectedCount === 1" type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#202124] hover:bg-[#f8fafd] dark:text-slate-100 dark:hover:bg-slate-700/70" @click="openSelectedItem">
					<IconFolder :size="17" :stroke="2" />
					<span>{{ t('common.open') }}</span>
				</button>
				<button v-if="selectedCount === 1 && !primarySelectedFile?.is_folder" type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#202124] hover:bg-[#f8fafd] disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-700/70" :disabled="!canPreviewSelection" @click="openPreview(primarySelectedFile)">
					<IconEye :size="17" :stroke="2" />
					<span>{{ t('drive.preview') }}</span>
				</button>
				<button v-if="canToggleStarSelection" type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#202124] hover:bg-[#f8fafd] dark:text-slate-100 dark:hover:bg-slate-700/70" @click="toggleSelectedFileStar">
					<component :is="isPrimarySelectedStarred ? IconStarFilled : IconStar" :size="17" :stroke="isPrimarySelectedStarred ? 0 : 2" />
					<span>{{ isPrimarySelectedStarred ? t('drive.unstar') : t('drive.star') }}</span>
				</button>
				<button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#202124] hover:bg-[#f8fafd] disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-700/70" :disabled="!canDownloadSelection" @click="downloadSelection">
					<IconDownload :size="17" :stroke="2" />
					<span>{{ t('common.download') }}</span>
				</button>
				<button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#202124] hover:bg-[#f8fafd] disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-700/70" :disabled="!canRenameSelection" @click="renameSelectedFile">
					<IconEdit :size="17" :stroke="2" />
					<span>{{ t('common.edit') }}</span>
				</button>
				<button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#202124] hover:bg-[#f8fafd] disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-700/70" :disabled="selectedCount !== 1" @click="showSelectedFileDetails">
					<IconInfoCircle :size="17" :stroke="2" />
					<span>{{ t('drive.details') }}</span>
				</button>
				<button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#c5221f] hover:bg-[#fce8e6] dark:text-red-300 dark:hover:bg-red-950/30" @click="deleteSelectedFile">
					<IconTrash :size="17" :stroke="2" />
					<span>{{ t('common.delete') }}</span>
				</button>
			</div>

			<div v-if="isDetailsOpen && detailsFile" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4" @click="closeDetails">
				<div class="w-full max-w-lg rounded-[28px] bg-white p-6 text-[#202124] shadow-[0_24px_60px_rgba(32,33,36,0.28)] dark:bg-slate-800 dark:text-slate-100" @click.stop>
					<div class="flex items-start justify-between gap-4">
						<div>
							<h3 class="text-xl font-semibold">{{ detailsFile.is_folder ? t('drive.details') + ' ' + t('drive.folder') : t('drive.details') }}</h3>
							<p class="mt-1 text-sm text-[#5f6368] dark:text-slate-400">{{ t('drive.metadataDescription') }}</p>
						</div>
						<button type="button" class="rounded-full px-3 py-1 text-sm text-[#5f6368] hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/8" @click="closeDetails">{{ t('common.close') }}</button>
					</div>
					<dl class="mt-6 grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
						<dt class="text-[#5f6368] dark:text-slate-400">{{ t('common.name') }}</dt>
						<dd>{{ detailsFile.name || detailsFile.file_name }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">{{ t('drive.type') }}</dt>
						<dd>{{ detailsFile.mime_type || detailsFile.mimeType || '—' }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">{{ t('drive.size') }}</dt>
						<dd>{{ detailsFile.is_folder ? t('drive.folder') : formatBytes(detailsFile.size) }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">{{ t('drive.owner') }}</dt>
						<dd>{{ detailsFile.owner_email || detailsFile.email || '—' }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">Provider</dt>
						<dd>{{ providerLabel(detailsFile.provider) }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">{{ t('drive.created') }}</dt>
						<dd>{{ formatDate(getCreatedTime(detailsFile)) }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">{{ t('drive.modified') }}</dt>
						<dd>{{ formatDate(getModifiedTime(detailsFile)) }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">{{ t('drive.location') }}</dt>
						<dd class="break-all">{{ detailsFile.virtual_path }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">Remote ID</dt>
						<dd class="break-all">{{ detailsFile.remote_file_id || detailsFile.id }}</dd>
					</dl>
				</div>
			</div>

			<div v-if="isPreviewOpen && previewFile" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8" @click="closePreview">
				<div class="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white text-[#202124] shadow-[0_24px_60px_rgba(32,33,36,0.28)] dark:bg-slate-900 dark:text-slate-100" @click.stop>
					<div class="flex items-center justify-between gap-4 border-b border-[#e8eaed] px-5 py-4 dark:border-slate-800">
						<div class="min-w-0">
							<p class="truncate text-base font-semibold">{{ previewFile.file_name }}</p>
						</div>
						<div class="flex items-center gap-2">
							<button type="button" class="grid size-10 place-items-center rounded-full text-[#5f6368] hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/8" @click="closePreview">
								<IconX :size="18" :stroke="2" />
							</button>
						</div>
					</div>
					<div class="relative min-h-[420px] flex-1 bg-[#f8fafd] dark:bg-slate-950">
						<div v-if="isPreviewLoading" class="absolute inset-0 z-10 grid place-items-center text-sm text-[#5f6368] dark:text-slate-400">{{ t('preview.loading') }}</div>
						<img v-if="previewFile.previewType === 'image'" :src="previewFile.previewUrl" class="max-h-[75vh] w-full object-contain" alt="Preview file" @load="handlePreviewLoaded" @error="handlePreviewFailed" />
						<video v-else-if="previewFile.previewType === 'video'" class="max-h-[75vh] w-full bg-black" controls playsinline @loadeddata="handlePreviewLoaded" @error="handlePreviewFailed">
							<source :src="previewFile.previewUrl" :type="previewFile.mime_type || 'video/mp4'" />
						</video>
						<div v-else-if="previewFile.previewType === 'audio'" class="grid min-h-[420px] place-items-center px-6">
							<div class="w-full max-w-xl rounded-[24px] border border-[#e0e3e7] bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
								<div class="mx-auto grid size-16 place-items-center rounded-full bg-[#e8f0fe] text-[#1a73e8] dark:bg-slate-800">
									<IconMusic :size="28" :stroke="1.8" />
								</div>
								<p class="mt-4 font-medium">{{ previewFile.file_name }}</p>
								<audio class="mt-5 w-full" controls @loadeddata="handlePreviewLoaded" @error="handlePreviewFailed">
									<source :src="previewFile.previewUrl" :type="previewFile.mime_type || 'audio/mpeg'" />
								</audio>
							</div>
						</div>
						<iframe v-else-if="previewFile.previewType === 'pdf' || previewFile.previewType === 'document'" :src="previewFile.previewUrl" class="h-[75vh] w-full border-0" :title="t('preview.document')" @load="handlePreviewLoaded" />
						<div v-else class="grid min-h-[420px] place-items-center px-6 text-center text-sm text-[#5f6368] dark:text-slate-400">
							<div>
								<div class="mx-auto grid size-16 place-items-center rounded-full bg-[#e8f0fe] text-[#1a73e8] dark:bg-slate-800">
									<IconPlayerPlay :size="28" :stroke="1.8" />
								</div>
								<p class="mt-4">{{ t('preview.notAvailable') }}</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<FloatingProgressToast :uploads="uploads" :total-progress="totalProgress" @close="uploadQueueStore.clearOperations" @close-item="uploadQueueStore.closeOperation" />
	</DriveShell>
</template>