import cron from 'node-cron';
import { env } from '../config/env.js';
import { getActiveAccounts, markAccountStatus, updateAccountStorage } from './accountService.js';
import { createAdapter } from './adapterRegistry.js';
import { clearFilesForAccount, replaceFilesForAccount } from './fileService.js';
import { isAuthError, withRetry } from '../utils/providerErrors.js';

async function fetchAccountSnapshot(account) {
	return withRetry(
		async () => {
			const adapter = createAdapter(account);
			const remoteFiles = await adapter.fetchStructure();
			const storage = await adapter.getStorageSummary();
			return { remoteFiles, storage };
		},
		{
			retries: 3,
			onRetry: (error, attempt) => {
				console.warn(
					`Transient sync error for ${account.email} (attempt ${attempt}), retrying:`,
					error?.message || error,
				);
			},
		},
	);
}

function handleSyncFailure(account, error) {
	if (isAuthError(error)) {
		clearFilesForAccount(account.id);
		markAccountStatus(account.id, 'invalid_token');
		console.error(`Auth error for account ${account.email}, marked invalid_token:`, error.message);
		return;
	}

	console.error(
		`Transient sync failure for account ${account.email} (kept connected):`,
		error.message,
	);
}

let lastSyncReport = {
	lastRunAt: null,
	scannedAccounts: 0,
	changesDetected: 0,
};

let activeSyncPromise = null;

export async function runDeltaSync() {
	if (activeSyncPromise) {
		return activeSyncPromise;
	}

	activeSyncPromise = (async () => {
		const accounts = getActiveAccounts();
		let changesDetected = 0;

		for (const account of accounts) {
			try {
				const { remoteFiles, storage } = await fetchAccountSnapshot(account);

				replaceFilesForAccount(account.id, remoteFiles);
				updateAccountStorage(account.id, storage.totalSpace, storage.usedSpace);
				changesDetected += remoteFiles.length;
			} catch (error) {
				handleSyncFailure(account, error);
			}
		}

		lastSyncReport = {
			lastRunAt: new Date().toISOString(),
			scannedAccounts: accounts.length,
			changesDetected,
		};

		return lastSyncReport;
	})();

	try {
		return await activeSyncPromise;
	} finally {
		activeSyncPromise = null;
	}
}

export function scheduleSync() {
	const interval = Math.max(1, env.syncIntervalMinutes);
	cron.schedule(`*/${interval} * * * *`, () => {
		runDeltaSync().catch((error) => {
			console.error('Delta sync failed:', error);
		});
	});
}

export function getLastSyncReport() {
	return {
		...lastSyncReport,
		isRunning: Boolean(activeSyncPromise),
	};
}

export async function syncAccount(account) {
	try {
		const { remoteFiles, storage } = await fetchAccountSnapshot(account);

		replaceFilesForAccount(account.id, remoteFiles);
		updateAccountStorage(account.id, storage.totalSpace, storage.usedSpace);

		return {
			accountId: account.id,
			filesSynced: remoteFiles.length,
			totalSpace: storage.totalSpace,
			usedSpace: storage.usedSpace,
		};
	} catch (error) {
		handleSyncFailure(account, error);
		throw error;
	}
}
