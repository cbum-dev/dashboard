import http from 'http';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as map from 'lib0/map';

const docs: Map<string, WSSharedDoc> = new Map();

class WSSharedDoc extends Y.Doc {
  name: string;
  connections: Map<any, Set<number>>;
  awareness: awarenessProtocol.Awareness;

  constructor(name: string) {
    super({ gc: true });
    this.name = name;
    this.connections = new Map();
    this.awareness = new awarenessProtocol.Awareness(this);
  }
}

const messageSync = 0;
const messageAwareness = 1;

function getYDoc(docname: string): WSSharedDoc {
  return map.setIfUndefined(docs, docname, () => new WSSharedDoc(docname));
}

function setupWSConnection(conn: any, req: any, docName = 'default') {
  conn.binaryType = 'arraybuffer';
  const doc = getYDoc(docName);
  const connId = Math.random();

  doc.connections.set(conn, new Set());

  conn.on('message', (message: ArrayBuffer) => {
    try {
      const encoder = encoding.createEncoder();
      const decoder = decoding.createDecoder(new Uint8Array(message));
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case messageSync:
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
          if (encoding.length(encoder) > 1) {
            conn.send(encoding.toUint8Array(encoder));
          }
          break;
        case messageAwareness:
          awarenessProtocol.applyAwarenessUpdate(
            doc.awareness,
            decoding.readVarUint8Array(decoder),
            conn
          );
          break;
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  conn.on('close', () => {
    doc.connections.delete(conn);
    doc.awareness.setLocalState(null);
    if (doc.connections.size === 0) {
      docs.delete(doc.name);
    }
  });

  // Send sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  conn.send(encoding.toUint8Array(encoder));

  // Send awareness states
  const awarenessStates = doc.awareness.getStates();
  if (awarenessStates.size > 0) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys()))
    );
    conn.send(encoding.toUint8Array(encoder));
  }
}

export async function startCollaborationServer(port: number, host = '0.0.0.0') {
  const server = http.createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CollabSpace Yjs server running');
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const docName = req.url?.slice(1) || 'default';
    setupWSConnection(ws, req, docName);
  });

  await new Promise<void>((resolve) => {
    server.listen(port, host, () => {
      console.log(`Collaboration server ready at ws://${host}:${port}`);
      resolve();
    });
  });

  return { server, wss };
}