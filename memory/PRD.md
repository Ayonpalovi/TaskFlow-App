# TaskFlow - Product Requirements Document

## Original Problem Statement
Build a full-stack SaaS — TaskFlow — operating system for a video editing agency.
Three roles (Admin, Editor, Client) with strict RBAC, anonymous anime-style editor names,
editor request/assignment with 12h windows, performance tracking, client revision/approve/review flow,
Discord-style chat, admin task builder with brief health score + editor recommendations, leaderboard.

## Tech Stack
- Backend: FastAPI + MongoDB (motor) + JWT (pyjwt) + bcrypt + WebSocket
- Frontend: React + Tailwind + shadcn/ui + Phosphor Icons + Recharts
- Auth: JWT via Authorization Bearer header (localStorage), httpOnly cookie supported
- Realtime: WebSocket with polling fallback

## User Personas
- **Admin** — Creates accounts, dispatches briefs, approves editor requests, monitors risk/workload, reviews analytics.
- **Editor** — Anonymous creator. Sees open briefs, requests within 12h, ships drafts, tracks performance.
- **Client** — Previews drafts, requests revisions, approves, reviews.

## Implemented

### v1 (2026-02-22) MVP
- JWT auth, admin-only account creation, auto-seeded admin + 3 editors + 2 clients
- Anonymous anime name generator for editors
- Admin: Dashboard, Kanban, Task creation with brief health score + recommendations, Team, Calendar, Leaderboard
- Editor: Dashboard, Available briefs (12h window), My Projects kanban, Drafts, Performance, Leaderboard, Chat
- Client: Dashboard, Preview/Revise/Approve + 5-star review modal, DM admin only
- Performance engine (30-day metrics with green/yellow/red), editor recommendation, brief health score
- Role-based permission enforcement

### v1.1 (2026-02-22) — Polish & Analytics
- **Recharts** line + pie charts on admin dashboard (30-day revenue/profit/task trend)
- **Public /showcase** — anonymized editor discovery surface (lead funnel)
- **WebSocket real-time chat** with polling fallback; `ws-status` badge
- **HTML5 drag-drop** kanban for admin tasks
- **New /client/panel** — 5-tab consolidated hub (Preview · Revise · Approve · Past · Reviews)
- **Revision counter** — top editors & clients by revision count
- **Deadline risk warning** — tasks within 48h highlighted red/amber, per-role scoping
- **Client satisfaction score** — avg rating per editor & per client
- **Editor workload meter** — progress bar with available/busy/overloaded states
- **CORS/auth fix** — dropped withCredentials, standardized on Bearer token to avoid Cloudflare CORS override
- **ChatPage null-guard** fix — prevents crash on initial render

## Test Results
- Iteration 1: Backend 27/27 pass (100%), frontend smoke pass
- Iteration 2: Backend 46/46 pass (100%), frontend 80% (1 HIGH bug: ChatPage null)
- Iteration 3: Frontend 100% after null-guard fix; WebSocket real-time verified admin↔editor within 2s

## Backlog (P1)
- File uploads for footages/scripts (Emergent object storage)
- Email notifications (account creation, revision, approval)
- Password reset flow
- Real response_rate calculation (currently 85% constant)
- Split server.py into routers (auth/users/tasks/chat/stats/ws)
- Aggregate leaderboard + trends via MongoDB $group (fix N+1)
- Redis pub/sub for WebSocket multi-pod scaling

## Backlog (P2)
- Client satisfaction trend charts
- Bulk task assignment
- Draft version history with diffing
- Export reports (PDF/CSV)
- Editor skill certifications

## Files
- `/app/backend/server.py` — All endpoints (~1020 lines)
- `/app/frontend/src/App.js` — Routes
- `/app/frontend/src/pages/*` — Role pages
- `/app/memory/test_credentials.md` — Demo credentials
- `/app/design_guidelines.json` — Design system
