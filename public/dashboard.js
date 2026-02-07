// Auto-detect server URL
const SOCKET_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : window.location.origin;
const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity
});
const sessions = new Map();
let currentReplayer = null;
let currentSession = null;
let totalEvents = 0;
let totalSessionsCount = 0;

// Update install code with correct URL
const installCodeEl = document.getElementById('install-code');
if (installCodeEl) {
  const trackerUrl = SOCKET_URL + '/src/tracker.js';
  installCodeEl.textContent = `<script src="${trackerUrl}"></script>`;
}

socket.on('connect', () => {
  console.log('Dashboard connected to server');
  socket.emit('watch-sessions');
});

socket.on('disconnect', () => {
  console.log('Dashboard disconnected from server');
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Dashboard reconnected after', attemptNumber, 'attempts');
  // Re-request active sessions after reconnection
  socket.emit('watch-sessions');
});

// Receive list of active sessions when dashboard connects
socket.on('active-sessions', (data) => {
  const { sessions: activeSessions } = data;
  console.log('Received active sessions:', activeSessions);
  activeSessions.forEach(sessionId => {
    if (!sessions.has(sessionId)) {
      addSession(sessionId);
    }
  });
});

// New session joined
socket.on('session-joined', (data) => {
  const { sessionId } = data;
  if (!sessions.has(sessionId)) {
    addSession(sessionId);
  }
});

socket.on('live-event', (data) => {
  const { sessionId, event } = data;

  if (!sessions.has(sessionId)) {
    addSession(sessionId);
  }

  const sessionData = sessions.get(sessionId);
  sessionData.events.push(event);
  sessionData.lastActivity = Date.now();
  totalEvents++;

  // Update preview replayer
  if (sessionData.replayer) {
    sessionData.replayer.addEvent(event);
  }

  updateCount();
});

function addSession(sessionId) {
  const shortId = sessionId.replace('session_', '').substring(0, 8).toUpperCase();

  if (!sessions.has(sessionId)) {
    totalSessionsCount++;
  }

  sessions.set(sessionId, {
    id: sessionId,
    shortId: shortId,
    events: [],
    startTime: Date.now(),
    lastActivity: Date.now(),
    replayer: null
  });

  const bar = document.getElementById('sessions-bar');
  const empty = bar.querySelector('.empty');
  if (empty) empty.remove();

  const card = document.createElement('div');
  card.className = 'session-card';
  card.dataset.sessionId = sessionId;
  card.innerHTML = `
    <div class="session-preview" id="preview-${sessionId}">
      <div class="live-dot"></div>
    </div>
    <div class="session-info">
      <div class="session-id">${shortId}</div>
      <div class="session-status">NOW</div>
    </div>
  `;

  bar.appendChild(card);

  // Create mini replayer for preview
  const previewEl = document.getElementById(`preview-${sessionId}`);
  const sessionData = sessions.get(sessionId);
  sessionData.replayer = new rrweb.Replayer([], {
    liveMode: true,
    root: previewEl,
    speed: 1,
    showDebug: false,
    skipInactive: true,
    UNSAFE_replayCanvas: true,
    mouseTail: false,
    insertStyleRules: [
      '.replayer-mouse { display: none !important; }',
      '.replayer-mouse-tail { display: none !important; }'
    ]
  });
  sessionData.replayer.startLive(Date.now() - 300);

  // Click to expand
  card.onclick = () => {
    const wasExpanded = card.classList.contains('expanded');

    // Collapse all cards
    document.querySelectorAll('.session-card').forEach(c => {
      c.classList.remove('expanded');
    });

    // Expand this card if it wasn't already expanded
    if (!wasExpanded) {
      card.classList.add('expanded');

      // Recreate replayer with better settings for expanded view
      setTimeout(() => {
        const previewEl = document.getElementById(`preview-${sessionId}`);
        const sessionData = sessions.get(sessionId);

        if (sessionData.replayer) {
          sessionData.replayer.pause();
        }

        // Clear the preview element
        previewEl.innerHTML = '<div class="live-dot"></div>';

        // Create new replayer for expanded view
        sessionData.replayer = new rrweb.Replayer(sessionData.events, {
          liveMode: true,
          root: previewEl,
          speed: 1,
          showDebug: false,
          skipInactive: true,
          UNSAFE_replayCanvas: true,
          mouseTail: false,
          insertStyleRules: [
            '.replayer-mouse { display: none !important; }',
            '.replayer-mouse-tail { display: none !important; }'
          ]
        });
        sessionData.replayer.startLive(Date.now() - 300);
      }, 100);
    } else {
      // Recreate replayer for normal view
      setTimeout(() => {
        const previewEl = document.getElementById(`preview-${sessionId}`);
        const sessionData = sessions.get(sessionId);

        if (sessionData.replayer) {
          sessionData.replayer.pause();
        }

        // Clear the preview element
        previewEl.innerHTML = '<div class="live-dot"></div>';

        // Create new replayer for normal view
        sessionData.replayer = new rrweb.Replayer(sessionData.events, {
          liveMode: true,
          root: previewEl,
          speed: 1,
          showDebug: false,
          skipInactive: true,
          UNSAFE_replayCanvas: true,
          mouseTail: false,
          insertStyleRules: [
            '.replayer-mouse { display: none !important; }',
            '.replayer-mouse-tail { display: none !important; }'
          ]
        });
        sessionData.replayer.startLive(Date.now() - 300);
      }, 100);
    }
  };
}


function updateCount() {
  const activeCount = sessions.size;
  document.getElementById('active-count').textContent = activeCount;
  document.getElementById('total-sessions').textContent = totalSessionsCount;
  document.getElementById('total-events').textContent = totalEvents.toLocaleString();
}

setInterval(() => {
  const now = Date.now();
  sessions.forEach((data, id) => {
    const card = document.querySelector(`[data-session-id="${id}"]`);
    if (card) {
      const elapsed = Math.floor((now - data.lastActivity) / 1000);
      const status = card.querySelector('.session-status');
      if (elapsed < 5) {
        status.textContent = 'NOW';
      } else if (elapsed < 60) {
        status.textContent = `${elapsed}S`;
      } else {
        status.textContent = `${Math.floor(elapsed / 60)}M`;
      }
    }
  });
}, 1000);
