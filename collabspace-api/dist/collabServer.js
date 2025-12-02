import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
async function loadSetupWSConnection() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const utilsPath = pathToFileURL(path.resolve(__dirname, '../node_modules/y-websocket/bin/utils.js')).href;
    const mod = (await import(utilsPath));
    return mod.setupWSConnection;
}
export async function startCollaborationServer(port, host = '0.0.0.0') {
    const setupWSConnection = await loadSetupWSConnection();
    const server = http.createServer((_, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('CollabSpace Yjs server running');
    });
    const wss = new WebSocketServer({ server });
    wss.on('connection', (ws, req) => {
        setupWSConnection(ws, req);
    });
    await new Promise((resolve) => {
        server.listen(port, host, () => {
            console.log(`Collaboration server ready at ws://${host}:${port}`);
            resolve();
        });
    });
    return { server, wss };
}
