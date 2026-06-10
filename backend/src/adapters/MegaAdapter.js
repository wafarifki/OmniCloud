import { Storage } from 'megajs';
import { BaseCloudAdapter } from './BaseCloudAdapter.js';
import { decryptJson } from '../utils/crypto.js';
import { updateAccountCredentials } from '../services/accountService.js';

function isMegaSessionError(error) {
	return /invalid or expired user session|ESID|utype/i.test(error?.message || '');
}

function normalizePath(input = '/') {
	if (!input || input === '/') return '/';
	const prefixed = input.startsWith('/') ? input : `/${input}`;
	return prefixed.endsWith('/') ? prefixed : `${prefixed}/`;
}

function buildVirtualPath(file) {
	const names = [];
	let cursor = file.parent;

	while (cursor?.parent && cursor.name) {
		names.unshift(cursor.name);
		cursor = cursor.parent;
	}

	return names.length ? `/${names.join('/')}/` : '/';
}

function findChildFolder(parent, name) {
	return (parent.children || []).find((child) => child.directory && child.name === name) || null;
}

export class MegaAdapter extends BaseCloudAdapter {
	constructor(account) {
		super(account);
		this.storagePromise = null;
	}

	readCredentials() {
		const credentials = decryptJson(this.account.encrypted_credentials);
		if (!credentials.session && (!credentials.email || !credentials.password)) {
			throw new Error('MEGA account credentials are incomplete');
		}
		return credentials;
	}

	async getStorage() {
		if (this.storagePromise) return this.storagePromise;

		const credentials = this.readCredentials();
		this.storagePromise = (async () => {
			let sessionError = null;

			if (credentials.session) {
				const sessionStorage = Storage.fromJSON(credentials.session);

				try {
					await sessionStorage.ready;
					await sessionStorage.getAccountInfo();
					await this.loadFileTree(sessionStorage);
					return sessionStorage;
				} catch (error) {
					sessionError = error;
					await sessionStorage.close().catch(() => { });

					if (!credentials.email || !credentials.password || !isMegaSessionError(error)) {
						throw error;
					}
				}
			}

			if (!credentials.email || !credentials.password) {
				throw sessionError || new Error('MEGA account credentials are incomplete');
			}

			const passwordStorage = new Storage({
				email: credentials.email,
				password: credentials.password,
				secondFactorCode: credentials.secondFactorCode || undefined,
				autoload: true,
				keepalive: false,
			});

			await passwordStorage.ready;

			this.persistRefreshedSession(credentials, passwordStorage);

			return passwordStorage;
		})();

		this.storagePromise.catch(() => {
			this.storagePromise = null;
		});

		return this.storagePromise;
	}

	loadFileTree(storage) {
		return new Promise((resolve, reject) => {
			storage.reload(true, (error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve(storage);
			});
		});
	}

	persistRefreshedSession(credentials, storage) {
		try {
			const session = storage.toJSON();
			if (!session) return;

			updateAccountCredentials(this.account.id, {
				...credentials,
				session,
			});
		} catch (error) {
			console.warn(`Failed to persist refreshed MEGA session for ${this.account.email}:`, error?.message || error);
		}
	}

	async ensureRemotePath(virtualPath = '/') {
		const storage = await this.getStorage();
		const normalizedPath = normalizePath(virtualPath);
		if (normalizedPath === '/') return storage.root;

		const segments = normalizedPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
		let current = storage.root;

		for (const segment of segments) {
			let next = findChildFolder(current, segment);
			if (!next) {
				next = await current.mkdir(segment);
			}
			current = next;
		}

		return current;
	}

	async findByRecord(fileRecord) {
		const storage = await this.getStorage();
		const remoteId = fileRecord.remote_file_id;

		if (remoteId && storage.files?.[remoteId]) {
			return storage.files[remoteId];
		}

		const parent = await this.ensureRemotePath(fileRecord.virtual_path);
		const match = (parent.children || []).find((child) => child.name === fileRecord.file_name);
		if (!match) {
			throw new Error(`MEGA item not found: ${fileRecord.file_name}`);
		}

		return match;
	}

	async fetchStructure() {
		const storage = await this.getStorage();
		const files = Object.values(storage.files || {});

		return files
			.filter((file) => file && file !== storage.root && file !== storage.trash && file !== storage.inbox && file.name)
			.map((file) => ({
				virtual_path: buildVirtualPath(file),
				file_name: file.name,
				is_folder: Boolean(file.directory),
				size: file.directory ? 0 : Number(file.size || 0),
				mime_type: file.directory ? null : 'application/octet-stream',
				remote_file_id: file.nodeId || file.downloadId,
				remote_parent_id: file.parent?.nodeId || null,
				remote_created_time: file.timestamp ? new Date(file.timestamp * 1000).toISOString() : null,
				remote_modified_time: file.timestamp ? new Date(file.timestamp * 1000).toISOString() : null,
			}));
	}

	async getStorageSummary() {
		const storage = await this.getStorage();
		const account = await storage.getAccountInfo();

		return {
			totalSpace: Number(account.spaceTotal || this.account.total_space || 0),
			usedSpace: Number(account.spaceUsed || this.account.used_space || 0),
		};
	}

	async uploadStream({ stream, size, fileName, mimeType, virtualPath = '/', onProgress }) {
		const parent = await this.ensureRemotePath(virtualPath);
		const progressStream = this.createProgressStream(onProgress);
		const upload = parent.upload({ name: fileName, size: Number(size || 0) });

		stream.pipe(progressStream).pipe(upload);
		const file = await upload.complete;

		return {
			remoteFileId: file.nodeId || file.downloadId,
			remoteParentId: parent.nodeId || null,
			size: Number(file.size || size || 0),
			fileName: file.name || fileName,
			mimeType,
		};
	}

	async createFolder({ name, virtualPath = '/' }) {
		const parent = await this.ensureRemotePath(virtualPath);
		const folder = await parent.mkdir(name);

		return {
			remoteFileId: folder.nodeId || folder.downloadId,
			remoteParentId: parent.nodeId || null,
			fileName: folder.name || name,
		};
	}

	async getDownloadStream(fileRecord) {
		const file = await this.findByRecord(fileRecord);
		if (file.directory) {
			throw new Error('Folders cannot be downloaded directly from MEGA');
		}

		return file.download({});
	}

	async renameFile(fileRecord, nextName) {
		const file = await this.findByRecord(fileRecord);
		await file.rename(nextName);
	}

	async deleteFile(fileRecord) {
		const file = await this.findByRecord(fileRecord);
		await file.delete(false);
	}

	async getFileDetails(fileRecord) {
		const file = await this.findByRecord(fileRecord);

		return {
			name: file.name || fileRecord.file_name,
			mime_type: fileRecord.mime_type,
			size: Number(file.size || fileRecord.size || 0),
			createdTime: file.timestamp ? new Date(file.timestamp * 1000).toISOString() : null,
			modifiedTime: file.timestamp ? new Date(file.timestamp * 1000).toISOString() : null,
			webViewLink: null,
			owner_email: this.account.email,
			remote_parent_id: file.parent?.nodeId || null,
			provider: 'mega',
		};
	}
}
