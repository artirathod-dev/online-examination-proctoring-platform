import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { connectSocket, ICE } from '../api.js';

export default function Proctor() {
  const [live, setLive] = useState([]);
  const [feed, setFeed] = useState([]);
  const [sel, setSel] = useState(null);
  const vref = useRef();
  const pcRef = useRef();
  const sockRef = useRef();
  const pending = useRef([]);

  useEffect(() => {
    const s = connectSocket();
    sockRef.current = s;
    s.on('connect', () => s.emit('proctor:join'));
    s.on('live:update', setLive);
    s.on('violation', (v) => setFeed((f) => [v, ...f].slice(0, 40)));
    s.on('signal', async ({ from, data }) => {
      const pc = pcRef.current;
      if (!pc) return;
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        for (const c of pending.current) await pc.addIceCandidate(c).catch(() => {});
        pending.current = [];
        await pc.setLocalDescription(await pc.createAnswer());
        s.emit('signal', { to: from, data: { sdp: pc.localDescription } });
      } else if (data.candidate) {
        pc.remoteDescription ? await pc.addIceCandidate(data.candidate).catch(() => {}) : pending.current.push(data.candidate);
      }
    });
    return () => { pcRef.current?.close(); s.disconnect(); };
  }, []);

  function watch(st) {
    pcRef.current?.close();
    pending.current = [];
    const pc = new RTCPeerConnection(ICE);
    pc.ontrack = (e) => { vref.current.srcObject = e.streams[0]; };
    pc.onicecandidate = (e) => e.candidate && sockRef.current.emit('signal', { to: st.socketId, data: { candidate: e.candidate } });
    pcRef.current = pc;
    setSel(st);
    sockRef.current.emit('proctor:watch', { attemptId: st.attemptId });
  }
  function warn(st) {
    const message = window.prompt(`Warning message to ${st.name}:`, 'Please keep your face visible and eyes on the screen.');
    if (message) sockRef.current.emit('proctor:warn', { attemptId: st.attemptId, message });
  }

  return (
    <>
      <h2>Live proctoring</h2>
      <div className="row2" style={{ alignItems: 'flex-start' }}>
        <div className="card">
          <h3>Students taking exams ({live.length})</h3>
          {!live.length && <p className="muted">No active students right now.</p>}
          {live.map((st) => (
            <div className="live" key={st.attemptId}>
              <div><b>{st.name}</b><div className="muted" style={{ fontSize: 12 }}>{st.exam}</div></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="sm" onClick={() => watch(st)}>👁 Watch</button>
                <button className="sm ghost" onClick={() => warn(st)}>⚠ Warn</button>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>{sel ? `Watching: ${sel.name}` : 'Live video'}</h3>
          <video ref={vref} autoPlay playsInline muted />
          {!sel && <p className="muted">Click “Watch” to open a peer-to-peer WebRTC video feed.</p>}
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Live violation feed</h3>
        {!feed.length && <p className="muted">Waiting for events…</p>}
        <table><tbody>{feed.map((v, i) => (
          <tr key={i}><td>{new Date(v.at).toLocaleTimeString()}</td><td>{v.userName}</td>
            <td><span className="badge bad">{v.type}</span></td><td>{v.detail}</td><td>#{v.count}</td>
            <td><Link to={`/admin/attempt/${v.attemptId}`}>report</Link></td></tr>
        ))}</tbody></table>
      </div>
    </>
  );
}
