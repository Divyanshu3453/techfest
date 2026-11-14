# Intelligent Campus & Civic Issue Resolution Platform

React (Vite) + Node/Express + PostgreSQL + Redis Streams + Socket.IO.

## Run
Backend (needs PostgreSQL and Redis running; create an empty database first):
    cd backend
    cp .env.example .env      # edit DATABASE_URL, JWT_SECRET, LLM_API_KEY
    npm install
    npm run setup             # creates tables, seeds locations, admin and staff
    npm run dev

Optional demo data (12 students, 13 tickets with images, upvotes, comments, workers):
    npm run demo              # or npm run demo:reset to recreate it
    (demo01 ... demo12 / demo123; drop your own photos in backend/demo-images/<key>.jpg to replace placeholders)

Frontend:
    cd frontend
    npm install
    npm run dev               # http://localhost:5173

## Logins
- Super admin: admin / admin123 (set in .env)
- Department heads: head-<department> / head123, e.g. head-electrical, head-plumbing-water, head-hostel-administration
- Students: register on the site
- Outside workers are NOT users; the head types their name, phone and expected date on each ticket.

If you already ran `npm run setup` on an older version, drop and recreate the database first (roles and columns changed).

## Flow
Student POST /api/complaints -> ticket (processing) -> XADD complaints:new
-> worker (consumer group): LLM classify + embedding + semantic duplicate check
   - duplicate: linked to the existing ticket, reporter counted as affected
   - new: routed to the least-loaded department head of that department
-> Department head assigns a 3rd-party worker (name, contact, expected date)
   -> every affected student is notified; ticket shows worker + date; overdue is flagged
-> Head marks resolved -> students confirm fixed / not fixed (not fixed reopens it)
Live feed: caption + image + location, upvote ("I'm facing this too"), comments. Upvotes drive escalation
(ESCALATE_AT -> high, CRITICAL_AT -> critical). Socket.IO pushes feed and notification updates.

## Notes
- Seed coordinates in backend/schema.sql are placeholders; replace with real GPS points.
- Without LLM_API_KEY it falls back to keyword classification and hashed embeddings (weak semantics).
- The worker runs inside the API process so it can push socket events. For several API instances, add the Socket.IO Redis adapter.
