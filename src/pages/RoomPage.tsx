import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Flower2,
  Hand,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PenTool,
  PhoneOff,
  Smile,
  Unlock,
  Video,
  VideoOff,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  endDarbarAndCleanup,
  getDarbarById,
  postArzMessageToFirestore,
  registerParticipantInFirestore,
  requestPratikshaEntry,
  updateDarbarLiveControls,
  updatePratikshaStatus,
  uploadSmritiRecording,
  type ActiveMode,
  type DarbarRoomDoc,
  type PratikshaDoc,
} from '../lib/darbarService';
import { playGuruBell, playSoftChime } from '../lib/audio';
import {
  AASAN_BACKGROUNDS,
  createVideoTransportAdapter,
  type AasanMode,
  type VideoTransportAdapter,
} from '../lib/videoEngine';
import { ShyaamPatCanvas, type WhiteboardStroke } from '../components/room/ShyaamPatCanvas';
import { GyaanPatraStage, type GyaanPatraMedia } from '../components/room/GyaanPatraStage';
import {
  AashirvadOverlay,
  type FloatingReaction,
  type PetalItem,
} from '../components/room/AashirvadOverlay';
import {
  RoomSideDrawer,
  type ChatMsg,
  type DrawerTab,
  type LivePeer,
  type PollItem,
} from '../components/room/RoomSideDrawer';

