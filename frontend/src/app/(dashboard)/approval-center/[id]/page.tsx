'use client';

import React, { useState, use, useEffect, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { canApprove } from '@/lib/rbac';
import { getFileUrl } from '@/lib/api/phase3';

const StepViewer = lazy(() => import('@/components/design/StepViewer'));

interface RevHistoryInfo {
  id: string;
  revStatus: string;
  description: string;
  loc3D?: string | null;
  path3D?: string | null;
  loc2D?: string | null;
  path2D?: string | null;
}

interface FullItem {
  id: string;
  noReg: string;
  assyPartName: string;
  type: string;
  lineProduct: string;
  process: string;
  revStatus: string;
  revisionHistories: RevHistoryInfo[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReviewApprovalPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();
  const { approvals, items, processApproval, user, isLoading } = useApp();
  const isApprover = !isLoading && canApprove(user?.role);

  const approval = approvals.find((a) => a.id === id);
  const baseItem = approval ? items.find((i) => i.noReg === approval.noReg) : null;

  const [fullItem, setFullItem] = useState<FullItem | null>(null);
  const [comment, setComment] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'2D' | '3D'>('2D');

  // Fetch approval detail directly from backend (includes design.revisionHistories)
  useEffect(() => {
    const token = document.cookie.match(/auth_token=([^;]+)/)?.[1] || '';
    fetch(`http://localhost:3002/api/approvals/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // data.item includes design with revisionHistories (added in backend findOne)
        const design = data.design || data.item;
        if (design?.revisionHistories) {
          setFullItem({
            id: design.id,
            noReg: design.noReg,
            assyPartName: design.assyPartName,
            type: design.type,
            lineProduct: design.line?.lineName || design.lineProduct || '',
            process: design.process?.name || design.process || '',
            revStatus: design.revStatus,
            revisionHistories: design.revisionHistories,
          });
          console.log('[ApprovalReview] loaded revisionHistories:', design.revisionHistories.length, 'entries');
        }
      })
      .catch((err) => {
        console.warn('[ApprovalReview] direct API failed, falling back to master-list:', err);
        // Fallback: use fetchMasterList
        import('@/lib/api/phase3').then(({ fetchMasterList }) =>
          fetchMasterList().then((list: FullItem[]) => {
            const found = list.find((i) => i.noReg === approval?.noReg) ?? null;
            console.log('[ApprovalReview] fallback found:', found?.noReg);
            setFullItem(found);
          })
        );
      });
  }, [id]);

  if (!approval || !baseItem) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="text-center">
          <p className="text-sm font-bold text-red-500 mb-2">Approval Request Not Found</p>
          <Link href="/approval-center" className="text-xs text-blue-500 underline">
            Back to Approval Center
          </Link>
        </div>
      </div>
    );
  }

  const handleApproveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processApproval(approval.id, 'APPROVE', comment);
    setToastMessage('Request has been APPROVED successfully!');
    setShowApproveModal(false);
    setComment('');
    setTimeout(() => { router.push('/approval-center'); }, 1500);
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) { alert('Reject comment is required.'); return; }
    processApproval(approval.id, 'REJECT', comment);
    setToastMessage('Request has been REJECTED.');
    setShowRejectModal(false);
    setComment('');
    setTimeout(() => { router.push('/approval-center'); }, 1500);
  };

  // Derive file URLs — search all revisions for files (not just the last one)
  const revWith2D = fullItem?.revisionHistories?.slice().reverse().find((r) => r.loc2D);
  const revWith3D = fullItem?.revisionHistories?.slice().reverse().find((r) => r.loc3D);
  const latestRev = revWith2D ?? revWith3D ?? fullItem?.revisionHistories?.[fullItem.revisionHistories.length - 1];
  const pdf2DUrl = revWith2D?.loc2D ? getFileUrl(revWith2D.loc2D) : null;
  const model3DUrl = revWith3D?.loc3D ? getFileUrl(revWith3D.loc3D) : null;

  // Use fullItem if loaded, fallback to baseItem for basic fields
  const item = fullItem ?? baseItem;

  const approvalStatusColor =
    approval.status === 'APPROVED' ? 'bg-green-100 text-green-700 border border-green-200' :
    approval.status === 'REJECTED' ? 'bg-red-100 text-red-700 border border-red-200' :
    'bg-yellow-100 text-yellow-700 border border-yellow-200';

  const infoRows = [
    { label: 'No. Registrasi', value: item.noReg, mono: true },
    { label: 'Part Name', value: item.assyPartName },
    { label: 'Tipe', value: item.type },
    { label: 'Line Product', value: item.lineProduct },
    { label: 'Process / OP', value: item.process },
    { label: 'Revision', value: `Rev ${item.revStatus}` },
  ];

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 pt-2 bg-white h-full overflow-hidden relative">

      {/* Toast */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-50">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="h-12 flex justify-between items-center mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Link href="/approval-center" className="text-gray-500 hover:text-gray-800 flex items-center">
            <span className="material-symbols-outlined text-base">arrow_back</span>
          </Link>
          <div>
            <h2 className="text-sm font-bold text-gray-800">Review Approval Request</h2>
            <p className="text-[9px] text-gray-500">ID: {approval.id} &bull; Submitted {approval.date} by <span className="font-bold text-gray-700">{approval.author}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${approvalStatusColor}`}>
            {approval.status}
          </span>
          <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold border border-purple-200">
            Fase 2 Flow
          </span>
        </div>
      </header>

      {/* 3-Column Layout */}
      <div className="flex-1 flex gap-3 min-h-0">

        {/* ── LEFT: 2D/3D Document Viewer ── */}
        <div className="flex-1 flex flex-col min-w-0 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
          {/* Viewer Tabs */}
          <div className="h-8 flex items-center gap-1 px-2 border-b border-gray-200 bg-white shrink-0">
            <button
              onClick={() => setPreviewMode('2D')}
              className={`flex items-center gap-1 px-2.5 h-full text-[10px] font-bold border-b-2 transition-all ${
                previewMode === '2D' ? 'border-blue-500 text-blue-650' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">picture_as_pdf</span>
              2D Drawing
            </button>
            <button
              onClick={() => setPreviewMode('3D')}
              className={`flex items-center gap-1 px-2.5 h-full text-[10px] font-bold border-b-2 transition-all ${
                previewMode === '3D' ? 'border-blue-500 text-blue-650' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">deployed_code</span>
              3D Model
            </button>
            <div className="flex-1" />
            <span className="text-[8px] font-mono text-gray-400 font-bold uppercase">{item.noReg}</span>
          </div>

          {/* Viewer Content */}
          <div className="flex-1 relative min-h-0">
            {previewMode === '2D' ? (
              pdf2DUrl ? (
                <iframe src={pdf2DUrl} className="w-full h-full border-0" title="2D Drawing PDF" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
                  <span className="material-symbols-outlined text-4xl">picture_as_pdf</span>
                  <p className="text-[10px] font-medium">File PDF 2D Drawing belum tersedia.</p>
                </div>
              )
            ) : (
              model3DUrl ? (
                <Suspense fallback={
                  <div className="w-full h-full flex items-center justify-center gap-2 text-gray-400">
                    <span className="material-symbols-outlined animate-spin text-xl text-indigo-500">sync</span>
                    <span className="text-xs">Memuat 3D Engine...</span>
                  </div>
                }>
                  <StepViewer
                    fileUrl={model3DUrl}
                    fileName={latestRev?.path3D || undefined}
                    onClose={() => setPreviewMode('2D')}
                  />
                </Suspense>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
                  <span className="material-symbols-outlined text-4xl">deployed_code</span>
                  <p className="text-[10px] font-medium">File model 3D belum tersedia.</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* ── CENTER: Specifications Info ── */}
        <div className="w-52 flex flex-col gap-2.5 shrink-0">

          {/* Part identity */}
          <div className="border border-gray-200 rounded-xl p-3 bg-white">
            <p className="text-[8px] font-bold uppercase text-gray-400 tracking-widest mb-2">Spesifikasi Item</p>
            <div className="space-y-2">
              {infoRows.map(({ label, value, mono }) => (
                <div key={label} className="flex flex-col gap-0.5 border-b border-gray-50 last:border-0 pb-1.5 last:pb-0">
                  <span className="text-[8px] text-gray-400 font-medium">{label}</span>
                  <span className={`text-[10px] text-gray-800 font-bold truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Revision note */}
          <div className="border border-gray-200 rounded-xl p-3 bg-white">
            <p className="text-[8px] font-bold uppercase text-gray-400 tracking-widest mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[10px]">sticky_note_2</span>
              Catatan Revisi
            </p>
            <p className="text-[10px] text-gray-600 italic leading-relaxed">"{approval.note || '—'}"</p>
          </div>

          {/* Approval timeline */}
          <div className="border border-gray-200 rounded-xl p-3 bg-white flex-1">
            <p className="text-[8px] font-bold uppercase text-gray-400 tracking-widest mb-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-[10px]">event_note</span>
              Approval Flow
            </p>
            <div className="relative pl-4 border-l border-gray-200 space-y-3">
              {/* Step 1 - PIC Submit */}
              <div className="relative">
                <span className="absolute -left-[18px] top-0.5 bg-green-500 text-white rounded-full w-3 h-3 flex items-center justify-center text-[7px] font-black">✓</span>
                <p className="text-[9px] font-bold text-gray-800 leading-none">PIC Submit</p>
                <p className="text-[8px] text-gray-500 mt-0.5">{approval.author} &bull; {approval.date}</p>
              </div>
              {/* Step 2 - Section Head */}
              <div className="relative">
                <span className={`absolute -left-[18px] top-0.5 rounded-full w-3 h-3 flex items-center justify-center text-[7px] font-black text-white ${
                  approval.status === 'APPROVED' ? 'bg-green-500' :
                  approval.status === 'REJECTED' ? 'bg-red-500' :
                  'bg-yellow-400 animate-pulse'
                }`}>
                  {approval.status === 'APPROVED' ? '✓' : approval.status === 'REJECTED' ? '✗' : '…'}
                </span>
                <p className="text-[9px] font-bold text-gray-800 leading-none">Section Head</p>
                <p className={`text-[8px] mt-0.5 font-semibold ${
                  approval.status === 'WAITING' ? 'text-yellow-600' :
                  approval.status === 'APPROVED' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {approval.status === 'WAITING' ? 'Menunggu keputusan' :
                   approval.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                </p>
              </div>
              {/* Step 3 - Dept Head */}
              <div className="relative">
                <span className={`absolute -left-[18px] top-0.5 rounded-full w-3 h-3 flex items-center justify-center text-[7px] font-black text-white ${
                  approval.status === 'APPROVED' ? 'bg-green-500' : 'bg-gray-300'
                }`}>
                  {approval.status === 'APPROVED' ? '✓' : '-'}
                </span>
                <p className={`text-[9px] font-bold leading-none ${approval.status === 'APPROVED' ? 'text-gray-800' : 'text-gray-400'}`}>
                  Dept Head
                </p>
                <p className="text-[8px] mt-0.5 text-gray-400">
                  {approval.status === 'APPROVED' ? <span className="text-green-600 font-semibold">Disetujui</span> : 'Pending Section Head'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Decision Panel ── */}
        <div className="w-48 flex flex-col gap-2.5 shrink-0">

          {/* Status badge */}
          <div className={`rounded-xl p-3 border text-center ${
            approval.status === 'APPROVED' ? 'bg-green-50 border-green-200' :
            approval.status === 'REJECTED' ? 'bg-red-50 border-red-200' :
            'bg-yellow-50 border-yellow-200'
          }`}>
            <span className={`material-symbols-outlined text-3xl block mb-1 ${
              approval.status === 'APPROVED' ? 'text-green-500' :
              approval.status === 'REJECTED' ? 'text-red-500' :
              'text-yellow-500'
            }`}>
              {approval.status === 'APPROVED' ? 'check_circle' :
               approval.status === 'REJECTED' ? 'cancel' : 'pending'}
            </span>
            <p className={`text-[10px] font-black uppercase tracking-wider ${
              approval.status === 'APPROVED' ? 'text-green-700' :
              approval.status === 'REJECTED' ? 'text-red-700' :
              'text-yellow-700'
            }`}>{approval.status}</p>
            <p className="text-[8px] text-gray-500 mt-0.5">
              {approval.status === 'WAITING' ? 'Menunggu keputusan' : 'Keputusan final'}
            </p>
          </div>

          {/* Submitter info */}
          <div className="border border-gray-200 rounded-xl p-3 bg-white">
            <p className="text-[8px] font-bold uppercase text-gray-400 tracking-widest mb-2">Submitter</p>
            <div className="flex items-center gap-2">
              <img
                src={approval.authorAvatar || `https://ui-avatars.com/api/?name=${approval.author}&size=32&background=e2e8f0&color=475569`}
                alt={approval.author}
                className="w-7 h-7 rounded-full border border-gray-200"
              />
              <div>
                <p className="text-[9px] font-bold text-gray-800">{approval.author}</p>
                <p className="text-[8px] text-gray-500">{approval.date}</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex-1 flex flex-col gap-2">
            {approval.status === 'WAITING' ? (
              isApprover ? (
                <>
                  <button
                    onClick={() => { setComment(''); setShowApproveModal(true); }}
                    className="w-full py-2 bg-green-600 text-white rounded-xl text-[10px] font-bold hover:bg-green-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Approve
                  </button>
                  <button
                    onClick={() => { setComment(''); setShowRejectModal(true); }}
                    className="w-full py-2 border border-red-400 text-red-600 rounded-xl text-[10px] font-bold hover:bg-red-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">cancel</span>
                    Reject
                  </button>
                </>
              ) : (
                <div className="flex-1 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-3 text-center text-[9px] font-bold flex flex-col items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-xl text-yellow-500">schedule</span>
                  Awaiting review dari Section / Dept Head
                </div>
              )
            ) : (
              <div className="flex-1 bg-gray-100 rounded-xl p-3 text-center text-[9px] font-bold text-gray-500 border border-gray-200 flex flex-col items-center justify-center gap-1">
                <span className="material-symbols-outlined text-xl">gavel</span>
                Decision finalized
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <form onSubmit={handleRejectSubmit} className="max-w-xs w-full bg-white border border-gray-300 rounded-2xl p-5 text-gray-800 shadow-2xl">
            <h3 className="font-bold text-xs text-red-600 mb-1.5 flex items-center gap-1 border-b border-gray-100 pb-2">
              <span className="material-symbols-outlined text-sm">cancel</span>
              Reject Request
            </h3>
            <p className="text-[9px] text-gray-500 mb-2 leading-tight">
              Tuliskan alasan penolakan. PIC akan menerima catatan ini.
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-2 text-[10px] h-20 outline-none focus:ring-1 focus:ring-red-500 text-gray-700 placeholder-gray-400 resize-none"
              placeholder="Contoh: Toleransi pin locator harus diperbaiki..."
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => setShowRejectModal(false)} className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-[10px] font-bold hover:bg-gray-100 transition-colors cursor-pointer">Batal</button>
              <button type="submit" className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-bold hover:bg-red-700 transition-colors cursor-pointer">Reject</button>
            </div>
          </form>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <form onSubmit={handleApproveSubmit} className="max-w-xs w-full bg-white border border-gray-300 rounded-2xl p-5 text-gray-800 shadow-2xl">
            <h3 className="font-bold text-xs text-green-600 mb-1.5 flex items-center gap-1 border-b border-gray-100 pb-2">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Approve Request
            </h3>
            <p className="text-[9px] text-gray-500 mb-2 leading-tight">
              Berikan catatan persetujuan (opsional).
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-2 text-[10px] h-20 outline-none focus:ring-1 focus:ring-green-500 text-gray-700 placeholder-gray-400 resize-none"
              placeholder="Contoh: Desain disetujui, siap fabrikasi..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => setShowApproveModal(false)} className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-[10px] font-bold hover:bg-gray-100 transition-colors cursor-pointer">Batal</button>
              <button type="submit" className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-[10px] font-bold hover:bg-green-700 transition-colors cursor-pointer">Approve</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
