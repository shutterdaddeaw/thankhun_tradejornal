# THANKHUN Trade Jornal Project Summary

THANKHUN Trade Jornal is a free web platform for MetaTrader 5 traders to track, analyze, and share trading performance across brokers using read-only access, with a product direction similar to Myfxbook but built independently for personal use first and extensible to broader users later.

## 1. Product Goal

Jornaltrade is intended to help MT5 traders and master traders do the following:

- Connect multiple MT5 accounts.
- Track historical trades.
- View daily profit/loss in a calendar format.
- See a dashboard summary of trading performance.
- Publish a public profit-sharing page through a link.
- Add AI-generated summaries of performance and trading behavior.

The current direction excludes IB overview for now.

## 2. Product Positioning

The desired positioning is:

- Similar user experience to Myfxbook.
- Free to use.
- Built independently, not dependent on Myfxbook itself.
- Works across brokers.
- Supports multiple MT5 accounts.
- Private login-protected web app.
- Public share page for selected account performance.

## 3. Important Constraints

The project constraints clarified during discussion are:

- This is **not VPS-first**.
- The user runs MT5 on a Windows notebook that stays on 24 hours.
- Another notebook is used to manage/monitor the setup.
- The user already runs many EAs, around 9 EAs currently.
- The solution must avoid adding too much overhead to the trading machine.

Because of this, the MT5 integration design should be lightweight and notebook-friendly.

## 4. Key Architecture Decision

The initial Google Sheets + Apps Script approach was useful as an early prototype, but it is **not the recommended production core** for a true Myfxbook-style system.

The final recommended production architecture is:

- A central backend SaaS-style API.
- A proper database for normalized trade/account data.
- A web frontend for login, dashboard, and public share pages.
- Two MT5 integration paths:
  1. `account_sync`
  2. `publisher_ea`

This means Jornaltrade should be built as a proper backend web product, not as a Google Sheet-centric app.

## 5. MT5 Integration Strategy

### 5.1 Account Sync

The first path is `account_sync`, where the user provides:

- broker name
- server name
- account login
- investor password

This path is intended to mimic the convenience of Myfxbook-style onboarding.

However, account sync may be unreliable with some brokers or infrastructure conditions, so it must not be the only connector.

### 5.2 Publisher EA

The second path is `publisher_ea`, which is the fallback and stability path.

A lightweight MT5 Publisher EA should:

- run on a separate chart,
- not interfere with the trading EA,
- collect account snapshots,
- detect new deals incrementally,
- push data to Jornaltrade backend through HTTP/WebRequest.

Important MT5 limitation:

- Only one EA can run on one chart.
- Therefore, Publisher EA must be attached to a different chart from the trading EA.
- One Publisher EA can be enough to publish activity for the whole account.

## 6. Recommended Publisher EA Design

The publisher EA should be designed as **lightweight** because the user already runs many EAs on a notebook.

Recommended design principles:

- Use `OnTradeTransaction()` to detect new deals/events.
- Use `OnTimer()` to send snapshots and flush queued events.
- Avoid scanning full history repeatedly.
- Avoid doing heavy work in `OnTick()`.
- Use small JSON payloads.
- Use low-frequency snapshots such as every 60 seconds.
- Use small retry/backoff logic.
- Avoid noisy logging in production.

Recommended minimal runtime behavior:

- Snapshot every 60 seconds.
- Heartbeat every 60–120 seconds.
- Queue new deals incrementally.
- Flush queue on timer.
- Keep HTTP timeout low.

## 7. Core Backend Architecture

Recommended components:

- Frontend Web App
  - landing page
  - login/register
  - add account page
  - dashboard
  - public share page

- Backend API
  - authentication
  - account CRUD
  - verification flow
  - dashboard data endpoints
  - AI summary endpoints
  - public page endpoints
  - EA ingest endpoints

- Sync Control Plane
  - verify jobs
  - backfill jobs
  - incremental sync jobs
  - retry/fallback logic

- Canonical Trading Database
  - accounts
  - credentials
  - sync state
  - deals
  - positions
  - balance operations
  - daily equity snapshots
  - computed metrics
  - share links
  - connection events

