# 🚀 Omni — Real-Time Collaborative Presence Engine

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=6366f1&height=200&section=header&text=Omni&fontSize=60&fontColor=ffffff" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Realtime-WebSockets-6366f1?style=for-the-badge" />
  <img src="https://img.shields.io/badge/CRDT-Yjs-orange?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Frontend-React-61dafb?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Backend-Node.js-339933?style=for-the-badge" />
</p>

<p align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&size=22&pause=1000&color=6366F1&center=true&vCenter=true&width=600&lines=Multiplayer+Cursor+Tracking;Room-Based+Collaboration;Live+Control+System;Built+for+Scale" />
</p>

---

## 🧠 What is Omni?

Omni is a **real-time presence + control system** where users can:

* 🖱️ See live cursors
* 👥 Join rooms
* 🎮 Control sessions (streamer/viewer system)
* ✍️ Collaborate on shared state (Yjs)
* ⚡ Experience ultra-low latency interactions (If the streamer scrolls, the 1,000+ viewers see the scroll happen in <100ms)

## ✨ Features

### 🌍 Global Lobby

* Live cursor tracking across all users
* Real-time user count
* Click ripple effects

### 🏠 Rooms

* Instant room creation
* Role system:

  * 🎥 Streamer
  * 🎮 Controller
  * 👀 Viewer
* Grant/revoke control dynamically

### ⚡ Real-Time Sync

* Cursor movement (smoothed interpolation)
* Click animations
* Scroll synchronization
* Shared text editing (CRDTs via Yjs)

---

## 🛠️ Tech Stack

```bash
Frontend:
- React
- Custom UI

Backend:
- Node.js
- Express
- ws (WebSocket)

Realtime:
- WebSockets
- Yjs (CRDT engine)
```

---

## 📦 Project Structure

```bash
omni/
├── server/
│   └── index.js
├── client/
│   ├── Home.jsx
│   └── Room.jsx
└── README.md
```

---

## ⚙️ Setup

### 1. Clone

```bash
git clone https://github.com/davex-ai/omni.git
cd omni
```

### 2. Install

```bash
npm install
```

### 3. Run server

```bash
node server/index.js
```

### 4. Run frontend

```bash
npm start
```

---

## 🧭 Architecture

```txt
Client → WebSocket → Server
        ↓
   Mode: Global | Room
        ↓
Global → broadcastGlobal()
Room   → broadcast(room)
```

---

## 🎮 Roles System

| Role          | Power             |
| ------------- | ----------------- |
| 🎥 Streamer   | Full control      |
| 🎮 Controller | Temporary control |
| 👀 Viewer     | Read-only         |

---

## 🧠 Core Concepts

### Cursor Smoothing

```js
x = current.x + (target.x - current.x) * 0.2
```

### Broadcast System

* `broadcastGlobal()` → lobby
* `broadcast(room)` → isolated room

---

## ⚠️ Known Challenges

* WebSocket state transitions
* Global vs Room isolation
* Event leakage prevention
* Presence consistency

---
---

## 💡 Inspiration

> Figma cursor presence
>
> * Twitch-style control
> * Multiplayer web engine

---

## 🧑‍💻 Author

Built by **[Dave](https://github.com/davex-ai) and [Uthman](https://github.com/damini310) — future systems engineer** ⚡

---

## 🧪 Status

```diff
+ Core system: DONE
+ Rooms: DONE
+ Realtime sync: DONE 
```

---

## ⭐ Support

If this project helped or inspired you:

* ⭐ Star the repo
* 🍴 Fork it
* 🧠 Build something insane with it

---

<p align="center">
  <img src="https://media.giphy.com/media/hvRJCLFzcasrR4ia7z/giphy.gif" width="120" />
</p>

---

<p align="center">
  <b>“This isn’t just a project. It’s a real-time systems engine.”</b>
</p>
