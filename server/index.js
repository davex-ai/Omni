import cors from "cors";
import express from "express";
import { WebSocketServer } from "ws";

const app = express();
app.use(cors());

const server = app.listen(3001, () => {
  console.log("Server running on port 3001");
});

const wss = new WebSocketServer({ server });

let rooms = {}; // roomId → room object

/*
room = {
  clients: Set(ws),
  users: Map(ws → { userId, role }),
  controller: userId | null
}
*/

wss.on("connection", (ws) => {
  console.log("🔌 Client connected");

  let currentRoom = null;

  ws.on("message", (data) => {
    const msg = JSON.parse(data);

    // ✅ JOIN ROOM
    if (msg.type === "join-room") {
      const { roomId, userId } = msg;

      // ❗ VALIDATION: room must exist
      if (!rooms[roomId]) {
        ws.send(JSON.stringify({
          type: "error",
          message: "Room does not exist"
        }));
        return;
      }

      currentRoom = roomId;
      const room = rooms[roomId];

      const role = room.clients.size === 0 ? "streamer" : "viewer";

      room.clients.add(ws);
      room.users.set(ws, { userId, role });

      ws.send(JSON.stringify({
        type: "init",
        role,
        controller: room.controller
      }));

      console.log(`👤 ${userId} joined ${roomId} as ${role}`);
      return;
    }

    // ✅ CREATE ROOM (NEW)
    if (msg.type === "create-room") {
      const { roomId, userId } = msg;

      rooms[roomId] = {
        clients: new Set(),
        users: new Map(),
        controller: null,
      };

      console.log(`🏠 Room created: ${roomId}`);
      return;
    }

    if (!currentRoom) return;

    const room = rooms[currentRoom];
    const sender = room.users.get(ws);
    if (!sender) return;

    const canControl =
      sender.role === "streamer" ||
      room.controller === sender.userId;

    // ✅ CONTROL
    if (msg.type === "grant-control") {
      if (sender.role !== "streamer") return;

      room.controller = msg.targetUserId;

      broadcast(room, {
        type: "control-update",
        controller: room.controller
      });

      return;
    }

    if (msg.type === "revoke-control") {
      if (sender.role !== "streamer") return;

      room.controller = null;

      broadcast(room, {
        type: "control-update",
        controller: null
      });

      return;
    }

    // ✅ BLOCK UNAUTHORIZED INPUT
    if (["scroll", "cursor", "click"].includes(msg.type)) {
      if (!canControl) return;
    }

    // ✅ ALWAYS INCLUDE USER ID
    const enriched = {
      ...msg,
      userId: sender.userId
    };

    broadcast(room, enriched, ws);
  });

  ws.on("close", () => {
    if (!currentRoom) return;

    const room = rooms[currentRoom];
    if (!room) return;

    const user = room.users.get(ws);

    if (user && user.role === "streamer") {
      const next = [...room.users.values()].find(
        (u) => u.userId !== user.userId
      );

      if (next) {
        broadcast(room, {
          type: "role-update",
          newStreamer: next.userId
        });
      } else {
        delete rooms[currentRoom];
        console.log(`🧹 Deleted empty room ${currentRoom}`);
      }
    }

    room.clients.delete(ws);
    room.users.delete(ws);

    console.log("❌ Client disconnected");
  });
});

function broadcast(room, message, skip = null) {
  const payload = JSON.stringify(message);

  room.clients.forEach((client) => {
    if (client !== skip && client.readyState === 1) {
      client.send(payload);
    }
  });
}