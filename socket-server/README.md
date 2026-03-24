# AZ Chat Socket Server

## Local
```bash
cd socket-server
npm install
npm run dev
```

## Env
Create `.env` with:
```
PORT=3001
CLIENT_ORIGIN=http://localhost:3000
```

## Production
Deploy this folder to Render/Railway/VPS and set:
```
CLIENT_ORIGIN=https://your-vercel-domain.vercel.app
```

Then in the main app set:
```
NEXT_PUBLIC_SOCKET_URL=https://your-socket-domain
```
