# QuizPortal_Auto_Certificate_Generation

## PostgreSQL VPS Setup

The app stores quizzes, submissions, certificate templates, and admin configuration in PostgreSQL. Browser storage is used only for short-lived login session data.

### Environment variables

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/certificate
PORT=3001
ADMIN_USER=admin
ADMIN_PASS=change-this-basic-auth-password
DB_SSL=false
REDIS_URL=redis://127.0.0.1:6379
```

Use `DB_SSL=true` only when your PostgreSQL provider requires SSL.

## Certificate generation (BullMQ + Redis queue)

Certificate PDFs are generated in **background worker processes** so hundreds of students can complete a quiz simultaneously without blocking the API.

### How it works

1. `POST /api/generate-certificate` returns **HTTP 202** `{ success, jobId, status: 'queued' }` immediately.
2. A BullMQ job is pushed to Redis; the **worker processes** pick it up.
3. The worker replaces `{{name}}`, `{{quiz_title}}`, `{{score}}`, `{{total}}`, `{{percent}}`, `{{date}}`, `{{email}}`, `{{org}}` in the PPTX template (unchanged), converts to PDF via headless LibreOffice, and writes a first-slide PNG preview.
4. The client polls `GET /api/certificate-status/:jobId` (`queued` / `processing` / `done` / `failed`).
5. When done, the PDF is **streamed** via `GET /api/download-certificate/:jobId` and the preview PNG via `GET /api/certificate-preview/:jobId`. No base64 is ever sent; no PDF is permanently stored — files are deleted after download or after `STORAGE_TTL_MS` (default 1 hour) via the worker's TTL sweep.

### Install & run on the VPS

```bash
# 1. Redis (BullMQ broker)
apt install redis-server
systemctl enable redis-server && systemctl start redis-server

# 2. Node dependencies + build
npm install
npm run build

# 3. Environment
cp .env.example .env   # set DATABASE_URL, REDIS_URL, ADMIN_PASS, WORKER_CONCURRENCY=3

# 4. LibreOffice (soffice) must be installed for PDF conversion
apt install libreoffice --no-install-recommends

# 5. Run API + workers under PM2
pm2 start ecosystem.config.cjs
pm2 save
```

On startup, the server and workers create the required PostgreSQL tables automatically, including the new `certificate_jobs` status table.

### Capacity notes

- `ecosystem.config.cjs` runs the API as a cluster (`instances: max` → 2 on the VPS) and **2 worker processes**.
- Each worker runs up to `WORKER_CONCURRENCY` (default **3**) jobs at once → max ~6 concurrent LibreOffice conversions. BullMQ applies **backpressure**: jobs wait in Redis until a concurrency slot frees.
- Jobs are retried up to `JOB_MAX_ATTEMPTS` (default **3**) with exponential backoff, then marked `failed`.
- `STORAGE_DIR` must be writable by both API and worker processes (shared disk).

### Database GUI

Open `/admin-ui` on your deployed server. It is protected by `ADMIN_USER` and `ADMIN_PASS`, and destructive database actions also ask for the app admin password.
