import { Readable, Transform } from 'stream';
import { randomUUID } from 'crypto';

export class BaseCloudAdapter {
	constructor(account) {
		this.account = account;
	}

	getCapabilities() {
		return {
			starred: false,
		};
	}

	async fetchStructure() {
		return [];
	}

	async getStorageSummary() {
		return {
			totalSpace: Number(this.account.total_space || 0),
			usedSpace: Number(this.account.used_space || 0),
		};
	}

	createProgressStream(onProgress) {
		let bytes = 0;

		return new Transform({
			transform(chunk, _encoding, callback) {
				bytes += chunk.length;
				onProgress(bytes);
				callback(null, chunk);
			},
		});
	}

	async uploadStream({ stream, size, fileName, mimeType, virtualPath, remoteParentId, onProgress }) {
		const progressStream = this.createProgressStream(onProgress);
		const passthrough = stream.pipe(progressStream);

		await new Promise((resolve, reject) => {
			passthrough.on('error', reject);
			passthrough.on('end', resolve);
			passthrough.resume();
		});

		return {
			remoteFileId: `${this.account.provider}-${randomUUID()}`,
			remoteParentId: remoteParentId || `${this.account.provider}-${virtualPath}`,
			size,
			fileName,
			mimeType,
		};
	}

	async createFolder({ name, virtualPath, remoteParentId }) {
		return {
			remoteFileId: `${this.account.provider}-${randomUUID()}`,
			remoteParentId: remoteParentId || `${this.account.provider}-${virtualPath}`,
			fileName: name,
		};
	}

	async getDownloadStream(fileRecord) {
		const content = `Simulated download for ${fileRecord.file_name} from ${this.account.provider}`;
		return Readable.from([content]);
	}

	async renameFile() {
		throw new Error(`Rename is not supported for provider ${this.account.provider}`);
	}

	async deleteFile() {
		throw new Error(`Delete is not supported for provider ${this.account.provider}`);
	}

	async getFileDetails(fileRecord) {
		return {
			name: fileRecord.file_name,
			mime_type: fileRecord.mime_type,
			size: fileRecord.size,
			virtual_path: fileRecord.virtual_path,
			remote_file_id: fileRecord.remote_file_id,
			provider: this.account.provider,
			owner_email: this.account.email,
			createdTime: fileRecord.remote_created_time,
			modifiedTime: fileRecord.remote_modified_time,
		};
	}

	async getDeltaChanges() {
		return [];
	}

	async setFileStarred() {
		throw new Error(`Starred state is not supported for provider ${this.account.provider}`);
	}
}
