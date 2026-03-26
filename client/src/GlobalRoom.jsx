import { useEffect, useState, useRef, useMemo } from "react";

const COLORS = ["#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#a855f7"];

function colorForId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function GlobalRoom() {
  const [cursors, setCursors] = useState({});
  const [smoothCursors, setSmoothCursors] = useState({});
  const [totalUsers, setTotalUsers] = useState(0);

  const cursorsRef = useRef({});

  const userId = useMemo(() => {
    let id = localStorage.getItem("userId");
    if (!id) { id = Math.random().toString(36).substring(7); localStorage.setItem("userId", id); }
    return id;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSmoothCursors((prev) => {
        const updated = {};
        for (let id in cursorsRef.current) {
          const target = cursorsRef.current[id];
          const current = prev[id] || target;
          updated[id] = {
            x: current.x + (target.x - current.x) * 0.2,
            y: current.y + (target.y - current.y) * 0.2,
          };
        }
        return updated;
      });
    }, 16);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3001");
    let lastSent = 0;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "join-global", userId }));
      socket.send(JSON.stringify({ type: "join-room", roomId: "__global__", userId, mode: "global" }));
    };

    socket.onmessage = async (event) => {
      const raw = event.data instanceof Blob ? await event.data.text() : event.data;
      const data = JSON.parse(raw);

      if (data.type === "global-users") {
        setTotalUsers(data.users.length);
        return;
      }

      if (data.type === "room-users") {
        setTotalUsers(data.users.length);
        return;
      }

      if (data.userId === userId) return;

      if (data.type === "cursor") {
        cursorsRef.current = { ...cursorsRef.current, [data.userId]: { x: data.x, y: data.y } };
        setCursors((prev) => ({ ...prev, [data.userId]: { x: data.x, y: data.y } }));
      }
    };

    const handleMouseMove = (e) => {
      const now = Date.now();
      if (now - lastSent < 50) return;
      lastSent = now;
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "cursor", x: e.clientX, y: e.clientY }));
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      socket.close();
    };
  }, [userId]);

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", color: "#fff", fontFamily: "sans-serif" }}>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "56px",
        background: "#111", borderBottom: "1px solid #222",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", zIndex: 1000,
      }}>
        <span style={{ fontWeight: 700, fontSize: "18px" }}>Omni — Global</span>
        <span style={{ fontSize: "13px", color: "#555" }}>{totalUsers} online</span>
      </div>

      <div style={{ paddingTop: "80px", paddingLeft: "24px" }}>
        <p style={{ color: "#444", fontSize: "14px" }}>Move your cursor around. Everyone sees each other.</p>
      </div>

      {Object.entries(smoothCursors).map(([id, pos]) => (
        <div key={id} style={{
          position: "fixed", left: pos.x, top: pos.y,
          pointerEvents: "none", zIndex: 998,
          transform: "translate(-2px, -2px)",
        }}>
          <div style={{
            width: "12px", height: "12px",
            background: colorForId(id), borderRadius: "50%",
            boxShadow: `0 0 6px ${colorForId(id)}`,
          }} />
          <div style={{
            marginTop: "2px", background: colorForId(id),
            color: "#fff", fontSize: "10px", fontWeight: 600,
            padding: "2px 6px", borderRadius: "4px", whiteSpace: "nowrap",
          }}>
            {id.slice(0, 5)}
          </div>
        </div>
      ))}
    </div>
  );
}