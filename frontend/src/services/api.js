const API_BASE_URL = 'http://localhost:8787/api';
const WS_BASE_URL = 'ws://localhost:8787/ws/uploads';

async function request(path, options = {}) {
	const response = await fetch(`${API_BASE_URL}${path}`, {
		headers: {
			'Content-Type': 'application/json',
			...(options.headers || {}),
		},
		...options,
	});

	if (!response.ok) {
		const payload = await response.json().catch(() => ({ error: 'Unknown API error' }));
		throw new Error(payload.error || 'API request failed');
	}

	return response.json();
}

export const settingsApi = {
	getSettings() {
		return request('/settings');
	},
	updateSettings(payload) {
		return request('/settings', {
			method: 'PATCH',
			body: JSON.stringify(payload),
		});
	},
};

export const api = {
	listFiles(virtualPath = '/') {
		const query = new URLSearchParams({ path: virtualPath }).toString();
		return request(`/files?${query}`);
	},
	getFileDetails(fileId) {
		return request(`/files/${fileId}`);
	},
	createFolder(payload) {
		return request('/files/folders', {
			method: 'POST',
			body: JSON.stringify(payload),
		});
	},
	renameFile(fileId, payload) {
		return request(`/files/${fileId}/rename`, {
			method: 'PATCH',
			body: JSON.stringify(payload),
		});
	},
	deleteFile(fileId) {
		return request(`/files/${fileId}`, {
			method: 'DELETE',
		});
	},
	deleteFiles(fileIds) {
		return request('/files/bulk/delete', {
			method: 'POST',
			body: JSON.stringify({ ids: fileIds }),
		});
	},
	getGoogleIntegrationStatus() {
		return request('/accounts/google/status');
	},
	getGoogleConnectUrl() {
		return request('/accounts/google/connect');
	},
	getOneDriveIntegrationStatus() {
		return request('/accounts/onedrive/status');
	},
	getOneDriveConnectUrl() {
		return request('/accounts/onedrive/connect');
	},
	getDropboxIntegrationStatus() {
		return request('/accounts/dropbox/status');
	},
	getDropboxConnectUrl() {
		return request('/accounts/dropbox/connect');
	},
	getMegaIntegrationStatus() {
		return request('/accounts/mega/status');
	},
	connectMegaAccount(payload) {
		return request('/accounts/mega/connect', {
			method: 'POST',
			body: JSON.stringify(payload),
		});
	},
	listAccounts() {
		return request('/accounts');
	},
	disconnectAccount(accountId) {
		return request(`/accounts/${accountId}`, {
			method: 'DELETE',
		});
	},
	getHealth() {
		return request('/health');
	},
	runSync() {
		return request('/sync/run', {
			method: 'POST',
		});
	},
	initiateUpload(payload, options = {}) {
		return request('/uploads/initiate', {
			method: 'POST',
			body: JSON.stringify(payload),
			signal: options.signal,
		});
	},
	async uploadFile(uploadId, file, options = {}) {
		const formData = new FormData();
		formData.append('file', file);

		const response = await fetch(`${API_BASE_URL}/uploads/${uploadId}/stream`, {
			method: 'POST',
			body: formData,
			signal: options.signal,
		});

		if (!response.ok) {
			const payload = await response.json().catch(() => ({ error: 'Upload failed' }));
			throw new Error(payload.error || 'Upload failed');
		}

		return response.json();
	},
	createUploadSocket(uploadId) {
		return new WebSocket(`${WS_BASE_URL}?uploadId=${encodeURIComponent(uploadId)}`);
	},
	downloadUrl(fileId) {
		return `${API_BASE_URL}/files/${fileId}/download`;
	},
	previewUrl(fileId) {
		return `${API_BASE_URL}/files/${fileId}/preview`;
	},
	getSettings() {
		return settingsApi.getSettings();
	},
	updateSettings(payload) {
		return settingsApi.updateSettings(payload);
	},
};
