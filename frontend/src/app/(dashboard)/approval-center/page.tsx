'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { canApprove, isGuest } from '@/lib/rbac';

export default function ApprovalCenterPage() {
  const { approvals, user, isLoading } = useApp();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WAITING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Design Rev' | 'Inventory Update'>('ALL');

  // Tamu cannot access Approval Center at all
  if (!isLoading && isGuest(user?.role)) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="text-center max-w-xs">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">lock</span>
          <p className="text-sm font-bold text-gray-500 mb-1">Akses Ditolak</p>
          <p className="text-[10px] text-gray-400">Halaman Approval Center tidak dapat diakses oleh Guest / Tamu.</p>
          <Link href="/" className="mt-3 inline-block text-xs text-blue-500 underline">Kembali ke Dashboard</Link>
        </div>
      </div>
    );
  }

  // Derive role flags
  const userIsApprover = !isLoading && canApprove(user?.role);
  const userIsPic = !isLoading && user?.role === 'PE_JIG_FIXTURE';

  // Filter items
  const filteredApprovals = approvals.filter((app) => {
    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || app.type === typeFilter;
    return matchesStatus && matchesType;
  });

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 pt-2 bg-white h-full overflow-hidden">
      {/* Header controls */}
      <header className="h-12 flex justify-between items-center border-b border-gray-150 mb-3 shrink-0">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#0063ff] text-lg">fact_check</span>
            Approval Center
          </h2>
        </div>

        {/* Toggle Filters */}
        <div className="flex items-center gap-2">
          {/* Status Select */}
          <div className="relative flex items-center gap-1 text-[9px] text-gray-500 font-semibold border border-gray-200 rounded-full px-2 py-0.5 cursor-pointer hover:bg-gray-50">
            <span>Status: {statusFilter}</span>
            <span className="material-symbols-outlined text-[12px]">expand_more</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="absolute inset-0 opacity-0 cursor-pointer text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="WAITING">Waiting</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Type Select */}
          <div className="relative flex items-center gap-1 text-[9px] text-gray-500 font-semibold border border-gray-200 rounded-full px-2 py-0.5 cursor-pointer hover:bg-gray-50">
            <span>Type: {typeFilter}</span>
            <span className="material-symbols-outlined text-[12px]">expand_more</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="absolute inset-0 opacity-0 cursor-pointer text-xs"
            >
              <option value="ALL">All Types</option>
              <option value="Design Rev">Design Revision</option>
              <option value="Inventory Update">Inventory Update</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Table */}
      <div className="flex-1 overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-150 text-gray-500 font-bold uppercase tracking-wider text-[9px]">
              <th className="py-2.5 px-4">No. Reg</th>
              <th className="py-2.5 px-4">Item Name / Assy</th>
              <th className="py-2.5 px-4">Type</th>
              <th className="py-2.5 px-4">Submitter</th>
              <th className="py-2.5 px-4">Description / Note</th>
              <th className="py-2.5 px-4 text-center">Approval Progress</th>
              <th className="py-2.5 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
            {filteredApprovals.map((app) => {
              // PE is always APPROVED since they submitted it
              const peStatus = 'APPROVED';
              const secStatus = app.sectionStatus || 'WAITING';
              const deptStatus = app.deptStatus || 'WAITING';

              // Sequential: DEPT is "locked" (not yet in queue) if SEC hasn't approved yet
              const deptLocked = secStatus !== 'APPROVED';

              const getDotColor = (status: 'WAITING' | 'APPROVED' | 'REJECTED', locked?: boolean) => {
                if (locked) return 'bg-gray-300';   // Not yet in queue
                if (status === 'APPROVED') return 'bg-green-500';
                if (status === 'REJECTED') return 'bg-red-500 animate-pulse';
                return 'bg-yellow-400';
              };

              const getDotTitle = (role: string, status: string, locked?: boolean) => {
                if (locked) return `${role}: Awaiting previous step`;
                return `${role}: ${status.toUpperCase()}`;
              };

              return (
                <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                  {/* Reg No */}
                  <td className="py-3 px-4 font-mono text-[10px] text-gray-900 font-normal">
                    {app.noReg}
                  </td>

                  {/* Item Name */}
                  <td className="py-3 px-4 text-[11px] font-bold text-gray-800">
                    {app.itemName}
                  </td>

                  {/* Type */}
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide ${
                        app.type === 'Design Rev'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}
                    >
                      {app.type}
                    </span>
                  </td>

                  {/* Submitter */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <img
                        className="w-4 h-4 rounded-full border border-gray-300"
                        src={app.authorAvatar}
                        alt={app.author}
                      />
                      <span className="text-[10px] text-gray-600 font-semibold">{app.author}</span>
                    </div>
                  </td>

                  {/* Description */}
                  <td className="py-3 px-4 text-gray-500 max-w-[220px] truncate italic" title={app.note}>
                    "{app.note || '—'}"
                  </td>

                  {/* Approval Progress (3-Dot Status) */}
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-3">
                      {/* PE Dot */}
                      <div className="flex flex-col items-center gap-1 group relative">
                        <div
                          className={`w-3.5 h-3.5 rounded-full ${getDotColor(peStatus)} shadow-2xs border-2 border-white`}
                          title={getDotTitle('PE Submitter', peStatus)}
                        />
                        <span className="text-[8px] font-mono text-gray-400 font-bold group-hover:text-gray-600">PE</span>
                      </div>

                      {/* Line connector */}
                      <div className="w-4 h-0.5 bg-gray-250 -mt-2" />

                      {/* Section Head Dot */}
                      <div className="flex flex-col items-center gap-1 group relative">
                        <div
                          className={`w-3.5 h-3.5 rounded-full ${getDotColor(secStatus)} shadow-2xs border-2 border-white`}
                          title={getDotTitle('Section Head', secStatus)}
                        />
                        <span className="text-[8px] font-mono text-gray-400 font-bold group-hover:text-gray-600">SEC</span>
                      </div>

                      {/* Line connector */}
                      <div className="w-4 h-0.5 bg-gray-250 -mt-2" />

                      {/* Dept Head Dot */}
                      <div className="flex flex-col items-center gap-1 group relative">
                        <div
                          className={`w-3.5 h-3.5 rounded-full ${getDotColor(deptStatus, deptLocked)} shadow-2xs border-2 border-white`}
                          title={getDotTitle('Dept Head', deptStatus, deptLocked)}
                        />
                        <span className="text-[8px] font-mono text-gray-400 font-bold group-hover:text-gray-600">DEPT</span>
                      </div>
                    </div>
                  </td>

                  {/* Action */}
                  <td className="py-3 px-4 text-center">
                    <Link
                      href={`/approval-center/${app.id}`}
                      className="text-gray-550 hover:text-gray-900 transition-colors inline-flex items-center justify-center"
                      title="Review Approval"
                    >
                      <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                    </Link>
                  </td>
                </tr>
              );
            })}

            {filteredApprovals.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400 italic">
                  Tidak ada data persetujuan yang sesuai filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
