# OmniCloud

OmniCloud is a cloud-drive aggregation app that provides a Google Drive-inspired interface on top of multiple storage providers. It currently focuses on a real Google Drive integration, while the architecture is prepared for additional providers such as OneDrive and S3-compatible storage.

This repository is based on the system blueprint in `blueprint.md` and is implemented as a small monorepo with a Vue frontend and a Node.js backend.

## Highlights

- Real Google Drive account connection via OAuth
- Unified file browser with virtual paths
- Google Drive-like `Home` and `My Drive` experience
- Folder creation, rename, delete, file details, and download
- File upload with drag-and-drop, file upload, and folder upload
- Upload progress over WebSocket
- Local metadata mirror in SQLite
- Scheduled synchronization to keep mirrored data aligned with provider state
- Dark mode support
- Tailwind CSS v4 UI with `@tabler/icons-vue`

## Current provider status

| Provider | Status |
| --- | --- |
| Google Drive | Implemented and actively used |
| OneDrive | Adapter placeholder / partial groundwork |
| S3-compatible | Basic adapter groundwork |
| Dropbox / MEGA | Not implemented yet |

## Monorepo structure

```text
OmniCloud/
├─ apps/
│  └─ web/           # Vue 3 frontend
├─ services/
│  └─ api/           # Express API, sync, adapters, SQLite
├─ blueprint.md      # Original architecture blueprint
├─ package.json      # Root workspace scripts
└─ README.md
```

## Tech stack

### Frontend
- Vue 3
- Vite
- Pinia
- Vue Router
- Tailwind CSS v4
- `@tabler/icons-vue`

### Backend
- Node.js
- Express
- WebSocket (`ws`)
- SQLite via `better-sqlite3`
- Google Drive API via `googleapis`
- `node-cron` for background sync

## How it works

OmniCloud uses a passthrough-style backend:

- the frontend requests file operations through the API,
- the backend talks to the cloud provider,
- file and folder metadata are mirrored into SQLite,
- uploads stream through the backend and report progress over WebSocket,
- sync jobs refresh the local mirror so the UI reflects the latest remote state.

The goal is to let users browse a unified virtual file tree while still working with real provider data.

## Features

### Account connection
- Connect a real Google Drive account
- Persist linked cloud account metadata locally
- Track quota usage per account

### File management
- Browse files by virtual path
- Open `Home` and `My Drive` views
- Create folders
- Rename files and folders
- Delete files and folders
- View file details
- Download files from the provider

### Uploads
- Upload files from the browser
- Upload folders
- Drag and drop files or folders into `My Drive`
- Show live progress via WebSocket

### UI/UX
- Google Drive-inspired layout
- Light and dark theme
- Context menu actions in `My Drive`
- Plus Jakarta Sans typography

## Requirements

Before running the project, make sure you have:

- Node.js 20+ recommended
- npm
- A Google Cloud OAuth client configuration file named `credentials.json`

## Setup

### 1. Install dependencies

From the repository root:

- `npm install`

If dependencies are already installed, you can skip this step.

### 2. Configure the API environment

Copy:

- `services/api/.env.example` → `services/api/.env`

Example environment values:

```env
PORT=8787
CORS_ORIGIN=http://localhost:5173
SYNC_INTERVAL_MINUTES=5
OMNICLOUD_SECRET_HALF=replace-this-with-random-half-key
GOOGLE_CREDENTIALS_PATH=./credentials.json
GOOGLE_REDIRECT_URI=http://localhost:8787/api/accounts/google/callback
```

### 3. Add Google credentials

Place your Google OAuth client file here:

- `services/api/credentials.json`

Important notes:

- the app expects a Google OAuth client config file from Google Cloud,
- the redirect URI in Google Cloud should match `GOOGLE_REDIRECT_URI`,
- `credentials.json` should never be committed to source control.

## Running the project

### Development

Run frontend and backend together from the root:

- `npm run dev`

Default local URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8787`

### Frontend only build

- `npm run build`

### Backend only

- `npm start`

## Root scripts

Available commands in the root `package.json`:

- `npm run dev` — run API and web app in parallel
- `npm run build` — build the frontend
- `npm run dev:web` — run only the Vue app
- `npm run dev:api` — run only the API server
- `npm start` — start the backend server

## Main API endpoints

### Health
- `GET /api/health`

### Accounts
- `GET /api/accounts`
- Google account connect/callback routes are available under `/api/accounts/...`

### Files
- `GET /api/files?path=/`
- `GET /api/files/:id`
- `GET /api/files/:id/download`
- `PATCH /api/files/:id/rename`
- `DELETE /api/files/:id`
- `POST /api/files/folders`

### Uploads
- `POST /api/uploads/initiate`
- `POST /api/uploads/:uploadId/stream`
- `WS /ws/uploads?uploadId=...`

## Project notes

- The local database is stored in `services/api/omnicloud.db`.
- Cloud metadata is mirrored locally and refreshed after relevant operations.
- The current implementation is centered on Google Drive.
- Multi-provider pooling is not fully completed yet.
- Move operations and broader provider parity are still future work.

## Security notes

- Do not commit `.env`, `credentials.json`, or local database files.
- Google OAuth credentials and tokens are sensitive.
- Review your Google Cloud OAuth consent configuration before using this project with real accounts.

## Roadmap

- Complete OneDrive real integration
- Add more providers such as Dropbox and MEGA
- Improve unified storage pooling logic
- Add move operations across the virtual file tree
- Harden multi-account production readiness

## Related files

- `blueprint.md` — original architecture and system design
- `apps/web/README.md` — frontend template/readme source
- `services/api/README.md` — backend-specific short readme

## License

No explicit license has been defined yet in this repository.
