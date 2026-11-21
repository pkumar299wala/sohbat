interface CfWebSocket extends WebSocket {
  accept(): void;
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStub;
}

interface DurableObjectState {
  storage: unknown;
}

declare const WebSocketPair: {
  new (): { 0: CfWebSocket; 1: CfWebSocket };
};

export interface Env {
  DARBAR_ROOM: DurableObjectNamespace;
  ENVIRONMENT: string;
  VIDEO_PROVIDER: string;
  CLOUDFLARE_TURN_TOKEN_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
}

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

export class DarbarRoomDO {
  private peers = new Map<string, RoomPeer>();
  private strokes: WhiteboardStroke[] = [];
  private polls: PollItem[] = [];
  private roomState = {
    isLocked: false,
    muteAllActive: false,
    activeMode: 'video' as 'video' | 'screenshare' | 'whiteboard',
    breakoutActive: false,
    recordingActive: false,
  };

  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    let attachedUid: string | null = null;

    server.addEventListener('message', (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type === 'join') {
          attachedUid = String(msg.uid);
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
            socket: server,
          };
          this.peers.set(attachedUid, peer);

          // Send initial room state to newly connected peer
          server.send(
            JSON.stringify({
              type: 'room:init',
              roomState: this.roomState,
              strokes: this.strokes,
              polls: this.polls,
              peers: this.serializeAdmittedPeers(),
              waiting: this.serializeWaitingPeers(),
            })
          );

          if (peer.admitted) {
            this.broadcastAdmitted({
              type: 'peer:joined',
              peer: this.serializePeer(peer),
            });
          } else {
            this.notifyGurus({
              type: 'pratiksha:updated',
              waiting: this.serializeWaitingPeers(),
            });
          }
          return;
        }

        if (!attachedUid) return;
        const sender = this.peers.get(attachedUid);
        if (!sender) return;

