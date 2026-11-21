import React, { useState } from 'react';
import {
  Check,
  Disc,
  Eye,
  Hand,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Square,
  Users,
  Vote,
  Wifi,
  X,
} from 'lucide-react';
import type { AasanMode } from '../../lib/videoEngine';

export type DrawerTab = 'arz' | 'sabha' | 'pariksha' | 'baithak' | 'aasan';

export interface LivePeer {
  uid: string;
  displayName: string;
  role: 'guru' | 'chela';
  admitted: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
  handRaised: boolean;
  audioOnly: boolean;
  breakoutRoomId: string;
}

export interface ChatMsg {
  id: string;
  senderUid: string;
  senderName: string;
  senderRole: 'guru' | 'chela';
  text: string;
  createdAt: string;
}

export interface PollItem {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, number>;
  status: 'open' | 'closed';
  createdBy: string;
}

interface RoomSideDrawerProps {
  activeTab: DrawerTab;
  onChangeTab: (tab: DrawerTab) => void;
  onClose: () => void;
  isGuru: boolean;
  currentUid: string;
  peers: LivePeer[];
  waitingList: LivePeer[];
  messages: ChatMsg[];
  polls: PollItem[];
  viewMode: 'darshan' | 'sabha';
  onChangeViewMode: (mode: 'darshan' | 'sabha') => void;
  aasanMode: AasanMode;
  onChangeAasanMode: (mode: AasanMode) => void;
  audioOnly: boolean;
  onToggleAudioOnly: () => void;
  recordingActive: boolean;
  onToggleRecording: () => void;
  breakoutActive: boolean;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onAdmitChela: (uid: string) => void;
  onRejectChela: (uid: string) => void;
  onVidaiRemove: (uid: string) => void;
  onCreatePoll: (question: string, options: string[]) => void;
  onVotePoll: (pollId: string, optionIndex: number) => void;
  onClosePoll: (pollId: string) => void;
  onAssignBreakout: (active: boolean, assignments: Record<string, string>) => void;
}

const REACTION_EMOJIS = [
  { emoji: '🙏', label: 'Pranam' },
  { emoji: '❤️', label: 'Prem' },
  { emoji: '👏', label: 'Taali' },
  { emoji: '🪔', label: 'Diya' },
  { emoji: '🌸', label: 'Phool' },
];

