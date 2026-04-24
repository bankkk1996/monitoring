# Monitor Web — Domain & SSL Expiration Monitoring

Monolithic full-stack app for monitoring domain and SSL certificate expirations.

- **Backend:** Node.js + Express + SQLite (better-sqlite3), `node-cron`, `whois-json`, native `tls`
- **Frontend:** React (Vite) + Tailwind CSS + Chart.js + native `fetch`
- **Notifications:** LINE Notify (required), email via `nodemailer` (optional)

## Features

- Domain CRUD with categories and notes
- Per-user alert rules (SSL / domain, days-before, repeat-daily)
- Cron-based monitoring every 6 hours (configurable)
- Dashboard with summary cards, pie chart, and sortable/filterable table
- Search, filter, sort, and CSV import for domains
- Dark mode
- Auto-refresh every 60 seconds

## Project structure

```
/backend
  app.js
  /config
  /routes
  /services
  /cron
/frontend
  /src
    /components
    /pages
    /services/api.js
    App.jsx
    main.jsx
```

## Run locally (development)

### Backend

```
cd backend
cp .env.example .env     # optionally tweak SMTP/cron
npm install
npm run dev              # starts http://localhost:4000
```

### Frontend

```
cd frontend
npm install
npm run dev              # starts http://localhost:5173 (proxies /api to :4000)
```

Open http://localhost:5173

## Run with Docker

```
docker compose up --build
```

- Frontend: http://localhost:8080
- Backend:  http://localhost:4000/api/health

SQLite data is persisted at `./backend/data/monitor.db`.

## Environment (backend/.env)

| Variable        | Default                | Notes                              |
|-----------------|------------------------|------------------------------------|
| PORT            | 4000                   | HTTP port                          |
| DB_PATH         | ./data/monitor.db      | SQLite file path                   |
| MONITOR_CRON    | `0 */12 * * *`         | Every 12 hours                     |
| RUN_ON_STARTUP  | true                   | Run a check immediately on boot    |
| SMTP_HOST/etc.  | (empty)                | Enables email alerts if all set    |
| LINE_NOTIFY_URL | notify-api.line.me/... | Override for compatible endpoints  |

## API

- `GET /api/dashboard` — summary + expiring list
- `CRUD /api/domains` + `POST /api/domains/check/run`, `POST /api/domains/import`
- `CRUD /api/categories`
- `CRUD /api/users` + `POST /api/users/:id/test`
- `CRUD /api/alerts`
- `GET  /api/health`

## CSV import format

Columns can be in any order as long as a header row is present.
Supported columns: `domain` (required), `name`, `admin`, `category`, `note`.

The `admin` column is matched against existing users by **name** (case-insensitive),
falling back to **email**. If no match is found, the domain is imported without an
admin and the unmatched value is reported in the response (`unmatched_admins`).

```
domain,name,admin,category,note
example.com,Corporate Site,Somchai,Production,main marketing site
api.example.com,Public API,devops@example.com,Production,
internal.example.org,Staging portal,,Staging,
```

(Legacy headerless format `domain,category,note` is still accepted.)

## Notes

- No `axios`. All client HTTP goes through `src/services/api.js`, which wraps
  `fetch`, handles JSON, errors (via `response.ok`), and timeouts with
  `AbortController`.
- LINE Notify requires a personal access token per user.
- Domain WHOIS parsing is best-effort; some TLDs expose expiry under
  non-standard keys.
"# monitoring" 
