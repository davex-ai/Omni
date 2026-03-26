import cors from "cors";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
app.use(cors());
app.use(express.json());

const rooms = {};
const globalClients = new Set();
const globalUsers = new Map();

app.post("/create-room", (req, res) => {
  const roomId = Math.random().toString(36).substring(7);

  rooms[roomId] = {
    clients: new Set(),
    users: new Map(),
    controller: null,
  };

  console.log(`Room created: ${roomId}`);
  res.json({ roomId });
});

const server = app.listen(3001, () => {
  console.log("Server running on port 3001");
});

const wss = new WebSocketServer({ server });

/* =========================
   HELPERS
========================= */

function getRoom(ws) {
  if (!ws.state.roomId) return null;
  return rooms[ws.state.roomId];
}

function isInRoom(ws) {
  return ws.state.mode === "room";
}

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
    if (
      client.readyState === WebSocket.OPEN &&
      client.state?.mode === "global"   // 🔥 ADD THIS
    ) {
      client.send(payload);
    }
  });
}
/* =========================
   CONNECTION
========================= */

wss.on("connection", (ws) => {
  
  ws.state = {
    mode: "global",
    roomId: null,
    userId: null,
  };

  /* =========================
     MESSAGE HANDLER
  ========================= */

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    console.log("SERVER RECEIVED:", msg);

    /* =========================
       JOIN GLOBAL
    ========================= */
    if (msg.type === "join-global") {
      
  if (ws.state.mode === "global") globalClients.add(ws);
      ws.state.mode = "global";
      ws.state.userId = msg.userId;

      globalUsers.set(ws, msg.userId);

      broadcastGlobal({
        type: "global-users",
        users: [...globalUsers.values()],
      });

      return;
    }

    /* =========================
       JOIN ROOM
    ========================= */
    if (msg.type === "join-room") {
      const { roomId, userId } = msg;

      if (!rooms[roomId]) {
        rooms[roomId] = {
          clients: new Set(),
          users: new Map(),
          controller: null,
        };
      }

      const room = rooms[roomId];

      // ❌ REMOVE FROM GLOBAL
      globalClients.delete(ws);
      globalUsers.delete(ws);

      // ✅ SET STATE
      ws.state.mode = "room";
      ws.state.roomId = roomId;
      ws.state.userId = userId;
      ws.removeAllListeners("cursor")
      ws.removeAllListeners("click")

      const isFirst = room.clients.size === 0;
      const role = isFirst ? "streamer" : "viewer";

      room.clients.add(ws);
      room.users.set(ws, { ...msg.user, role });

      ws.send(
        JSON.stringify({
          type: "init",
          role,
          controller: room.controller,
        })
      );

      broadcast(room, {
        type: "room-users",
        users: [...room.users.values()],
      });

      return;
    }

    /* =========================
       GLOBAL EVENTS
    ========================= */
    if (ws.state.mode === "global") {
      const userId = ws.state.userId;
      if (!userId) return;

      if (msg.type === "cursor" || msg.type === "click") {
        broadcastGlobal({
          type: msg.type,
          userId,
          x: msg.x,
          y: msg.y,
        });
      }

      return;
    }

    /* =========================
       ROOM EVENTS
    ========================= */
    const room = getRoom(ws);
    if (!room) return;

    const sender = room.users.get(ws);
    if (!sender) return;

    const canControl =
      sender.role === "streamer" ||
      room.controller === sender.userId;

    /* control logic */
    if (msg.type === "grant-control") {
      if (sender.role !== "streamer") return;

      room.controller = msg.targetUserId;

      broadcast(room, {
        type: "control-update",
        controller: room.controller,
      });

      return;
    }

    if (msg.type === "revoke-control") {
      if (sender.role !== "streamer") return;

      room.controller = null;

      broadcast(room, {
        type: "control-update",
        controller: null,
      });

      return;
    }

    /* control protection */
    if (
      (msg.type === "scroll" ||
        msg.type === "click" ||
        msg.type === "input") &&
      !canControl
    ) {
      return;
    }

    broadcast(
      room,
      {
        ...msg,
        userId: sender.userId,
      },
      ws
    );
  });

  /* =========================
     DISCONNECT
  ========================= */

  ws.on("close", () => {
    globalClients.delete(ws);
    globalUsers.delete(ws);

    broadcastGlobal({
      type: "global-users",
      users: [...globalUsers.values()],
    });

    if (!isInRoom(ws)) return;

    const room = getRoom(ws);
    if (!room) return;

    const user = room.users.get(ws);

    room.clients.delete(ws);
    room.users.delete(ws);

    /* delete empty room */
    if (room.clients.size === 0) {
      delete rooms[ws.state.roomId];
      console.log(`Deleted empty room ${ws.state.roomId}`);
      return;
    }

    /* streamer reassignment */
    if (user?.role === "streamer") {
      const nextEntry = [...room.users.entries()][0];

      if (nextEntry) {
        const [nextWs, nextUser] = nextEntry;

        nextUser.role = "streamer";
        room.users.set(nextWs, nextUser);

        nextWs.send(
          JSON.stringify({
            type: "role-update",
            newRole: "streamer",
          })
        );

        broadcast(
          room,
          {
            type: "room-users",
            users: [...room.users.values()],
          },
          nextWs
        );
      }
    } else {
      broadcast(room, {
        type: "room-users",
        users: [...room.users.values()],
      });
    }
  });
});