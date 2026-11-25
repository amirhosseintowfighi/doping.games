// A small stand-in for the RouterOS v7 REST API (HTTPS, self-signed certificate, Basic auth).
// Enough of /rest for the panel: system resource, WireGuard interface + peers, simple queues, address lists.
// Test hook: POST /__traffic {"name":"dp-<sub>","up":n,"down":n} adds bytes to a queue counter.
const https = require('node:https');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function selfSigned() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ros-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${dir}/k.pem`, '-out', `${dir}/c.pem`, '-days', '2', '-subj', '/CN=routeros-mock'], { stdio: 'ignore' });
  return { key: fs.readFileSync(`${dir}/k.pem`), cert: fs.readFileSync(`${dir}/c.pem`) };
}

function startRouterOS({ user = 'doping-api', pass, port = 0 } = {}) {
  const state = { peers: [], queues: [], lists: [], seq: 1, calls: [] };
  const id = () => `*${(state.seq++).toString(16).toUpperCase()}`;
  const table = (p) => (p.startsWith('/interface/wireguard/peers') ? state.peers : p.startsWith('/queue/simple') ? state.queues : p.startsWith('/ip/firewall/address-list') ? state.lists : null);
  const server = https.createServer(selfSigned(), (req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const url = new URL(req.url, 'https://x');
      const send = (code, json) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(json)); };
      if (url.pathname === '/__traffic') {
        const b = JSON.parse(body);
        const q = state.queues.find((x) => x.name === b.name);
        if (!q) return send(404, {});
        const [u, d] = q.bytes.split('/').map(Number);
        q.bytes = `${u + (b.up ?? 0)}/${d + (b.down ?? 0)}`;
        const targets = q.target.split(',');
        for (const peer of state.peers.filter((p) => targets.includes(p['allowed-address']))) peer['last-handshake'] = '12s';
        return send(200, q);
      }
      const auth = Buffer.from((req.headers.authorization ?? '').replace('Basic ', ''), 'base64').toString();
      if (auth !== `${user}:${pass}`) return send(401, { error: 401, message: 'Unauthorized' });
      const p = url.pathname.replace(/^\/rest/, '');
      state.calls.push(`${req.method} ${p}`);
      const json = body ? JSON.parse(body) : {};
      const filter = (list) => list.filter((row) => [...url.searchParams].every(([k, v]) => k.startsWith('.') || row[k] === v));
      if (p === '/system/resource') return send(200, { version: '7.19.4', 'cpu-load': '7', 'free-memory': '700000000', 'total-memory': '1000000000', uptime: '3d4h', 'board-name': 'CHR' });
      if (p === '/interface/wireguard') return send(200, [{ '.id': '*1', name: url.searchParams.get('name'), 'public-key': 'U2VydmVyUHVibGljS2V5Rm9yVGVzdHMwMDAwMDAwMDA=', 'listen-port': '51820', running: 'true' }]);
      if (p === '/queue/simple/reset-counters') {
        const q = state.queues.find((x) => x['.id'] === json['.id']);
        if (q) q.bytes = '0/0';
        return send(200, []);
      }
      const list = table(p);
      if (!list) return send(404, { error: 404, message: 'no such command' });
      const rowId = p.split('/').pop();
      if (req.method === 'GET') return send(200, filter(list));
      if (req.method === 'POST' && p.endsWith('/add') && list === state.lists && list.some((r) => r.list === json.list && r.address === json.address)) {
        return send(400, { error: 400, message: 'Bad Request', detail: 'failure: already have such entry' });
      }
      if (req.method === 'POST' && p.endsWith('/add')) {
        const row = { '.id': id(), disabled: 'false', ...(list === state.queues ? { bytes: '0/0' } : {}), ...json };
        list.push(row);
        return send(201, { ret: row['.id'] });
      }
      const row = list.find((r) => r['.id'] === rowId);
      if (!row) return send(404, { error: 404, message: 'no such item' });
      if (req.method === 'PATCH') { Object.assign(row, json); return send(200, row); }
      if (req.method === 'DELETE') { list.splice(list.indexOf(row), 1); return send(204, null); }
      return send(400, {});
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ port: server.address().port, state, close: () => server.close() })));
}

module.exports = { startRouterOS };
