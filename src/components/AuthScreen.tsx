import React, { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { Building, ShieldAlert, Key, User, ArrowRight, Lock, Clock, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AuthScreenProps {
  onLoginSuccess: (token: string) => void;
}

interface LocalLockoutState {
  lockoutUntil: number; // timestamp ms
  lockoutCount: number;
  failedAttempts: number;
}

const STORAGE_KEY = "apartmentpro_auth_lockout";

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sanitizationNotice, setSanitizationNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Rate Limiting & Lockout state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutCount, setLockoutCount] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Client-side input sanitization function
  const sanitizeInput = (val: string, maxLen: number = 100): { cleaned: string; wasSanitized: boolean } => {
    // Check for dangerous injection characters or HTML/script tags
    const hasDangerousChars = /[<>"'`;\\$\0]/.test(val) || /<[^>]*>?/gm.test(val);
    const cleaned = val
      .replace(/\0/g, "")
      .replace(/<[^>]*>?/gm, "")
      .replace(/[<>"'`;\\$]/g, "")
      .slice(0, maxLen);
    return { cleaned, wasSanitized: hasDangerousChars };
  };

  // Load saved lockout state on mount & sync with server
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: LocalLockoutState = JSON.parse(stored);
        const now = Date.now();
        if (parsed.lockoutUntil && parsed.lockoutUntil > now) {
          setLockoutUntil(parsed.lockoutUntil);
          setLockoutCount(parsed.lockoutCount || 1);
          setRemainingSeconds(Math.ceil((parsed.lockoutUntil - now) / 1000));
        } else {
          setFailedAttempts(parsed.failedAttempts || 0);
          setLockoutCount(parsed.lockoutCount || 0);
        }
      }
    } catch {
      // Ignore local storage error
    }

    // Check with server
    api.getAuthStatus().then((status) => {
      if (status.locked && status.remainingSeconds) {
        const until = Date.now() + (status.remainingSeconds * 1000);
        setLockoutUntil(until);
        setLockoutCount(status.lockoutCount || 1);
        setRemainingSeconds(status.remainingSeconds);
        saveLockoutState(until, status.lockoutCount || 1, 0);
      } else if (status.attemptsLeft !== undefined) {
        setFailedAttempts(Math.max(0, 3 - status.attemptsLeft));
      }
    });
  }, []);

  const saveLockoutState = (until: number, count: number, failed: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        lockoutUntil: until,
        lockoutCount: count,
        failedAttempts: failed
      }));
    } catch {
      // ignore
    }
  };

  // Active countdown timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (lockoutUntil > Date.now()) {
      const updateTimer = () => {
        const now = Date.now();
        const diff = Math.ceil((lockoutUntil - now) / 1000);
        if (diff <= 0) {
          setRemainingSeconds(0);
          setLockoutUntil(0);
          setFailedAttempts(0);
          setError(null);
          saveLockoutState(0, lockoutCount, 0);
          if (timerRef.current) clearInterval(timerRef.current);
        } else {
          setRemainingSeconds(diff);
        }
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      setRemainingSeconds(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockoutUntil, lockoutCount]);

  // Handle Username Change with Sanitization
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const { cleaned, wasSanitized } = sanitizeInput(raw, 50);
    setUsername(cleaned);

    if (wasSanitized) {
      setSanitizationNotice("Special characters (<, >, \", ', `, ;, $, \\) were automatically stripped for security.");
      setTimeout(() => setSanitizationNotice(null), 4000);
    }
  };

  // Handle Password Change with Sanitization
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const { cleaned, wasSanitized } = sanitizeInput(raw, 100);
    setPassword(cleaned);

    if (wasSanitized) {
      setSanitizationNotice("Special characters were automatically sanitized.");
      setTimeout(() => setSanitizationNotice(null), 4000);
    }
  };

  const isLockedOut = remainingSeconds > 0;

  // Progressive lockout duration helper for UI display
  const getNextLockoutMinutes = (count: number) => {
    if (count <= 0) return 1;
    if (count === 1) return 5;
    if (count === 2) return 15;
    if (count === 3) return 30;
    return 60;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) return;

    setError(null);
    setLoading(true);

    const { cleaned: cleanUser } = sanitizeInput(username.trim(), 50);
    const { cleaned: cleanPass } = sanitizeInput(password.trim(), 100);

    if (!cleanUser || !cleanPass) {
      setError("Please provide a valid username and password.");
      setLoading(false);
      return;
    }

    try {
      const data = await api.login(cleanUser, cleanPass);
      if (data.success && data.token) {
        // Reset lockout storage
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem("apartmentpro_token", data.token);
        onLoginSuccess(data.token);
      }
    } catch (err: any) {
      const resData = err.data;
      if (resData?.locked) {
        const durationSec = resData.remainingSeconds || 60;
        const until = Date.now() + (durationSec * 1000);
        const count = resData.lockoutCount || (lockoutCount + 1);

        setLockoutUntil(until);
        setLockoutCount(count);
        setRemainingSeconds(durationSec);
        setFailedAttempts(0);
        saveLockoutState(until, count, 0);

        setError(resData.message || `Maximum failed attempts reached. Account is locked for ${resData.lockoutMinutes || 1} minute(s).`);
      } else {
        const newFailed = failedAttempts + 1;
        setFailedAttempts(newFailed);
        saveLockoutState(0, lockoutCount, newFailed);

        const left = resData?.attemptsLeft ?? Math.max(0, 3 - newFailed);
        setError(resData?.message || `Invalid credentials, ${left} attempt${left === 1 ? '' : 's'} remaining`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Format MM:SS for countdown timer
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Graphic Accents */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-brand-orange/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center items-center gap-3">
          <div className="p-3 bg-brand-orange text-white rounded-2xl shadow-lg">
            <Building className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Apartment<span className="text-brand-orange">Pro</span>
            </h1>
            <span className="block text-[10px] text-slate-400 font-mono tracking-widest uppercase font-bold">Property Administration</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-xl font-bold text-slate-200">
          Sign in to your manager portal
        </h2>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-800 py-7 px-5 shadow-2xl rounded-2xl sm:px-8 border border-slate-700/50 space-y-5">
          
          {/* Active Lockout Banner */}
          <AnimatePresence>
            {isLockedOut && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="p-4 bg-gradient-to-r from-rose-950/80 to-red-900/80 border-2 border-rose-500/60 rounded-2xl shadow-lg text-white space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-rose-600 text-white rounded-xl animate-pulse">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black tracking-wide uppercase text-rose-200">
                        Login Locked
                      </h4>
                      <p className="text-[11px] text-rose-300">
                        Maximum failed login attempts reached
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-rose-500/30 text-rose-200 border border-rose-400/40 text-[10px] font-bold rounded uppercase">
                    Security Active
                  </span>
                </div>

                <div className="bg-slate-900/80 rounded-xl p-3 border border-rose-500/30 flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs text-slate-300">
                    <Clock className="w-4 h-4 text-rose-400" />
                    <span>Time Remaining:</span>
                  </div>
                  <div className="font-mono text-xl font-black text-rose-400 tracking-wider">
                    {formatTime(remainingSeconds)}
                  </div>
                </div>

                <p className="text-[11px] text-rose-200/80 leading-tight">
                  Next failed lockout duration will escalate to <strong className="text-white font-bold">{getNextLockoutMinutes(lockoutCount)} minutes</strong>.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sanitization Notice */}
          <AnimatePresence>
            {sanitizationNotice && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="p-3 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-xl text-xs flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>{sanitizationNotice}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Regular Error Notification */}
          <AnimatePresence>
            {error && !isLockedOut && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-start gap-2.5"
              >
                <ShieldAlert className="w-4.5 h-4.5 flex-shrink-0 mt-0.5 text-rose-400" />
                <div className="flex-1 space-y-1">
                  <p className="font-medium leading-relaxed">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Admin Username
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="h-4.5 w-4.5" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  disabled={isLockedOut || loading}
                  placeholder="Username"
                  value={username}
                  onChange={handleUsernameChange}
                  autoComplete="username"
                  maxLength={50}
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Key className="h-4.5 w-4.5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  disabled={isLockedOut || loading}
                  placeholder="Password"
                  value={password}
                  onChange={handlePasswordChange}
                  autoComplete="current-password"
                  maxLength={100}
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || isLockedOut}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-brand-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-orange active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-orange"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : isLockedOut ? (
                  <>
                    <Lock className="w-4 h-4 text-white/80" />
                    <span>Locked ({formatTime(remainingSeconds)})</span>
                  </>
                ) : (
                  <>
                    <span>Login to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
