import cors from "cors";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
app.use(cors());
app.use(express.json());

const rooms = {};

app.post("/create-room", (req, res) => {
  const roomId = Math.random().toString(36).substring(7);
  rooms[roomId] = {
    clients: new Set(),
    users: new Map(),
    controller: null,
  };
  console.log(`🏠 Room created: ${roomId}`);
  res.json({ roomId });
});

const server = app.listen(3001, () => {
  console.log("Server running on port 3001");
});

const wss = new WebSocketServer({ server });

let globalClients = new Set();
let globalUsers = new Map();

wss.on("connection", (ws) => {
  globalClients.add(ws);
  console.log("🔌 Client connected");

  let currentRoom = null;

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());

    if (msg.type === "join-global") {
      globalUsers.set(ws, msg.userId);
      broadcastGlobal({
        type: "user-joined-global",
        users: [...globalUsers.values()],
      });
      return;
    }

    if (msg.type === "join-room") {
      const { roomId, userId } = msg;

      if (!rooms[roomId]) {
        rooms[roomId] = {
          clients: new Set(),
          users: new Map(),
          controller: null,
        };
      }

      currentRoom = roomId;
      const room = rooms[roomId];
      const role = room.clients.size === 0 ? "streamer" : "viewer";

      room.clients.add(ws);
      room.users.set(ws, { userId, role });

      ws.send(JSON.stringify({ type: "init", role, controller: room.controller }));

      broadcast(
        room,
        { type: "room-users", users: [...room.users.values()] },
        ws
      );

      console.log(`👤 ${userId} joined ${roomId} as ${role}`);
      return;
    }

    if (msg.type === "create-room") {
      const { roomId } = msg;
      rooms[roomId] = {
        clients: new Set(),
        users: new Map(),
        controller: null,
      };
      console.log(`🏠 Room created via WS: ${roomId}`);
      return;
    }

    if (!currentRoom) return;

    const room = rooms[currentRoom];
    const sender = room.users.get(ws);
    if (!sender) return;

    const canControl =
      sender.role === "streamer" || room.controller === sender.userId;

    if (msg.type === "grant-control") {
      if (sender.role !== "streamer") return;
      room.controller = msg.targetUserId;
      broadcast(room, { type: "control-update", controller: room.controller });
      return;
    }

    if (msg.type === "revoke-control") {
      if (sender.role !== "streamer") return;
      room.controller = null;
      broadcast(room, { type: "control-update", controller: null });
      return;
    }

    if (["scroll", "click"].includes(msg.type) && !canControl) return;

    broadcast(room, { ...msg, userId: sender.userId }, ws);
  });

  ws.on("close", () => {
    globalClients.delete(ws);
    globalUsers.delete(ws);

    if (!currentRoom) return;

    const room = rooms[currentRoom];
    if (!room) return;

    const user = room.users.get(ws);

    room.clients.delete(ws);
    room.users.delete(ws);

    if (user && user.role === "streamer") {
      const next = [...room.users.values()].find(
        (u) => u.userId !== user.userId
      );

      if (next) {
        broadcast(room, { type: "role-update", newStreamer: next.userId });
      } else {
        delete rooms[currentRoom];
        console.log(`🧹 Deleted empty room ${currentRoom}`);
      }
    }

    broadcast(room, { type: "room-users", users: [...room.users.values()] });

    console.log("❌ Client disconnected");
  });
});

function broadcast(room, message, skip = null) {
  const payload = JSON.stringify(message);
  room.clients.forEach((client) => {
    if (client !== skip && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function broadcastGlobal(message) {
  const payload = JSON.stringify(message);
  globalClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}