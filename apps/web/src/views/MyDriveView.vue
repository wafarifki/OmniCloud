<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import {
	IconChevronRight,
	IconEdit,
	IconEye,
	IconDownload,
	IconFileDescription,
	IconFolder,
	IconTrash,
	IconInfoCircle,
	IconLayoutGrid,
	IconListDetails,
} from '@tabler/icons-vue';
import DriveShell from '../components/DriveShell.vue';
import FloatingProgressToast from '../components/FloatingProgressToast.vue';
import { useFileTreeStore } from '../stores/fileTree';
import { useUploadQueueStore } from '../stores/uploadQueue';
import { api } from '../services/api';

const fileTreeStore = useFileTreeStore();
const uploadQueueStore = useUploadQueueStore();
const { currentPath, filteredFiles, breadcrumbs, searchTerm, isLoading } = storeToRefs(fileTreeStore);
const { activeUploads, totalProgress } = storeToRefs(uploadQueueStore);

const isDragActive = ref(false);
const dragDepth = ref(0);
const fileInputRef = ref(null);
const folderInputRef = ref(null);
const actionError = ref('');
const contextMenu = ref({ visible: false, x: 0, y: 0, file: null });
const detailsFile = ref(null);
const isDetailsOpen = ref(false);
const isActionRunning = ref(false);
const lastObservedSyncAt = ref('');
let healthPollTimer = null;

const folders = computed(() => filteredFiles.value.filter((file) => file.is_folder));

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
		year: 'numeric',
	}).format(new Date(value));
}

function openFolder(file) {
	if (!file.is_folder) return;
	const nextPath = `${currentPath.value === '/' ? '' : currentPath.value}${file.file_name}/`;
	fileTreeStore.navigate(nextPath.startsWith('/') ? nextPath : `/${nextPath}`);
}

function closeContextMenu() {
	contextMenu.value = { visible: false, x: 0, y: 0, file: null };
}

function openContextMenu(event, file) {
	event.preventDefault();
	contextMenu.value = {
		visible: true,
		x: event.clientX,
		y: event.clientY,
		file,
	};
}

function closeDetails() {
	isDetailsOpen.value = false;
	detailsFile.value = null;
}

function resetFileInput(inputRef) {
	if (inputRef.value) {
		inputRef.value.value = '';
	}
}

async function refreshCurrentFolder() {
	await fileTreeStore.loadFiles(currentPath.value);
}

async function checkSyncStatus() {
	if (document.visibilityState !== 'visible') {
		return;
	}

	try {
		const { sync } = await api.getHealth();
		const nextSyncAt = sync?.lastRunAt || '';

		if (!lastObservedSyncAt.value) {
			lastObservedSyncAt.value = nextSyncAt;
			return;
		}

		if (nextSyncAt && nextSyncAt !== lastObservedSyncAt.value) {
			lastObservedSyncAt.value = nextSyncAt;
			await refreshCurrentFolder();
		}
	} catch {
		// Ignore lightweight sync polling failures.
	}
}

function startHealthPolling() {
	stopHealthPolling();
	healthPollTimer = window.setInterval(() => {
		checkSyncStatus();
	}, 20000);
}

function stopHealthPolling() {
	if (healthPollTimer) {
		window.clearInterval(healthPollTimer);
		healthPollTimer = null;
	}
}

async function handleUploads(entries) {
	actionError.value = '';

	if (!entries.length) return;

	try {
		await uploadQueueStore.uploadFiles(entries, currentPath.value, refreshCurrentFolder);
		await refreshCurrentFolder();
	} catch (error) {
		actionError.value = error.message;
	}
}

function openFilePicker() {
	resetFileInput(fileInputRef);
	fileInputRef.value?.click();
}

function openFolderPicker() {
	resetFileInput(folderInputRef);
	folderInputRef.value?.click();
}

async function onFileInputChange(event) {
	const files = Array.from(event.target.files || []);
	await handleUploads(files);
}