- Analytics Layer
  - equity curve
  - daily calendar pnl
  - symbol analysis
  - performance metrics
  - drawdown and win/loss summaries
  - AI summary generation

## 8. Canonical Data Model

The following table groups were defined as part of the architecture:

### Main tables
- `users`
- `trading_accounts`
- `account_credentials`
- `account_sync_state`
- `sync_jobs`
- `deals`
- `positions_open`
- `balance_operations`
- `daily_equity_snapshots`
- `account_metrics_daily`
- `share_links`
- `connection_events`

### Purpose of these tables
- `users`: application users
- `trading_accounts`: linked MT5 accounts
- `account_credentials`: encrypted investor password or publisher token
- `account_sync_state`: cursor, status, and last sync result
- `sync_jobs`: queued verification/backfill/incremental jobs
- `deals`: normalized trade history
- `positions_open`: latest open positions snapshot
- `balance_operations`: deposits, withdrawals, balance adjustments
- `daily_equity_snapshots`: daily account state
- `account_metrics_daily`: daily computed metrics
- `share_links`: public performance links
- `connection_events`: connector logs/events

## 9. Account State Machine

The recommended account states are:

- `pending_verify`
- `active_account_sync`
- `degraded_account_sync`
- `fallback_required`
- `active_publisher_ea`
- `paused`
- `disabled`

Typical transitions:

1. User adds account.
2. System creates verify job.
3. If account sync works -> `active_account_sync`.
4. If repeated failures happen -> `degraded_account_sync`.
5. If failures continue -> `fallback_required`.
6. User switches to Publisher EA -> `active_publisher_ea`.

## 10. API Design Direction

The API structure recommended for implementation includes:

### Auth
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `POST /v1/auth/refresh`

### Accounts
- `POST /v1/accounts`
- `GET /v1/accounts`
- `GET /v1/accounts/{accountId}`
- `PATCH /v1/accounts/{accountId}`
- `DELETE /v1/accounts/{accountId}`

### Connectivity
- `POST /v1/accounts/{accountId}/verify`
- `POST /v1/accounts/{accountId}/sync`
- `GET /v1/accounts/{accountId}/sync-state`
- `POST /v1/accounts/{accountId}/switch-to-ea`

### Analytics
- `GET /v1/accounts/{accountId}/dashboard`
- `GET /v1/accounts/{accountId}/calendar`
- `GET /v1/accounts/{accountId}/equity-curve`
- `GET /v1/accounts/{accountId}/trades`
- `GET /v1/accounts/{accountId}/symbols`
- `GET /v1/accounts/{accountId}/ai-summary`

### Public pages
- `GET /p/{slug}`
- `GET /p/{slug}/equity-curve`
- `GET /p/{slug}/trades`

### Publisher ingest
- `POST /v1/ingest/mt5/publisher/bootstrap`
- `POST /v1/ingest/mt5/publisher/snapshot`
- `POST /v1/ingest/mt5/publisher/deals`
- `POST /v1/ingest/mt5/publisher/heartbeat`

## 11. Recommended Tech Stack

Suggested stack for Antigravity IDE to generate:

### Backend
- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- Redis
- Worker queue (Celery, RQ, Dramatiq, or equivalent)

### Frontend
- Next.js or React-based dashboard frontend
- Authentication-protected dashboard
- Public share page routes

### Infrastructure
- Docker / Docker Compose for dev
- Nginx or Caddy reverse proxy
- HTTPS
- backup strategy for PostgreSQL

### MT5 side
- MQL5 Publisher EA
- WebRequest-enabled integration
- lightweight event-driven sync

## 12. Files Already Created in Earlier Work

The project work already produced the following conceptual/starter assets during the discussion:

### A. Architecture markdown
A Markdown architecture file was created summarizing:
- Myfxbook-style architecture
- ERD
- PostgreSQL schema
- OpenAPI outline
- Publisher EA protocol

### B. Starter backend pack
A starter pack was created containing:
- `docs/SETUP_STEP_BY_STEP.md`
- `docs/ARCHITECTURE.md`
- `backend/` starter FastAPI project
- initial SQLAlchemy models
- Alembic setup
- Docker setup
- `mql5/JornaltradePublisherEA_SPEC.md`

These files were intended as a starting point, not as the full production system.

