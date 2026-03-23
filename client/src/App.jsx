import { useEffect } from "react";

function App() {
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
  };

  return () => {
    window.removeEventListener("scroll", handleScroll);
    ws.close();
  };
}, []);

  return (
    <div style={{ height: "3000px", padding: "20px" }}>
      <h1>SyncWatch MVP</h1>
      <p>Scroll and watch it sync 👀</p>
    </div>
  );
}

export default App;