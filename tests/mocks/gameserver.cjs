// A fake Source server: answers A2S_INFO / A2S_PLAYER (with the challenge handshake) on UDP and
// speaks Source RCON on TCP, both on the same port, like a real CS2 server.
const dgram = require('node:dgram');
const net = require('node:net');

function str(s) { return Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]); }

function startGameServer({ password = 'rcon-secret', map = 'de_mirage', players = [{ name: 'Arash_AWP', score: 21, time: 900 }, { name: 'Sina', score: 9, time: 600 }], port = 0 } = {}) {
  const state = { map, players, commands: [] };
  const challenge = Buffer.from([0x11, 0x22, 0x33, 0x44]);
  const udp = dgram.createSocket('udp4');
  udp.on('message', (msg, rinfo) => {
    const head = Buffer.from([0xff, 0xff, 0xff, 0xff]);
    const reply = (b) => udp.send(Buffer.concat([head, b]), rinfo.port, rinfo.address);
    const type = msg[4];
    const hasChallenge = (offset) => msg.length >= offset + 4 && msg.subarray(offset, offset + 4).equals(challenge);
    if (type === 0x54) {
      if (!hasChallenge(25)) return reply(Buffer.concat([Buffer.from([0x41]), challenge]));
      const b = Buffer.concat([Buffer.from([0x49, 17]), str('Doping Retake #1'), str(state.map), str('cs2'), str('Counter-Strike 2'), Buffer.from([0xda, 0x02, state.players.length, 10, 0])]);
      return reply(b);
    }
    if (type === 0x55) {
      if (!hasChallenge(5)) return reply(Buffer.concat([Buffer.from([0x41]), challenge]));
      const parts = [Buffer.from([0x44, state.players.length])];
      state.players.forEach((p, i) => {
        const n = Buffer.alloc(8); n.writeInt32LE(p.score, 0); n.writeFloatLE(p.time, 4);
        parts.push(Buffer.from([i]), str(p.name), n);
      });
      return reply(Buffer.concat(parts));
    }
  });
  const pkt = (id, type, body) => {
    const b = Buffer.from(body, 'utf8');
    const out = Buffer.alloc(14 + b.length);
    out.writeInt32LE(10 + b.length, 0); out.writeInt32LE(id, 4); out.writeInt32LE(type, 8); b.copy(out, 12);
    return out;
  };
  const tcp = net.createServer((sock) => {
    let buf = Buffer.alloc(0);
    sock.on('data', (c) => {
      buf = Buffer.concat([buf, c]);
      while (buf.length >= 4 && buf.length >= 4 + buf.readInt32LE(0)) {
        const size = buf.readInt32LE(0);
        const id = buf.readInt32LE(4); const type = buf.readInt32LE(8);
        const body = buf.toString('utf8', 12, 4 + size - 2);
        buf = buf.subarray(4 + size);
        if (type === 3) { sock.write(pkt(id, 0, '')); sock.write(pkt(body === password ? id : -1, 2, '')); continue; }
        if (type === 0) { sock.write(pkt(id, 0, '')); continue; }
        state.commands.push(body);
        let out = `Unknown command "${body}"`;
        const [name, arg] = body.split(/\s+/);
        if (name === 'status') out = `hostname: Doping Retake #1\nmap     : ${state.map}\nplayers : ${state.players.length} humans, 0 bots (10 max)`;
        if (name === 'changelevel') { state.map = arg; out = `Changing level to ${arg}`; }
        if (name === 'say') out = `Console: ${body.slice(4)}`;
        if (name === 'kick') { const who = body.slice(5).replace(/"/g, ''); state.players = state.players.filter((p) => p.name !== who); out = `Kicked ${who}`; }
        sock.write(pkt(id, 0, out));
      }
    });
  });
  return new Promise((resolve) => {
    tcp.listen(port, '127.0.0.1', () => {
      const p = tcp.address().port;
      udp.bind(p, '127.0.0.1', () => resolve({ port: p, state, close: () => { tcp.close(); udp.close(); } }));
    });
  });
}

module.exports = { startGameServer };
