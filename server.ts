import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RoomPeer {
  uid: string;
  displayName: string;
  role: 'guru' | 'chela';
  admitted: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
  handRaised: boolean;
  audioOnly: boolean;
  breakoutRoomId: string;
  socket: WebSocket;
}

interface WhiteboardStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
}

interface PollItem {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, number>;
  status: 'open' | 'closed';
  createdBy: string;
}

interface RoomState {
  isLocked: boolean;
  muteAllActive: boolean;
  activeMode: 'video' | 'screenshare' | 'whiteboard';
  breakoutActive: boolean;
  recordingActive: boolean;
}

interface RoomContainer {
  peers: Map<string, RoomPeer>;
  strokes: WhiteboardStroke[];
  polls: PollItem[];
  roomState: RoomState;
}

const rooms = new Map<string, RoomContainer>();

function getOrCreateRoom(roomId: string): RoomContainer {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      peers: new Map(),
      strokes: [],
      polls: [],
      roomState: {
        isLocked: false,
        muteAllActive: false,
        activeMode: 'video',
        breakoutActive: false,
        recordingActive: false,
      },
    };
    rooms.set(roomId, room);
  }
  return room;
}

function serializePeer(p: RoomPeer) {
  return {
    uid: p.uid,
    displayName: p.displayName,
    role: p.role,
    admitted: p.admitted,
    isMuted: p.isMuted,
    isVideoOn: p.isVideoOn,
    handRaised: p.handRaised,
    audioOnly: p.audioOnly,
    breakoutRoomId: p.breakoutRoomId,
  };
}

function serializeAdmittedPeers(room: RoomContainer) {
  return Array.from(room.peers.values())
    .filter((p) => p.admitted)
    .map(serializePeer);
}

function serializeWaitingPeers(room: RoomContainer) {
  return Array.from(room.peers.values())
    .filter((p) => !p.admitted)
    .map(serializePeer);
}

function broadcastAdmitted(room: RoomContainer, payload: unknown) {
  const raw = JSON.stringify(payload);
  for (const peer of room.peers.values()) {
    if (peer.admitted && peer.socket.readyState === WebSocket.OPEN) {
      peer.socket.send(raw);
    }
  }
}

