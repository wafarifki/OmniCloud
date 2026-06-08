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
	initiateUpload(payload) {
		return request('/uploads/initiate', {
			method: 'POST',
			body: JSON.stringify(payload),
		});
	},
	async uploadFile(uploadId, file) {
		const formData = new FormData();
		formData.append('file', file);

		const response = await fetch(`${API_BASE_URL}/uploads/${uploadId}/stream`, {
			method: 'POST',
			body: formData,
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
};
