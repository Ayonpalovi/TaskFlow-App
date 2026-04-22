# TaskFlow - Product Requirements Document

## Original Problem Statement
Build a full-stack SaaS — TaskFlow — an operating system for a video editing agency.
Three roles (Admin, Editor, Client) with strict RBAC, anonymous anime-style editor names,
editor request/assignment with 12h windows, performance tracking, client revision/approve/review flow,
Discord-style chat, admin task builder with brief health score + editor recommendations, leaderboard.

## Tech Stack (Implemented)
- Backend: **FastAPI + MongoDB (motor)** + JWT (pyjwt) + bcrypt
- Frontend: **React + Tailwind + shadcn/ui + Phosphor Icons**
- Auth: httpOnly cookie + Bearer-token fallback (cross-origin safe)
- Realtime: polling every 3s for chat (simple, reliable)

## User Personas
- **Admin** — Agency owner/operator. Creates accounts, dispatches briefs, approves editor requests, reviews analytics.
- **Editor** — Anonymous creator. Sees open briefs, requests within 12h, ships drafts, tracks performance.
- **Client** — Brand/customer. Previews drafts, requests revisions, approves, reviews.

## Implemented — 2026-02-22 (v1 MVP)
- JWT auth with httpOnly cookie + Bearer fallback, admin-only account creation, auto-seeded admin + 3 editors + 2 clients
- Anonymous anime name generator for editors (stable per user)
- Admin: Dashboard (stats + pending requests), Kanban tasks, Task creation form with brief health score + editor recommendations, Team management, Calendar, Leaderboard, Chat (group + all DMs)
- Editor: Dashboard, Available briefs (limited info), Request brief (12h expiry), My Projects kanban, Submit drafts, Performance metrics, Leaderboard, Chat (group + admin DM)
- Client: Dashboard with ongoing + past works, Preview drafts, Request revision, Approve → review modal (5-star), DM admin only
- Performance engine: 30-day rolling metrics (on-time, acceptance, videos/week, revision rate, response rate, avg rating, overall score) with green/yellow/red tone
- Editor recommendation engine: ranks by skill match + performance + availability
- Brief health score: detects missing fields, gives suggestions
- Role-based permission enforcement (editor cannot DM client, client cannot access group, etc.)

## Backlog / Remaining (P1)
- Drag-drop kanban (currently view-only)
- File upload for footages/scripts (currently URL-based)
- Real WebSocket chat (currently 3s polling)
- Email notifications (account creation, revision request, approval)
- Real response_rate calculation (currently hardcoded 85%)
- Password reset flow
- Split server.py into routers (auth/users/tasks/chat/metrics) — ~790 lines currently
- Aggregate leaderboard queries (fix N+1)
- Revenue/profit charts (recharts already installed)

## Backlog (P2)
- Editor skill certifications
- Client satisfaction trend charts
- Bulk task assignment
- Draft version history with diffing
- Export reports (PDF/CSV)

## Test Results (Iteration 1)
- Backend: **27/27 pytest passed (100%)**
- Frontend smoke: admin login + routing + dashboard + kanban verified
- No critical or minor bugs reported

## Files
- `/app/backend/server.py` — All API endpoints
- `/app/frontend/src/App.js` — Routes
- `/app/frontend/src/pages/*` — Role pages
- `/app/memory/test_credentials.md` — Demo credentials