function notifyGurus(room: RoomContainer, payload: unknown) {
  const raw = JSON.stringify(payload);
  for (const peer of room.peers.values()) {
    if (peer.role === 'guru' && peer.socket.readyState === WebSocket.OPEN) {
      peer.socket.send(raw);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'SOHBAT',
      provider: process.env.VITE_VIDEO_PROVIDER || 'cloudflare-webrtc',
    });
  });

  app.get('/api/video-config', (_req, res) => {
    res.json({
      provider: process.env.VITE_VIDEO_PROVIDER || 'cloudflare-webrtc',
      livekitUrl: process.env.LIVEKIT_URL || null,
    });
  });

  // Cloudflare Realtime TURN free tier proxy (server-side keeps API token secure)
  app.get('/api/ice-servers', async (_req, res) => {
    const tokenId = process.env.CLOUDFLARE_TURN_TOKEN_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (tokenId && apiToken) {
      try {
        const cfRes = await fetch(
          `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(tokenId)}/credentials/generate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ttl: 86400 }),
          }
        );
        if (cfRes.ok) {
          const data = await cfRes.json();
          res.json(data);
          return;
        }
      } catch {
        // Fallback to STUN below
      }
    }

    res.json({
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (socket: WebSocket, _req: http.IncomingMessage, roomId: string) => {
    const room = getOrCreateRoom(roomId);
    let attachedUid: string | null = null;

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'join') {
          attachedUid = String(msg.uid || '').slice(0, 128);
          if (!attachedUid) return;

          const peer: RoomPeer = {
            uid: attachedUid,
            displayName: String(msg.displayName || 'Sadhak').slice(0, 80),
            role: msg.role === 'guru' ? 'guru' : 'chela',
            admitted: msg.role === 'guru' || Boolean(msg.admitted),
            isMuted: Boolean(msg.isMuted),
            isVideoOn: msg.isVideoOn !== false,
            handRaised: false,
            audioOnly: Boolean(msg.audioOnly),
            breakoutRoomId: 'main',
            socket,
          };

          room.peers.set(attachedUid, peer);

          socket.send(
            JSON.stringify({
              type: 'room:init',
              roomState: room.roomState,
              strokes: room.strokes,
              polls: room.polls,
              peers: serializeAdmittedPeers(room),
              waiting: serializeWaitingPeers(room),
            })
          );

          if (peer.admitted) {
            broadcastAdmitted(room, {
              type: 'peer:joined',
              peer: serializePeer(peer),
            });
          } else {
            notifyGurus(room, {
              type: 'pratiksha:updated',
              waiting: serializeWaitingPeers(room),
            });
          }
          return;
        }

        if (!attachedUid) return;
        const sender = room.peers.get(attachedUid);
        if (!sender) return;

        switch (msg.type) {
          case 'signal': {
            const target = room.peers.get(String(msg.toUid));
            if (target && target.admitted && sender.admitted && target.socket.readyState === WebSocket.OPEN) {
              target.socket.send(
                JSON.stringify({
                  type: 'signal',
                  fromUid: sender.uid,
                  data: msg.data,
                })
              );
            }
            break;
          }
          case 'pratiksha:admit': {
            if (sender.role !== 'guru') return;
            const target = room.peers.get(String(msg.targetUid));
            if (target) {
              target.admitted = true;
              if (target.socket.readyState === WebSocket.OPEN) {
                target.socket.send(JSON.stringify({ type: 'pratiksha:admitted' }));
              }
              broadcastAdmitted(room, {
                type: 'peer:joined',
                peer: serializePeer(target),
              });
              notifyGurus(room, {
                type: 'pratiksha:updated',
                waiting: serializeWaitingPeers(room),
              });
            }
            break;
          }
          case 'pratiksha:reject': {
            if (sender.role !== 'guru') return;
            const target = room.peers.get(String(msg.targetUid));
            if (target) {
              if (target.socket.readyState === WebSocket.OPEN) {
                target.socket.send(JSON.stringify({ type: 'pratiksha:rejected' }));
              }
              target.socket.close(4003, 'Rejected by Guru');
              room.peers.delete(target.uid);
              notifyGurus(room, {
                type: 'pratiksha:updated',
                waiting: serializeWaitingPeers(room),
              });
            }
            break;
          }
          case 'peer:state': {
            if (!sender.admitted) return;
            sender.isMuted = Boolean(msg.isMuted);
            sender.isVideoOn = Boolean(msg.isVideoOn);
            sender.handRaised = Boolean(msg.handRaised);
            sender.audioOnly = Boolean(msg.audioOnly);
            broadcastAdmitted(room, {
              type: 'peer:updated',
              peer: serializePeer(sender),
            });
            break;
          }
          case 'arz:message': {
            if (!sender.admitted) return;
            const text = String(msg.text || '').trim().slice(0, 1000);
            if (!text) return;
            broadcastAdmitted(room, {
              type: 'arz:message',
              message: {
                id: String(msg.id || crypto.randomUUID()),
                senderUid: sender.uid,
                senderName: sender.displayName,
                senderRole: sender.role,
                text,
                createdAt: new Date().toISOString(),
              },
            });
            break;
          }
          case 'reaction:send': {
            if (!sender.admitted) return;
            broadcastAdmitted(room, {
              type: 'reaction:send',
              id: crypto.randomUUID(),
              emoji: String(msg.emoji || '🙏').slice(0, 12),
              senderName: sender.displayName,
            });
            break;
          }
          case 'aashirvad:shower': {
            if (sender.role !== 'guru') return;
            broadcastAdmitted(room, {
              type: 'aashirvad:shower',
              fromName: sender.displayName,
              timestamp: Date.now(),
            });
            break;
          }
          case 'shyaam-pat:stroke': {
            if (sender.role !== 'guru') return;
            const stroke = msg.stroke as WhiteboardStroke;
            if (stroke && Array.isArray(stroke.points)) {
              room.strokes.push(stroke);
              if (room.strokes.length > 500) room.strokes.shift();
              broadcastAdmitted(room, { type: 'shyaam-pat:stroke', stroke });
            }
            break;
          }
          case 'shyaam-pat:clear': {
            if (sender.role !== 'guru') return;
            room.strokes = [];
            broadcastAdmitted(room, { type: 'shyaam-pat:clear' });
            break;
          }
          case 'host:control': {
            if (sender.role !== 'guru') return;
            if (msg.action === 'mute-all') {
              room.roomState.muteAllActive = Boolean(msg.value);
              for (const p of room.peers.values()) {
                if (p.role !== 'guru' && p.admitted) {
                  p.isMuted = true;
                }
              }
              broadcastAdmitted(room, {
                type: 'host:mute-all',
                muteAllActive: room.roomState.muteAllActive,
                peers: serializeAdmittedPeers(room),
              });
            } else if (msg.action === 'lock-room') {
              room.roomState.isLocked = Boolean(msg.value);
              broadcastAdmitted(room, { type: 'room:state', roomState: room.roomState });
            } else if (msg.action === 'mode-switch') {
              room.roomState.activeMode = msg.value;
              broadcastAdmitted(room, { type: 'room:state', roomState: room.roomState });
            } else if (msg.action === 'recording') {
              room.roomState.recordingActive = Boolean(msg.value);
              broadcastAdmitted(room, { type: 'room:state', roomState: room.roomState });
            } else if (msg.action === 'vidai-remove') {
              const target = room.peers.get(String(msg.targetUid));
              if (target && target.role !== 'guru') {
                if (target.socket.readyState === WebSocket.OPEN) {
                  target.socket.send(JSON.stringify({ type: 'peer:removed' }));
                }
                target.socket.close(4004, 'Vidai by Guru');
                room.peers.delete(target.uid);
                broadcastAdmitted(room, { type: 'peer:left', uid: target.uid });
              }
            } else if (msg.action === 'baithak-assign') {
              room.roomState.breakoutActive = Boolean(msg.breakoutActive);
              const assignments = (msg.assignments || {}) as Record<string, string>;
              for (const [uid, baithak] of Object.entries(assignments)) {
                const p = room.peers.get(uid);
                if (p) p.breakoutRoomId = String(baithak).slice(0, 64);
              }
              broadcastAdmitted(room, {
                type: 'baithak:updated',
                breakoutActive: room.roomState.breakoutActive,
                peers: serializeAdmittedPeers(room),
              });
            } else if (msg.action === 'end-darbar') {
              broadcastAdmitted(room, { type: 'room:ended' });
              room.strokes = [];
              room.polls = [];
              for (const p of room.peers.values()) {
                try {
                  p.socket.close(1000, 'Darbar Sampann');
                } catch {
                  // ignore
                }
              }
              room.peers.clear();
              rooms.delete(roomId);
            }
            break;
          }
          case 'pariksha:create': {
            if (sender.role !== 'guru') return;
            const poll: PollItem = {
              id: crypto.randomUUID(),
              question: String(msg.question || '').slice(0, 200),
              options: Array.isArray(msg.options)
                ? msg.options.map((o: unknown) => String(o).slice(0, 80)).slice(0, 6)
                : [],
              votes: {},
              status: 'open',
              createdBy: sender.displayName,
            };
            if (poll.question && poll.options.length >= 2) {
              room.polls.unshift(poll);
              broadcastAdmitted(room, { type: 'pariksha:updated', polls: room.polls });
            }
            break;
          }
          case 'pariksha:vote': {
            if (!sender.admitted) return;
            const poll = room.polls.find((p) => p.id === String(msg.pollId));
            if (poll && poll.status === 'open') {
              const optionIndex = Number(msg.optionIndex);
              if (optionIndex >= 0 && optionIndex < poll.options.length) {
                poll.votes[sender.uid] = optionIndex;
                broadcastAdmitted(room, { type: 'pariksha:updated', polls: room.polls });
              }
            }
            break;
          }
          case 'pariksha:close': {
            if (sender.role !== 'guru') return;
            const poll = room.polls.find((p) => p.id === String(msg.pollId));
            if (poll) {
              poll.status = 'closed';
              broadcastAdmitted(room, { type: 'pariksha:updated', polls: room.polls });
            }
            break;
          }
        }
      } catch {
        // Ignore malformed packets
      }
    });

    socket.on('close', () => {
      if (attachedUid) {
        const existed = room.peers.get(attachedUid);
        room.peers.delete(attachedUid);
        if (existed?.admitted) {
          broadcastAdmitted(room, { type: 'peer:left', uid: attachedUid });
        } else {
          notifyGurus(room, {
            type: 'pratiksha:updated',
            waiting: serializeWaitingPeers(room),
          });
        }
        if (room.peers.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });

  httpServer.on('upgrade', (request, socket, head) => {
    const reqUrl = request.url || '';
    const match = reqUrl.match(/^\/ws\/room\/([a-zA-Z0-9_-]+)/);
    if (match) {
      const roomId = match[1];
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, roomId);
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`SOHBAT server running on http://0.0.0.0:${port}`);
  });
}

startServer();