        switch (msg.type) {
          case 'signal': {
            const target = this.peers.get(String(msg.toUid));
            if (target && target.admitted && sender.admitted) {
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
            const target = this.peers.get(String(msg.targetUid));
            if (target) {
              target.admitted = true;
              target.socket.send(JSON.stringify({ type: 'pratiksha:admitted' }));
              this.broadcastAdmitted({
                type: 'peer:joined',
                peer: this.serializePeer(target),
              });
              this.notifyGurus({
                type: 'pratiksha:updated',
                waiting: this.serializeWaitingPeers(),
              });
            }
            break;
          }
          case 'pratiksha:reject': {
            if (sender.role !== 'guru') return;
            const target = this.peers.get(String(msg.targetUid));
            if (target) {
              target.socket.send(JSON.stringify({ type: 'pratiksha:rejected' }));
              target.socket.close(4003, 'Rejected by Guru');
              this.peers.delete(target.uid);
              this.notifyGurus({
                type: 'pratiksha:updated',
                waiting: this.serializeWaitingPeers(),
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
            this.broadcastAdmitted({
              type: 'peer:updated',
              peer: this.serializePeer(sender),
            });
            break;
          }
          case 'arz:message': {
            if (!sender.admitted) return;
            const text = String(msg.text || '').trim().slice(0, 1000);
            if (!text) return;
            this.broadcastAdmitted({
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
            this.broadcastAdmitted({
              type: 'reaction:send',
              id: crypto.randomUUID(),
              emoji: String(msg.emoji || '🙏').slice(0, 12),
              senderName: sender.displayName,
            });
            break;
          }
          case 'aashirvad:shower': {
            if (sender.role !== 'guru') return;
            this.broadcastAdmitted({
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
              this.strokes.push(stroke);
              if (this.strokes.length > 500) this.strokes.shift();
              this.broadcastAdmitted({ type: 'shyaam-pat:stroke', stroke });
            }
            break;
          }
          case 'shyaam-pat:clear': {
            if (sender.role !== 'guru') return;
            this.strokes = [];
            this.broadcastAdmitted({ type: 'shyaam-pat:clear' });
            break;
          }
          case 'host:control': {
            if (sender.role !== 'guru') return;
            if (msg.action === 'mute-all') {
              this.roomState.muteAllActive = Boolean(msg.value);
              for (const p of this.peers.values()) {
                if (p.role !== 'guru' && p.admitted) {
                  p.isMuted = true;
                }
              }
              this.broadcastAdmitted({
                type: 'host:mute-all',
                muteAllActive: this.roomState.muteAllActive,
                peers: this.serializeAdmittedPeers(),
              });
            } else if (msg.action === 'lock-room') {
              this.roomState.isLocked = Boolean(msg.value);
              this.broadcastAdmitted({ type: 'room:state', roomState: this.roomState });
            } else if (msg.action === 'mode-switch') {
              this.roomState.activeMode = msg.value;
              this.broadcastAdmitted({ type: 'room:state', roomState: this.roomState });
            } else if (msg.action === 'recording') {
              this.roomState.recordingActive = Boolean(msg.value);
              this.broadcastAdmitted({ type: 'room:state', roomState: this.roomState });
            } else if (msg.action === 'vidai-remove') {
              const target = this.peers.get(String(msg.targetUid));
              if (target && target.role !== 'guru') {
                target.socket.send(JSON.stringify({ type: 'peer:removed' }));
                target.socket.close(4004, 'Vidai by Guru');
                this.peers.delete(target.uid);
                this.broadcastAdmitted({ type: 'peer:left', uid: target.uid });
              }
            } else if (msg.action === 'baithak-assign') {
              this.roomState.breakoutActive = Boolean(msg.breakoutActive);
              const assignments = (msg.assignments || {}) as Record<string, string>;
              for (const [uid, baithak] of Object.entries(assignments)) {
                const p = this.peers.get(uid);
                if (p) p.breakoutRoomId = String(baithak).slice(0, 64);
              }
              this.broadcastAdmitted({
                type: 'baithak:updated',
                breakoutActive: this.roomState.breakoutActive,
                peers: this.serializeAdmittedPeers(),
              });
            } else if (msg.action === 'end-darbar') {
              this.broadcastAdmitted({ type: 'room:ended' });
              this.strokes = [];
              this.polls = [];
              for (const p of this.peers.values()) {
                try {
                  p.socket.close(1000, 'Darbar Sampann');
                } catch {
                  // ignore close errors
                }
              }
              this.peers.clear();
            }
            break;
          }
          case 'pariksha:create': {
            if (sender.role !== 'guru') return;
            const poll: PollItem = {
              id: crypto.randomUUID(),
              question: String(msg.question || '').slice(0, 200),
              options: Array.isArray(msg.options) ? msg.options.map((o: unknown) => String(o).slice(0, 80)).slice(0, 6) : [],
              votes: {},
              status: 'open',
              createdBy: sender.displayName,
            };
            if (poll.question && poll.options.length >= 2) {
              this.polls.unshift(poll);
              this.broadcastAdmitted({ type: 'pariksha:updated', polls: this.polls });
            }
            break;
          }
          case 'pariksha:vote': {
            if (!sender.admitted) return;
            const poll = this.polls.find((p) => p.id === String(msg.pollId));
            if (poll && poll.status === 'open') {
              const optionIndex = Number(msg.optionIndex);
              if (optionIndex >= 0 && optionIndex < poll.options.length) {
                poll.votes[sender.uid] = optionIndex;
                this.broadcastAdmitted({ type: 'pariksha:updated', polls: this.polls });
              }
            }
            break;
          }
          case 'pariksha:close': {
            if (sender.role !== 'guru') return;
            const poll = this.polls.find((p) => p.id === String(msg.pollId));
            if (poll) {
              poll.status = 'closed';
              this.broadcastAdmitted({ type: 'pariksha:updated', polls: this.polls });
            }
            break;
          }
        }
      } catch {
        // Ignore malformed packets
      }
    });

    server.addEventListener('close', () => {
      if (attachedUid) {
        const existed = this.peers.get(attachedUid);
        this.peers.delete(attachedUid);
        if (existed?.admitted) {
          this.broadcastAdmitted({ type: 'peer:left', uid: attachedUid });
        } else {
          this.notifyGurus({
            type: 'pratiksha:updated',
            waiting: this.serializeWaitingPeers(),
          });
        }
      }
    });

    return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket });
  }

  private serializePeer(p: RoomPeer) {
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

  private serializeAdmittedPeers() {
    return Array.from(this.peers.values())
      .filter((p) => p.admitted)
      .map((p) => this.serializePeer(p));
  }

  private serializeWaitingPeers() {
    return Array.from(this.peers.values())
      .filter((p) => !p.admitted)
      .map((p) => this.serializePeer(p));
  }

  private broadcastAdmitted(payload: unknown) {
    const raw = JSON.stringify(payload);
    for (const peer of this.peers.values()) {
      if (peer.admitted) {
        try {
          peer.socket.send(raw);
        } catch {
          // ignore stale socket
        }
      }
    }
  }

  private notifyGurus(payload: unknown) {
    const raw = JSON.stringify(payload);
    for (const peer of this.peers.values()) {
      if (peer.role === 'guru') {
        try {
          peer.socket.send(raw);
        } catch {
          // ignore stale socket
        }
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', service: 'SOHBAT', provider: env.VIDEO_PROVIDER || 'cloudflare-webrtc' });
    }

    if (url.pathname === '/api/video-config') {
      return Response.json({
        provider: env.VIDEO_PROVIDER || 'cloudflare-webrtc',
        livekitUrl: env.LIVEKIT_URL || null,
      });
    }

    if (url.pathname === '/api/ice-servers') {
      if (env.CLOUDFLARE_TURN_TOKEN_ID && env.CLOUDFLARE_API_TOKEN) {
        try {
          const res = await fetch(
            `https://rtc.live.cloudflare.com/v1/turn/keys/${env.CLOUDFLARE_TURN_TOKEN_ID}/credentials/generate`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ ttl: 86400 }),
            }
          );
          if (res.ok) {
            const data = await res.json();
            return Response.json(data);
          }
        } catch {
          // fallback to STUN below
        }
      }
      return Response.json({
        iceServers: [
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      });
    }

    const wsMatch = url.pathname.match(/^\/ws\/room\/([a-zA-Z0-9_-]+)$/);
    if (wsMatch) {
      const roomId = wsMatch[1];
      const id = env.DARBAR_ROOM.idFromName(roomId);
      const stub = env.DARBAR_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
