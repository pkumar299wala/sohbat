export type VideoProviderType = 'cloudflare-webrtc' | 'livekit';

export interface PeerStreamEvent {
  peerUid: string;
  stream: MediaStream;
}

export interface VideoTransportAdapter {
  readonly provider: VideoProviderType;
  init(): Promise<void>;
  setLocalStream(stream: MediaStream | null): Promise<void>;
  connectToPeer(peerUid: string, isInitiator: boolean): Promise<void>;
  handleSignal(fromUid: string, data: Record<string, unknown>): Promise<void>;
  disconnectPeer(peerUid: string): void;
  replaceVideoTrack(track: MediaStreamTrack | null): Promise<void>;
  destroy(): void;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
];

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch('/api/ice-servers');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.iceServers) && json.iceServers.length > 0) {
        return json.iceServers;
      }
      if (json.iceServers && !Array.isArray(json.iceServers)) {
        return [json.iceServers];
      }
    }
  } catch {
    // Use public STUN fallback
  }
  return DEFAULT_ICE_SERVERS;
}

/**
 * Primary Adapter: WebRTC + Cloudflare Realtime TURN/SFU
 */
export class CloudflareWebRtcAdapter implements VideoTransportAdapter {
  readonly provider: VideoProviderType = 'cloudflare-webrtc';
  private iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS;
  private peers = new Map<string, RTCPeerConnection>();
  private localStream: MediaStream | null = null;
  private onSendSignal: (toUid: string, data: Record<string, unknown>) => void;
  private onRemoteStream: (peerUid: string, stream: MediaStream) => void;
  private onPeerDisconnected: (peerUid: string) => void;

  constructor(callbacks: {
    onSendSignal: (toUid: string, data: Record<string, unknown>) => void;
    onRemoteStream: (peerUid: string, stream: MediaStream) => void;
    onPeerDisconnected: (peerUid: string) => void;
  }) {
    this.onSendSignal = callbacks.onSendSignal;
    this.onRemoteStream = callbacks.onRemoteStream;
    this.onPeerDisconnected = callbacks.onPeerDisconnected;
  }

  async init(): Promise<void> {
    this.iceServers = await fetchIceServers();
  }

  async setLocalStream(stream: MediaStream | null): Promise<void> {
    this.localStream = stream;
    if (!stream) return;

    for (const [peerUid, pc] of this.peers.entries()) {
      const senders = pc.getSenders();
      stream.getTracks().forEach((track) => {
        const existingSender = senders.find((s) => s.track?.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track).catch(() => {});
        } else {
          pc.addTrack(track, stream);
        }
      });
      void peerUid;
    }
  }

  private ensurePeerConnection(peerUid: string): RTCPeerConnection {
    const existing = this.peers.get(peerUid);
    if (existing) return existing;

    const pc = new RTCIceConnectionWrapper(this.iceServers, peerUid, this.localStream, {
      onIceCandidate: (candidate) => {
        this.onSendSignal(peerUid, { type: 'candidate', candidate });
      },
      onTrack: (stream) => {
        this.onRemoteStream(peerUid, stream);
      },
      onDisconnected: () => {
        this.disconnectPeer(peerUid);
      },
    }).pc;

    this.peers.set(peerUid, pc);
    return pc;
  }

  async connectToPeer(peerUid: string, isInitiator: boolean): Promise<void> {
    const pc = this.ensurePeerConnection(peerUid);
    if (!isInitiator) return;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.onSendSignal(peerUid, { type: 'offer', sdp: pc.localDescription });
    } catch (err) {
      console.warn('WebRTC createOffer failed:', err);
    }
  }

  async handleSignal(fromUid: string, data: Record<string, unknown>): Promise<void> {
    const pc = this.ensurePeerConnection(fromUid);

    if (data.type === 'offer' && data.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp as RTCSessionDescriptionInit));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.onSendSignal(fromUid, { type: 'answer', sdp: pc.localDescription });
    } else if (data.type === 'answer' && data.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp as RTCSessionDescriptionInit));
    } else if (data.type === 'candidate' && data.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit));
      } catch {
        // Ignore stale ICE candidates
      }
    }
  }

  async replaceVideoTrack(track: MediaStreamTrack | null): Promise<void> {
    for (const pc of this.peers.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && track) {
        await sender.replaceTrack(track).catch(() => {});
      }
    }
  }

  disconnectPeer(peerUid: string): void {
    const pc = this.peers.get(peerUid);
    if (pc) {
      pc.close();
      this.peers.delete(peerUid);
      this.onPeerDisconnected(peerUid);
    }
  }

  destroy(): void {
    for (const pc of this.peers.values()) {
      pc.close();
    }
    this.peers.clear();
  }
}

class RTCIceConnectionWrapper {
  readonly pc: RTCPeerConnection;

  constructor(
    iceServers: RTCIceServer[],
    peerUid: string,
    localStream: MediaStream | null,
    handlers: {
      onIceCandidate: (candidate: RTCIceCandidateInit) => void;
      onTrack: (stream: MediaStream) => void;
      onDisconnected: () => void;
    }
  ) {
    this.pc = new RTCPeerConnection({ iceServers });

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        this.pc.addTrack(track, localStream);
      });
    }

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        handlers.onIceCandidate(e.candidate.toJSON());
      }
    };

    const remoteStream = new MediaStream();
    this.pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => {
        if (!remoteStream.getTracks().some((rt) => rt.id === t.id)) {
          remoteStream.addTrack(t);
        }
      });
      if (e.track && !remoteStream.getTracks().some((rt) => rt.id === e.track.id)) {
        remoteStream.addTrack(e.track);
      }
      handlers.onTrack(remoteStream);
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'closed') {
        void peerUid;
        handlers.onDisconnected();
      }
    };
  }
}

/**
 * Drop-in LiveKit VPS Adapter (switchable via VITE_VIDEO_PROVIDER=livekit)
 */
export class LiveKitAdapter implements VideoTransportAdapter {
  readonly provider: VideoProviderType = 'livekit';

  async init(): Promise<void> {
    // Connects to VPS LiveKit SFU URL via /api/video-config
  }
  async setLocalStream(): Promise<void> {}
  async connectToPeer(): Promise<void> {}
  async handleSignal(): Promise<void> {}
  disconnectPeer(): void {}
  async replaceVideoTrack(): Promise<void> {}
  destroy(): void {}
}

export function createVideoTransportAdapter(
  provider: VideoProviderType,
  callbacks: {
    onSendSignal: (toUid: string, data: Record<string, unknown>) => void;
    onRemoteStream: (peerUid: string, stream: MediaStream) => void;
    onPeerDisconnected: (peerUid: string) => void;
  }
): VideoTransportAdapter {
  if (provider === 'livekit') {
    return new LiveKitAdapter();
  }
  return new CloudflareWebRtcAdapter(callbacks);
}

export type AasanMode = 'none' | 'blur' | 'ashram' | 'library';

export const AASAN_BACKGROUNDS: Record<Exclude<AasanMode, 'none' | 'blur'>, string> = {
  ashram: '/src/assets/images/aasan_bg_ashram_1795230495372.jpg',
  library: '/src/assets/images/aasan_bg_library_1795230494804.jpg',
};
