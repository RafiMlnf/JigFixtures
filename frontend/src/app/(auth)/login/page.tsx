'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { login, user } = useApp();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // If already logged in, redirect to dashboard
  React.useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      await login(email, password);
      router.push('/');
    } catch (e: any) {
      setErrorMsg(e.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (quickEmail: string, quickNpk: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await login(quickEmail, quickNpk);
      router.push('/');
    } catch (e: any) {
      setErrorMsg(e.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/50 to-slate-100 h-full w-full p-4 select-none relative overflow-hidden">

      {/* Background Image with 40% Opacity */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none z-0"
        style={{
          backgroundImage: "url('/assets/img/bgmtm.jpg')",
          opacity: 0.4
        }}
      />

      <div className="w-[450px] max-w-full bg-white/90 backdrop-blur-xl border border-gray-200 rounded-3xl p-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)] flex flex-col z-10 transition-all duration-300">

        {/* Logos Header: Mengisi lebar card secara natural & proporsional */}
        <div className="flex items-center justify-between w-full gap-6 mb-6 pb-5 border-b border-gray-150 px-2">
          {/* Logo Jig (Kompak/Kotak, lebih tinggi & tegas) */}
          <div className="shrink-0 flex items-center justify-center">
            <img
              src="/assets/img/logoapp.png"
              alt="Logo Jig & Fixtures"
              className="h-16 w-auto object-contain brightness-0 drop-shadow-sm"
            />
          </div>

          {/* Garis pembatas vertikal */}
          <div className="h-12 border-r border-gray-300 shrink-0 self-center" />

          {/* Logo MTM (Wide/Memanjang, mengisi ruang sisa lebar kartu) */}
          <div className="flex-1 flex items-center justify-end">
            <img
              src="/assets/img/mtmwide.png"
              alt="Logo MTM"
              className="h-12 max-w-full w-auto object-contain opacity-95"
            />
          </div>
        </div>

        {/* Form Container */}
        <div className="w-full flex flex-col justify-center">

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">NPK or Username</label>
              <div className="relative flex items-center border border-gray-300 rounded-xl bg-gray-50 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-shadow overflow-hidden">
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="..."
                  className="w-full bg-transparent px-4 py-2.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Password</label>
              <div className="relative flex items-center border border-gray-300 rounded-xl bg-gray-50 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-shadow overflow-hidden">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent pl-4 pr-10 py-2.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center cursor-pointer select-none"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showPassword ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-[10px] font-semibold p-2.5 rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-[#0063ff] hover:bg-[#0052d4] text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Login</span>
                  <span className="material-symbols-outlined text-sm">login</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Access - 4 buttons in a horizontal row */}
          <div className="mt-4 pt-3 border-t border-gray-150">
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">
              Akses Cepat (Quick Login)
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {/* 1. Drafter: Kukuh W. (NPK: NPK001) */}
              <button
                type="button"
                onClick={() => handleQuickLogin('admin', 'NPK001')}
                className="py-1.5 px-1 bg-blue-50/60 hover:bg-blue-100/80 border border-blue-200/80 rounded-lg text-gray-700 hover:text-blue-800 flex flex-col items-center text-center transition-all cursor-pointer shadow-3xs"
                title="Login sebagai Drafter (Kukuh W. / NPK001)"
              >
                <span className="material-symbols-outlined text-[13px] text-blue-600 mb-0.5">engineering</span>
                <span className="text-[8px] font-bold text-gray-800 leading-tight truncate w-full">Kukuh W.</span>
                <span className="text-[7px] text-blue-600 font-semibold leading-tight">Drafter</span>
              </button>

              {/* 2. Section Head: M. Fariedl (NPK: NPK002) */}
              <button
                type="button"
                onClick={() => handleQuickLogin('sec@example.com', 'NPK002')}
                className="py-1.5 px-1 bg-amber-50/60 hover:bg-amber-100/80 border border-amber-200/80 rounded-lg text-gray-700 hover:text-amber-800 flex flex-col items-center text-center transition-all cursor-pointer shadow-3xs"
                title="Login sebagai Section Head (M. Fariedl / NPK002)"
              >
                <span className="material-symbols-outlined text-[13px] text-amber-600 mb-0.5">fact_check</span>
                <span className="text-[8px] font-bold text-gray-800 leading-tight truncate w-full">M. Fariedl</span>
                <span className="text-[7px] text-amber-600 font-semibold leading-tight">Section</span>
              </button>

              {/* 3. Dept Head: Rahmat K. (NPK: NPK003) */}
              <button
                type="button"
                onClick={() => handleQuickLogin('dept@example.com', 'NPK003')}
                className="py-1.5 px-1 bg-emerald-50/60 hover:bg-emerald-100/80 border border-emerald-200/80 rounded-lg text-gray-700 hover:text-emerald-800 flex flex-col items-center text-center transition-all cursor-pointer shadow-3xs"
                title="Login sebagai Dept Head (Rahmat K. / NPK003)"
              >
                <span className="material-symbols-outlined text-[13px] text-emerald-600 mb-0.5">verified_user</span>
                <span className="text-[8px] font-bold text-gray-800 leading-tight truncate w-full">Rahmat K.</span>
                <span className="text-[7px] text-emerald-600 font-semibold leading-tight">Dept Head</span>
              </button>

              {/* 4. Guest / Tamu (NPK: NPK004) */}
              <button
                type="button"
                onClick={() => handleQuickLogin('guest@example.com', 'NPK004')}
                className="py-1.5 px-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-600 hover:text-gray-900 flex flex-col items-center text-center transition-all cursor-pointer shadow-3xs"
                title="Login sebagai Tamu / Guest (NPK004)"
              >
                <span className="material-symbols-outlined text-[13px] text-gray-500 mb-0.5">visibility</span>
                <span className="text-[8px] font-bold text-gray-800 leading-tight truncate w-full">Tamu</span>
                <span className="text-[7px] text-gray-500 font-semibold leading-tight">Guest</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