async function onFolderInputChange(event) {
	const entries = Array.from(event.target.files || []).map((file) => ({
		file,
		relativePath: file.webkitRelativePath || file.name,
	}));
	await handleUploads(entries);
}

async function readDirectoryEntry(entry, prefix = '') {
	const reader = entry.createReader();
	const children = await new Promise((resolve, reject) => {
		reader.readEntries(resolve, reject);
	});

	const nested = await Promise.all(
		children.map((child) => readDroppedEntry(child, prefix ? `${prefix}/${entry.name}` : entry.name)),
	);

	return nested.flat();
}

async function readFileEntry(entry, prefix = '') {
	return new Promise((resolve, reject) => {
		entry.file(
			(file) => {
				resolve([
					{
						file,
						relativePath: prefix ? `${prefix}/${file.name}` : file.name,
					},
				]);
			},
			reject,
		);
	});
}

async function readDroppedEntry(entry, prefix = '') {
	if (entry.isDirectory) {
		return readDirectoryEntry(entry, prefix);
	}

	return readFileEntry(entry, prefix);
}

async function collectDroppedEntries(dataTransfer) {
	const items = Array.from(dataTransfer.items || []);
	const entries = items
		.map((item) => item.webkitGetAsEntry?.())
		.filter(Boolean);

	if (!entries.length) {
		return Array.from(dataTransfer.files || []);
	}

	const collected = await Promise.all(entries.map((entry) => readDroppedEntry(entry)));
	return collected.flat();
}

function handleDragEnter() {
	dragDepth.value += 1;
	isDragActive.value = true;
}

function handleDragLeave() {
	dragDepth.value = Math.max(0, dragDepth.value - 1);
	if (dragDepth.value === 0) {
		isDragActive.value = false;
	}
}

async function handleDrop(event) {
	dragDepth.value = 0;
	isDragActive.value = false;
	const entries = await collectDroppedEntries(event.dataTransfer);
	await handleUploads(entries);
}

async function createNewFolder() {
	const folderName = window.prompt('Nama folder baru');
	if (!folderName?.trim()) return;

	actionError.value = '';

	try {
		await api.createFolder({
			name: folderName.trim(),
			virtual_path: currentPath.value,
		});
		await refreshCurrentFolder();
	} catch (error) {
		actionError.value = error.message;
	}
}

async function renameSelectedFile() {
	const file = contextMenu.value.file;
	if (!file) return;

	const nextName = window.prompt('Nama baru', file.file_name);
	closeContextMenu();

	if (!nextName?.trim() || nextName.trim() === file.file_name) return;

	actionError.value = '';
	isActionRunning.value = true;

	try {
		await api.renameFile(file.id, { name: nextName.trim() });
		await refreshCurrentFolder();
	} catch (error) {
		actionError.value = error.message;
	} finally {
		isActionRunning.value = false;
	}
}

async function deleteSelectedFile() {
	const file = contextMenu.value.file;
	if (!file) return;

	const confirmed = window.confirm(`Hapus ${file.file_name}?`);
	closeContextMenu();
	if (!confirmed) return;

	actionError.value = '';
	isActionRunning.value = true;

	try {
		await api.deleteFile(file.id);
		await refreshCurrentFolder();
	} catch (error) {
		actionError.value = error.message;
	} finally {
		isActionRunning.value = false;
	}
}

async function showSelectedFileDetails() {
	const file = contextMenu.value.file;
	if (!file) return;

	closeContextMenu();
	actionError.value = '';
	isActionRunning.value = true;

	try {
		const { data } = await api.getFileDetails(file.id);
		detailsFile.value = data;
		isDetailsOpen.value = true;
	} catch (error) {
		actionError.value = error.message;
	} finally {
		isActionRunning.value = false;
	}
}

function triggerDownload(file) {
	closeContextMenu();
	if (file?.is_folder) return;
	window.open(api.downloadUrl(file.id), '_blank', 'noopener,noreferrer');
}

