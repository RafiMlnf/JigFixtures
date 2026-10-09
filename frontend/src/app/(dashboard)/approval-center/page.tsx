'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { canApprove, isGuest } from '@/lib/rbac';

export default function ApprovalCenterPage() {
  const { approvals, user, isLoading } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WAITING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Design Rev' | 'Inventory Update'>('ALL');

  // Tamu cannot access Approval Center
  if (!isLoading && isGuest(user?.role)) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="text-center max-w-xs">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">lock</span>
          <p className="text-sm font-bold text-gray-500 mb-1">Akses Ditolak</p>
          <p className="text-[10px] text-gray-400">Halaman Approval Center tidak dapat diakses oleh Tamu.</p>
          <Link href="/" className="mt-3 inline-block text-xs text-blue-500 underline">Kembali ke Dashboard</Link>
        </div>
      </div>
    );
  }

  // Filter items
  const filteredApprovals = approvals.filter((app) => {
    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || app.type === typeFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      app.noReg.toLowerCase().includes(q) ||
      app.itemName.toLowerCase().includes(q) ||
      app.author.toLowerCase().includes(q) ||
      (app.note && app.note.toLowerCase().includes(q));
    return matchesStatus && matchesType && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 pt-2 bg-white h-full overflow-hidden">
      {/* ─── STANDARD TOPBAR ──────────────── */}
      <header className="h-12 flex justify-between items-center border-b border-gray-150 mb-3 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          {/* Search bar inside header */}
          <div className="relative flex items-center w-80">
            <span
              className="material-symbols-outlined absolute left-2.5 text-gray-400 pointer-events-none select-none flex items-center justify-center leading-none"
              style={{ fontSize: '11px', width: '11px', height: '11px' }}
            >
              search
            </span>
            <input
              className="pl-7 pr-2.5 py-1.5 bg-gray-50 hover:bg-gray-100/70 border border-gray-300 rounded-lg w-full text-[10px] outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-medium transition-all text-gray-700 placeholder-gray-400"
              placeholder="Cari No. Reg / Drawing / Submitter..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Right side filters */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Filter Status */}
          <div className="relative flex items-center gap-1 text-[9.5px] text-gray-600 font-semibold border border-gray-300 bg-gray-50 rounded-lg px-2.5 py-1 cursor-pointer hover:bg-gray-100 transition-colors">
            <span>
              Status:{' '}
              {statusFilter === 'ALL'
                ? 'Semua'
                : statusFilter === 'WAITING'
                ? 'Menunggu'
                : statusFilter === 'APPROVED'
                ? 'Disetujui'
                : 'Perlu Revisi'}
            </span>
            <span className="material-symbols-outlined text-[13px] text-gray-500">expand_more</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="absolute inset-0 opacity-0 cursor-pointer text-xs"
            >
              <option value="ALL">Semua Status</option>
              <option value="WAITING">Menunggu Approval</option>
              <option value="APPROVED">Disetujui</option>
              <option value="REJECTED">Perlu Revisi</option>
            </select>
          </div>

          {/* Filter Tipe */}
          <div className="relative flex items-center gap-1 text-[9.5px] text-gray-600 font-semibold border border-gray-300 bg-gray-50 rounded-lg px-2.5 py-1 cursor-pointer hover:bg-gray-100 transition-colors">
            <span>Tipe: {typeFilter === 'ALL' ? 'Semua' : typeFilter}</span>
            <span className="material-symbols-outlined text-[13px] text-gray-500">expand_more</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="absolute inset-0 opacity-0 cursor-pointer text-xs"
            >
              <option value="ALL">Semua Tipe</option>
              <option value="Design Rev">Design Revision</option>
              <option value="Inventory Update">Inventory Update</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Table */}
      <div className="flex-1 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-3xs">
        <table className="w-full text-left border-collapse text-[10px] table-fixed">
          <thead>
            <tr className="bg-slate-50/90 text-gray-500 font-semibold border-b border-gray-200 sticky top-0 z-10 text-[9px] uppercase tracking-wider whitespace-nowrap select-none h-6">
              <th className="px-2 py-0.5 w-[110px]">No. Reg</th>
              <th className="px-2 py-0.5 min-w-[170px]">Item Name / Assy</th>
              <th className="px-1 py-0.5 text-center w-[75px]">Type</th>
              <th className="px-2 py-0.5 w-[115px]">Submitter</th>
              <th className="px-2 py-0.5 min-w-[140px]">Catatan Pengajuan</th>
              <th className="px-1.5 py-0.5 text-center w-[120px]">Status</th>
              <th className="px-1.5 py-0.5 text-center w-[120px]">Alur Verifikasi</th>
              <th className="px-1.5 py-0.5 text-center w-[45px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {filteredApprovals.map((app) => {
              const peStatus = 'APPROVED';
              const secStatus = app.sectionStatus || 'WAITING';
              const deptStatus = app.deptStatus || 'WAITING';
              const deptLocked = secStatus !== 'APPROVED';

              const getDotColor = (status: 'WAITING' | 'APPROVED' | 'REJECTED', locked?: boolean) => {
                if (locked) return 'bg-gray-300';
                if (status === 'APPROVED') return 'bg-emerald-500';
                if (status === 'REJECTED') return 'bg-rose-500 animate-pulse';
                return 'bg-amber-400';
              };

              return (
                <tr key={app.id} className="border-b border-gray-200 hover:bg-blue-50/50 transition-colors">
                  {/* Reg No */}
                  <td className="px-2 py-0.5 font-mono font-bold text-blue-600 truncate text-[9.5px] whitespace-nowrap">
                    {app.noReg}
                  </td>

                  {/* Item Name */}
                  <td className="px-2 py-0.5 font-medium text-gray-900 truncate text-[9.5px]" title={app.itemName}>
                    <span className="truncate block text-[9.5px]">
                      {app.itemName}
                    </span>
                  </td>

                  {/* Type */}
                  <td className="px-1 py-0.5 text-center whitespace-nowrap text-[8.5px] font-semibold text-gray-500">
                    {app.type}
                  </td>

                  {/* Submitter */}
                  <td className="px-2 py-0.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <img
                        className="w-3.5 h-3.5 rounded-full border border-gray-300"
                        src={app.authorAvatar}
                        alt={app.author}
                      />
                      <span className="text-[9px] text-gray-600 font-medium truncate">{app.author}</span>
                    </div>
                  </td>

                  {/* Description */}
                  <td className="px-2 py-0.5 text-gray-500 truncate text-[9px]" title={app.note}>
                    {app.note ? `"${app.note}"` : '—'}
                  </td>

                  {/* Status Badge */}
                  <td className="px-1.5 py-0.5 text-center whitespace-nowrap">
                    <span
                      className={`text-[8.5px] font-bold px-2 py-0.5 rounded-full ${
                        app.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : app.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-700 font-extrabold'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {app.status === 'APPROVED'
                        ? 'Disetujui'
                        : app.status === 'REJECTED'
                        ? 'Perlu Revisi'
                        : 'Menunggu'}
                    </span>
                  </td>

                  {/* Approval Progress (3-Dot Status) */}
                  <td className="px-1.5 py-0.5">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* PE Dot */}
                      <div className="flex items-center gap-0.5" title="PE Submitter: Diajukan">
                        <div className={`w-2 h-2 rounded-full ${getDotColor(peStatus)} shadow-2xs`} />
                        <span className="text-[7px] font-mono text-gray-400 font-bold">PE</span>
                      </div>

                      <div className="w-2 h-px bg-gray-300" />

                      {/* Section Head Dot */}
                      <div
                        className="flex items-center gap-0.5"
                        title={`Section Head: ${secStatus === 'APPROVED' ? 'Disetujui' : secStatus === 'REJECTED' ? 'Perlu Revisi' : 'Menunggu'}`}
                      >
                        <div className={`w-2 h-2 rounded-full ${getDotColor(secStatus)} shadow-2xs`} />
                        <span className="text-[7px] font-mono text-gray-400 font-bold">SEC</span>
                      </div>

                      <div className="w-2 h-px bg-gray-300" />

                      {/* Dept Head Dot */}
                      <div
                        className="flex items-center gap-0.5"
                        title={`Dept Head: ${deptLocked ? 'Antre Section Head' : deptStatus === 'APPROVED' ? 'Disetujui' : deptStatus === 'REJECTED' ? 'Perlu Revisi' : 'Menunggu'}`}
                      >
                        <div className={`w-2 h-2 rounded-full ${getDotColor(deptStatus, deptLocked)} shadow-2xs`} />
                        <span className="text-[7px] font-mono text-gray-400 font-bold">DEPT</span>
                      </div>
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-1.5 py-0.5 text-center whitespace-nowrap">
                    <Link
                      href={`/approval-center/${app.id}`}
                      className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors inline-flex items-center justify-center"
                      title="Review Permintaan Approval"
                    >
                      <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                    </Link>
                  </td>
                </tr>
              );
            })}

            {filteredApprovals.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400 italic">
                  Tidak ada data persetujuan yang sesuai pencarian / filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
