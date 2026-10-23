# 🎓 ProctorExam — Online Examination & Proctoring Platform

React · Node.js/Express · PostgreSQL · WebRTC (Socket.IO signaling)

## Features
- **Timed exams** — server-authoritative deadline, live countdown, auto-submit at 0, resume after refresh
- **Question bank** — add/edit/delete MCQs with topics & marks; compose exams from the bank; per-student shuffling
- **Webcam proctoring** — mandatory camera, fullscreen enforcement, tab-switch / copy-paste / devtools-key detection, face-presence & camera-covered checks, periodic snapshots, violation limit → auto-submit
- **Live proctor console** — admins see active students, open a peer-to-peer **WebRTC** video feed, send warnings, watch a real-time violation feed
- **Automated evaluation** — graded on the server from saved answers (clients never receive correct answers during the exam); result page with answer review
- **Analytics** — platform overview, score distribution, pass rate, per-question accuracy, attempt table, per-attempt proctor report (violations + snapshots), CSV export

## Quick start
Requires Node 18+ and PostgreSQL 14+ (or Docker).

```bash
# 1. Database (skip if you already have Postgres; edit server/.env accordingly)
docker compose up -d

# 2. Backend
cd server
npm install
npm run migrate      # create tables
npm run seed         # demo users, 12 questions, 1 exam
npm run dev          # http://localhost:4000

# 3. Frontend (new terminal)
cd client
npm install
npm run dev          # http://localhost:5173
```

**Demo logins** — Admin: `admin@exam.com / admin123` · Student: `student@exam.com / student123`

Try it: log in as the student in one browser and take the exam; log in as admin in a second browser/profile → *Live Proctor* → **Watch**.

### Production
`cd client && npm run build` — the Express server then serves `client/dist` automatically.
Set a strong `JWT_SECRET` in `server/.env`.

## Project layout
```
server/src   index.js · socket.js (WebRTC signaling) · schema.sql · seed.js
             routes/{auth,questions,exams,attempts,analytics}.js
client/src   App.jsx · api.js · hooks/useProctor.js
             pages/{Login,Student,TakeExam,Manage,Analytics,Proctor}.jsx
```

## Honest notes / hardening for real-world use
- Browser-based proctoring can be deterred, not made unbreakable. For high-stakes exams add a lockdown browser.
- Face detection uses the browser `FaceDetector` API (Chromium, may need the *Experimental Web Platform features* flag). Without it, the camera-covered check still runs. For production, plug in MediaPipe / face-api.js in `useProctor.js`.
- WebRTC uses a public Google STUN server. Behind strict NATs/corporate networks add a **TURN** server in `client/src/api.js` (`ICE`).
- Snapshots are stored as base64 in Postgres for simplicity; move to S3/object storage at scale.
- Add rate limiting, HTTPS, and email verification before deploying publicly.
