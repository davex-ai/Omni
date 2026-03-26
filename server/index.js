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
    mode: null,
  };
  console.log(`Room created: ${roomId}`);
  res.json({ roomId });
});

const server = app.listen(3001, () => {
  console.log("Server running on port 3001");
});

const wss = new WebSocketServer({ server });

const globalClients = new Set();
const globalUsers = new Map();

wss.on("connection", (ws) => {
  globalClients.add(ws);

  let currentRoom = null;

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());

    if (msg.type === "join-global") {
      globalUsers.set(ws, msg.userId);
      broadcastGlobal({ type: "global-users", users: [...globalUsers.values()] });
      return;
    }

    if (msg.type === "join-room") {
      const { roomId, userId, mode } = msg;

      if (!rooms[roomId]) {
        rooms[roomId] = { clients: new Set(), users: new Map(), controller: null, mode };
      }

      currentRoom = roomId;
      const room = rooms[roomId];
      const isFirst = room.clients.size === 0;
      const role = isFirst ? "streamer" : "viewer";

      room.clients.add(ws);
      room.users.set(ws, { userId, role });

      ws.send(JSON.stringify({ type: "init", role, controller: room.controller }));

      const userList = [...room.users.values()];
      broadcast(room, { type: "room-users", users: userList });

      console.log(`${userId} joined ${roomId} as ${role}`);
      return;
    }

    if (!currentRoom) return;

    const room = rooms[currentRoom];
    const sender = room.users.get(ws);
    if (!sender) return;

    const canControl = sender.role === "streamer" || room.controller === sender.userId;

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

    if (["scroll", "click", "input"].includes(msg.type) && !canControl) return;

    broadcast(room, { ...msg, userId: sender.userId }, ws);
  });

  ws.on("close", () => {
    globalClients.delete(ws);
    globalUsers.delete(ws);
    broadcastGlobal({ type: "global-users", users: [...globalUsers.values()] });
if (msg.type === "cursor" && !currentRoom) {
  const userId = globalUsers.get(ws);
  if (!userId) return;

  broadcastGlobal({
    type: "cursor",
    userId,
    x: msg.x,
    y: msg.y,
  });

  return;
}
    if (!currentRoom) return;

    const room = rooms[currentRoom];
    if (!room) return;

    const user = room.users.get(ws);
    room.clients.delete(ws);
    room.users.delete(ws);

    if (!room.clients.size) {
      delete rooms[currentRoom];
      console.log(`Deleted empty room ${currentRoom}`);
      return;
    }

    if (user && user.role === "streamer") {
      const nextEntry = [...room.users.entries()][0];
      if (nextEntry) {
        const [nextWs, nextUser] = nextEntry;
        nextUser.role = "streamer";
        room.users.set(nextWs, nextUser);
        nextWs.send(JSON.stringify({ type: "role-update", newRole: "streamer" }));
        broadcast(room, { type: "room-users", users: [...room.users.values()] }, nextWs);
      }
    } else {
      broadcast(room, { type: "room-users", users: [...room.users.values()] });
    }
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
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}