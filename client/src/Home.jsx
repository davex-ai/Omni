import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
const createRoom = async () => {
  const res = await fetch("http://localhost:3001/create-room", {
    method: "POST",
  });

  const data = await res.json();
  navigate(`/room/${data.roomId}`);
};;
  return (
    <div>
      <h1>Omni</h1>

      <button onClick={() => {
        const roomId = Math.random().toString(36).substring(7);
        navigate(`/room/${roomId}`);
      }}>
        Create Room
      </button>

      <input id="roomInput" placeholder="Enter room ID" />

      <button onClick={() => {
        const id = document.getElementById("roomInput").value;
        navigate(`/room/${id}`);
      }}>
        Join Room
      </button>
    </div>
  );
}