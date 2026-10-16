const express = require('express');
const { createServer } = require('http');
const WebSocket = require('ws');

const app = express();
const server = createServer(app);
const port = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('EfsunX Server çalışıyor!'));

const wss = new WebSocket.Server({ server, path: '/ws' });

const players = new Map(); // id -> { ws, x, y, face, name, lvl, cls, king, hp, maxhp }

wss.on('connection', (ws, req) => {
  const id = Math.random().toString(36).slice(2, 9);
  players.set(id, {
    ws,
    x: 20000, y: 20180,
    face: 1,
    name: 'Oyuncu', lvl: 1, cls: 'warrior', king: 0,
    hp: 100, maxhp: 100
  });
  console.log(`✅ Bağlandı: ${id} (toplam: ${players.size})`);

  // Yeni oyuncuya hoş geldin + mevcut oyuncuları gönder
  ws.send(JSON.stringify({
    type: 'welcome',
    id,
    players: [...players.entries()].map(([pid, p]) => ({
      id: pid, x: p.x, y: p.y, face: p.face,
      name: p.name, lvl: p.lvl, cls: p.cls, king: p.king,
      hp: p.hp, maxhp: p.maxhp
    }))
  }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    const me = players.get(id);
    if (!me) return;

    if (msg.type === 'move') {
      me.x = msg.x; me.y = msg.y; me.face = msg.face || 1;
      if (msg.name) me.name = String(msg.name).slice(0, 16);
      if (msg.lvl !== undefined) me.lvl = msg.lvl;
      if (msg.cls) me.cls = msg.cls;
      if (msg.king !== undefined) me.king = msg.king;
      if (msg.hp !== undefined) me.hp = msg.hp;
      if (msg.maxhp !== undefined) me.maxhp = msg.maxhp;
      broadcast({
        type: 'player', id, x: me.x, y: me.y, face: me.face,
        name: me.name, lvl: me.lvl, cls: me.cls, king: me.king,
        hp: me.hp, maxhp: me.maxhp
      }, id);
    } else if (msg.type === 'chat') {
      broadcast({ type: 'chat', id, name: me.name, lvl: me.lvl, text: String(msg.text).slice(0, 120) });
    } else if (msg.type === 'attack') {
      // Görsel efekt paylaşımı (yerel görsel için)
      broadcast({ type: 'attack', id, x: msg.x, y: msg.y, dmg: msg.dmg, kind: msg.kind, c: msg.c }, id);
    } else if (msg.type === 'stoneHit') {
      // Metin taşına vuruldu - tüm oyunculara bildir
      broadcast({ type: 'stoneHit', id, stoneIdx: msg.stoneIdx, dmg: msg.dmg, x: msg.x, y: msg.y }, id);
    } else if (msg.type === 'stoneDead') {
      broadcast({ type: 'stoneDead', id, stoneIdx: msg.stoneIdx, x: msg.x, y: msg.y }, id);
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ type: 'leave', id });
    console.log(`❌ Ayrıldı: ${id} (kalan: ${players.size - 1})`);
  });
});

function broadcast(obj, exceptId) {
  const data = JSON.stringify(obj);
  for (const [pid, p] of players) {
    if (pid === exceptId) continue;
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(data);
  }
}

server.listen(port, () => console.log(`🚀 Sunucu ${port} portunda hazır`));
