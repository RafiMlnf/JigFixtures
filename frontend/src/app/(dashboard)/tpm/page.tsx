'use client';

import React from 'react';

export default function TPMPage() {
  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
            <span className="material-symbols-outlined text-2xl">build_circle</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">
              TPM (Total Productive Maintenance)
            </h1>
            <p className="text-xs text-gray-500">
              Pemeliharaan &amp; monitoring preventif mesin, jig, dan fixtures
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          Tahap Pengembangan
        </span>
      </header>

      {/* Main Empty State Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100">
            <span className="material-symbols-outlined text-3xl">engineering</span>
          </div>

          <h2 className="text-sm font-bold text-gray-800 mb-1">
            Modul TPM Segera Hadir
          </h2>
          <p className="text-xs text-gray-500 leading-relaxed mb-6">
            Halaman Total Productive Maintenance (TPM) sedang dipersiapkan untuk jadwal maintenance rutin, preventive checklist, dan log historis perbaikan jig &amp; fixture.
          </p>

          <div className="w-full grid grid-cols-3 gap-2 border-t border-gray-100 pt-4 text-[10px] text-gray-400">
            <div className="p-2 bg-gray-50 rounded-lg">
              <span className="material-symbols-outlined text-base text-gray-400 block mb-0.5">event_repeat</span>
              <span>Preventive Schedule</span>
            </div>
            <div className="p-2 bg-gray-50 rounded-lg">
              <span className="material-symbols-outlined text-base text-gray-400 block mb-0.5">fact_check</span>
              <span>Daily Checklist</span>
            </div>
            <div className="p-2 bg-gray-50 rounded-lg">
              <span className="material-symbols-outlined text-base text-gray-400 block mb-0.5">history_toggle_off</span>
              <span>Maintenance Log</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
