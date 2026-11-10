import type { WebSocket, WebSocketServer } from "ws";

interface HeartbeatSocket extends WebSocket {
  isAlive?: boolean;
}

/**
 * Drops WebSocket connections whose other end has silently gone away.
 *
 * A phone that walks out of coverage, switches from Wi-Fi to mobile data,
 * or is put to sleep mid-chat never sends a TCP FIN — so no "close" or
 * "error" event ever fires on the server, and the socket (plus everything
 * the gateway keeps per connection) stays in memory until the process
 * restarts. On the mobile networks this app is built for that is the
 * normal way a chat ends, not an edge case, so without this the number of
 * retained sockets only ever grows.
 *
 * The standard ws ping/pong pattern: every `intervalMs` each client is
 * pinged, and one that hasn't answered the previous ping by then is
 * terminated. Browsers answer protocol-level pings on their own — no
 * client-side change is needed. `terminate()` emits the socket's normal
 * "close" event, so each gateway's existing cleanup still runs.
 */
export function startHeartbeat(
  wss: WebSocketServer,
  intervalMs = 30_000,
): NodeJS.Timeout {
  wss.on("connection", (socket: HeartbeatSocket) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
  });
  const timer = setInterval(() => {
    for (const socket of wss.clients as Set<HeartbeatSocket>) {
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, intervalMs);
  // Never the reason the process stays up during shutdown.
  timer.unref?.();
  wss.on("close", () => clearInterval(timer));
  return timer;
}
