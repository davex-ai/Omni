import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const COLORS = ["#f43f5e","#f97316","#eab308","#22c55e","#06b6d4","#6366f1","#a855f7"];

function colorForId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Home() {
  const navigate = useNavigate();
  const [joinId, setJoinId] = useState("");
  const [cursors, setCursors] = useState({});
  const [smoothCursors, setSmoothCursors] = useState({});
  const [totalUsers, setTotalUsers] = useState(0);

  const cursorsRef = useRef({});

  const userId = useMemo(() => {
    let id = localStorage.getItem("userId");
    if (!id) {
      id = Math.random().toString(36).substring(7);
      localStorage.setItem("userId", id);
    }
    return id;
  }, []);

  const createRoom = async () => {
    const res = await fetch("http://localhost:3001/create-room", { method: "POST" });
    const data = await res.json();
    navigate(`/room/${data.roomId}`);
  };

  // smoothing
  useEffect(() => {
    const interval = setInterval(() => {
      setSmoothCursors((prev) => {
        const updated = {};
        for (let id in cursorsRef.current) {
          const t = cursorsRef.current[id];
          const c = prev[id] || t;
          updated[id] = {
            x: c.x + (t.x - c.x) * 0.2,
            y: c.y + (t.y - c.y) * 0.2,
          };
        }
        return updated;
      });
    }, 16);
    return () => clearInterval(interval);
  }, []);

  // websocket
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3001");
    let lastSent = 0;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "join-global", userId }));
    };

    socket.onmessage = async (event) => {
      const raw = event.data instanceof Blob ? await event.data.text() : event.data;
      const data = JSON.parse(raw);

      if (data.type === "global-users") {
        setTotalUsers(data.users.length);
        return;
      }

      if (data.userId === userId) return;

      if (data.type === "cursor") {
        cursorsRef.current = {
          ...cursorsRef.current,
          [data.userId]: { x: data.x, y: data.y },
        };
        setCursors((prev) => ({
          ...prev,
          [data.userId]: { x: data.x, y: data.y },
        }));
      }
    };

    const move = (e) => {
      const now = Date.now();
      if (now - lastSent < 50) return;
      lastSent = now;

      socket.send(JSON.stringify({
        type: "cursor",
        x: e.clientX,
        y: e.clientY,
      }));
    };

    window.addEventListener("mousemove", move);

    return () => {
      window.removeEventListener("mousemove", move);
      socket.close();
    };
  }, [userId]);

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", color: "#fff" }}>
      <div style={{ position: "fixed", top: 0, width: "100%", padding: "16px" }}>
        {totalUsers} users creating chaos
      </div>

      {/* UI */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:"20px" }}>
        <h1>Omni</h1>

        <button onClick={createRoom}>Create Room</button>

        <input value={joinId} onChange={(e)=>setJoinId(e.target.value)} />
        <button onClick={()=>joinId && navigate(`/room/${joinId}`)}>Join</button>
      </div>

      {/* cursors */}
      {Object.entries(smoothCursors).map(([id,pos]) => (
        <div key={id} style={{
          position:"fixed",
          left:pos.x,
          top:pos.y,
          pointerEvents:"none"
        }}>
          <div style={{
            width:10,
            height:10,
            borderRadius:"50%",
            background:colorForId(id)
          }} />
        </div>
      ))}
    </div>
  );
}