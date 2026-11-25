// Stand-ins for the outgoing channels, so the e2e suite can read the codes and links the app sends:
// a minimal SMTP server, the two Kavenegar endpoints and the Telegram Bot API calls the app uses.
const http = require('node:http');
const net = require('node:net');

/** Decodes a quoted-printable MIME body enough to find links and codes in it. */
const unQp = (s) => s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

function startSmtp(port) {
  const mails = [];
  const server = net.createServer((sock) => {
    let buf = '';
    let data = false;
    let msg = { from: '', to: [], raw: '' };
    sock.write('220 smtp-mock ESMTP\r\n');
    sock.on('data', (chunk) => {
      buf += chunk.toString('latin1');
      for (;;) {
        if (data) {
          const end = buf.indexOf('\r\n.\r\n');
          if (end < 0) return;
          msg.raw = Buffer.from(buf.slice(0, end), 'latin1').toString('utf8');
          msg.text = unQp(msg.raw);
          mails.push(msg);
          msg = { from: '', to: [], raw: '' };
          buf = buf.slice(end + 5);
          data = false;
          sock.write('250 OK queued\r\n');
          continue;
        }
        const nl = buf.indexOf('\r\n');
        if (nl < 0) return;
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') sock.write('250-smtp-mock\r\n250 8BITMIME\r\n');
        else if (cmd === 'MAIL') { msg.from = line; sock.write('250 OK\r\n'); }
        else if (cmd === 'RCPT') { msg.to.push(line.replace(/^.*<(.*)>.*$/, '$1')); sock.write('250 OK\r\n'); }
        else if (cmd === 'DATA') { data = true; sock.write('354 go ahead\r\n'); }
        else if (cmd === 'QUIT') { sock.end('221 bye\r\n'); return; }
        else sock.write('250 OK\r\n');
      }
    });
    sock.on('error', () => {});
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ mails, close: () => server.close() })));
}

function startKavenegar(port) {
  const sms = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const p = new URLSearchParams(body);
      const kind = req.url.includes('/verify/lookup') ? 'otp' : 'sms';
      sms.push({ kind, to: p.get('receptor'), text: p.get('message') ?? '', token: p.get('token') ?? '' });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ return: { status: 200, message: 'تایید شد' }, entries: [] }));
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ sms, close: () => server.close() })));
}

function startTelegram(port) {
  // update_id grows across runs like the real API, so an offset stored by an earlier run never hides new updates.
  const state = { updates: [], sent: [], seq: Date.now() };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const j = body ? JSON.parse(body) : {};
      const method = req.url.split('/').pop();
      const send = (result) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, result })); };
      if (method === 'getUpdates') return send(state.updates.filter((u) => u.update_id >= (j.offset ?? 0)));
      if (method === 'sendMessage') { state.sent.push({ chat: String(j.chat_id), text: j.text }); return send({ message_id: state.seq++ }); }
      res.writeHead(404); res.end('{"ok":false}');
    });
  });
  /** Simulates a user typing `text` to the bot. */
  const say = (chatId, text) => state.updates.push({ update_id: state.seq++, message: { chat: { id: chatId, type: 'private' }, text } });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ state, say, close: () => server.close() })));
}

module.exports = { startSmtp, startKavenegar, startTelegram };
