import { useEffect, useState, useRef, useMemo } from "react";
import * as Y from 'yjs'
import { WebsocketProvider } from "y-websocket"
import { useParams } from "react-router-dom";

function Room() {
  const [cursors, setCursors] = useState({});
  const [smoothCursors, setSmoothCursors] = useState({});
  const [clicks, setClicks] = useState([]);
  const [text, setText] = useState("");
  const [role, setRole] = useState(null); 
const [controller, setController] = useState(null);
const { roomId } = useParams();
const userId = useMemo(() => {
  let id = localStorage.getItem("userId");
  if (!id) {
    id = Math.random().toString(36).substring(7);
    localStorage.setItem("userId", id);
  }
  return id;
}, []);

const canControl =
  role === "streamer" || controller === userId;
  
  const ws = useRef(null);
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const yTextRef = useRef(null);

useEffect(() => {
  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(
    "ws://localhost:1234",  
    roomId,
    ydoc
  );

  const yText = ydoc.getText("shared-text");

  ydocRef.current = ydoc;
  providerRef.current = provider;
  yTextRef.current = yText;

  const update = () => {
    setText(yText.toString());
  };

  yText.observe(update);

  return () => {
    yText.unobserve(update);
    provider.destroy();
    ydoc.destroy();
  };
}, []);


  const handleInput = (e) => {
    const value = e.target.value;
    const yText = yTextRef.current
    if (!canControl) return;
    if(!yText)return
    const current = yText.toString()

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
    socket.send(
      JSON.stringify({
        type: "join-room",
        roomId,
        userId,
      })
    );
  };

    socket.onmessage = async (event) => {
      const rawData = event.data instanceof Blob ? await event.data.text() : event.data;
      const data = JSON.parse(rawData);

      if (data.userId === userId) return;

      if (data.type === "scroll") {
        isRemoteScroll = true;
        window.scrollTo(0, data.scrollY);
      } else if (data.type === "cursor") {
        setCursors((prev) => ({ ...prev, [data.userId]: { x: data.x, y: data.y } }));
      } else if (data.type === "click") {
        setClicks((prev) => [...prev, { id: Math.random(), x: data.x, y: data.y }]);
        setTimeout(() => setClicks((prev) => prev.slice(1)), 500);
      } 
      if (data.type === "role") {
      setRole(data.role);
      }

      if (data.type === "control-update") {
        setController(data.controller);
      }
        if (data.type === "error") {
        alert(data.message);
        }

    };

    const handleScroll = () => {
      if (isRemoteScroll) {
        isRemoteScroll = false;
        return;
      }
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

      if (now - lastSent < 50) return; // 20fps

      lastSent = now;

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "cursor",
            userId,
            x: e.clientX,
            y: e.clientY,
          })
        );
      }
    };

    const handleClick = (e) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "click", userId, x: e.clientX, y: e.clientY }));
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
  }, [userId]);

  return (
    <div style={{ height: "3000px", padding: "20px" }}>
      <h1>SyncWatch MVP</h1>
      <p>Your ID: {userId}</p>

      {/* Render Smooth Cursors instead of raw Cursors */}
      {Object.entries(smoothCursors).map(([id, pos]) => (
        <div
          key={id}
          style={{
            zIndex: 999,
            position: "fixed",
            left: pos.x,
            top: pos.y,
            width: "10px",
            height: "10px",
            backgroundColor: "red",
            borderRadius: "50%",
            pointerEvents: "none",
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      {clicks.map((click) => (
        <div
          key={click.id}
          style={{
            position: "fixed",
            left: click.x,
            top: click.y,
            width: "20px",
            height: "20px",
            border: "2px solid blue",
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        />
      ))}

      <input
        value={text}
        onChange={handleInput}
        disabled={!canControl}
        style={{ padding: "10px", fontSize: "16px", width: "300px", position: 'sticky', top: '20px' }}
        placeholder="Type something..."
      />

      {role === "streamer" && (
  <div style={{ position: "fixed", top: 10, right: 10 }}>
    <button
      onClick={() =>
        ws.current.send(
          JSON.stringify({
            type: "grant-control",
            targetUserId: Object.keys(cursors)[0],
          })
        )
      }
    >
      Grant Control
    </button>

    <button
      onClick={() =>
        ws.current.send(JSON.stringify({ type: "revoke-control" }))
      }
    >
      Revoke Control
    </button>
  </div>
)} 
    </div>
  );
}

export default Room;
