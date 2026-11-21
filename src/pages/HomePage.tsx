import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Flower2, ShieldCheck, Video } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF5EC] text-[#1D0E30]">
      <Navbar />

      <main className="flex-1">
        {/* Hero Split Section */}
        <section className="max-w-7xl mx-auto px-6 py-12 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-medium text-[#B7720A] mb-3">
                SOHBAT · Guru aur Chela ka Milan
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-[#1D0E30] leading-[1.08] mb-5">
                Baatein, Dil Se
              </h1>
              <p className="text-base sm:text-lg text-[#4A3B5C] leading-relaxed max-w-xl mb-8">
                A serene video Darbar crafted for meaningful Guru–Shishya gatherings. Enter with
                verified identity, gather in Pratiksha Kaksh, teach on Shyaam-Pat, share Gyaan
                Patra, and exchange Pranam and Aashirvad without visual clutter.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Link
                  to={user ? '/create' : '/login?next=/create'}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1D0E30] text-[#FAF5EC] text-sm font-semibold hover:bg-[#2B1547] transition-colors whitespace-nowrap shrink-0"
                >
                  Create Darbar
                  <ArrowRight className="w-4 h-4 text-[#F3B33D]" />
                </Link>
                <Link
                  to={user ? '/join' : '/login?next=/join'}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#1D0E30]/25 bg-[#F3EBDC] text-[#1D0E30] text-sm font-semibold hover:bg-[#E8DEC8] transition-colors whitespace-nowrap shrink-0"
                >
                  Join Darbar
                </Link>
              </div>

              <div className="mt-10 pt-6 border-t border-[#E8DEC8] flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#5E4E72]">
                <span>End-to-End WebRTC Video</span>
                <span aria-hidden="true">·</span>
                <span>Hashed Gupt Mantra Access</span>
                <span aria-hidden="true">·</span>
                <span>Web &amp; Android Ready</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[320px] lg:min-h-[460px] rounded-2xl overflow-hidden border border-[#E8DEC8] bg-[#1D0E30]">
                <img
                  src="/src/assets/images/hero_sohbat_sanctuary_1795230495830.jpg"
                  alt="Warm teakwood pavilion illuminated by a brass diya lamp at twilight"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1D0E30]/80 via-[#1D0E30]/15 to-transparent" />
                <div className="absolute bottom-5 left-6 right-6 text-[#FAF5EC]">
                  <p className="font-display text-lg font-medium">
                    Guruji on Aasan · Chelas seated below
                  </p>
                  <p className="text-xs text-[#E8DEC8] mt-1">
                    Darshan Speaker View &amp; Sabha Gallery View with soft sanctuary bell chime
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Strip */}
        <section className="border-t border-[#E8DEC8] bg-[#F3EBDC]/60">
          <div className="max-w-7xl mx-auto px-6 py-14">
            <div className="max-w-2xl mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#1D0E30]">
                Every Darbar tool, steeped in warmth and discipline
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="pt-4 border-t border-[#1D0E30]/15">
                <Video className="w-5 h-5 text-[#B7720A] mb-3" />
                <h3 className="font-display text-lg font-semibold text-[#1D0E30] mb-1.5">
                  01. Darshan &amp; Sabha
                </h3>
                <p className="text-sm text-[#4A3B5C] leading-relaxed">
                  Guru remains prominent above on the Aasan while Chelas sit in an organized strip
                  below, with instant audio-only mode for low bandwidth.
                </p>
              </div>

              <div className="pt-4 border-t border-[#1D0E30]/15">
                <ShieldCheck className="w-5 h-5 text-[#B7720A] mb-3" />
                <h3 className="font-display text-lg font-semibold text-[#1D0E30] mb-1.5">
                  02. Pratiksha Kaksh
                </h3>
                <p className="text-sm text-[#4A3B5C] leading-relaxed">
                  Verified login is compulsory. Chelas wait in Pratiksha Kaksh with Gupt Mantra
                  verification until Guru grants entry.
                </p>
              </div>

              <div className="pt-4 border-t border-[#1D0E30]/15">
                <BookOpen className="w-5 h-5 text-[#B7720A] mb-3" />
                <h3 className="font-display text-lg font-semibold text-[#1D0E30] mb-1.5">
                  03. Shyaam-Pat &amp; Gyaan Patra
                </h3>
                <p className="text-sm text-[#4A3B5C] leading-relaxed">
                  Guru draws live on the Shyaam-Pat blackboard or presents PDFs, images, and videos
                  directly in the center stage without popups.
                </p>
              </div>

              <div className="pt-4 border-t border-[#1D0E30]/15">
                <Flower2 className="w-5 h-5 text-[#B7720A] mb-3" />
                <h3 className="font-display text-lg font-semibold text-[#1D0E30] mb-1.5">
                  04. Pranam &amp; Aashirvad
                </h3>
                <p className="text-sm text-[#4A3B5C] leading-relaxed">
                  Chelas offer folded-hand Pranam, and Guru showers golden marigold petals across
                  every screen with Aashirvad.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E8DEC8] bg-[#FAF5EC]">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5E4E72]">
          <span className="font-display text-sm font-semibold text-[#1D0E30]">
            SOHBAT — Baatein, Dil Se
          </span>
          <div className="flex items-center gap-6">
            <Link to="/create" className="hover:text-[#1D0E30]">
              Create Darbar
            </Link>
            <Link to="/join" className="hover:text-[#1D0E30]">
              Join Darbar
            </Link>
            <Link to="/dashboard" className="hover:text-[#1D0E30]">
              Guru Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
