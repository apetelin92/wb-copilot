# Production Runbook

## Goal

This runbook covers the minimum operational setup for using MarginPoint with real daily work.

## Required environment

Use `.env.example` as the baseline.

Key production values:

- `DATABASE_URL` — managed PostgreSQL
- `APP_ENCRYPTION_KEY` — strong secret, rotate with care
- `APP_BASE_URL` — public app URL
- `AUTH_ALLOW_DEMO_LOGIN=false` — disable demo login in production unless demos are required
- `AUTH_BOOTSTRAP_ADMIN_EMAILS` — comma-separated bootstrap admin emails
- `SYNC_STALE_AFTER_HOURS=24` — max allowed sync age before UI warns that data is stale
- `WB_DAILY_SYNC_SECRET` — secret for scheduled sync endpoint
- `ERROR_TRACKING_WEBHOOK_URL` — optional webhook for operational errors and sync failures

## Deploy

The repository includes a production `Dockerfile`.

Basic flow:

1. build image
2. run app with production env vars
3. run Prisma schema sync before first start

Example:

```bash
npx prisma db push
docker build -t wb-copilot .
docker run --env-file .env.production -p 3000:3000 wb-copilot
```

## Scheduled sync

Set an external scheduler or platform cron to call:

`POST /api/jobs/daily-sync`

Auth options:

- `Authorization: Bearer <WB_DAILY_SYNC_SECRET>`
- or header `x-job-secret`
- or query `?secret=` for simple cron systems

Example:

```bash
curl -X POST \
  -H "Authorization: Bearer $WB_DAILY_SYNC_SECRET" \
  https://your-domain.com/api/jobs/daily-sync
```

Recommended cadence:

- daily early morning for base refresh
- optional midday rerun if decisions depend on same-day changes

## Backups

Use managed PostgreSQL backups if available.

Minimum fallback:

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F-%H%M).sql
```

Recommended policy:

- daily full backup
- keep 7 daily backups
- keep 4 weekly backups
- test restore at least once before production rollout

## Error tracking

The app can report operational errors and sync failures to `ERROR_TRACKING_WEBHOOK_URL`.

Suggested targets:

- Slack incoming webhook
- Make webhook
- your own incident collector endpoint

At minimum, watch for:

- repeated sync failures
- stale data beyond allowed threshold
- connection verification failures
- invite/auth failures during rollout

## Daily ops checklist

1. check `/api/health`
2. confirm latest successful sync is recent
3. confirm there is no unresolved sync failure
4. clear incomplete SKU economics queue
5. verify cash inputs are updated when obligations change
