# TaskFlow - Product Requirements Document

## Original Problem Statement
Build a full-stack SaaS — TaskFlow — operating system for a video editing agency.
Three roles (Admin, Editor, Client) with strict RBAC, anonymous anime-style editor names,
gamification (XP/levels/badges), payment tracking, approval workflow, real-time chat, MVP rewards.

## Tech Stack
- Backend: FastAPI + MongoDB (motor) + JWT (pyjwt) + bcrypt + WebSocket + asyncio scheduler
- Frontend: React + Tailwind + shadcn/ui + Phosphor Icons + Recharts + MediaRecorder
- Auth: JWT via Authorization Bearer header (localStorage)
- Realtime: WebSocket with polling fallback
- Background: asyncio scheduler tick every 60s for auto-assign / auto-approve / payment-reset

## Personas
- **Admin** — Approves projects + videos, dispatches briefs, monitors risk/workload/burnout/payments, reviews analytics
- **Editor** — Anonymous creator with XP/level/badges/burnout meter; requests briefs (12h), submits drafts, gets paid per project
- **Client** — Creates projects (admin approves), previews drafts, requests revisions, approves & reviews

## Implemented

### v1 (2026-02-22) MVP
- JWT auth, anonymous anime names, role-based dashboards, kanban, briefs, performance metrics, basic chat

### v1.1 (2026-02-22) — Polish & Analytics
- Recharts charts, /showcase public page, WebSocket real-time chat, drag-drop kanban, deadline risk, workload meter, satisfaction, revision counter, client panel tabs

### v2.0 (2026-05-01) — Full Workflow + Gamification + Payments
- **Public registration** at `/register` with access code `42202010` (creates editor)
- **Client → Admin → Editor approval workflow**:
  - Client creates project → `pending_admin_approval` → Admin approves → `available`
  - Editor requests within 12h OR auto-assigned to best-fit editor
  - Editor submits → `submitted` → Admin approves video within 6h OR auto-approved → `client_review`
  - Client previews → revise (notifies editor) OR approve → `completed` (awards XP)
- **XP system**: +10 per delivery, +5 on-time, −5 late
- **4 levels**: Rookie (1) · Pro Cutter (5) · Cinematic Beast (10) · Editing God (20) with progress bar
- **7 achievement badges**: First Delivery 🎯, 3 Tasks 1 Day ⚡, Zero Revisions Streak 🧠, Survived 5 Urgent 💀, Pro Cutter/Cinematic Beast/Editing God level badges
- **Top 5 Edited Videos** (Google Drive embed) on editor profile
- **Burnout meter**: Low / Medium / High based on active+revisions+urgent load
- **Editor payment tracking**: charge_per_project field, current month dashboard, mark paid, monthly reset on 5th day → payment history
- **Reactions** on chat messages (👍🔥💀😂😭) with toggle
- **Voice notes** in chat (MediaRecorder → base64, max ~30s/700KB)
- **Notifications**: bell + dropdown, 13+ event types (project pending, video pending, XP awarded, badge unlocked, level up, revision, MVP, etc.)
- **MVP of the Month** auto-computed from on-time + completed + XP + badges; card on admin + editor dashboards
- **Deadline progress bar** with green/yellow/red/overdue colors
- **Background scheduler** (60s tick): auto-assigns stale briefs after 12h, auto-approves stale videos after 6h, monthly payment reset on 5th day

## Test Results
- Iteration 1: Backend 27/27 pass
- Iteration 2: Backend 46/46 pass
- Iteration 3: Frontend 100% (after null-guard fix)
- Iteration 4: Backend 34/34 new pass + 3 issues (seed, mark-paid, alert)
- Iteration 5: **Backend 80/80 pass, Frontend 100%, zero issues**

## Backlog (P1)
- Voice note size > 700KB → use Emergent object storage
- Email notifications (currently in-app only)
- Password reset flow
- Real `response_rate` calc (currently 85% constant)
- Split server.py (~1530 lines) into routers
- Aggregate leaderboard via Mongo `$group`
- Redis pub/sub for WebSocket multi-pod scaling
- Drag handles on kanban cards (currently whole-card drag)

## Backlog (P2)
- Editor skill certifications
- Bulk task assignment
- Draft version history with diffing
- Export reports (PDF/CSV)
- Trend charts for client satisfaction
- 2FA for admin

## Files
- `/app/backend/server.py` — All endpoints + scheduler (~1530 lines)
- `/app/frontend/src/App.js` — Routes
- `/app/frontend/src/pages/*` — 16 pages
- `/app/frontend/src/components/*` — Sidebar, Layout, NotificationBell, DeadlineBar
- `/app/memory/test_credentials.md` — All demo credentials

## Deployment Readiness
- Frontend builds successfully (webpack compiled, no errors)
- Backend runs without errors (all logs clean)
- All env vars in `/app/backend/.env` and `/app/frontend/.env`; protected and read-only
- Auth + role-based routing working end-to-end
- Single `MONGO_URL` + `DB_NAME` from env; `/api` prefix on all routes
- Ready for deployment via Emergent / Vercel (frontend) + Render/Railway (backend) + MongoDB Atlas
