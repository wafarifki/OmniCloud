import { google } from 'googleapis';
import { BaseCloudAdapter } from './BaseCloudAdapter.js';
import { decryptJson } from '../utils/crypto.js';

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

function normalizePath(input = '/') {
	if (!input || input === '/') return '/';
	const prefixed = input.startsWith('/') ? input : `/${input}`;
	return prefixed.endsWith('/') ? prefixed : `${prefixed}/`;
}

function escapeDriveQueryValue(value) {
	return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export class GoogleDriveAdapter extends BaseCloudAdapter {
	getCapabilities() {
		return {
			starred: true,
		};
	}

	createOAuthClient() {
		const credentials = decryptJson(this.account.encrypted_credentials);
		const oauthClient = new google.auth.OAuth2(
			credentials.clientId,
			credentials.clientSecret,
			credentials.redirectUri,
		);

		oauthClient.setCredentials({
			refresh_token: credentials.refreshToken || undefined,
			access_token: credentials.accessToken || undefined,
			expiry_date: credentials.expiryDate || undefined,
			scope: credentials.scope || undefined,
			token_type: credentials.tokenType || undefined,
		});

		return oauthClient;
	}

	async getDriveClient() {
		const auth = this.createOAuthClient();
		return google.drive({ version: 'v3', auth });
	}

	async ensureRemotePath(virtualPath = '/') {
		const normalizedPath = normalizePath(virtualPath);
		if (normalizedPath === '/') {
			return 'root';
		}

		const drive = await this.getDriveClient();
		const segments = normalizedPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
		let parentId = 'root';

		for (const segment of segments) {
			const response = await drive.files.list({
				q: [
					`trashed = false`,
					`mimeType = '${FOLDER_MIME_TYPE}'`,
					`name = '${escapeDriveQueryValue(segment)}'`,
					`'${parentId}' in parents`,
				].join(' and '),
				fields: 'files(id, name)',
				pageSize: 1,
			});

			const existing = response.data.files?.[0];
			if (existing) {
				parentId = existing.id;
				continue;
			}

			const created = await drive.files.create({
				requestBody: {
					name: segment,
					mimeType: FOLDER_MIME_TYPE,
					parents: [parentId],
				},
				fields: 'id, parents',
			});

			parentId = created.data.id;
		}

		return parentId;
	}

	async fetchStructure() {
		const drive = await this.getDriveClient();
		const files = [];
		let pageToken;

		do {
			const response = await drive.files.list({
				q: 'trashed = false',
				fields: 'nextPageToken, files(id, name, mimeType, size, parents, starred, createdTime, modifiedTime)',
				pageSize: 1000,
				pageToken,
				supportsAllDrives: false,
			});

			files.push(...(response.data.files || []));
			pageToken = response.data.nextPageToken || undefined;
		} while (pageToken);

		const byId = new Map(files.map((file) => [file.id, file]));

		const buildFolderPath = (file) => {
			const parentId = file.parents?.[0];
			if (!parentId || parentId === 'root') {
				return '/';
			}

			const segments = [];
			const visited = new Set();
			let currentId = parentId;

			while (currentId && currentId !== 'root' && !visited.has(currentId)) {
				visited.add(currentId);
				const current = byId.get(currentId);
				if (!current) {
					break;
				}

				segments.unshift(current.name);
				currentId = current.parents?.[0];
			}

			return segments.length ? `/${segments.join('/')}/` : '/';
		};

		return files.map((file) => ({
			virtual_path: buildFolderPath(file),
			file_name: file.name,
			is_folder: file.mimeType === FOLDER_MIME_TYPE,
			is_starred: file.starred ? 1 : 0,
			size: Number(file.size || 0),
			mime_type: file.mimeType || null,
			remote_file_id: file.id,
			remote_parent_id: file.parents?.[0] || null,
			remote_created_time: file.createdTime || null,
			remote_modified_time: file.modifiedTime || null,
		}));
	}

	async setFileStarred(fileRecord, isStarred) {
		const drive = await this.getDriveClient();
		await drive.files.update({
			fileId: fileRecord.remote_file_id,
			requestBody: {
				starred: Boolean(isStarred),
			},
			fields: 'id, starred',
		});
	}

	async getStorageSummary() {
		const drive = await this.getDriveClient();
		const response = await drive.about.get({
			fields: 'storageQuota(limit,usage)',
		});

		return {
			totalSpace: Number(response.data.storageQuota?.limit || 0),
			usedSpace: Number(response.data.storageQuota?.usage || 0),
		};
	}

	async uploadStream({ stream, fileName, mimeType, virtualPath, remoteParentId, onProgress }) {
		const drive = await this.getDriveClient();
		const parentId = remoteParentId || await this.ensureRemotePath(virtualPath);
		const progressStream = this.createProgressStream(onProgress);
		const body = stream.pipe(progressStream);

		const response = await drive.files.create(
			{
				requestBody: {
					name: fileName,
					parents: parentId ? [parentId] : undefined,
				},
				media: {
					mimeType,
					body,
				},
				fields: 'id, parents, size, mimeType, name',
			},
			{
				maxBodyLength: Infinity,
			},
		);

		return {
			remoteFileId: response.data.id,
			remoteParentId: response.data.parents?.[0] || parentId || null,
			size: Number(response.data.size || 0),
			fileName: response.data.name || fileName,
			mimeType: response.data.mimeType || mimeType,
		};
	}

	async createFolder({ name, virtualPath = '/', remoteParentId }) {
		const drive = await this.getDriveClient();
		const parentId = remoteParentId || await this.ensureRemotePath(virtualPath);
		const response = await drive.files.create({
			requestBody: {
				name,
				mimeType: FOLDER_MIME_TYPE,
				parents: parentId ? [parentId] : undefined,
			},
			fields: 'id, parents, name',
		});

		return {
			remoteFileId: response.data.id,
			remoteParentId: response.data.parents?.[0] || parentId || null,
			fileName: response.data.name || name,
		};
	}

	async getDownloadStream(fileRecord) {
		const drive = await this.getDriveClient();
		const response = await drive.files.get(
			{
				fileId: fileRecord.remote_file_id,
				alt: 'media',
			},
			{
				responseType: 'stream',
			},
		);

		return response.data;
	}

	async renameFile(fileRecord, nextName) {
		const drive = await this.getDriveClient();
		await drive.files.update({
			fileId: fileRecord.remote_file_id,
			requestBody: {
				name: nextName,
			},
			fields: 'id, name',
		});
	}

	async deleteFile(fileRecord) {
		const drive = await this.getDriveClient();
		await drive.files.delete({
			fileId: fileRecord.remote_file_id,
		});
	}

	async getFileDetails(fileRecord) {
		const drive = await this.getDriveClient();
		const response = await drive.files.get({
			fileId: fileRecord.remote_file_id,
			fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink, owners(displayName,emailAddress), parents',
		});

		const remote = response.data;
		return {
			name: remote.name,
			mimeType: remote.mimeType,
			size: Number(remote.size || fileRecord.size || 0),
			createdTime: remote.createdTime,
			modifiedTime: remote.modifiedTime,
			webViewLink: remote.webViewLink,
			webContentLink: remote.webContentLink,
			owner_name: remote.owners?.[0]?.displayName || null,
			owner_email: remote.owners?.[0]?.emailAddress || this.account.email,
			remote_parent_id: remote.parents?.[0] || fileRecord.remote_parent_id || null,
			provider: 'google-drive',
		};
	}
}
