// Live Session Tracker
(function() {
  const SOCKET_URL = 'http://localhost:3001';

  // Load scripts
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function init() {
    try {
      // Load dependencies
      await loadScript('https://cdn.jsdelivr.net/npm/rrweb@latest/dist/rrweb-all.min.js');
      await loadScript('https://cdn.socket.io/4.7.5/socket.io.min.js');

      // Get or create session ID (persists across page navigation)
      let sessionId = sessionStorage.getItem('live_session_id');
      if (!sessionId) {
        sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('live_session_id', sessionId);
      }

      const socket = io(SOCKET_URL);

      socket.on('connect', () => {
        console.log('Live tracking started:', sessionId);
        socket.emit('join-session', sessionId);

        // Record everything and stream it live
        window.rrweb.record({
          emit(event) {
            socket.emit('user-action', {
              sessionId: sessionId,
              event: event,
              timestamp: Date.now()
            });
          },
          sampling: {
            scroll: 150,
            input: 'last'
          }
        });
      });
    } catch (err) {
      console.error('Tracker failed to load:', err);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
