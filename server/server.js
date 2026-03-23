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

// Socket Logic

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

 
  // CREATE ROOM

  socket.on("create-room", () => {
    const roomId = generateRoomId();

    rooms[roomId] = {
      streamerId: socket.id,
      users: {
        [socket.id]: { role: "streamer" }
      }
    };

    socket.join(roomId);

    socket.emit("room-created", {
      roomId,
      role: "streamer"
    });

    console.log(`Room ${roomId} created by ${socket.id}`);
  });


  // JOIN ROOM
  
  socket.on("join-room", ({ roomId }) => {
    const room = rooms[roomId];

    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    room.users[socket.id] = { role: "viewer" };
    socket.join(roomId);

    socket.emit("room-joined", {
      roomId,
      role: "viewer"
    });

    console.log(`${socket.id} joined room ${roomId}`);
  });


  // EVENT ROUTING 

  socket.on("event", (data) => {
    const { roomId } = data;
    const room = rooms[roomId];

    if (!room) return;

    // ONLY streamer can broadcast
    if (room.streamerId !== socket.id) return;

    socket.to(roomId).emit("event", {
      ...data,
      userId: socket.id
    });
  });

  // DISCONNECT
 
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];

      if (room.users[socket.id]) {
        delete room.users[socket.id];

        // If streamer leaves → end room
        if (room.streamerId === socket.id) {
          io.to(roomId).emit("room-ended");
          delete rooms[roomId];

          console.log(`Room ${roomId} ended (streamer left)`);
        }
      }
    }
  });
});

//CHECK SERVER
app.get("/", (req, res) => {
  res.send("Server running");
});


const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});