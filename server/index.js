import cors from "cors";
import express from "express";
import { WebSocketServer } from "ws";

const app = express();
app.use(cors());

const server = app.listen(3001, () => {
  console.log("Server running on port 3001");
});

const wss = new WebSocketServer({ server });

let clients = new Map(); // ws -> { userId, role }
let currentController = null;

wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", (data) => {
    const msg = JSON.parse(data);

    // 🟢 JOIN
    if (msg.type === "join") {
      const role = clients.size === 0 ? "streamer" : "viewer";

      clients.set(ws, {
        userId: msg.userId,
        role,
      });

      ws.send(JSON.stringify({ type: "role", role }));
      return;
    }

    const client = clients.get(ws);
    if (!client) return;

    // 🟢 PERMISSION CHECK
    const canControl =
      client.role === "streamer" ||
      (currentController === client.userId);

    // 🟢 CONTROL EVENTS
    if (msg.type === "grant-control") {
      if (client.role !== "streamer") return;

      currentController = msg.targetUserId;

      broadcast({
        type: "control-update",
        controller: currentController,
      });

      return;
    }

    if (msg.type === "revoke-control") {
      if (client.role !== "streamer") return;

      currentController = null;

      broadcast({
        type: "control-update",
        controller: null,
      });

      return;
    }

    // 🟢 BLOCK UNAUTHORIZED USERS
    if (["scroll", "cursor", "click"].includes(msg.type)) {
      if (!canControl) return;

      broadcast(msg, ws);
    }
  });

  ws.on("close", () => {
    const client = clients.get(ws);

    if (client && client.userId === currentController) {
      currentController = null;
    }

    clients.delete(ws);
    console.log("Client disconnected");
  });
});

// 🔥 helper
function broadcast(message, sender = null) {
  clients.forEach((_, clientWs) => {
    if (clientWs !== sender && clientWs.readyState === 1) {
      clientWs.send(JSON.stringify(message));
    }
  });
}