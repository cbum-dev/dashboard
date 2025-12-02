declare module 'y-websocket/bin/utils.js' {
  import type { IncomingMessage } from 'http';
  import type WebSocket from 'ws';

  export function setupWSConnection(
    connection: WebSocket,
    request: IncomingMessage,
    options?: Record<string, unknown>
  ): void;
}
