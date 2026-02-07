const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/src', express.static(path.join(__dirname, '../src')));

const sessions = new Map();
const activeSessions = new Set();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    socket.sessionId = sessionId;

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }

    // Mark session as active
    activeSessions.add(sessionId);

    console.log(`Session ${sessionId} joined`);

    // Notify dashboard that a new session joined
    io.to('dashboard').emit('session-joined', { sessionId });
  });

  socket.on('user-action', (data) => {
    const { sessionId, event } = data;
    console.log('User action received:', sessionId, 'Event type:', event.type);

    // Broadcast to ALL dashboard viewers
    io.to('dashboard').emit('live-event', {
      sessionId,
      event
    });

    // Store event
    if (sessions.has(sessionId)) {
      sessions.get(sessionId).push(event);
    } else {
      sessions.set(sessionId, [event]);
    }

    // Mark session as active
    activeSessions.add(sessionId);
  });

  socket.on('watch-sessions', () => {
    socket.join('dashboard');
    console.log('Dashboard viewer connected');

    // Send all active sessions to new dashboard viewer
    const activeSessionsList = Array.from(activeSessions);
    socket.emit('active-sessions', { sessions: activeSessionsList });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // If this was a session client, remove from active sessions
    if (socket.sessionId && activeSessions.has(socket.sessionId)) {
      // Check if any other socket is still in this session room
      const room = io.sockets.adapter.rooms.get(socket.sessionId);
      if (!room || room.size === 0) {
        console.log(`Session ${socket.sessionId} ended`);
        activeSessions.delete(socket.sessionId);
      }
    }
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🟢 Live Session Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`\n📝 Add to your site: <script src="http://localhost:${PORT}/src/tracker.js"></script>\n`);
});
