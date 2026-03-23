import { useEffect, useState } from "react";

function App() {
  const [cursors, setCursors] =  useState({});
  const userId = Math.random().toString(36).substring(7)
  const [smoothCursors, setSmoothCursors] = useState({})
  const [clicks, setClicks] = useState([])

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
  }, 16); // ~60fps

  return () => clearInterval(interval);
}, [cursors]);

  useEffect(() => {
  const ws = new WebSocket("ws://localhost:3001");

  let isRemoteScroll = false;
  let timeout;

  const handleScroll = () => {
    if (isRemoteScroll) {
      isRemoteScroll = false;
      return;
    }

    clearTimeout(timeout);

    timeout = setTimeout(() => {
      const currentScroll = Math.round(window.scrollY);

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "scroll",
            scrollY: currentScroll,
          })
        );
      }
    }, 50);
  };

  window.addEventListener("scroll", handleScroll);

  ws.onmessage = async (event) => {
    const text = event.data instanceof Blob
    ? await event.data.text() : event.data

    const data = JSON.parse(text);

    if (data.type === "scroll") {
      isRemoteScroll = true;
      window.scrollTo(0, data.scrollY);
    }

    if (data.type === "cursor") {
      if (data.userId === userId) return;
      setCursors((prev) => ({
        ...prev, [data.userId]: { x: data.x, y: data.y }
      }))
    }

    if (data.type === "click") {
      setClicks((prev) => [...prev, {id: Math.random(), x: data.x, y: data.y }]);
      setTimeout(() => {
        setClicks((prev) => prev.slice(1))
      }, 500)
    }
  };
   const handleMouseMove = (e) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "cursor", userId, x: e.clientX, y: e.clientY }));
      }
    }

  window.addEventListener("mousemove", (e) => {
    if( ws.readyState === WebSocket.OPEN ) {
      ws.send(
        JSON.stringify({
          type: "cursor",
          userId,
          x: e.clientX,
          y: e.clientY
        })
      );
    }
  })

  window.addEventListener("click", (e) => {
    if( ws.readyState === WebSocket.OPEN ) {
      ws.send(
        JSON.stringify({
          type: "click",
          userId,
          x: e.clientX,
          y: e.clientY
        })
      );
    }
  });


  return () => {
    window.removeEventListener("scroll", handleScroll); 
    window.removeEventListener("mousemove", handleMouseMove);

    ws.close();
  };
}, []);

  return (
    <div style={{ height: "3000px", padding: "20px" }}>
      <h1>SyncWatch MVP</h1>
      <p>Scroll and watch it sync 👀</p>
      {Object.entries(cursors).map(([id ,pos]) => (
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
            transform: "translate(-50%, -50%)"
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
            animation: "ping 0.5s ease-out",
          }}
        />
      ))}
    </div>
  );
}

export default App;