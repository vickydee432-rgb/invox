# Standalone Super Admin Dashboard

The Super Admin dashboard is a **standalone web application** (separate from the main `frontend`) used only for:

- Aggregated analytics across **all companies**
- Reporting, monitoring, and performance insights
- Mixed-currency visibility (clearly labeled + broken down by currency)

Operational modules (sales processing, inventory management, etc.) are **not** included.

## Access control

All `/api/admin/*` endpoints are **Super Admin only** (`role === "super_admin"`). Any other role should receive `403`.

## Local development

1) Start the API:

`cd backend && npm run dev`

2) Start the Super Admin app:

`cd superadmin && npm install && npm run dev`

3) Set the API URL in `superadmin`:

- `NEXT_PUBLIC_API_URL=http://localhost:5000`

## Production deployment (Railway)

Deploy `backend` and `superadmin` as **separate Railway services**.

### Required env vars (superadmin service)

- `NEXT_PUBLIC_API_URL` = your API base URL (example: `https://invox-production.up.railway.app`)

### Required env vars (backend service)

Your Super Admin app domain must be allowed by CORS:

- `CORS_ORIGIN` should include the Super Admin app origin, e.g.:
  - `https://your-superadmin-app-domain.com,https://your-main-frontend.com`

### Optional env vars (backend service)

- `SUPER_ADMIN_USAGE_WINDOW_DAYS` (default `30`)

## Linking from the main app (optional)

If you still want a link inside the main platform (without embedding the dashboard), set:

- `NEXT_PUBLIC_SUPERADMIN_APP_URL` in the main `frontend`

Then the `/super-admin` route will show a “moved” message with a link to the standalone app.

