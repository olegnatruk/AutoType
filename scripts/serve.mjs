import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('.');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };
createServer(async (request, response) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!path.startsWith(root + sep)) throw new Error('Outside project');
    response.setHeader('Content-Type', types[extname(path)] || 'text/plain');
    response.end(await readFile(path));
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(8765, '127.0.0.1', () => console.log('AutoType fixtures: http://127.0.0.1:8765/tests/fixture.html'));
