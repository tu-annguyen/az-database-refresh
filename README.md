# AZ Database Refresh

Lightweight review app for library database descriptions.

## Architecture

- `apps/web`: React + Vite + Bootstrap frontend for reviewers, admins, import, aggregation, final decisions, and browser-side XLSX/CSV export.
- `workers/api`: Cloudflare Worker API backed by Cloudflare D1.
- `packages/shared`: shared schemas, constants, CSV/XLSX helpers, and sanitization helpers.

## Local Setup

```sh
npm install
cp apps/web/.env.example apps/web/.env.local
cp workers/api/.dev.vars.example workers/api/.dev.vars
npm run dev:api
npm run dev:web
```

The web app defaults to `http://localhost:8787` for the API.

## Deployment

- Frontend: Vercel Hobby. Set `VITE_API_BASE_URL` to the deployed Worker URL.
- API: Cloudflare Worker with D1. Set `ADMIN_TOKEN` and `ALLOWED_ORIGINS`.
- Database: run the D1 migration in `workers/api/migrations`.

## Verification

```sh
npm test
npm run typecheck
npm run build
```
