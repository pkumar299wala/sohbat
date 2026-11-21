import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Check, Copy, Lock, Sparkles } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { createDarbar, type DarbarRoomDoc, type RecurrenceType } from '../lib/darbarService';

export function CreateDarbarPage() {
  const { user, loading, isVerified } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('Pratahkalin Satsang');
  const [hostName, setHostName] = useState(user?.displayName || 'Guruji');
  const [mantra, setMantra] = useState('');
  const [startNow, setStartNow] = useState(true);
  const [scheduledFor, setScheduledFor] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdRoom, setCreatedRoom] = useState<DarbarRoomDoc | null>(null);
  const [copied, setCopied] = useState(false);

  if (!loading && (!user || !isVerified)) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAF5EC] text-[#1D0E30]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E8DEC8] rounded-2xl p-8 text-center">
            <h1 className="font-display text-2xl font-semibold mb-2">Guru Login Required</h1>
            <p className="text-sm text-[#4A3B5C] mb-6">
              Darbar sthapit karne ke liye verified login anivarya hai.
            </p>
            <Link
              to="/login?next=/create"
              className="inline-block px-6 py-3 rounded-xl bg-[#1D0E30] text-[#FAF5EC] text-sm font-semibold"
            >
              Proceed to Login
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setSubmitting(true);
    try {
      const room = await createDarbar({
        title,
        hostUid: user.uid,
        hostName: hostName || user.displayName || 'Guruji',
        mantra: mantra.trim() || undefined,
        scheduledFor: !startNow && scheduledFor ? scheduledFor : undefined,
        recurrence,
        startNow,
      });
      setCreatedRoom(room);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create Darbar.');
    } finally {
      setSubmitting(false);
    }
  };

  const shareUrl = createdRoom
    ? `${window.location.origin}/join?code=${encodeURIComponent(createdRoom.roomCode)}`
    : '';

  const copyInvite = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(
      `SOHBAT Darbar: ${createdRoom?.title}\nRoom Code: ${createdRoom?.roomCode}\nLink: ${shareUrl}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF5EC] text-[#1D0E30]">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
        {!createdRoom ? (
          <div className="bg-white border border-[#E8DEC8] rounded-2xl p-8">
            <p className="text-xs font-medium text-[#B7720A] mb-2">Guru Aasan Setup</p>
            <h1 className="font-display text-3xl font-semibold text-[#1D0E30] mb-2">
              Create New Darbar
            </h1>
            <p className="text-sm text-[#4A3B5C] mb-8">
              Set your Satsang topic, optional Gupt Mantra password, and Satsang ka Samay schedule.
            </p>

            {error && (
              <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-[#4A3B5C] mb-1.5">
                    Darbar / Satsang Title
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Gita Chintan Sabha"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E8DEC8] bg-[#FAF5EC] text-sm focus:outline-none focus:border-[#1D0E30]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A3B5C] mb-1.5">
                    Guru Display Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    placeholder="Guruji"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E8DEC8] bg-[#FAF5EC] text-sm focus:outline-none focus:border-[#1D0E30]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A3B5C] mb-1.5">
                  Gupt Mantra (Optional Room Password — Stored Hashed)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5E4E72] absolute left-3.5 top-3" />
                  <input
                    type="password"
                    maxLength={64}
                    value={mantra}
                    onChange={(e) => setMantra(e.target.value)}
                    placeholder="Leave blank for Pratiksha Kaksh admission only"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] bg-[#FAF5EC] text-sm focus:outline-none focus:border-[#1D0E30]"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[#E8DEC8]">
                <label className="block text-xs font-medium text-[#4A3B5C] mb-3">
                  Satsang ka Samay (Timing)
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#F3EBDC] rounded-xl mb-4 max-w-sm">
                  <button
                    type="button"
                    onClick={() => setStartNow(true)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      startNow ? 'bg-[#1D0E30] text-[#FAF5EC]' : 'text-[#4A3B5C]'
                    }`}
                  >
                    Start Immediately
                  </button>
                  <button
                    type="button"
                    onClick={() => setStartNow(false)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      !startNow ? 'bg-[#1D0E30] text-[#FAF5EC]' : 'text-[#4A3B5C]'
                    }`}
                  >
                    Schedule Later
                  </button>
                </div>

                {!startNow && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#4A3B5C] mb-1.5">
                        Date &amp; Time
                      </label>
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-[#5E4E72] absolute left-3.5 top-3" />
                        <input
                          type="datetime-local"
                          required={!startNow}
                          value={scheduledFor}
                          onChange={(e) => setScheduledFor(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] bg-[#FAF5EC] text-sm focus:outline-none focus:border-[#1D0E30]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#4A3B5C] mb-1.5">
                        Recurring Satsang
                      </label>
                      <select
                        value={recurrence}
                        onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#E8DEC8] bg-[#FAF5EC] text-sm focus:outline-none focus:border-[#1D0E30]"
                      >
                        <option value="none">One-time Darbar</option>
                        <option value="daily">Daily Nitya Satsang</option>
                        <option value="weekly">Weekly Ravivar Sabha</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#1D0E30] text-[#FAF5EC] text-sm font-semibold hover:bg-[#2B1547] transition-colors disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Establishing Darbar...' : 'Establish Darbar'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white border border-[#E8DEC8] rounded-2xl p-8">
            <div className="flex items-center gap-2 text-xs font-medium text-[#B7720A] mb-2">
              <Sparkles className="w-4 h-4" />
              <span>Darbar Sthapit</span>
            </div>
            <h1 className="font-display text-3xl font-semibold text-[#1D0E30] mb-2">
              {createdRoom.title}
            </h1>
            <p className="text-sm text-[#4A3B5C] mb-6">
              Share this Room Code and invite link with your Chelas. Every entrant waits in
              Pratiksha Kaksh until you admit them.
            </p>

            <div className="p-5 rounded-xl bg-[#F3EBDC] border border-[#E8DEC8] mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-[#5E4E72] mb-1">Room Code</p>
                <p className="font-mono-tabular text-2xl font-semibold text-[#1D0E30]">
                  {createdRoom.roomCode}
                </p>
                <p className="text-xs text-[#5E4E72] mt-1 break-all">{shareUrl}</p>
              </div>
              <button
                type="button"
                onClick={copyInvite}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E8DEC8] text-xs font-semibold text-[#1D0E30] hover:bg-[#FAF5EC] transition-colors cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy Invite'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => navigate(`/room/${createdRoom.roomId}`)}
                className="px-6 py-3 rounded-xl bg-[#1D0E30] text-[#FAF5EC] text-sm font-semibold hover:bg-[#2B1547] transition-colors cursor-pointer"
              >
                Enter Darbar as Guru
              </button>
              <Link
                to="/dashboard"
                className="px-6 py-3 rounded-xl border border-[#E8DEC8] text-sm font-semibold text-[#1D0E30] hover:bg-[#F3EBDC] transition-colors"
              >
                View Dashboard
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
