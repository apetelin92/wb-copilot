# WB Financial Co-Pilot

MVP for daily WB SKU profitability, AI explanations, daily brief generation, cash-gap projection, sync run logging, and a Russian-language action-first UI.

## Scope

- WB only
- profitability by SKU
- AI explanations and daily brief
- cash-gap risk projection
- dashboard and SKU APIs

## Stack

- Next.js App Router
- TypeScript
- Prisma with PostgreSQL
- OpenAI for optional AI insight generation

## Main screens

- `/auth` — вход в рабочее пространство
- `/onboarding` — подключение WB, первая синхронизация, стартовые финансовые входные данные
- `/dashboard` — экран "Сегодня" с дневным итогом, проблемными SKU и приоритетами
- `/calculator` — калькулятор юнит-экономики SKU с live-пересчётом, подсказками и what-if сценариями
- `/brief` — print-friendly short brief for PDF/export after demos and calls
- `/skus` — основной рабочий список SKU, требующих решений
- `/skus/:skuId` — страница решения по SKU с переходом в калькулятор сценариев
- `/cash-gap` — прогноз кассового разрыва с акцентом на минимальный остаток и дату риска
- `/insights` — лента AI-объяснений и брифов
- `/settings` — подключение WB, сессия и журнал синхронизаций

## Pilot flow

- Today → SKU → Cash → Calculator → Brief
- client-facing navigation is intentionally reduced to this MVP path
- demo and service controls are moved away from the main daily workflow

## Accounts and workspace isolation

- `demo@local.test` — отдельный demo workspace с готовыми демо-данными
- `owner@local.test` — отдельный live workspace для реального подключения WB
- demo и live теперь полностью изолированы по подключениям, синхронизациям, SKU, выплатам и финансовым входным данным
- demo workspace можно безопасно пересоздавать для показов и тестов интерфейса

## Demo-ready features

- demo workspace includes switchable scenarios: growth, decline, and cash-risk
- dashboard now answers three questions first: are we making money, where is the problem, and what to do today
- SKU list defaults to items that require attention and highlights the reason plus the next action
- workspace access is now invite-only for real users, with base roles `admin` and `analyst`
- app shell shows sync freshness and incomplete-economics trust signals across working screens
- dashboard and SKU pages show profit explainers with formula breakdowns
- `GET /api/exports/skus` exports current SKU economics as CSV
- `/brief` provides a print-friendly page suitable for browser PDF export
- `/calculator` provides a standalone unit economics decision tool for one SKU

## Formula verification

- Run `npm run test:unit-economics` to verify profitable, low-margin, and loss-making scenarios
- The test suite also checks break-even price and max ad spend logic

## Setup

1. Copy `.env.example` values into your local environment.
2. Install dependencies with `npm install`.
3. Generate the Prisma client with `npm run prisma:generate`.
4. Apply schema updates with `npx prisma db push`.
4. Run the app with `npm run dev`.

## Access model

- existing users can sign in by email
- new real users must be added by an admin through `Settings` invites
- demo access can be disabled in production with `AUTH_ALLOW_DEMO_LOGIN=false`
- bootstrap admin emails are controlled by `AUTH_BOOTSTRAP_ADMIN_EMAILS`

## Real WB connection

- demo workspace всегда использует mock adapter и не требует реального токена
- live workspace предназначен для реального кабинета WB
- The app can call official WB APIs directly for:
  - product cards via `content-api.wildberries.ru`
  - sales and report details via `statistics-api.wildberries.ru`
- The token should include access to both content and statistics APIs.
- `WB_API_BASE_URL` is optional and is used only if you want to proxy WB through your own adapter service.

## Main API routes

- `GET /api/health`
- `POST /api/jobs/daily-sync`
- `GET /api/wb/connection`
- `POST /api/wb/connection`
- `POST /api/sync/run`
- `GET /api/sync/runs`
- `GET /api/dashboard`
- `GET /api/skus`
- `GET /api/skus/:skuId`
- `POST /api/skus/:skuId/cost-profile`
- `GET /api/cash-gap`
- `POST /api/cash-gap/inputs`

## Notes

- WB integration is isolated behind an adapter. demo workspace always uses a deterministic mock adapter.
- live workspace uses official WB APIs directly, or `WB_API_BASE_URL` if you want to proxy WB through your own adapter service.
- `POST /api/jobs/daily-sync` is intended for cron-based scheduled sync and is protected by `WB_DAILY_SYNC_SECRET`.
- operational errors and sync failures can be forwarded to `ERROR_TRACKING_WEBHOOK_URL` without adding an SDK dependency.
- Raw ingestion is stored separately from normalized financial records and daily metrics.
- AI insight generation falls back to deterministic summaries when `OPENAI_API_KEY` is not configured.
- UI is Russian-language and built around direct daily actions for non-technical business users.

## Production

- use the included `Dockerfile` for container deployment
- configure backups for PostgreSQL before rollout
- see `docs/production-runbook.md` for deploy, cron, backups, and error-tracking setup
