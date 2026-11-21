import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Lock, User } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { lookupDarbarByCode, requestPratikshaEntry } from '../lib/darbarService';
import { normalizeRoomCode, verifyGuptMantra } from '../lib/crypto';

export function JoinDarbarPage() {
  const { user, loading, isVerified } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [roomCode, setRoomCode] = useState(searchParams.get('code') || 'SOHBAT-');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [mantra, setMantra] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && (!user || !isVerified)) {
    const codeQuery = searchParams.get('code')
      ? `?next=${encodeURIComponent(`/join?code=${searchParams.get('code')}`)}`
      : '?next=/join';
    return (
      <div className="min-h-screen flex flex-col bg-[#FAF5EC] text-[#1D0E30]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E8DEC8] rounded-2xl p-8 text-center">
            <h1 className="font-display text-2xl font-semibold mb-2">Verified Login Required</h1>
            <p className="text-sm text-[#4A3B5C] mb-6">
              Chela pravesh bina login ke sambhav nahi hai. Kripya pehle sign in karein.
            </p>
            <Link
              to={`/login${codeQuery}`}
              className="inline-block px-6 py-3 rounded-xl bg-[#1D0E30] text-[#FAF5EC] text-sm font-semibold"
            >
              Sign In to Join
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setSubmitting(true);

    try {
      const normalized = normalizeRoomCode(roomCode);
      const room = await lookupDarbarByCode(normalized);
      if (!room) {
        setError('Yeh Darbar code nahi mila. Kripya SOHBAT-XXXX code jaanch karein.');
        setSubmitting(false);
        return;
      }

      if (room.status === 'ended') {
        setError('Yeh Darbar sampann ho chuka hai.');
        setSubmitting(false);
        return;
      }

      if (room.isLocked && room.hostUid !== user.uid) {
        setError('Darbar abhi Guruji dwara band (locked) kiya gaya hai.');
        setSubmitting(false);
        return;
      }

      if (room.hasPassword && room.hostUid !== user.uid) {
        if (!mantra.trim()) {
          setError('Is Darbar ke liye Gupt Mantra (password) darj karein.');
          setSubmitting(false);
          return;
        }
        const ok = await verifyGuptMantra(mantra, room.passwordHash || '');
        if (!ok) {
          setError('Gupt Mantra galat hai. Dubara prayas karein.');
          setSubmitting(false);
          return;
        }
      }

      const finalName = displayName.trim() || user.displayName || 'Chela';
      if (room.hostUid !== user.uid) {
        await requestPratikshaEntry(room.roomId, room.hostUid, user.uid, finalName);
      }

      navigate(`/room/${room.roomId}`, {
        state: { displayName: finalName },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to enter Pratiksha Kaksh.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF5EC] text-[#1D0E30]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white border border-[#E8DEC8] rounded-2xl p-8">
          <p className="text-xs font-medium text-[#B7720A] mb-2">Chela Pravesh</p>
          <h1 className="font-display text-3xl font-semibold text-[#1D0E30] mb-2">
            Join Darbar
          </h1>
          <p className="text-sm text-[#4A3B5C] mb-6">
            Enter the SOHBAT room code to step into Pratiksha Kaksh and await Guruji&apos;s
            admission.
          </p>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#4A3B5C] mb-1.5">
                Room Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#5E4E72] absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="SOHBAT-1234"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] bg-[#FAF5EC] text-sm font-mono-tabular uppercase focus:outline-none focus:border-[#1D0E30]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A3B5C] mb-1.5">
                Aapka Naam (Chela Name)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#5E4E72] absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Shubh Naam"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] bg-[#FAF5EC] text-sm focus:outline-none focus:border-[#1D0E30]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A3B5C] mb-1.5">
                Gupt Mantra (If set by Guru)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5E4E72] absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={mantra}
                  onChange={(e) => setMantra(e.target.value)}
                  placeholder="Optional password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] bg-[#FAF5EC] text-sm focus:outline-none focus:border-[#1D0E30]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-[#1D0E30] text-[#FAF5EC] text-sm font-semibold hover:bg-[#2B1547] transition-colors disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Entering Pratiksha Kaksh...' : 'Enter Pratiksha Kaksh'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
