<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { IconChevronRight, IconDownload, IconFileDescription, IconFolder } from '@tabler/icons-vue';
import { api } from '../services/api';

const { t } = useI18n();

const props = defineProps({
	files: { type: Array, required: true },
	breadcrumbs: { type: Array, required: true },
	currentPath: { type: String, required: true },
	searchTerm: { type: String, default: '' },
	loading: { type: Boolean, default: false },
});

const emit = defineEmits(['navigate', 'search']);

const visibleFiles = computed(() => props.files.slice(0, 500));

function openFolder(file) {
	if (!file.is_folder) return;
	const nextPath = `${props.currentPath === '/' ? '' : props.currentPath}${file.file_name}/`;
	emit('navigate', nextPath.startsWith('/') ? nextPath : `/${nextPath}`);
}
</script>

<template>
	<section class="rounded-[28px] border border-[#e6ebf2] bg-white p-6 shadow-sm">
		<div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#1a73e8]">{{ t('fileExplorer.unifiedExplorer') }}</p>
				<h2 class="mt-2 text-2xl font-semibold text-[#202124]">{{ t('fileExplorer.virtualPooling') }}</h2>
			</div>
			<input class="h-11 w-full rounded-full border border-[#d6deea] bg-[#fbfcff] px-4 text-sm outline-none sm:w-[280px]" type="search" :value="searchTerm" :placeholder="t('fileExplorer.searchInFolder')" @input="emit('search', $event.target.value)" />
		</div>

		<nav class="mb-5 flex flex-wrap items-center gap-1.5">
			<button v-for="(crumb, index) in breadcrumbs" :key="crumb.path" type="button" class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-[#202124] hover:bg-black/[0.03]" @click="emit('navigate', crumb.path)">
				{{ crumb.label }}
				<IconChevronRight v-if="index < breadcrumbs.length - 1" :size="16" :stroke="2" class="text-[#5f6368]" />
			</button>
		</nav>

		<div class="overflow-hidden rounded-3xl border border-[#e6ebf2]">
			<article v-for="file in visibleFiles" :key="file.id" class="flex flex-col gap-3 border-t border-[#eef2f7] px-5 py-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between" :class="file.is_folder ? 'cursor-pointer hover:bg-black/[0.02]' : 'bg-white'" @dblclick="openFolder(file)">
				<div>
					<div class="flex items-center gap-2.5">
						<component :is="file.is_folder ? IconFolder : IconFileDescription" :size="18" :stroke="1.8" class="text-[#5f6368]" />
						<strong class="text-[#202124]">{{ file.display_name || file.file_name }}</strong>
					</div>
					<p class="mt-1 text-sm text-[#5f6368]">{{ file.virtual_path }}</p>
				</div>
				<div class="flex flex-wrap items-center gap-3 text-sm text-[#5f6368] sm:justify-end">
					<span>{{ file.provider }}</span>
					<span>{{ file.is_folder ? t('fileExplorer.folder') : file.mime_type || t('fileExplorer.file') }}</span>
					<a v-if="!file.is_folder" :href="api.downloadUrl(file.id)" class="inline-flex items-center gap-1 font-medium text-[#1a73e8]">
						<IconDownload :size="16" :stroke="2" />
						{{ t('fileExplorer.download') }}
					</a>
				</div>
			</article>

			<div v-if="!visibleFiles.length && !loading" class="p-5 text-sm text-[#5f6368]">{{ t('fileExplorer.noFiles') }}</div>
			<div v-if="loading" class="p-5 text-sm text-[#5f6368]">{{ t('fileExplorer.loading') }}</div>
		</div>
	</section>
</template>
