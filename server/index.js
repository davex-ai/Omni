const express = require("express");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
app.use(cors());

const server = app.listen(3001, () => {
  console.log("Server running on port 3001");
});

const wss = new WebSocket.Server({ server });

let clients = [];

wss.on("connection", (ws) => {
  console.log("New client connected");
  clients.push(ws);

  ws.on("message", (data) => {
    // Broadcast to everyone except sender
    clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });

  ws.on("close", () => {
    clients = clients.filter((c) => c !== ws);
    console.log("Client disconnected");
  });
});