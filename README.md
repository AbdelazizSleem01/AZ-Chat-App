# AZ Chat App

A modern real‑time chat experience with rich media, reactions, calls, reminders, and collaboration tools.

## Highlights
- 1:1 chat with typing, replies, reactions, editing, and soft delete
- File & image uploads (Cloudinary) with previews and download
- Audio and video notes with custom UI + transcription support
- Message search (global + per‑chat) with filters
- Scheduled messages and reminders
- Ephemeral messages (auto‑expire)
- Pinned messages and starred filter
- Notifications center (messages / follow / tasks / story reactions)
- Profile & privacy controls (bio visibility, follow requests)
- Status / Stories with views and reactions
- Tasks inside chat (assign, done/pending, notifications)
- Collaboration suite (whiteboard + code editor)
- Theming, custom chat backgrounds, and settings

## Tech
- Next.js (App Router)
- MongoDB Atlas
- Cloudinary for media storage

## Local Development
1) Install
```bash
npm install
```

2) Create `.env.local`
```bash
env
MONGODB_URI=YOUR_MONGODB_URI
JWT_SECRET=YOUR_SECRET
NEXT_PUBLIC_API_URL=http://localhost:3000
CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_KEY
CLOUDINARY_API_SECRET=YOUR_SECRET
```

3) Run
```bash
npm run dev
```

Open http://localhost:3000

## Deployment (Vercel)
1) Push to GitHub
2) Import in Vercel
3) Add Environment Variables:
```
MONGODB_URI=YOUR_MONGODB_URI
JWT_SECRET=YOUR_SECRET
NEXT_PUBLIC_API_URL=https://YOUR_APP.vercel.app
CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_KEY
CLOUDINARY_API_SECRET=YOUR_SECRET
```
4) Deploy

### Notes
- File uploads require Cloudinary in production.
- Vercel serverless doesn’t keep local `/uploads`.
- WebSocket real‑time features should use a separate socket host if you need full realtime; polling is enabled by default.

---

If you need help, open an issue or contact the maintainer.