export function RoomSideDrawer({
  activeTab,
  onChangeTab,
  onClose,
  isGuru,
  currentUid,
  peers,
  waitingList,
  messages,
  polls,
  viewMode,
  onChangeViewMode,
  aasanMode,
  onChangeAasanMode,
  audioOnly,
  onToggleAudioOnly,
  recordingActive,
  onToggleRecording,
  breakoutActive,
  onSendMessage,
  onSendReaction,
  onAdmitChela,
  onRejectChela,
  onVidaiRemove,
  onCreatePoll,
  onVotePoll,
  onClosePoll,
  onAssignBreakout,
}: RoomSideDrawerProps) {
  const [chatInput, setChatInput] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  const handleCreatePoll = (e: React.FormEvent) => {
    e.preventDefault();
    const validOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || validOpts.length < 2) return;
    onCreatePoll(pollQuestion.trim(), validOpts);
    setPollQuestion('');
    setPollOptions(['', '']);
  };

  const tabs: { id: DrawerTab; label: string; icon: React.ReactNode }[] = [
    { id: 'arz', label: 'Arz', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: 'sabha', label: 'Sabha', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'pariksha', label: 'Pariksha', icon: <Vote className="w-3.5 h-3.5" /> },
    { id: 'baithak', label: 'Baithak', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'aasan', label: 'Aasan', icon: <Eye className="w-3.5 h-3.5" /> },
  ];

  return (
    <aside className="h-full w-full bg-[#1D0E30] border-l border-[#3D1F63] flex flex-col min-h-0 overflow-hidden">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#3D1F63] shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChangeTab(t.id)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                activeTab === t.id
                  ? 'bg-[#E59819] text-[#1D0E30]'
                  : 'text-[#E8DEC8] hover:bg-[#2B1547]'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close drawer"
          className="p-1 rounded-lg text-[#E8DEC8] hover:bg-[#2B1547] cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {activeTab === 'arz' && (
          <div className="flex flex-col h-full justify-between gap-3">
            {/* Reactions Strip */}
            <div className="p-2 rounded-xl bg-[#2B1547] border border-[#3D1F63] flex items-center justify-between gap-1 shrink-0">
              {REACTION_EMOJIS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onSendReaction(item.emoji)}
                  title={item.label}
                  className="flex-1 py-1.5 rounded-lg hover:bg-[#3D1F63] text-base cursor-pointer transition-transform active:scale-95"
                >
                  {item.emoji}
                </button>
              ))}
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[120px]">
              {messages.length === 0 ? (
                <p className="text-xs text-[#E8DEC8]/60 text-center py-8">
                  Arz khali hai. Baatein, Dil Se shuru karein.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded-xl text-xs ${
                      m.senderRole === 'guru'
                        ? 'bg-[#E59819]/15 border border-[#E59819]/35'
                        : 'bg-[#2B1547] border border-[#3D1F63]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-[#F3B33D]">
                        {m.senderName} {m.senderRole === 'guru' ? '· Guru' : ''}
                      </span>
                      <span className="text-[10px] text-[#E8DEC8]/50 font-mono-tabular">
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[#FAF5EC] leading-relaxed break-words">{m.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleChatSubmit} className="flex items-center gap-2 shrink-0 pt-2 border-t border-[#3D1F63]">
              <input
                type="text"
                maxLength={1000}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Arz likhein..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#2B1547] border border-[#3D1F63] text-xs text-[#FAF5EC] placeholder-[#E8DEC8]/50 focus:outline-none focus:border-[#E59819]"
              />
              <button
                type="submit"
                aria-label="Send Arz"
                className="p-2 rounded-xl bg-[#E59819] text-[#1D0E30] hover:bg-[#F3B33D] cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {activeTab === 'sabha' && (
          <div className="space-y-4">
            {/* Pratiksha Kaksh (Guru only) */}
            {isGuru && (
              <div>
                <p className="text-xs font-semibold text-[#F3B33D] mb-2">
                  Pratiksha Kaksh ({waitingList.length})
                </p>
                {waitingList.length === 0 ? (
                  <p className="text-xs text-[#E8DEC8]/60">No Chelas waiting right now.</p>
                ) : (
                  <div className="space-y-2">
                    {waitingList.map((w) => (
                      <div
                        key={w.uid}
                        className="p-2.5 rounded-xl bg-[#2B1547] border border-[#3D1F63] flex items-center justify-between gap-2"
                      >
                        <span className="text-xs text-[#FAF5EC] truncate">{w.displayName}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onAdmitChela(w.uid)}
                            className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-medium cursor-pointer"
                          >
                            Admit
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectChela(w.uid)}
                            className="px-2 py-1 rounded-lg bg-rose-700 text-white text-[11px] font-medium cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active Sabha Participants */}
            <div>
              <p className="text-xs font-semibold text-[#E8DEC8] mb-2">
                Sabha ({peers.length})
              </p>
              <div className="space-y-2">
                {peers.map((p) => (
                  <div
                    key={p.uid}
                    className="p-2.5 rounded-xl bg-[#2B1547] border border-[#3D1F63] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#FAF5EC] truncate flex items-center gap-1.5">
                        <span>{p.displayName}</span>
                        {p.handRaised && (
                          <span title="Pranam">
                            <Hand className="w-3.5 h-3.5 text-[#F3B33D]" />
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-[#E8DEC8]/65">
                        {p.role === 'guru' ? 'Guru (Aasan)' : 'Chela'} ·{' '}
                        {p.isMuted ? 'Maun' : 'Speaking'}
                      </p>
                    </div>
                    {isGuru && p.role !== 'guru' && (
                      <button
                        type="button"
                        onClick={() => onVidaiRemove(p.uid)}
                        className="px-2 py-1 rounded-lg bg-rose-900/70 text-rose-100 text-[11px] hover:bg-rose-800 cursor-pointer shrink-0"
                      >
                        Vidai
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pariksha' && (
          <div className="space-y-4">
            {isGuru && (
              <form
                onSubmit={handleCreatePoll}
                className="p-3 rounded-xl bg-[#2B1547] border border-[#3D1F63] space-y-2.5"
              >
                <p className="text-xs font-semibold text-[#F3B33D]">New Pariksha (Poll / Quiz)</p>
                <input
                  type="text"
                  required
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Ask a question..."
                  className="w-full px-3 py-1.5 rounded-lg bg-[#1D0E30] border border-[#3D1F63] text-xs text-[#FAF5EC]"
                />
                {pollOptions.map((opt, idx) => (
                  <input
                    key={idx}
                    type="text"
                    required={idx < 2}
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[idx] = e.target.value;
                      setPollOptions(next);
                    }}
                    placeholder={`Option ${idx + 1}`}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#1D0E30] border border-[#3D1F63] text-xs text-[#FAF5EC]"
                  />
                ))}
                <div className="flex items-center justify-between gap-2">
                  {pollOptions.length < 4 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions([...pollOptions, ''])}
                      className="inline-flex items-center gap-1 text-[11px] text-[#F3B33D] cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Option
                    </button>
                  )}
                  <button
                    type="submit"
                    className="ml-auto px-3 py-1.5 rounded-lg bg-[#E59819] text-[#1D0E30] text-xs font-semibold cursor-pointer"
                  >
                    Launch
                  </button>
                </div>
              </form>
            )}

            {polls.length === 0 ? (
              <p className="text-xs text-[#E8DEC8]/60 text-center py-6">
                No active Pariksha polls yet.
              </p>
            ) : (
              polls.map((poll) => {
                const totalVotes = Object.keys(poll.votes).length;
                const myVote = poll.votes[currentUid];
                return (
                  <div
                    key={poll.id}
                    className="p-3 rounded-xl bg-[#2B1547] border border-[#3D1F63] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-[#FAF5EC]">{poll.question}</p>
                      <span className="text-[10px] text-[#F3B33D] shrink-0">
                        {poll.status === 'open' ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {poll.options.map((opt, idx) => {
                        const count = Object.values(poll.votes).filter((v) => v === idx).length;
                        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        const selected = myVote === idx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            disabled={poll.status === 'closed'}
                            onClick={() => onVotePoll(poll.id, idx)}
                            className={`w-full text-left p-2 rounded-lg border text-xs relative overflow-hidden cursor-pointer ${
                              selected
                                ? 'border-[#E59819] bg-[#E59819]/15'
                                : 'border-[#3D1F63] bg-[#1D0E30]'
                            }`}
                          >
                            <div className="flex items-center justify-between relative z-10">
                              <span className="flex items-center gap-1.5">
                                {selected && <Check className="w-3 h-3 text-[#F3B33D]" />}
                                {opt}
                              </span>
                              <span className="font-mono-tabular text-[11px] text-[#E8DEC8]">
                                {pct}%
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {isGuru && poll.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => onClosePoll(poll.id)}
                        className="text-[11px] text-rose-300 hover:underline cursor-pointer"
                      >
                        Close Pariksha
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'baithak' && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#F3B33D]">
              Alag Baithak (Breakout Rooms)
            </p>
            <p className="text-xs text-[#E8DEC8]/75">
              Status: {breakoutActive ? 'Breakout Baithaks Active' : 'Unified Main Darbar'}
            </p>

            {isGuru ? (
              <div className="space-y-2.5">
                {peers
                  .filter((p) => p.role !== 'guru')
                  .map((p) => (
                    <div
                      key={p.uid}
                      className="p-2.5 rounded-xl bg-[#2B1547] border border-[#3D1F63] flex items-center justify-between gap-2"
                    >
                      <span className="text-xs text-[#FAF5EC] truncate">{p.displayName}</span>
                      <select
                        value={assignments[p.uid] || p.breakoutRoomId || 'main'}
                        onChange={(e) =>
                          setAssignments((prev) => ({ ...prev, [p.uid]: e.target.value }))
                        }
                        className="px-2 py-1 rounded-lg bg-[#1D0E30] border border-[#3D1F63] text-[11px] text-[#FAF5EC]"
                      >
                        <option value="main">Main Darbar</option>
                        <option value="baithak-1">Baithak 1</option>
                        <option value="baithak-2">Baithak 2</option>
                      </select>
                    </div>
                  ))}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onAssignBreakout(true, assignments)}
                    className="flex-1 py-2 rounded-lg bg-[#E59819] text-[#1D0E30] text-xs font-semibold cursor-pointer"
                  >
                    Open Baithaks
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const reset: Record<string, string> = {};
                      peers.forEach((p) => {
                        reset[p.uid] = 'main';
                      });
                      onAssignBreakout(false, reset);
                    }}
                    className="flex-1 py-2 rounded-lg bg-[#2B1547] text-[#FAF5EC] text-xs font-semibold cursor-pointer"
                  >
                    Return All
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#E8DEC8]/75">
                Your current seat:{' '}
                <span className="text-[#F3B33D] font-semibold">
                  {peers.find((p) => p.uid === currentUid)?.breakoutRoomId || 'main'}
                </span>
              </p>
            )}
          </div>
        )}

        {activeTab === 'aasan' && (
          <div className="space-y-4">
            {/* Darshan vs Sabha view */}
            <div>
              <p className="text-xs font-semibold text-[#F3B33D] mb-2">Darbar View</p>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#2B1547]">
                <button
                  type="button"
                  onClick={() => onChangeViewMode('darshan')}
                  className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    viewMode === 'darshan' ? 'bg-[#E59819] text-[#1D0E30]' : 'text-[#E8DEC8]'
                  }`}
                >
                  Darshan (Guru)
                </button>
                <button
                  type="button"
                  onClick={() => onChangeViewMode('sabha')}
                  className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    viewMode === 'sabha' ? 'bg-[#E59819] text-[#1D0E30]' : 'text-[#E8DEC8]'
                  }`}
                >
                  Sabha (Gallery)
                </button>
              </div>
            </div>

            {/* Aasan Virtual Background */}
            <div>
              <p className="text-xs font-semibold text-[#F3B33D] mb-2">
                Aasan (Virtual Background)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'none', label: 'Natural' },
                    { id: 'blur', label: 'Soft Blur' },
                    { id: 'ashram', label: 'Ashram Courtyard' },
                    { id: 'library', label: 'Granth Library' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeAasanMode(opt.id)}
                    className={`p-2 rounded-xl border text-xs font-medium cursor-pointer ${
                      aasanMode === opt.id
                        ? 'border-[#E59819] bg-[#E59819]/15 text-[#F3B33D]'
                        : 'border-[#3D1F63] bg-[#2B1547] text-[#E8DEC8]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio-Only Mode */}
            <div className="p-3 rounded-xl bg-[#2B1547] border border-[#3D1F63] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-[#F3B33D]" />
                <div>
                  <p className="text-xs font-semibold text-[#FAF5EC]">Audio Only Mode</p>
                  <p className="text-[11px] text-[#E8DEC8]/65">For slow network</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleAudioOnly}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  audioOnly ? 'bg-[#E59819] text-[#1D0E30]' : 'bg-[#1D0E30] text-[#E8DEC8]'
                }`}
              >
                {audioOnly ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Smriti Recording (Guru Only) */}
            {isGuru && (
              <div className="p-3 rounded-xl bg-[#2B1547] border border-[#3D1F63] space-y-2">
                <p className="text-xs font-semibold text-[#F3B33D]">
                  Smriti Recording (Host Only)
                </p>
                <p className="text-[11px] text-[#E8DEC8]/70">
                  Saved securely to Firebase Storage. Downloadable only by Guru on Dashboard.
                </p>
                <button
                  type="button"
                  onClick={onToggleRecording}
                  className={`w-full py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                    recordingActive
                      ? 'bg-rose-700 text-white'
                      : 'bg-[#E59819] text-[#1D0E30]'
                  }`}
                >
                  {recordingActive ? (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      <span>Stop &amp; Save Smriti</span>
                    </>
                  ) : (
                    <>
                      <Disc className="w-3.5 h-3.5" />
                      <span>Start Smriti Recording</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
