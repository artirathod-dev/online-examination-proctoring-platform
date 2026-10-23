import { verify } from './auth.js';

// WebRTC signaling + live proctoring presence
export function setupSocket(io) {
  const live = new Map(); // attemptId -> { attemptId, socketId, name, exam }
  const list = () => [...live.values()];

  io.use((s, next) => {
    try { s.user = verify(s.handshake.auth.token); next(); } catch { next(new Error('unauthorized')); }
  });

  io.on('connection', (s) => {
    const isAdmin = s.user.role === 'admin';

    s.on('student:join', ({ attemptId, exam }) => {
      live.set(attemptId, { attemptId, socketId: s.id, name: s.user.name, exam });
      s.data.attemptId = attemptId;
      io.to('proctors').emit('live:update', list());
    });
    s.on('proctor:join', () => {
      if (!isAdmin) return;
      s.join('proctors');
      s.emit('live:update', list());
    });
    s.on('proctor:watch', ({ attemptId }) => {
      const t = isAdmin && live.get(attemptId);
      if (t) io.to(t.socketId).emit('proctor:watch', { proctorId: s.id });
    });
    s.on('proctor:warn', ({ attemptId, message }) => {
      const t = isAdmin && live.get(attemptId);
      if (t) io.to(t.socketId).emit('proctor:warn', { message });
    });
    s.on('signal', ({ to, data }) => io.to(to).emit('signal', { from: s.id, data }));
    s.on('disconnect', () => {
      const id = s.data.attemptId;
      if (id && live.get(id)?.socketId === s.id) {
        live.delete(id);
        io.to('proctors').emit('live:update', list());
      }
    });
  });
}
