import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { setupSocket } from './socket.js';
import authRoutes from './routes/auth.js';
import questionRoutes from './routes/questions.js';
import examRoutes from './routes/exams.js';
import attemptRoutes from './routes/attempts.js';
import analyticsRoutes from './routes/analytics.js';

const app = express();
const server = http.createServer(app);
const origin = process.env.CLIENT_ORIGIN || true;
const io = new Server(server, { cors: { origin } });
setupSocket(io);
app.set('io', io);

app.use(cors({ origin }));
app.use(express.json({ limit: '3mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/analytics', analyticsRoutes);

// Serve the built React app in production
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`API + signaling on http://localhost:${port}`));