## 13. What Has Been Successfully Implemented

All major items have been implemented and hardened for local deployment on the user's Windows notebook environment:

### Backend (FastAPI + SQLite + SQLAlchemy)
- **Complete Database Schema:** Fully normalized database structure in SQLite including `users`, `trading_accounts`, `account_credentials`, `deals`, `positions_open`, `balance_operations`, `daily_equity_snapshots`, and `share_links`.
- **Authentication & Security:** Custom token-based user authentication (login/register) with secure Fernet symmetric credential encryption for stored Publisher Tokens and API keys.
- **Account Management:** Full CRUD capabilities for trading accounts (Add, Edit, Delete) accessible via the frontend dashboard settings.
- **Incremental Sync Pipeline:** Lightweight ingest endpoints for MQL5 Publisher EA to push bootstrapped history, periodic heartbeats, live active position snapshots, and incremental deals.
- **Advanced Drawdown Logic:** A custom Peak-to-Trough drawdown calculation engine that dynamically tracks and neutralizes deposits and withdrawals (via cumulative adjustment offsets), ensuring transaction events do not artificially inflate trading drawdown percentages.
- **Multi-Provider AI Analytics Engine:** Flexible AI summary generator that reads trading performance statistics (win rate, profit factor, average hold times, drawdown, recent deals) and sends them to a user-configured AI provider (**Google Gemini, Openrouter, Nvidia, or OpenAI**) with user-customizable models (e.g. `gemini-2.5-flash`), custom base URLs, and custom API keys configured directly on the page.

### MT5 Integration (MQL5)
- **JornaltradePublisherEA:** Fully functional, lightweight event-driven Expert Advisor in MQL5 that connects to the FastAPI backend over `WebRequest`, performs historical backfills on launch, uploads live open positions periodically, and forwards new closed deals incrementally.

### Frontend Dashboard UI (Vite + React)
- **Polished Professional Dashboard:** Slick glassmorphic dark-mode interface built with Vanilla CSS.
- **Comprehensive Analytics Cards:** Real-time displays for Net Profit, Balance, Equity, Win Rate, Profit Factor, and Max Drawdown.
- **Dynamic Growth Curve:** Recharts area chart showing Balance and Equity. Includes green/red markers (**📥 / 📤**) at exact dates where deposit/withdrawal transactions occurred, with detailed hover tooltips.
- **Interactive Daily P&L Calendar:** Calendar grid showcasing daily net profit/loss, matching the selected date filters.
- **Color-Coded Recent Closed Deals Table:** Detailed table of closed transactions with dynamic Magic Number filtering, and color-coded Profit values (green for profit, red for loss).
- **Public Share Links:** Instant generation of public links with individual privacy settings (toggle balance, magic number, or comment visibility).

---

## 14. Important Product Decisions Already Made

These decisions were successfully preserved and implemented in the system:
- Free local deployment on a 24/7 Windows notebook.
- Multiple MT5 accounts supported simultaneously.
- Fallback through a lightweight Publisher EA that runs on an independent chart.
- Industry-standard calculation models (such as treating any closed trade with Net Profit >= 0 as a winning/TP trade).

---

## 15. Technical Stack Scopes

### Backend API
- FastAPI (Python 3.11+)
- SQLAlchemy ORM
- SQLite Database (local file `jornaltrade.db` for simplicity and lightweight execution)
- Requests (API calls with a robust 120-second timeout limit to support heavy reasoning/preview LLM generation)

### Frontend
- React 18
- Vite Build Engine
- Recharts (responsive vector charts)
- Lucide React (vector icons)

---

## 16. Final Summary

THANKHUN Trade Jornal has successfully evolved from a Google Sheets conceptual idea into a fully-functional, robust, and lightweight local portfolio analytics platform. The final system achieves:
1. Fast, local trade synchronizations via a lightweight MT5 Publisher EA.
2. Dynamic, transaction-aware drawdown calculations and growth curve markers (📥/📤).
3. Highly customizable and secure LLM-driven behavioral psychology analysis for trades.
4. Sleek public performance sharing with responsive, privacy-sensitive layouts.

All components are fully verified, building cleanly, and running stably on Windows notebook hosts.
