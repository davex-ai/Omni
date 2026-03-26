import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const [joinId, setJoinId] = useState("");

  const createRoom = async () => {
    const res = await fetch("http://localhost:3001/create-room", {
      method: "POST",
    });
    const data = await res.json();
    navigate(`/room/${data.roomId}`);
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#0f0f0f",
      color: "#fff",
      fontFamily: "sans-serif",
      gap: "24px",
    }}>
      <h1 style={{ fontSize: "3rem", fontWeight: 800, letterSpacing: "-1px", margin: 0 }}>
        Omni
      </h1>
      <p style={{ color: "#888", margin: 0 }}>Sync scrolling, cursors and clicks across browsers</p>

      <button
        onClick={createRoom}
        style={{
          padding: "14px 32px",
          fontSize: "16px",
          fontWeight: 600,
          background: "#6366f1",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          cursor: "pointer",
        }}
      >
        Create Room
      </button>

      <div style={{ display: "flex", gap: "10px" }}>
        <input
          value={joinId}
          onChange={(e) => setJoinId(e.target.value)}
          placeholder="Enter room ID"
          style={{
            padding: "12px 16px",
            fontSize: "15px",
            borderRadius: "8px",
            border: "1px solid #333",
            background: "#1a1a1a",
            color: "#fff",
            outline: "none",
            width: "200px",
          }}
        />
        <button
          onClick={() => joinId && navigate(`/room/${joinId}`)}
          style={{
            padding: "12px 24px",
            fontSize: "15px",
            fontWeight: 600,
            background: "#22c55e",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Join
        </button>
      </div>
    </div>
  );
}