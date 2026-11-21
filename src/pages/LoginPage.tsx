import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  updateProfile,
  type ConfirmationResult,
} from 'firebase/auth';
import { Mail, Phone, ShieldCheck } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

type AuthTab = 'google' | 'phone' | 'email';

export function LoginPage() {
  const { user, isVerified, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next') || '/dashboard';

  const [tab, setTab] = useState<AuthTab>('google');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Phone OTP state
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  // Email state
  const [isRegister, setIsRegister] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user && isVerified) {
      navigate(nextPath, { replace: true });
    }
  }, [user, isVerified, navigate, nextPath]);

  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    };
  }, []);

  const handleGoogleLogin = async () => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'sohbat-recaptcha-container', {
          size: 'invisible',
        });
      }
      const result = await signInWithPhoneNumber(auth, phone.trim(), recaptchaRef.current);
      setConfirmation(result);
      setNotice('OTP bheja gaya hai. Kripya 6-digit code darj karein.');
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} (Ensure Phone provider is enabled in Firebase Authentication Console.)`
          : 'Failed to send OTP.'
      );
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmation) return;
    setError('');
    setBusy(true);
    try {
      await confirmation.confirm(otp.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP code.');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 80) });
        }
        await sendEmailVerification(cred.user);
        setNotice(
          'Verification email bhej diya gaya hai. Kripya inbox verify karke niche status check karein.'
        );
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (!cred.user.emailVerified) {
          await sendEmailVerification(cred.user);
          setNotice('Email verify nahi hua hai. Verification link dubara bheja gaya hai.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF5EC] text-[#1D0E30]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white border border-[#E8DEC8] rounded-2xl p-8">
          <div className="flex items-center gap-2 text-xs font-medium text-[#B7720A] mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Verified Pravesh Compulsory</span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-[#1D0E30] mb-2">
            SOHBAT Pravesh
          </h1>
          <p className="text-sm text-[#4A3B5C] mb-6">
            Darbar me pravesh ke liye Google, Phone OTP ya verified Email se login karein.
          </p>

          {/* Pending email verification banner */}
          {user && !isVerified && (
            <div className="mb-6 p-4 rounded-xl bg-[#F3EBDC] border border-[#E59819]/40 text-sm">
              <p className="font-semibold text-[#1D0E30] mb-1">Email Verification Pending</p>
              <p className="text-xs text-[#4A3B5C] mb-3">
                Signed in as {user.email}. Click the verification link in your inbox, then refresh.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={refreshUser}
                  className="px-3 py-1.5 rounded-lg bg-[#1D0E30] text-[#FAF5EC] text-xs font-medium cursor-pointer"
                >
                  Check Verification Status
                </button>
                <button
                  type="button"
                  onClick={() => sendEmailVerification(user)}
                  className="px-3 py-1.5 rounded-lg border border-[#1D0E30]/25 text-[#1D0E30] text-xs font-medium cursor-pointer"
                >
                  Resend Email
                </button>
              </div>
            </div>
          )}

          {/* Segmented Auth Method Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#F3EBDC] rounded-xl mb-6">
            <button
              type="button"
              onClick={() => setTab('google')}
              className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'google'
                  ? 'bg-[#1D0E30] text-[#FAF5EC]'
                  : 'text-[#4A3B5C] hover:text-[#1D0E30]'
              }`}
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => setTab('phone')}
              className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'phone'
                  ? 'bg-[#1D0E30] text-[#FAF5EC]'
                  : 'text-[#4A3B5C] hover:text-[#1D0E30]'
              }`}
            >
              Phone OTP
            </button>
            <button
              type="button"
              onClick={() => setTab('email')}
              className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'email'
                  ? 'bg-[#1D0E30] text-[#FAF5EC]'
                  : 'text-[#4A3B5C] hover:text-[#1D0E30]'
              }`}
            >
              Email
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-[#E59819]/40 text-xs text-[#7C4D06]">
              {notice}
            </div>
          )}

          {tab === 'google' && (
            <div className="space-y-4">
              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleLogin}
                className="w-full py-3 px-4 rounded-xl bg-[#1D0E30] text-[#FAF5EC] text-sm font-semibold hover:bg-[#2B1547] transition-colors disabled:opacity-60 cursor-pointer"
              >
                {busy ? 'Connecting...' : 'Continue with Google'}
              </button>
              <p className="text-xs text-[#5E4E72] text-center">
                Instant verified entry for both Guru and Chela accounts.
              </p>
            </div>
          )}

          {tab === 'phone' && (
            <div className="space-y-4">
              {!confirmation ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#4A3B5C] mb-1.5">
                      Mobile Number (with country code)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#5E4E72] absolute left-3.5 top-3" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] bg-[#FAF5EC] text-sm focus:outline-none focus:border-[#1D0E30]"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-3 rounded-xl bg-[#1D0E30] text-[#FAF5EC] text-sm font-semibold hover:bg-[#2B1547] transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {busy ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#4A3B5C] mb-1.5">
                      Enter 6-digit OTP
                    </label>
                    <input
                      type="text"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="123456"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E8DEC8] bg-[#FAF5EC] text-sm font-mono-tabular tracking-widest focus:outline-none focus:border-[#1D0E30]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-3 rounded-xl bg-[#E59819] text-[#1D0E30] text-sm font-semibold hover:bg-[#F3B33D] transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {busy ? 'Verifying...' : 'Verify OTP & Enter'}
                  </button>
                </form>
              )}
              <div id="sohbat-recaptcha-container" />
            </div>
          )}

          {tab === 'email' && (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isRegister && (
                <div>
                  <label className="block text-xs font-medium text-[#4A3B5C] mb-1.5">
                    Shubh Naam (Display Name)
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Acharya / Sadhak Name"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E8DEC8] bg-[#FAF5EC] text-sm focus:outline-none focus:border-[#1D0E30]"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-[#4A3B5C] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#5E4E72] absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8DEC8] bg-[#FAF5EC] text-sm focus:outline-none focus:border-[#1D0E30]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4A3B5C] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E8DEC8] bg-[#FAF5EC] text-sm focus:outline-none focus:border-[#1D0E30]"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl bg-[#1D0E30] text-[#FAF5EC] text-sm font-semibold hover:bg-[#2B1547] transition-colors disabled:opacity-60 cursor-pointer"
              >
                {busy ? 'Please wait...' : isRegister ? 'Create Verified Account' : 'Sign In with Email'}
              </button>
              <button
                type="button"
                onClick={() => setIsRegister((v) => !v)}
                className="w-full text-xs text-[#4A3B5C] hover:text-[#1D0E30] underline underline-offset-4 cursor-pointer"
              >
                {isRegister ? 'Already registered? Sign In' : 'New Sadhak? Create account'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
