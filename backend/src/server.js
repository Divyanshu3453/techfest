import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { initSocket } from './socket.js';
import { startWorker } from './workers/assigner.js';
import authRoutes from './routes/auth.js';
import locationRoutes from './routes/locations.js';
import complaintRoutes from './routes/complaints.js';
import feedRoutes from './routes/feed.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json());
app.use('/uploads', express.static(path.resolve('uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Express 4 does not catch rejected promises from async handlers on its own
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Something went wrong' });
});

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`API + sockets on http://localhost:${PORT}`);
  // Runs in-process so the worker can push socket notifications directly.
  startWorker().catch((e) => { console.error('Worker crashed:', e); process.exit(1); });
});