function VideoTile({
  stream,
  muted,
  name,
  role,
  isVideoOn,
  isAudioMuted,
  handRaised,
  audioOnly,
  aasanMode,
  large,
}: {
  stream: MediaStream | null;
  muted: boolean;
  name: string;
  role: 'guru' | 'chela';
  isVideoOn: boolean;
  isAudioMuted: boolean;
  handRaised: boolean;
  audioOnly: boolean;
  aasanMode?: AasanMode;
  large?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const bgImage =
    aasanMode === 'ashram' || aasanMode === 'library' ? AASAN_BACKGROUNDS[aasanMode] : null;

  return (
    <div
      className={`relative w-full h-full overflow-hidden rounded-xl border ${
        role === 'guru' ? 'border-[#E59819]/60 bg-[#22103A]' : 'border-[#3D1F63] bg-[#1B0C2E]'
      }`}
    >
      {bgImage && (
        <img
          src={bgImage}
          alt="Aasan backdrop"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
      )}

      {stream && isVideoOn && !audioOnly ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`sohbat-video-cover relative z-10 ${
            aasanMode === 'blur' ? 'brightness-105 contrast-105' : ''
          }`}
        />
      ) : (
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-3 text-center">
          <div
            className={`${
              large ? 'w-20 h-20 text-2xl' : 'w-11 h-11 text-sm'
            } rounded-full bg-[#3D1F63] border border-[#E59819]/50 text-[#FAF5EC] font-display font-semibold flex items-center justify-center mb-2`}
          >
            {name.slice(0, 2).toUpperCase()}
          </div>
          {audioOnly && (
            <span className="text-[11px] text-[#E8DEC8]/75">Audio Only Mode</span>
          )}
        </div>
      )}

      {/* Non-intrusive bottom nameplate strip */}
      <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-between gap-2 pointer-events-none">
        <div className="px-2.5 py-1 rounded-lg bg-[#160926]/80 text-[#FAF5EC] text-[11px] font-medium flex items-center gap-1.5 max-w-full truncate">
          <span className="truncate">
            {name} {role === 'guru' ? '· Aasan' : ''}
          </span>
          {isAudioMuted && <MicOff className="w-3 h-3 text-rose-300 shrink-0" />}
        </div>
        {handRaised && (
          <div className="px-2 py-1 rounded-lg bg-[#E59819] text-[#1D0E30] text-[11px] font-semibold flex items-center gap-1 shrink-0">
            <Hand className="w-3 h-3" />
            <span>Pranam</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function RoomPage() {
  const { id: roomId = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, isVerified } = useAuth();

  const [room, setRoom] = useState<DarbarRoomDoc | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [roomError, setRoomError] = useState('');
  const [pratikshaStatus, setPratikshaStatus] = useState<'waiting' | 'admitted' | 'rejected'>(
    'waiting'
  );
  const [bannerText, setBannerText] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);

  // Media & WebRTC
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [gyaanMedia, setGyaanMedia] = useState<GyaanPatraMedia | null>(null);

  // Room Controls State
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [aasanMode, setAasanMode] = useState<AasanMode>('none');
  const [viewMode, setViewMode] = useState<'darshan' | 'sabha'>('darshan');
  const [activeMode, setActiveMode] = useState<ActiveMode>('video');
  const [isLocked, setIsLocked] = useState(false);
  const [muteAllActive, setMuteAllActive] = useState(false);
  const [breakoutActive, setBreakoutActive] = useState(false);
  const [recordingActive, setRecordingActive] = useState(false);

  // Live Collaborative State
  const [peers, setPeers] = useState<LivePeer[]>([]);
  const [waitingList, setWaitingList] = useState<LivePeer[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [polls, setPolls] = useState<PollItem[]>([]);
  const [petals, setPetals] = useState<PetalItem[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  // Side Drawer (pushes video container rather than overlapping)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('arz');

  const wsRef = useRef<WebSocket | null>(null);
  const adapterRef = useRef<VideoTransportAdapter | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef<number>(0);

  const customDisplayName =
    (location.state as { displayName?: string } | null)?.displayName ||
    user?.displayName ||
    user?.phoneNumber ||
    'Sadhak';

  const isGuru = Boolean(room && user && room.hostUid === user.uid);
  const isAdmitted = isGuru || pratikshaStatus === 'admitted';

  // Fetch room document & listen for updates
  useEffect(() => {
    if (!roomId || !user || !isVerified) {
      setRoomLoading(false);
      return;
    }

    let unsubRoom: (() => void) | undefined;

    getDarbarById(roomId)
      .then((found) => {
        if (!found) {
          setRoomError('Yeh Darbar uplabdh nahi hai.');
          setRoomLoading(false);
          return;
        }
        setRoom(found);
        setActiveMode(found.activeMode);
        setIsLocked(found.isLocked);
        setMuteAllActive(found.muteAllActive);
        setBreakoutActive(found.breakoutActive);
        setRecordingActive(found.recordingActive);
        setRoomLoading(false);

        unsubRoom = onSnapshot(
          doc(db, 'darbars', roomId),
          (snap) => {
            if (!snap.exists()) return;
            const d = snap.data() as DarbarRoomDoc;
            setRoom(d);
            setIsLocked(d.isLocked);
            setMuteAllActive(d.muteAllActive);
            setActiveMode(d.activeMode);
            if (d.status === 'ended') {
              setBannerText('Darbar Sampann hua.');
            }
          },
          (err) => handleFirestoreError(err, OperationType.GET, `darbars/${roomId}`)
        );
      })
      .catch((err) => {
        setRoomError(err instanceof Error ? err.message : 'Unable to load Darbar.');
        setRoomLoading(false);
      });

    return () => {
      if (unsubRoom) unsubRoom();
    };
  }, [roomId, user, isVerified]);

  // Pratiksha Kaksh Gate for Chela
  useEffect(() => {
    if (!room || !user || !isVerified) return;
    if (room.hostUid === user.uid) {
      setPratikshaStatus('admitted');
      return;
    }

    setBannerText('Chela Darbar me Pravesh kar raha hai...');
    requestPratikshaEntry(room.roomId, room.hostUid, user.uid, customDisplayName).catch(() => {});

    const unsub = onSnapshot(
      doc(db, 'darbars', room.roomId, 'pratiksha', user.uid),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as PratikshaDoc;
        setPratikshaStatus(data.status);
      },
      (err) =>
        handleFirestoreError(err, OperationType.GET, `darbars/${room.roomId}/pratiksha/${user.uid}`)
    );

    return () => unsub();
  }, [room, user, isVerified, customDisplayName]);

  // Room Timer
  useEffect(() => {
    if (!isAdmitted) return;
    const timer = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isAdmitted]);

  const formattedTime = useMemo(() => {
    const mins = Math.floor(elapsedSec / 60)
      .toString()
      .padStart(2, '0');
    const secs = (elapsedSec % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }, [elapsedSec]);

  const triggerAashirvadPetals = () => {
    playSoftChime();
    const symbols = ['🌸', '🌼', '🌺', '🪷'];
    const batch: PetalItem[] = Array.from({ length: 24 }, (_, idx) => ({
      id: `${Date.now()}_${idx}`,
      leftPercent: Math.random() * 96 + 2,
      delayMs: Math.random() * 1400,
      durationSec: 3.5 + Math.random() * 2.2,
      symbol: symbols[idx % symbols.length],
    }));
    setPetals(batch);
    setTimeout(() => setPetals([]), 6200);
  };

  // Connect Camera/Mic + WebRTC Adapter + WebSocket Signaling once admitted
  useEffect(() => {
    if (!room || !user || !isVerified || !isAdmitted || room.status === 'ended') return;

    let active = true;
    let streamRef: MediaStream | null = null;

    const sendWs = (payload: unknown) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
    };

    const initRoomSession = async () => {
      await registerParticipantInFirestore(
        room.roomId,
        room.hostUid,
        user.uid,
        customDisplayName,
        isGuru ? 'guru' : 'chela'
      ).catch(() => {});

      if (isGuru) {
        await updateDarbarLiveControls(room.roomId, { status: 'live' }).catch(() => {});
        playGuruBell();
        setBannerText('Guruji Padhare');
        setTimeout(() => setBannerText(''), 4000);
      } else {
        setBannerText('Chela Darbar me Pravesh kar raha hai...');
        setTimeout(() => setBannerText(''), 3500);
      }

      // Request Camera + Mic
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        if (active) {
          streamRef = media;
          setLocalStream(media);
        } else {
          media.getTracks().forEach((t) => t.stop());
        }
      } catch {
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (active) {
            streamRef = audioOnlyStream;
            setLocalStream(audioOnlyStream);
            setIsVideoOn(false);
          }
        } catch {
          setIsVideoOn(false);
        }
      }

      const adapter = createVideoTransportAdapter('cloudflare-webrtc', {
        onSendSignal: (toUid, data) => {
          sendWs({ type: 'signal', toUid, data });
        },
        onRemoteStream: (peerUid, stream) => {
          setRemoteStreams((prev) => ({ ...prev, [peerUid]: stream }));
        },
        onPeerDisconnected: (peerUid) => {
          setRemoteStreams((prev) => {
            const copy = { ...prev };
            delete copy[peerUid];
            return copy;
          });
        },
      });
      await adapter.init();
      if (streamRef) {
        await adapter.setLocalStream(streamRef);
      }
      adapterRef.current = adapter;

      // Connect WebSocket signaling channel
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/room/${room.roomId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'join',
            uid: user.uid,
            displayName: customDisplayName,
            role: isGuru ? 'guru' : 'chela',
            admitted: isAdmitted,
            isMuted: false,
            isVideoOn: true,
            audioOnly: false,
          })
        );
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'room:init': {
              setPeers(msg.peers || []);
              setWaitingList(msg.waiting || []);
              setStrokes(msg.strokes || []);
              setPolls(msg.polls || []);
              if (msg.roomState) {
                setActiveMode(msg.roomState.activeMode || 'video');
                setIsLocked(Boolean(msg.roomState.isLocked));
                setMuteAllActive(Boolean(msg.roomState.muteAllActive));
                setBreakoutActive(Boolean(msg.roomState.breakoutActive));
              }
              for (const p of (msg.peers || []) as LivePeer[]) {
                if (p.uid !== user.uid && user.uid < p.uid) {
                  await adapter.connectToPeer(p.uid, true);
                }
              }
              break;
            }
            case 'peer:joined': {
              const joinedPeer = msg.peer as LivePeer;
              setPeers((prev) => {
                const exists = prev.some((p) => p.uid === joinedPeer.uid);
                return exists
                  ? prev.map((p) => (p.uid === joinedPeer.uid ? joinedPeer : p))
                  : [...prev, joinedPeer];
              });
              if (joinedPeer.uid !== user.uid) {
                if (joinedPeer.role === 'guru') {
                  playGuruBell();
                  setBannerText('Guruji Padhare');
                } else {
                  setBannerText(`${joinedPeer.displayName} Darbar me Pravesh kar rahe hain...`);
                }
                setTimeout(() => setBannerText(''), 3500);
                if (user.uid < joinedPeer.uid) {
                  await adapter.connectToPeer(joinedPeer.uid, true);
                }
              }
              break;
            }
            case 'peer:updated': {
              const updated = msg.peer as LivePeer;
              setPeers((prev) => prev.map((p) => (p.uid === updated.uid ? updated : p)));
              break;
            }
            case 'peer:left': {
              const leftUid = String(msg.uid);
              setPeers((prev) => prev.filter((p) => p.uid !== leftUid));
              adapter.disconnectPeer(leftUid);
              break;
            }
            case 'peer:removed': {
              navigate('/join', { replace: true });
              break;
            }
            case 'pratiksha:updated': {
              setWaitingList(msg.waiting || []);
              break;
            }
            case 'signal': {
              await adapter.handleSignal(msg.fromUid, msg.data);
              break;
            }
            case 'arz:message': {
              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.message.id)) return prev;
                return [...prev, msg.message];
              });
              break;
            }
            case 'reaction:send': {
              const item: FloatingReaction = {
                id: msg.id,
                emoji: msg.emoji,
                senderName: msg.senderName,
                leftPercent: 15 + Math.random() * 70,
              };
              setReactions((prev) => [...prev.slice(-14), item]);
              setTimeout(() => {
                setReactions((prev) => prev.filter((r) => r.id !== item.id));
              }, 2500);
              break;
            }
            case 'aashirvad:shower': {
              triggerAashirvadPetals();
              setBannerText(`${msg.fromName} ka Aashirvad`);
              setTimeout(() => setBannerText(''), 3500);
              break;
            }
            case 'shyaam-pat:stroke': {
              setStrokes((prev) => [...prev, msg.stroke]);
              break;
            }
            case 'shyaam-pat:clear': {
              setStrokes([]);
              break;
            }
            case 'host:mute-all': {
              setMuteAllActive(Boolean(msg.muteAllActive));
              setPeers(msg.peers || []);
              if (!isGuru && streamRef) {
                streamRef.getAudioTracks().forEach((t) => {
                  t.enabled = false;
                });
                setIsMuted(true);
              }
              break;
            }
            case 'room:state': {
              if (msg.roomState) {
                setActiveMode(msg.roomState.activeMode);
                setIsLocked(Boolean(msg.roomState.isLocked));
                setRecordingActive(Boolean(msg.roomState.recordingActive));
              }
              break;
            }
            case 'pariksha:updated': {
              setPolls(msg.polls || []);
              break;
            }
            case 'baithak:updated': {
              setBreakoutActive(Boolean(msg.breakoutActive));
              setPeers(msg.peers || []);
              break;
            }
            case 'room:ended': {
              navigate('/dashboard', { replace: true });
              break;
            }
          }
        } catch {
          // ignore malformed messages
        }
      };
    };

    initRoomSession();

    return () => {
      active = false;
      wsRef.current?.close();
      adapterRef.current?.destroy();
      streamRef?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.roomId, user?.uid, isVerified, isAdmitted]);

  const sendWsEvent = (payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  // Actions
  const toggleVideo = () => {
    const next = !isVideoOn;
    setIsVideoOn(next);
    localStream?.getVideoTracks().forEach((t) => {
      t.enabled = next && !audioOnly;
    });
    sendWsEvent({
      type: 'peer:state',
      isMuted,
      isVideoOn: next,
      handRaised,
      audioOnly,
    });
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    sendWsEvent({
      type: 'peer:state',
      isMuted: next,
      isVideoOn,
      handRaised,
      audioOnly,
    });
  };

  const togglePranam = () => {
    const next = !handRaised;
    setHandRaised(next);
    if (next) playSoftChime();
    sendWsEvent({
      type: 'peer:state',
      isMuted,
      isVideoOn,
      handRaised: next,
      audioOnly,
    });
  };

  const toggleAudioOnly = () => {
    const next = !audioOnly;
    setAudioOnly(next);
    localStream?.getVideoTracks().forEach((t) => {
      t.enabled = isVideoOn && !next;
    });
    sendWsEvent({
      type: 'peer:state',
      isMuted,
      isVideoOn,
      handRaised,
      audioOnly: next,
    });
  };

  const handleToggleScreenShare = async () => {
    if (activeMode === 'screenshare') {
      screenStream?.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setGyaanMedia(null);
      setActiveMode('video');
      sendWsEvent({ type: 'host:control', action: 'mode-switch', value: 'video' });
      if (isGuru && room) {
        updateDarbarLiveControls(room.roomId, { activeMode: 'video' }).catch(() => {});
      }
      return;
    }

    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      setScreenStream(display);
      setGyaanMedia({ kind: 'screen', name: 'Live Screen' });
      setActiveMode('screenshare');
      sendWsEvent({ type: 'host:control', action: 'mode-switch', value: 'screenshare' });
      if (isGuru && room) {
        updateDarbarLiveControls(room.roomId, { activeMode: 'screenshare' }).catch(() => {});
      }
      display.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        setActiveMode('video');
        sendWsEvent({ type: 'host:control', action: 'mode-switch', value: 'video' });
      };
    } catch {
      // Allow opening Gyaan Patra PDF/Image/Video stage even if screen capture is cancelled
      setActiveMode('screenshare');
      sendWsEvent({ type: 'host:control', action: 'mode-switch', value: 'screenshare' });
    }
  };

  const handleSelectLocalGyaanFile = (file: File) => {
    const url = URL.createObjectURL(file);
    if (file.type === 'application/pdf') {
      setGyaanMedia({ kind: 'pdf', url, name: file.name });
    } else if (file.type.startsWith('image/')) {
      setGyaanMedia({ kind: 'image', url, name: file.name });
    } else if (file.type.startsWith('video/')) {
      setGyaanMedia({ kind: 'video', url, name: file.name });
    }
  };

  const handleToggleWhiteboard = () => {
    const nextMode: ActiveMode = activeMode === 'whiteboard' ? 'video' : 'whiteboard';
    setActiveMode(nextMode);
    sendWsEvent({ type: 'host:control', action: 'mode-switch', value: nextMode });
    if (isGuru && room) {
      updateDarbarLiveControls(room.roomId, { activeMode: nextMode }).catch(() => {});
    }
  };

  const handleAashirvadOrAasan = () => {
    if (isGuru) {
      triggerAashirvadPetals();
      sendWsEvent({ type: 'aashirvad:shower' });
    } else {
      setDrawerTab('aasan');
      setDrawerOpen(true);
    }
  };

  const handleMuteAll = async () => {
    if (!isGuru || !room) return;
    const next = !muteAllActive;
    setMuteAllActive(next);
    sendWsEvent({ type: 'host:control', action: 'mute-all', value: next });
    await updateDarbarLiveControls(room.roomId, { muteAllActive: next }).catch(() => {});
  };

  const handleLockRoom = async () => {
    if (!isGuru || !room) return;
    const next = !isLocked;
    setIsLocked(next);
    sendWsEvent({ type: 'host:control', action: 'lock-room', value: next });
    await updateDarbarLiveControls(room.roomId, { isLocked: next }).catch(() => {});
  };

  const handleToggleRecording = async () => {
    if (!isGuru || !room || !user) return;
    if (!recordingActive) {
      const streamToRecord = screenStream || localStream;
      if (!streamToRecord) return;
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(streamToRecord, { mimeType: 'video/webm' });
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const dur = (Date.now() - recStartRef.current) / 1000;
        await uploadSmritiRecording(
          user.uid,
          room.roomId,
          room.roomCode,
          room.title,
          blob,
          dur
        ).catch(() => {});
      };
      recStartRef.current = Date.now();
      mr.start(1000);
      mediaRecorderRef.current = mr;
      setRecordingActive(true);
      sendWsEvent({ type: 'host:control', action: 'recording', value: true });
    } else {
      mediaRecorderRef.current?.stop();
      setRecordingActive(false);
      sendWsEvent({ type: 'host:control', action: 'recording', value: false });
    }
  };

  const handleLeaveOrEnd = async () => {
    if (isGuru && room && user) {
      if (recordingActive) {
        mediaRecorderRef.current?.stop();
      }
      sendWsEvent({ type: 'host:control', action: 'end-darbar' });
      await endDarbarAndCleanup(room.roomId, room.roomCode, user.uid).catch(() => {});
      navigate('/dashboard');
    } else {
      wsRef.current?.close();
      navigate('/');
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!room || !user) return;
    const id = await postArzMessageToFirestore(
      room.roomId,
      room.hostUid,
      user.uid,
      customDisplayName,
      isGuru ? 'guru' : 'chela',
      text
    ).catch(() => `${Date.now()}`);
    sendWsEvent({ type: 'arz:message', id, text });
  };

  const openDrawerTab = (tab: DrawerTab) => {
    if (drawerOpen && drawerTab === tab) {
      setDrawerOpen(false);
    } else {
      setDrawerTab(tab);
      setDrawerOpen(true);
    }
  };

  // Auth / Loading / Pratiksha Kaksh Gates
  if (loading || roomLoading) {
    return (
      <div className="min-h-screen bg-[#160926] text-[#FAF5EC] flex items-center justify-center">
        <p className="font-display text-lg">SOHBAT Darbar taiyaar ho raha hai...</p>
      </div>
    );
  }

  if (!user || !isVerified) {
    return (
      <div className="min-h-screen bg-[#160926] text-[#FAF5EC] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#1D0E30] border border-[#3D1F63] rounded-2xl p-8 text-center">
          <h1 className="font-display text-2xl font-semibold mb-2">Login Compulsory</h1>
          <p className="text-sm text-[#E8DEC8] mb-6">
            SOHBAT Darbar me bina verified login pravesh varjit hai.
          </p>
          <Link
            to={`/login?next=${encodeURIComponent(`/room/${roomId}`)}`}
            className="inline-block px-6 py-3 rounded-xl bg-[#E59819] text-[#1D0E30] text-sm font-semibold"
          >
            Sign In to Continue
          </Link>
        </div>
      </div>
    );
  }

  if (roomError || !room) {
    return (
      <div className="min-h-screen bg-[#160926] text-[#FAF5EC] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#1D0E30] border border-[#3D1F63] rounded-2xl p-8 text-center">
          <h1 className="font-display text-2xl font-semibold mb-2">Darbar Not Found</h1>
          <p className="text-sm text-[#E8DEC8] mb-6">{roomError}</p>
          <Link
            to="/join"
            className="inline-block px-6 py-3 rounded-xl bg-[#E59819] text-[#1D0E30] text-sm font-semibold"
          >
            Return to Join
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmitted) {
    return (
      <div className="min-h-screen bg-[#160926] text-[#FAF5EC] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#1D0E30] border border-[#3D1F63] rounded-2xl p-8 text-center">
          <p className="text-xs font-medium text-[#F3B33D] mb-2">
            Pratiksha Kaksh · {room.roomCode}
          </p>
          <h1 className="font-display text-2xl font-semibold mb-3">{room.title}</h1>
          {pratikshaStatus === 'rejected' ? (
            <>
              <p className="text-sm text-rose-300 mb-6">
                Guruji ne abhi is Darbar me pravesh anumati nahi di hai.
              </p>
              <Link
                to="/join"
                className="inline-block px-6 py-2.5 rounded-xl bg-[#E59819] text-[#1D0E30] text-sm font-semibold"
              >
                Back to Join
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-[#E8DEC8] mb-6">
                Chela Darbar me Pravesh kar raha hai... Guruji ke swikar karne ki pratiksha karein.
              </p>
              <button
                type="button"
                onClick={() => navigate('/join')}
                className="px-5 py-2 rounded-xl border border-[#3D1F63] text-xs text-[#E8DEC8] hover:bg-[#2B1547] cursor-pointer"
              >
                Leave Waiting Room
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Partition Guru (top Aasan) and Chelas (below in front)
  const allActiveParticipants: LivePeer[] =
    peers.length > 0
      ? peers
      : [
          {
            uid: user.uid,
            displayName: customDisplayName,
            role: isGuru ? 'guru' : 'chela',
            admitted: true,
            isMuted,
            isVideoOn,
            handRaised,
            audioOnly,
            breakoutRoomId: 'main',
          },
        ];

  const guruPeer =
    allActiveParticipants.find((p) => p.role === 'guru') || allActiveParticipants[0];
  const chelaPeers = allActiveParticipants.filter((p) => p.uid !== guruPeer?.uid);

  const getStreamForPeer = (uid: string) =>
    uid === user.uid ? localStream : remoteStreams[uid] || null;

  return (
    <div className={`sohbat-room-grid ${drawerOpen ? 'has-drawer' : ''}`}>
      <AashirvadOverlay petals={petals} reactions={reactions} />

      {/* MOBILE TOP BAR: 0.5cm (19px) height, SOHBAT Logo small + Room Code + Timer ONLY */}
      <header className="md:hidden flex items-center justify-between px-3 bg-[#1D0E30] border-b border-[#3D1F63] text-[10px] leading-none h-[0.5cm]">
        <span className="font-display font-bold text-[#F3B33D] tracking-tight">SOHBAT</span>
        <span className="font-mono-tabular text-[#FAF5EC]">{room.roomCode}</span>
        <span className="font-mono-tabular text-[#E8DEC8]">{formattedTime}</span>
      </header>

      {/* DESKTOP LEFT SIDEBAR: Fixed 1cm (38px), vertical toolbar, icons only, 32x32 round buttons */}
      <nav
        aria-label="Primary Darbar Controls"
        className="hidden md:flex flex-col items-center justify-center gap-3 bg-[#1D0E30] border-r border-[#3D1F63] w-[1cm] h-full"
      >
        <button
          type="button"
          onClick={toggleVideo}
          title={isVideoOn ? 'Video OFF' : 'Video ON'}
          aria-label="Toggle Video"
          className={`sohbat-desktop-btn cursor-pointer ${
            isVideoOn ? 'bg-[#2B1547] text-[#FAF5EC]' : 'bg-rose-700 text-white'
          }`}
        >
          {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={toggleMute}
          title={isMuted ? 'Bolna (Unmute)' : 'Maun (Mute)'}
          aria-label="Toggle Maun"
          className={`sohbat-desktop-btn cursor-pointer ${
            !isMuted ? 'bg-[#2B1547] text-[#FAF5EC]' : 'bg-rose-700 text-white'
          }`}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={togglePranam}
          title="Pranam"
          aria-label="Pranam"
          className={`sohbat-desktop-btn cursor-pointer ${
            handRaised ? 'bg-[#E59819] text-[#1D0E30]' : 'bg-[#2B1547] text-[#FAF5EC]'
          }`}
        >
          <Hand className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => openDrawerTab('arz')}
          title="Arz (Chat)"
          aria-label="Arz Chat"
          className={`sohbat-desktop-btn cursor-pointer ${
            drawerOpen && drawerTab === 'arz'
              ? 'bg-[#E59819] text-[#1D0E30]'
              : 'bg-[#2B1547] text-[#FAF5EC]'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => openDrawerTab('sabha')}
          title="Reactions & Sabha"
          aria-label="Reactions and Sabha"
          className={`sohbat-desktop-btn cursor-pointer ${
            drawerOpen && drawerTab !== 'arz'
              ? 'bg-[#E59819] text-[#1D0E30]'
              : 'bg-[#2B1547] text-[#FAF5EC]'
          }`}
        >
          <Smile className="w-4 h-4" />
        </button>
      </nav>

      {/* CENTER STAGE: Remaining 1fr width/height. ONLY Video / Gyaan Patra / Shyaam-Pat */}
      <main className="w-full h-full min-w-0 min-h-0 flex flex-col bg-[#160926] overflow-hidden">
        {bannerText && (
          <div className="px-4 py-1.5 bg-[#2B1547] border-b border-[#3D1F63] text-center text-xs font-medium text-[#F3B33D] shrink-0">
            {bannerText}
          </div>
        )}

        {/* Mobile split drawer inside center area when drawer is open (no overlap on video) */}
        <div className="flex-1 min-h-0 flex flex-col md:block overflow-hidden">
          <div
            className={`${
              drawerOpen ? 'h-1/2 md:h-full' : 'h-full'
            } w-full min-h-0 p-2`}
          >
            {activeMode === 'whiteboard' ? (
              <ShyaamPatCanvas
                isGuru={isGuru}
                strokes={strokes}
                onCommitStroke={(stroke) => {
                  setStrokes((prev) => [...prev, stroke]);
                  sendWsEvent({ type: 'shyaam-pat:stroke', stroke });
                }}
                onClearBoard={() => {
                  setStrokes([]);
                  sendWsEvent({ type: 'shyaam-pat:clear' });
                }}
              />
            ) : activeMode === 'screenshare' ? (
              <GyaanPatraStage
                isGuru={isGuru}
                screenStream={screenStream}
                media={gyaanMedia}
                onSelectLocalFile={handleSelectLocalGyaanFile}
                onStopSharing={handleToggleScreenShare}
              />
            ) : viewMode === 'sabha' ? (
              <div
                className="w-full h-full grid gap-2"
                style={{
                  gridTemplateColumns:
                    allActiveParticipants.length <= 1
                      ? '1fr'
                      : allActiveParticipants.length <= 4
                        ? 'repeat(2, minmax(0, 1fr))'
                        : 'repeat(3, minmax(0, 1fr))',
                }}
              >
                {allActiveParticipants.map((p) => (
                  <VideoTile
                    key={p.uid}
                    stream={getStreamForPeer(p.uid)}
                    muted={p.uid === user.uid}
                    name={p.displayName}
                    role={p.role}
                    isVideoOn={p.uid === user.uid ? isVideoOn : p.isVideoOn}
                    isAudioMuted={p.uid === user.uid ? isMuted : p.isMuted}
                    handRaised={p.uid === user.uid ? handRaised : p.handRaised}
                    audioOnly={p.uid === user.uid ? audioOnly : p.audioOnly}
                    aasanMode={p.uid === user.uid ? aasanMode : 'none'}
                  />
                ))}
              </div>
            ) : (
              /* Darshan View: Guru large on top like on Aasan, Chelas small below like sitting in front */
              <div className="w-full h-full flex flex-col gap-2 min-h-0">
                <div className="flex-1 min-h-0">
                  {guruPeer && (
                    <VideoTile
                      stream={getStreamForPeer(guruPeer.uid)}
                      muted={guruPeer.uid === user.uid}
                      name={guruPeer.displayName}
                      role={guruPeer.role}
                      isVideoOn={guruPeer.uid === user.uid ? isVideoOn : guruPeer.isVideoOn}
                      isAudioMuted={guruPeer.uid === user.uid ? isMuted : guruPeer.isMuted}
                      handRaised={guruPeer.uid === user.uid ? handRaised : guruPeer.handRaised}
                      audioOnly={guruPeer.uid === user.uid ? audioOnly : guruPeer.audioOnly}
                      aasanMode={guruPeer.uid === user.uid ? aasanMode : 'none'}
                      large
                    />
                  )}
                </div>

                {chelaPeers.length > 0 && (
                  <div className="h-24 sm:h-32 shrink-0 grid grid-flow-col auto-cols-[minmax(140px,200px)] gap-2 overflow-x-auto">
                    {chelaPeers.map((p) => (
                      <VideoTile
                        key={p.uid}
                        stream={getStreamForPeer(p.uid)}
                        muted={p.uid === user.uid}
                        name={p.displayName}
                        role={p.role}
                        isVideoOn={p.uid === user.uid ? isVideoOn : p.isVideoOn}
                        isAudioMuted={p.uid === user.uid ? isMuted : p.isMuted}
                        handRaised={p.uid === user.uid ? handRaised : p.handRaised}
                        audioOnly={p.uid === user.uid ? audioOnly : p.audioOnly}
                        aasanMode={p.uid === user.uid ? aasanMode : 'none'}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile non-overlapping drawer below video */}
          {drawerOpen && (
            <div className="md:hidden h-1/2 w-full min-h-0">
              <RoomSideDrawer
                activeTab={drawerTab}
                onChangeTab={setDrawerTab}
                onClose={() => setDrawerOpen(false)}
                isGuru={isGuru}
                currentUid={user.uid}
                peers={allActiveParticipants}
                waitingList={waitingList}
                messages={messages}
                polls={polls}
                viewMode={viewMode}
                onChangeViewMode={setViewMode}
                aasanMode={aasanMode}
                onChangeAasanMode={setAasanMode}
                audioOnly={audioOnly}
                onToggleAudioOnly={toggleAudioOnly}
                recordingActive={recordingActive}
                onToggleRecording={handleToggleRecording}
                breakoutActive={breakoutActive}
                onSendMessage={handleSendMessage}
                onSendReaction={(emoji) => sendWsEvent({ type: 'reaction:send', emoji })}
                onAdmitChela={async (uid) => {
                  sendWsEvent({ type: 'pratiksha:admit', targetUid: uid });
                  await updatePratikshaStatus(room.roomId, uid, 'admitted').catch(() => {});
                }}
                onRejectChela={async (uid) => {
                  sendWsEvent({ type: 'pratiksha:reject', targetUid: uid });
                  await updatePratikshaStatus(room.roomId, uid, 'rejected').catch(() => {});
                }}
                onVidaiRemove={(uid) => {
                  sendWsEvent({ type: 'host:control', action: 'vidai-remove', targetUid: uid });
                }}
                onCreatePoll={(question, options) =>
                  sendWsEvent({ type: 'pariksha:create', question, options })
                }
                onVotePoll={(pollId, optionIndex) =>
                  sendWsEvent({ type: 'pariksha:vote', pollId, optionIndex })
                }
                onClosePoll={(pollId) => sendWsEvent({ type: 'pariksha:close', pollId })}
                onAssignBreakout={(active, assignments) =>
                  sendWsEvent({
                    type: 'host:control',
                    action: 'baithak-assign',
                    breakoutActive: active,
                    assignments,
                  })
                }
              />
            </div>
          )}
        </div>
      </main>

      {/* DESKTOP SIDE DRAWER: Dedicated grid column (320px) pushing video without overlapping */}
      {drawerOpen && (
        <div className="hidden md:block h-full w-[320px] min-h-0">
          <RoomSideDrawer
            activeTab={drawerTab}
            onChangeTab={setDrawerTab}
            onClose={() => setDrawerOpen(false)}
            isGuru={isGuru}
            currentUid={user.uid}
            peers={allActiveParticipants}
            waitingList={waitingList}
            messages={messages}
            polls={polls}
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            aasanMode={aasanMode}
            onChangeAasanMode={setAasanMode}
            audioOnly={audioOnly}
            onToggleAudioOnly={toggleAudioOnly}
            recordingActive={recordingActive}
            onToggleRecording={handleToggleRecording}
            breakoutActive={breakoutActive}
            onSendMessage={handleSendMessage}
            onSendReaction={(emoji) => sendWsEvent({ type: 'reaction:send', emoji })}
            onAdmitChela={async (uid) => {
              sendWsEvent({ type: 'pratiksha:admit', targetUid: uid });
              await updatePratikshaStatus(room.roomId, uid, 'admitted').catch(() => {});
            }}
            onRejectChela={async (uid) => {
              sendWsEvent({ type: 'pratiksha:reject', targetUid: uid });
              await updatePratikshaStatus(room.roomId, uid, 'rejected').catch(() => {});
            }}
            onVidaiRemove={(uid) => {
              sendWsEvent({ type: 'host:control', action: 'vidai-remove', targetUid: uid });
            }}
            onCreatePoll={(question, options) =>
              sendWsEvent({ type: 'pariksha:create', question, options })
            }
            onVotePoll={(pollId, optionIndex) =>
              sendWsEvent({ type: 'pariksha:vote', pollId, optionIndex })
            }
            onClosePoll={(pollId) => sendWsEvent({ type: 'pariksha:close', pollId })}
            onAssignBreakout={(active, assignments) =>
              sendWsEvent({
                type: 'host:control',
                action: 'baithak-assign',
                breakoutActive: active,
                assignments,
              })
            }
          />
        </div>
      )}

      {/* DESKTOP RIGHT SIDEBAR: Fixed 1cm (38px), vertical toolbar, icons only, 32x32 round buttons */}
      <nav
        aria-label="Darbar Host and Stage Controls"
        className="hidden md:flex flex-col items-center justify-center gap-3 bg-[#1D0E30] border-l border-[#3D1F63] w-[1cm] h-full"
      >
        <button
          type="button"
          onClick={handleToggleScreenShare}
          title="Gyaan Patra (Screen Share)"
          aria-label="Screen Share"
          className={`sohbat-desktop-btn cursor-pointer ${
            activeMode === 'screenshare'
              ? 'bg-[#E59819] text-[#1D0E30]'
              : 'bg-[#2B1547] text-[#FAF5EC]'
          }`}
        >
          <MonitorUp className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleToggleWhiteboard}
          title="Shyaam-Pat (Whiteboard)"
          aria-label="Whiteboard"
          className={`sohbat-desktop-btn cursor-pointer ${
            activeMode === 'whiteboard'
              ? 'bg-[#E59819] text-[#1D0E30]'
              : 'bg-[#2B1547] text-[#FAF5EC]'
          }`}
        >
          <PenTool className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleAashirvadOrAasan}
          title={isGuru ? 'Aashirvad (Flower Shower)' : 'Aasan & View'}
          aria-label="Aashirvad"
          className="sohbat-desktop-btn bg-[#2B1547] text-[#F3B33D] hover:bg-[#3D1F63] cursor-pointer"
        >
          <Flower2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleMuteAll}
          disabled={!isGuru}
          title="Sabko Maun (Mute All)"
          aria-label="Mute All"
          className={`sohbat-desktop-btn cursor-pointer disabled:opacity-40 ${
            muteAllActive ? 'bg-[#E59819] text-[#1D0E30]' : 'bg-[#2B1547] text-[#FAF5EC]'
          }`}
        >
          <VolumeX className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleLockRoom}
          disabled={!isGuru}
          title={isLocked ? 'Unlock Darbar' : 'Darbar Band (Lock)'}
          aria-label="Lock Darbar"
          className={`sohbat-desktop-btn cursor-pointer disabled:opacity-40 ${
            isLocked ? 'bg-[#E59819] text-[#1D0E30]' : 'bg-[#2B1547] text-[#FAF5EC]'
          }`}
        >
          {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={handleLeaveOrEnd}
          title={isGuru ? 'End Darbar (Vidai)' : 'Leave Darbar'}
          aria-label="Vidai Leave"
          className="sohbat-desktop-btn bg-rose-700 text-white hover:bg-rose-600 cursor-pointer"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </nav>

      {/* MOBILE BOTTOM BAR: Fixed 0.5cm + safe-area, 7 icons only (28x28 round) */}
      <nav
        aria-label="Mobile Darbar Controls"
        className="md:hidden flex items-center justify-around px-2 bg-[#1D0E30] border-t border-[#3D1F63] min-h-[0.5cm] pb-[env(safe-area-inset-bottom,0px)] overflow-visible"
      >
        <button
          type="button"
          onClick={toggleVideo}
          aria-label="Video"
          className={`sohbat-mobile-btn cursor-pointer ${
            isVideoOn ? 'bg-[#2B1547] text-[#FAF5EC]' : 'bg-rose-700 text-white'
          }`}
        >
          {isVideoOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={toggleMute}
          aria-label="Maun"
          className={`sohbat-mobile-btn cursor-pointer ${
            !isMuted ? 'bg-[#2B1547] text-[#FAF5EC]' : 'bg-rose-700 text-white'
          }`}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={togglePranam}
          aria-label="Pranam"
          className={`sohbat-mobile-btn cursor-pointer ${
            handRaised ? 'bg-[#E59819] text-[#1D0E30]' : 'bg-[#2B1547] text-[#FAF5EC]'
          }`}
        >
          <Hand className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => openDrawerTab('arz')}
          aria-label="Arz"
          className={`sohbat-mobile-btn cursor-pointer ${
            drawerOpen ? 'bg-[#E59819] text-[#1D0E30]' : 'bg-[#2B1547] text-[#FAF5EC]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleToggleScreenShare}
          aria-label="Screen Share"
          className={`sohbat-mobile-btn cursor-pointer ${
            activeMode === 'screenshare'
              ? 'bg-[#E59819] text-[#1D0E30]'
              : 'bg-[#2B1547] text-[#FAF5EC]'
          }`}
        >
          <MonitorUp className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleAashirvadOrAasan}
          aria-label="Aashirvad"
          className="sohbat-mobile-btn bg-[#2B1547] text-[#F3B33D] cursor-pointer"
        >
          <Flower2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleLeaveOrEnd}
          aria-label="Vidai"
          className="sohbat-mobile-btn bg-rose-700 text-white cursor-pointer"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </nav>
    </div>
  );
}
