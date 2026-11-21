import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Download, Film, Plus, Video } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import {
  fetchHostDashboard,
  getSmritiDownloadUrl,
  type DarbarRoomDoc,
  type SmritiRecordingDoc,
} from '../lib/darbarService';

export function DashboardPage() {
  const { user, loading, isVerified } = useAuth();
  const navigate = useNavigate();

  const [darbars, setDarbars] = useState<DarbarRoomDoc[]>([]);
  const [recordings, setRecordings] = useState<SmritiRecordingDoc[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isVerified) {
      setFetching(false);
      return;
    }

    let cancelled = false;
    setFetching(true);
    fetchHostDashboard(user.uid)
      .then((res) => {
        if (!cancelled) {
          setDarbars(res.darbars);
          setRecordings(res.recordings);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
        }
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, isVerified]);

  const handleDownloadSmriti = async (rec: SmritiRecordingDoc) => {
    setDownloadingId(rec.id);
    try {
      const url = await getSmritiDownloadUrl(rec.storagePath);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${rec.roomCode}_${rec.title}.webm`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!loading && (!user || !isVerified)) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAF5EC] text-[#1D0E30]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E8DEC8] rounded-2xl p-8 text-center">
            <h1 className="font-display text-2xl font-semibold mb-2">Guru Dashboard</h1>
            <p className="text-sm text-[#4A3B5C] mb-6">
              Sign in to view your upcoming Satsang schedule, past Darbars, and host-only Smriti
              recordings.
            </p>
            <Link
              to="/login?next=/dashboard"
              className="inline-block px-6 py-3 rounded-xl bg-[#1D0E30] text-[#FAF5EC] text-sm font-semibold"
            >
              Sign In
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const upcoming = darbars.filter((d) => d.status !== 'ended');
  const past = darbars.filter((d) => d.status === 'ended');

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF5EC] text-[#1D0E30]">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E8DEC8] pb-6">
          <div>
            <p className="text-xs font-medium text-[#B7720A] mb-1">Guru Sabha Management</p>
            <h1 className="font-display text-3xl font-semibold text-[#1D0E30]">
              Guru Dashboard
            </h1>
          </div>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D0E30] text-[#FAF5EC] text-xs font-semibold hover:bg-[#2B1547] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 text-[#F3B33D]" />
            New Darbar
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}

        {/* Upcoming & Live Darbars */}
        <section>
          <h2 className="font-display text-xl font-semibold text-[#1D0E30] mb-4">
            Upcoming &amp; Active Satsangs
          </h2>
          {fetching ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-[#F3EBDC] animate-pulse" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="p-8 rounded-2xl border border-[#E8DEC8] bg-white text-center">
              <p className="text-sm text-[#4A3B5C] mb-4">
                Abhi koi upcoming ya active Darbar nahi hai.
              </p>
              <Link
                to="/create"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D0E30] text-[#FAF5EC] text-xs font-semibold"
              >
                Schedule First Satsang
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcoming.map((room) => (
                <div
                  key={room.roomId}
                  className="p-5 rounded-2xl border border-[#E8DEC8] bg-white flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#5E4E72] mb-1">
                      <span className="font-mono-tabular font-semibold text-[#B7720A]">
                        {room.roomCode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{room.status === 'live' ? 'Live Now' : 'Scheduled'}</span>
                      {room.recurrence !== 'none' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{room.recurrence}</span>
                        </>
                      )}
                    </div>
                    <h3 className="font-display text-lg font-semibold text-[#1D0E30] truncate">
                      {room.title}
                    </h3>
                    {room.scheduledFor && (
                      <p className="text-xs text-[#5E4E72] mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(room.scheduledFor).toLocaleString()}</span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/room/${room.roomId}`)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1D0E30] text-[#FAF5EC] text-xs font-semibold hover:bg-[#2B1547] transition-colors shrink-0 cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5 text-[#F3B33D]" />
                    Enter
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Smriti Recordings (Host-Only Download) */}
        <section>
          <h2 className="font-display text-xl font-semibold text-[#1D0E30] mb-4">
            Smriti Recordings (Host Only)
          </h2>
          {recordings.length === 0 ? (
            <div className="p-6 rounded-2xl border border-[#E8DEC8] bg-white text-sm text-[#4A3B5C]">
              Recorded sessions will appear here and remain downloadable exclusively by you.
            </div>
          ) : (
            <div className="border border-[#E8DEC8] rounded-2xl bg-white divide-y divide-[#E8DEC8]">
              {recordings.map((rec) => (
                <div
                  key={rec.id}
                  className="p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Film className="w-5 h-5 text-[#B7720A] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1D0E30] truncate">{rec.title}</p>
                      <p className="text-xs text-[#5E4E72] font-mono-tabular">
                        {rec.roomCode} · {rec.durationSec}s
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={downloadingId === rec.id}
                    onClick={() => handleDownloadSmriti(rec)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E8DEC8] text-xs font-semibold text-[#1D0E30] hover:bg-[#F3EBDC] cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloadingId === rec.id ? 'Preparing...' : 'Download'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past Satsangs */}
        <section>
          <h2 className="font-display text-xl font-semibold text-[#1D0E30] mb-4">
            Past Satsang Archive
          </h2>
          {past.length === 0 ? (
            <p className="text-sm text-[#5E4E72]">No completed Darbars yet.</p>
          ) : (
            <div className="border border-[#E8DEC8] rounded-2xl bg-white divide-y divide-[#E8DEC8]">
              {past.map((room) => (
                <div key={room.roomId} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1D0E30] truncate">{room.title}</p>
                    <p className="text-xs text-[#5E4E72] font-mono-tabular">
                      {room.roomCode} · Ephemeral Arz chat cleared
                    </p>
                  </div>
                  <span className="text-xs text-[#5E4E72] shrink-0">Sampann</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
