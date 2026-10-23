import { useEffect, useRef, useState } from 'react';
import { api, connectSocket, ICE } from '../api.js';

const MSG = {
  tab_switch: 'You left the exam tab/window. This was recorded.',
  fullscreen_exit: 'Please stay in fullscreen mode.',
  copy_paste: 'Copy, paste and right-click are disabled.',
  blocked_key: 'That shortcut is disabled during the exam.',
  no_face: 'No face detected — stay in front of the camera.',
  multiple_faces: 'Multiple faces detected in the camera.',
  camera_blocked: 'Your camera appears to be covered or too dark.',
};

/** Webcam proctoring: behaviour monitoring, snapshots, and WebRTC streaming to live proctors. */
export default function useProctor({ attemptId, examTitle, stream, maxViolations = 5, onLimit }) {
  const [count, setCount] = useState(0);
  const [warning, setWarning] = useState('');
  const limitRef = useRef(onLimit);
  limitRef.current = onLimit;

  useEffect(() => {
    const socket = connectSocket();
    const pcs = {};
    const last = {};
    const cleanups = [];
    let stopped = false;

    const report = (type, detail = '') => {
      const now = Date.now();
      if (stopped || now - (last[type] || 0) < 8000) return; // throttle repeats
      last[type] = now;
      setWarning(MSG[type] || type);
      api(`/attempts/${attemptId}/violation`, { method: 'POST', body: { type, detail } })
        .then((r) => { setCount(r.count); if (r.count >= maxViolations) limitRef.current?.(); })
        .catch(() => {});
    };
    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); cleanups.push(() => t.removeEventListener(ev, fn, opt)); };

    // ---- Browser behaviour ----
    on(document, 'visibilitychange', () => document.hidden && report('tab_switch', 'visibilitychange'));
    on(window, 'blur', () => report('tab_switch', 'window blur'));
    on(document, 'fullscreenchange', () => !document.fullscreenElement && report('fullscreen_exit'));
    ['copy', 'cut', 'paste', 'contextmenu'].forEach((ev) =>
      on(document, ev, (e) => { e.preventDefault(); report('copy_paste', ev); }));
    on(document, 'keydown', (e) => {
      const k = e.key.toLowerCase();
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) || (e.ctrlKey && ['u', 's', 'p'].includes(k))) {
        e.preventDefault(); report('blocked_key', e.key);
      }
    });
    on(window, 'beforeunload', (e) => { e.preventDefault(); e.returnValue = ''; });

    // ---- Camera analysis ----
    const vid = document.createElement('video');
    vid.srcObject = stream; vid.muted = true; vid.playsInline = true; vid.play().catch(() => {});
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const detector = 'FaceDetector' in window ? new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 }) : null;

    const analyse = setInterval(async () => {
      if (vid.readyState < 2) return;
      ctx.drawImage(vid, 0, 0, 320, 240);
      const d = ctx.getImageData(0, 0, 320, 240).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 64) sum += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      if (sum / (d.length / 64) < 18) return report('camera_blocked');
      if (detector) {
        try {
          const faces = await detector.detect(vid);
          if (faces.length === 0) report('no_face');
          else if (faces.length > 1) report('multiple_faces', `${faces.length} faces`);
        } catch { /* detector unavailable */ }
      }
    }, 3000);
    const snap = setInterval(() => {
      if (vid.readyState < 2) return;
      ctx.drawImage(vid, 0, 0, 320, 240);
      api(`/attempts/${attemptId}/snapshot`, { method: 'POST', body: { image: cv.toDataURL('image/jpeg', 0.5) } }).catch(() => {});
    }, 30000);
    setTimeout(() => { if (vid.readyState >= 2) { ctx.drawImage(vid, 0, 0, 320, 240); api(`/attempts/${attemptId}/snapshot`, { method: 'POST', body: { image: cv.toDataURL('image/jpeg', 0.5) } }).catch(() => {}); } }, 2500);

    // ---- WebRTC: stream to a proctor on request ----
    socket.on('connect', () => socket.emit('student:join', { attemptId, exam: examTitle }));
    socket.on('proctor:warn', ({ message }) => setWarning(`Proctor: ${message}`));
    socket.on('proctor:watch', async ({ proctorId }) => {
      pcs[proctorId]?.close();
      const pc = new RTCPeerConnection(ICE);
      pcs[proctorId] = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = (e) => e.candidate && socket.emit('signal', { to: proctorId, data: { candidate: e.candidate } });
      await pc.setLocalDescription(await pc.createOffer());
      socket.emit('signal', { to: proctorId, data: { sdp: pc.localDescription } });
    });
    socket.on('signal', async ({ from, data }) => {
      const pc = pcs[from];
      if (!pc) return;
      if (data.sdp) await pc.setRemoteDescription(data.sdp);
      else if (data.candidate) await pc.addIceCandidate(data.candidate).catch(() => {});
    });

    return () => {
      stopped = true;
      clearInterval(analyse); clearInterval(snap);
      cleanups.forEach((f) => f());
      Object.values(pcs).forEach((p) => p.close());
      socket.disconnect();
    };
  }, [attemptId, stream]);

  return { count, warning, dismiss: () => setWarning(''), maxViolations };
}
