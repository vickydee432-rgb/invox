# Invox (API + Next.js App)

A practical starter backend + frontend for:
- Quotes (public link) -> Accept = auto-create Invoice
- Invoices
- Expenses (with optional receipt URLs)
- Projects (for grouping + profitability)
- Authenticated workspace UI

## Tech
- Node.js + Express
- MongoDB + Mongoose
- Next.js (App Router)

## Quick start
### Backend
1) Install dependencies
```bash
cd backend
npm install
```

2) Create `.env` from `.env.example`
```bash
cp .env.example .env
```

3) Run
```bash
npm run dev
```

Server: `http://localhost:5000`

### Frontend
1) Install dependencies
```bash
cd frontend
npm install
```

2) Create `.env` from `.env.example`
```bash
cp .env.example .env
```

3) Run
```bash
npm run dev
```

App: `http://localhost:3000`
Public quote links: `http://localhost:3000/quote/:token`

Tip: set `NEXT_PUBLIC_API_URL` in `frontend/.env` if the API is not on `http://localhost:5000`.

## Key endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET  /api/auth/me`
- `GET  /api/company/me`
- `PUT  /api/company/me`

Note: registration requires a `company` object with at least `name`.

### Quotes
- `GET  /api/quotes` list (filters + `limit` + `page`)
- `GET  /api/quotes/:id` get one
- `POST /api/quotes` create quote (draft)
- `PUT  /api/quotes/:id` update (draft/sent)
- `POST /api/quotes/:id/send` mark sent + returns publicUrl (token link)
- `GET  /api/quotes/:id/pdf` download PDF
- `GET  /api/quotes/export.xlsx` export Excel
- `GET  /api/quotes/public/:token` public view
- `POST /api/quotes/public/:token/accept` accept -> auto invoice
- `POST /api/quotes/public/:token/decline`

### Invoices
- `GET /api/invoices` list (filters + `limit` + `page`)
- `GET /api/invoices/:id` get one
- `PUT /api/invoices/:id` update
- `POST /api/invoices/:id/payment` update payment
- `GET /api/invoices/:id/pdf` download PDF
- `GET /api/invoices/export.xlsx` export Excel

### Projects
- `POST /api/projects` create
- `PUT /api/projects/:id` update
- `GET /api/projects` list
- `GET /api/projects/:id/summary` income vs expenses

### Expenses
- `POST /api/expenses` create
- `POST /api/expenses/bulk` import from pasted text
- `PUT /api/expenses/:id` update
- `GET /api/expenses` list (filters + `limit` + `page`)

Bulk paste format (one per line):
- `Title | Amount | Category | Date` (recommended)
- `Title Amount Category Date`

### Inventory & Products
- `GET  /api/products?search=` search by name, sku, barcode
- `GET  /api/products/lookup?barcode=` lookup by barcode
- `POST /api/products` create product (supports `barcode`)
- `PUT  /api/products/:id` update product (supports `barcode`)
- `PATCH /api/products/:id` update product (supports `barcode`)
- `POST /api/inventory/adjust` adjust stock + logs

### Reports
- `GET /api/reports/overview?from&to` summary + monthly series
- `GET /api/reports/export.xlsx?from&to` export Excel
- `GET /api/reports/export.pdf?from&to` export PDF

## Notes
- Invoice/Quote numbers use a simple "latest + 1" approach (fine for MVP).
  For high concurrency, switch to a `counters` collection.
- Set `AUTH_JWT_SECRET` and `PUBLIC_QUOTE_TOKEN_SECRET` to long random values.
- `PUBLIC_APP_URL` is used to generate shareable quote links.

## Barcode scanning tips
- USB/Bluetooth scanners usually act like a keyboard. Click the “Scan barcode” input, scan, and the scanner will send an Enter key.
- The Inventory Scanner page (`/inventory/scan`) also supports camera scanning. Grant camera permission when prompted.
- If a barcode is not found, use the “Create product” action to prefill the barcode in the product form.
