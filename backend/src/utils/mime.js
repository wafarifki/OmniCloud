const EXTENSION_MIME_MAP = {
	png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
	webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon',
	heic: 'image/heic', heif: 'image/heif', tiff: 'image/tiff', tif: 'image/tiff',
	avif: 'image/avif',

	mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
	mkv: 'video/x-matroska', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv',
	flv: 'video/x-flv', '3gp': 'video/3gpp',

	mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg',
	oga: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac', opus: 'audio/opus',
	wma: 'audio/x-ms-wma',

	pdf: 'application/pdf',
	doc: 'application/msword', dot: 'application/msword',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	odt: 'application/vnd.oasis.opendocument.text',
	ods: 'application/vnd.oasis.opendocument.spreadsheet',
	odp: 'application/vnd.oasis.opendocument.presentation',
	rtf: 'application/rtf',

	txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', log: 'text/plain',
	json: 'application/json', xml: 'application/xml', yaml: 'application/x-yaml', yml: 'application/x-yaml',
	html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript',

	zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
	tar: 'application/x-tar', gz: 'application/gzip', bz2: 'application/x-bzip2', xz: 'application/x-xz',
	iso: 'application/x-iso9660-image',

	exe: 'application/x-msdownload', msi: 'application/x-msdownload',
	apk: 'application/vnd.android.package-archive', dmg: 'application/x-apple-diskimage',
	sql: 'application/sql', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
};

export function guessMimeType(fileName) {
	if (!fileName) return 'application/octet-stream';
	const extension = String(fileName).toLowerCase().split('.').pop();
	return EXTENSION_MIME_MAP[extension] || 'application/octet-stream';
}

export function resolveMimeType(record) {
	const provided = record?.mime_type;
	if (provided && provided !== 'application/octet-stream') {
		return provided;
	}
	return guessMimeType(record?.file_name);
}
