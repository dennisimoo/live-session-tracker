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

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }
    console.log(`Session ${sessionId} joined`);
  });

  socket.on('user-action', (data) => {
    const { sessionId, event } = data;
    console.log('User action received:', sessionId);

    // Broadcast to ALL dashboard viewers
    io.to('dashboard').emit('live-event', {
      sessionId,
      event
    });

    // Store event
    if (sessions.has(sessionId)) {
      sessions.get(sessionId).push(event);
    }
  });

  socket.on('watch-sessions', () => {
    socket.join('dashboard');
    console.log('Dashboard viewer connected');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🟢 Live Session Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`\n📝 Add to your site: <script src="http://localhost:${PORT}/src/tracker.js"></script>\n`);
});
