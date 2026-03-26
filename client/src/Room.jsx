import { useEffect, useState, useRef, useMemo } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useParams } from "react-router-dom";

const COLORS = ["#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#a855f7"];

function colorForId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function Room() {
  const [cursors, setCursors] = useState({});
  const [smoothCursors, setSmoothCursors] = useState({});
  const [clicks, setClicks] = useState([]);
  const [text, setText] = useState("");
  const [role, setRole] = useState(null);
  const [controller, setController] = useState(null);
  const [roomUsers, setRoomUsers] = useState([]);

  const { roomId } = useParams();

  const userId = useMemo(() => {
    let id = localStorage.getItem("userId");
    if (!id) {
      id = Math.random().toString(36).substring(7);
      localStorage.setItem("userId", id);
    }
    return id;
  }, []);

  const canControl = role === "streamer" || controller === userId;

  const ws = useRef(null);
  const yTextRef = useRef(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider("ws://localhost:1234", roomId, ydoc);
    const yText = ydoc.getText("shared-text");

    yTextRef.current = yText;

    const update = () => setText(yText.toString());
    yText.observe(update);

    return () => {
      yText.unobserve(update);
      provider.destroy();
      ydoc.destroy();
    };
  }, [roomId]);

  const handleInput = (e) => {
    const value = e.target.value;
    const yText = yTextRef.current;
    if (!canControl || !yText) return;
    const current = yText.toString();
    if (value !== current) {
      yText.delete(0, yText.length);
      yText.insert(0, value);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setSmoothCursors((prev) => {
        const updated = {};
        for (let id in cursors) {
          const target = cursors[id];
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
  }, [cursors]);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3001");
    ws.current = socket;

    let isRemoteScroll = false;
    let scrollTimeout;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "join-global", userId }));
      socket.send(JSON.stringify({ type: "join-room", roomId, userId }));
    };

    socket.onmessage = async (event) => {
      const rawData = event.data instanceof Blob ? await event.data.text() : event.data;
      const data = JSON.parse(rawData);

      if (data.type === "init") {
        setRole(data.role);
        setController(data.controller);
        return;
      }

      if (data.type === "room-users") {
        setRoomUsers(data.users);
        return;
      }

      if (data.type === "control-update") {
        setController(data.controller);
        return;
      }

      if (data.type === "role-update") {
        if (data.newStreamer === userId) setRole("streamer");
        return;
      }

      if (data.type === "error") {
        alert(data.message);
        return;
      }

      if (data.userId === userId) return;

      if (data.type === "scroll") {
        isRemoteScroll = true;
        window.scrollTo(0, data.scrollY);
      } else if (data.type === "cursor") {
        setCursors((prev) => ({ ...prev, [data.userId]: { x: data.x, y: data.y } }));
      } else if (data.type === "click") {
        setClicks((prev) => [
          ...prev,
          { id: Math.random(), x: data.x, y: data.y, uid: data.userId },
        ]);
        setTimeout(() => setClicks((prev) => prev.slice(1)), 600);
      }
    };

    const handleScroll = () => {
      if (isRemoteScroll) { isRemoteScroll = false; return; }
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "scroll", scrollY: Math.round(window.scrollY) }));
        }
      }, 50);
    };

    let lastSent = 0;
    const handleMouseMove = (e) => {
      const now = Date.now();
      if (now - lastSent < 50) return;
      lastSent = now;
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "cursor", x: e.clientX, y: e.clientY }));
      }
    };

    const handleClick = (e) => {
      if (!canControl) return;
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "click", x: e.clientX, y: e.clientY }));
      }
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      socket.close();
    };
  }, [userId, roomId]);

  return (
    <div style={{ minHeight: "3000px", background: "#0f0f0f", color: "#fff", fontFamily: "sans-serif", padding: "24px" }}>

      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "56px",
        background: "#111", borderBottom: "1px solid #222",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", zIndex: 1000,
      }}>
        <span style={{ fontWeight: 700, fontSize: "18px", letterSpacing: "-0.5px" }}>Omni</span>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{
            padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600,
            background: role === "streamer" ? "#6366f1" : "#22c55e",
            color: "#fff",
          }}>
            {role === "streamer" ? "Streamer" : canControl ? "Controller" : "Viewer"}
          </span>

          <span style={{ fontSize: "12px", color: "#555" }}>
            {roomUsers.length} in room
          </span>

          <span style={{
            fontSize: "12px", color: "#444", background: "#1a1a1a",
            padding: "4px 10px", borderRadius: "6px", fontFamily: "monospace",
          }}>
            {roomId}
          </span>
        </div>
      </div>

      <div style={{ marginTop: "80px" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: "22px" }}>Shared Workspace</h2>
        <p style={{ color: "#555", margin: "0 0 20px", fontSize: "14px" }}>
          {canControl ? "You can control this session." : "You are viewing. Control not granted."}
        </p>

        <input
          value={text}
          onChange={handleInput}
          disabled={!canControl}
          placeholder="Type something..."
          style={{
            padding: "12px 16px", fontSize: "15px", width: "320px",
            borderRadius: "8px", border: "1px solid #333",
            background: canControl ? "#1a1a1a" : "#111",
            color: canControl ? "#fff" : "#444",
            outline: "none", position: "sticky", top: "68px",
          }}
        />
      </div>

      {role === "streamer" && (
        <div style={{
          position: "fixed", top: "68px", right: "20px",
          background: "#1a1a1a", border: "1px solid #2a2a2a",
          borderRadius: "10px", padding: "12px 16px",
          display: "flex", flexDirection: "column", gap: "8px",
          zIndex: 999,
        }}>
          <span style={{ fontSize: "12px", color: "#666", fontWeight: 600 }}>Control</span>
          <button
            onClick={() =>
              ws.current.send(JSON.stringify({
                type: "grant-control",
                targetUserId: Object.keys(cursors)[0],
              }))
            }
            style={{
              padding: "8px 14px", fontSize: "13px", fontWeight: 600,
              background: "#6366f1", color: "#fff", border: "none",
              borderRadius: "6px", cursor: "pointer",
            }}
          >
            Grant Control
          </button>
          <button
            onClick={() => ws.current.send(JSON.stringify({ type: "revoke-control" }))}
            style={{
              padding: "8px 14px", fontSize: "13px", fontWeight: 600,
              background: "#1f1f1f", color: "#f43f5e",
              border: "1px solid #f43f5e", borderRadius: "6px", cursor: "pointer",
            }}
          >
            Revoke Control
          </button>
        </div>
      )}

      {Object.entries(smoothCursors).map(([id, pos]) => (
        <div key={id} style={{
          position: "fixed", left: pos.x, top: pos.y,
          pointerEvents: "none", zIndex: 998,
          transform: "translate(-2px, -2px)",
        }}>
          <div style={{
            width: "12px", height: "12px",
            background: colorForId(id),
            borderRadius: "50%",
            boxShadow: `0 0 6px ${colorForId(id)}`,
          }} />
          <div style={{
            marginTop: "2px",
            background: colorForId(id),
            color: "#fff", fontSize: "10px", fontWeight: 600,
            padding: "2px 6px", borderRadius: "4px",
            whiteSpace: "nowrap",
          }}>
            {id.slice(0, 5)}
          </div>
        </div>
      ))}

      {clicks.map((click) => (
        <div key={click.id} style={{
          position: "fixed", left: click.x, top: click.y,
          width: "24px", height: "24px",
          border: `2px solid ${colorForId(click.uid)}`,
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          animation: "ripple 0.6s ease-out forwards",
        }} />
      ))}

      <style>{`
        @keyframes ripple {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(2.5); }
        }
      `}</style>
    </div>
  );
}

export default Room;