function handleGlobalPointer() {
	if (contextMenu.value.visible) {
		closeContextMenu();
	}
}

function handleVisibilityChange() {
	if (document.visibilityState === 'visible') {
		refreshCurrentFolder();
		checkSyncStatus();
	}
}

onMounted(() => {
	fileTreeStore.loadFiles('/');
	checkSyncStatus();
	startHealthPolling();
	window.addEventListener('click', handleGlobalPointer);
	window.addEventListener('scroll', handleGlobalPointer, true);
	document.addEventListener('visibilitychange', handleVisibilityChange);
});

onBeforeUnmount(() => {
	stopHealthPolling();
	window.removeEventListener('click', handleGlobalPointer);
	window.removeEventListener('scroll', handleGlobalPointer, true);
	document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<template>
	<DriveShell current-section="drive" @new-folder="createNewFolder" @upload-files="openFilePicker" @upload-folder="openFolderPicker">
		<div class="relative min-h-[calc(100vh-84px)] rounded-[24px] bg-white px-4 py-[18px] pb-5 text-[#202124] dark:bg-slate-800 dark:text-slate-100 sm:px-6" @dragenter.prevent="handleDragEnter" @dragover.prevent="handleDragEnter" @dragleave.prevent="handleDragLeave" @drop.prevent="handleDrop">
			<input ref="fileInputRef" class="hidden" type="file" multiple @change="onFileInputChange" />
			<input ref="folderInputRef" class="hidden" type="file" multiple webkitdirectory directory @change="onFolderInputChange" />

			<div v-if="isDragActive" class="pointer-events-none absolute inset-4 z-20 grid place-items-center rounded-[24px] border-2 border-dashed border-[#1a73e8] bg-[#e8f0fe]/90 text-center dark:bg-slate-900/90">
				<div>
					<p class="text-lg font-semibold text-[#1a73e8]">Lepas file di sini untuk upload</p>
					<p class="mt-2 text-sm text-[#5f6368] dark:text-slate-400">File dan folder akan diunggah ke lokasi Drive saat ini.</p>
				</div>
			</div>

			<div class="mb-2 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
				<h1 class="m-0 text-2xl font-normal text-[#202124] dark:text-slate-100">Drive Saya</h1>

				<div class="flex items-center gap-2">
					<button type="button" class="grid size-9 place-items-center rounded-full text-[#5f6368] hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/8">
						<IconListDetails :size="18" :stroke="2" />
					</button>
					<button type="button" class="grid size-9 place-items-center rounded-full text-[#5f6368] hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/8">
						<IconLayoutGrid :size="18" :stroke="2" />
					</button>
					<button type="button" class="grid size-9 place-items-center rounded-full text-[#5f6368] hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/8">
						<IconInfoCircle :size="18" :stroke="2" />
					</button>
				</div>
			</div>

			<div class="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<nav class="flex flex-wrap items-center gap-1.5">
					<button v-for="(crumb, index) in breadcrumbs" :key="crumb.path" type="button" class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[#202124] hover:bg-black/[0.03] dark:text-slate-100 dark:hover:bg-white/8" @click="fileTreeStore.navigate(crumb.path)">
						<span>{{ crumb.label === 'Root' ? 'Drive Saya' : crumb.label }}</span>
						<IconChevronRight v-if="index < breadcrumbs.length - 1" :size="16" :stroke="2" class="text-[#5f6368] dark:text-slate-400" />
					</button>
				</nav>

				<div class="flex flex-wrap gap-2.5">
					<button type="button" class="rounded-full border border-[#dadce0] bg-white px-3.5 py-2 text-[#1a73e8] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-400">Jenis</button>
					<button type="button" class="rounded-full border border-[#dadce0] bg-white px-3.5 py-2 text-[#1a73e8] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-400">Orang</button>
					<button type="button" class="rounded-full border border-[#dadce0] bg-white px-3.5 py-2 text-[#1a73e8] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-400">Diubah</button>
				</div>
			</div>

			<div class="mb-3 flex items-center justify-between gap-3">
				<h2 class="m-0 text-base font-medium text-[#202124] dark:text-slate-100">Saran</h2>
			</div>

			<div class="mb-[18px] grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<button v-for="folder in folders.slice(0, 4)" :key="folder.id" type="button" class="flex h-12 items-center gap-2.5 rounded-full border border-[#e0e3e7] bg-white px-3.5 text-left text-[#202124] hover:bg-black/[0.02] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-white/8" @click="openFolder(folder)" @dblclick="openFolder(folder)">
					<IconFolder :size="18" :stroke="1.8" class="text-[#1a73e8]" />
					<span class="truncate">{{ folder.display_name || folder.file_name }}</span>
				</button>
			</div>

			<div class="mb-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
				<h2 class="m-0 text-base font-medium text-[#202124] dark:text-slate-100">File</h2>
				<input class="h-9 w-full rounded-full border border-[#dadce0] bg-white px-3.5 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:w-[220px]" type="search" :value="searchTerm" placeholder="Telusuri di folder ini" @input="fileTreeStore.applySearch($event.target.value)" />
			</div>

			<p v-if="actionError" class="mb-4 rounded-2xl bg-[#fce8e6] px-4 py-3 text-sm text-[#c5221f] dark:bg-red-950/40 dark:text-red-300">{{ actionError }}</p>

			<div class="overflow-hidden rounded-2xl border border-[#e0e3e7] dark:border-slate-700">
				<div class="grid min-h-11 grid-cols-[minmax(220px,2fr)_1.1fr_1fr_140px_84px] items-center gap-3 bg-[#f8fafd] px-[18px] text-[13px] text-[#5f6368] dark:bg-slate-900/70 dark:text-slate-400 max-lg:grid-cols-[minmax(180px,1.8fr)_1fr_1fr]">
					<span>Nama</span>
					<span>Pemilik</span>
					<span>Terakhir diubah</span>
					<span class="max-lg:hidden">Ukuran file</span>
					<span class="max-lg:hidden"></span>
				</div>

				<div v-for="item in filteredFiles" :key="item.id" class="grid min-h-[52px] grid-cols-[minmax(220px,2fr)_1.1fr_1fr_140px_84px] items-center gap-3 border-t border-[#eceff1] px-[18px] dark:border-slate-700 max-lg:grid-cols-[minmax(180px,1.8fr)_1fr_1fr]" :class="item.is_folder ? 'cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/6' : 'hover:bg-black/[0.02] dark:hover:bg-white/6'" @dblclick="openFolder(item)" @contextmenu="openContextMenu($event, item)">
					<div class="flex items-center gap-2.5 text-[#202124] dark:text-slate-100">
						<component :is="item.is_folder ? IconFolder : IconFileDescription" :size="18" :stroke="1.8" class="text-[#5f6368] dark:text-slate-400" />
						<span class="truncate">{{ item.display_name || item.file_name }}</span>
					</div>
					<span class="text-[#5f6368] dark:text-slate-400">{{ item.email }}</span>
					<span class="text-[#5f6368] dark:text-slate-400">{{ formatDate(item.updated_at) }}</span>
					<span class="text-[#5f6368] dark:text-slate-400 max-lg:hidden">{{ item.is_folder ? '—' : formatBytes(item.size) }}</span>
					<button v-if="!item.is_folder" type="button" class="justify-self-end text-[#1a73e8] max-lg:hidden" @click="triggerDownload(item)">
						<IconDownload :size="18" :stroke="2" />
					</button>
				</div>

				<div v-if="!filteredFiles.length && !isLoading" class="p-[18px] text-[#5f6368] dark:text-slate-400">Tidak ada file pada lokasi ini.</div>
				<div v-if="isLoading" class="p-[18px] text-[#5f6368] dark:text-slate-400">Memuat metadata mirror...</div>
			</div>

			<div v-if="contextMenu.visible" class="fixed inset-0 z-40">
				<div class="absolute z-50 min-w-[220px] overflow-hidden rounded-2xl border border-[#e0e3e7] bg-white py-2 shadow-[0_16px_40px_rgba(32,33,36,0.2)] dark:border-slate-700 dark:bg-slate-800 dark:shadow-[0_16px_40px_rgba(15,23,42,0.45)]" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @click.stop>
					<button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#202124] hover:bg-[#f8fafd] disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-700/70" :disabled="contextMenu.file?.is_folder" @click="triggerDownload(contextMenu.file)">
						<IconDownload :size="17" :stroke="2" />
						<span>Download</span>
					</button>
					<button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#202124] hover:bg-[#f8fafd] dark:text-slate-100 dark:hover:bg-slate-700/70" @click="renameSelectedFile">
						<IconEdit :size="17" :stroke="2" />
						<span>Ganti Nama</span>
					</button>
					<button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#202124] hover:bg-[#f8fafd] dark:text-slate-100 dark:hover:bg-slate-700/70" @click="showSelectedFileDetails">
						<IconEye :size="17" :stroke="2" />
						<span>Detail File</span>
					</button>
					<button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#c5221f] hover:bg-[#fce8e6] dark:text-red-300 dark:hover:bg-red-950/30" @click="deleteSelectedFile">
						<IconTrash :size="17" :stroke="2" />
						<span>Hapus</span>
					</button>
				</div>
			</div>

			<div v-if="isDetailsOpen && detailsFile" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4" @click="closeDetails">
				<div class="w-full max-w-lg rounded-[28px] bg-white p-6 text-[#202124] shadow-[0_24px_60px_rgba(32,33,36,0.28)] dark:bg-slate-800 dark:text-slate-100" @click.stop>
					<div class="flex items-start justify-between gap-4">
						<div>
							<h3 class="text-xl font-semibold">Detail File</h3>
							<p class="mt-1 text-sm text-[#5f6368] dark:text-slate-400">Metadata dari provider dan mirror lokal.</p>
						</div>
						<button type="button" class="rounded-full px-3 py-1 text-sm text-[#5f6368] hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/8" @click="closeDetails">Tutup</button>
					</div>

					<dl class="mt-6 grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
						<dt class="text-[#5f6368] dark:text-slate-400">Nama</dt>
						<dd>{{ detailsFile.name || detailsFile.file_name }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">Tipe</dt>
						<dd>{{ detailsFile.mime_type || detailsFile.mimeType || '—' }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">Ukuran</dt>
						<dd>{{ detailsFile.is_folder ? 'Folder' : formatBytes(detailsFile.size) }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">Pemilik</dt>
						<dd>{{ detailsFile.owner_email || detailsFile.email || '—' }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">Provider</dt>
						<dd>{{ detailsFile.provider || 'google-drive' }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">Dibuat</dt>
						<dd>{{ formatDate(detailsFile.created_at || detailsFile.createdTime) }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">Diubah</dt>
						<dd>{{ formatDate(detailsFile.updated_at || detailsFile.modifiedTime) }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">Path</dt>
						<dd class="break-all">{{ detailsFile.virtual_path || currentPath }}</dd>
						<dt class="text-[#5f6368] dark:text-slate-400">Remote ID</dt>
						<dd class="break-all">{{ detailsFile.remote_file_id || detailsFile.id }}</dd>
					</dl>
				</div>
			</div>

			<div v-if="isActionRunning" class="pointer-events-none absolute right-6 top-6 rounded-full bg-[#1a73e8] px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
				Memproses...
			</div>
		</div>

		<FloatingProgressToast :uploads="activeUploads" :total-progress="totalProgress" />
	</DriveShell>
</template>