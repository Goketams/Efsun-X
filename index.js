const express = require('express');
const { createServer } = require('http');
const WebSocket = require('ws');

const app = express();
const server = createServer(app);
const port = process.env.PORT || 10000;

// Sağlık kontrolü için basit HTTP endpoint
app.get('/', (req, res) => res.send('EfsunX Server çalışıyor!'));

const wss = new WebSocket.Server({ server, path: '/ws' });

const players = new Map(); // id -> { ws, x, y, name, ... }

wss.on('connection', (ws, req) => {
  const id = Math.random().toString(36).slice(2, 9);
  players.set(id, { ws, x: 20000, y: 20180, name: 'Oyuncu' });
  console.log(`Oyuncu bağlandı: ${id} (toplam: ${players.size})`);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const me = players.get(id);
      if (!me) return;

      if (msg.type === 'move') {
        me.x = msg.x; me.y = msg.y; me.face = msg.face;
        broadcast({ type: 'player', id, x: me.x, y: me.y, face: me.face, name: me.name }, id);
      } else if (msg.type === 'chat') {
        broadcast({ type: 'chat', id, name: me.name, text: msg.text });
      } else if (msg.type === 'voice') {
        // Basit ses paketi yayını (base64/ArrayBuffer)
        broadcast({ type: 'voice', id, data: msg.data }, id);
      }
    } catch (e) { /* geçersiz mesaj */ }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ type: 'leave', id });
    console.log(`Oyuncu ayrıldı: ${id}`);
  });

  // Yeni oyuncuya mevcut oyuncuları gönder
  ws.send(JSON.stringify({
    type: 'welcome',
    id,
    players: [...players.entries()].map(([pid, p]) => ({ id: pid, x: p.x, y: p.y, name: p.name }))
  }));
});

function broadcast(obj, exceptId) {
  const data = JSON.stringify(obj);
  for (const [pid, p] of players) {
    if (pid === exceptId) continue;
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(data);
  }
}

server.listen(port, () => console.log(`Sunucu ${port} portunda çalışıyor`));