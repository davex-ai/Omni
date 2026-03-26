const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});


// In-memory store (MVP)

const rooms = {};


function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  //CREATE/JOIN ROOM 
  socket.on("create-room", () => {
    const roomId = generateRoomId();
    rooms[roomId] = {
      streamerId: socket.id,
      activeControllerId: null, // New: Tracks the temporary "pilot"
      users: { [socket.id]: { role: "streamer" } }
    };
    socket.join(roomId);
    socket.emit("room-created", { roomId, role: "streamer" });
  });

  socket.on("join-room", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit("error", "Room not found");

    room.users[socket.id] = { role: "viewer" };
    socket.join(roomId);
    socket.emit("room-joined", { roomId, role: "viewer" });
  });

  //  CROWD CONTROL

  // Streamer grants control to a specific viewer
  socket.on("grant-control", ({ roomId, targetUserId }) => {
    const room = rooms[roomId];
    if (!room || room.streamerId !== socket.id) return;

    room.activeControllerId = targetUserId;
    
    // Broadcast to everyone so UI can show "User X is now in control"
    io.to(roomId).emit("control-changed", { 
      controllerId: targetUserId,
      status: "active" 
    });
  });

  // Streamer revokes control instantly
  socket.on("revoke-control", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.streamerId !== socket.id) return;

    room.activeControllerId = null;
    io.to(roomId).emit("control-changed", { 
      controllerId: null,
      status: "idle" 
    });
  });

  //EVENT ROUTING WITH PERMISSIONS 

  socket.on("event", (data) => {
    const { roomId } = data;
    const room = rooms[roomId];
    if (!room) return;

    
    if (socket.id === room.streamerId) {
      socket.to(roomId).emit("event", { ...data, userId: socket.id });
    } 
    
    
    else if (socket.id === room.activeControllerId) {
      io.to(room.streamerId).emit("remote-input", { ...data, userId: socket.id });
    }
    
    
  });

  
  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.users[socket.id]) {
        // If controller dcs, reset control state
        if (room.activeControllerId === socket.id) {
          room.activeControllerId = null;
          io.to(roomId).emit("control-changed", { controllerId: null });
        }
        delete room.users[socket.id];
        
      }
    }
  });
});