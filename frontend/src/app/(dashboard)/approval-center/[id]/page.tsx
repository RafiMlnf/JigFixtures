'use client';

import React, { useState, use, useEffect, useRef, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { canApprove } from '@/lib/rbac';
import { getFileUrl, approveRevision, rejectRevision, uploadFile, resubmitRevision, fetchApprovalDetail } from '@/lib/api/phase3';

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
  documents?: any[];
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
  const isDrawer = !isLoading && user?.role === 'PE_JIG_FIXTURE';

  const [fullItem, setFullItem] = useState<FullItem | null>(null);
  const [comment, setComment] = useState('');
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'2D' | '3D'>('2D');
  const [approvalDetail, setApprovalDetail] = useState<any>(null);
  const [loadingApproval, setLoadingApproval] = useState(true);

  // Markup Canvas States
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const markupCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isMarkupMode, setIsMarkupMode] = useState(false);
  const [inkColor, setInkColor] = useState<'#dc2626' | '#eab308' | '#2563eb'>('#dc2626');
  const [brushSize, setBrushSize] = useState<number>(3);
  const [hasDrawnMarkup, setHasDrawnMarkup] = useState(false);
  const [localMarkupData, setLocalMarkupData] = useState<string | null>(null);
  const [showSavedMarkup, setShowSavedMarkup] = useState(true);
  const [strokesHistory, setStrokesHistory] = useState<ImageData[]>([]);
  const isDrawingRef = useRef(false);
  const prevPointRef = useRef<{ x: number; y: number } | null>(null);

  // Resubmit Revision Modal Form States (for Drawer)
  const [revFile2D, setRevFile2D] = useState<File | null>(null);
  const [revFile3D, setRevFile3D] = useState<File | null>(null);
  const [newRevStatus, setNewRevStatus] = useState('');
  const [resubmitNote, setResubmitNote] = useState('');
  const [resubmitting, setResubmitting] = useState(false);

  const contextApproval = approvals.find((a) => a.id === id);
  const resolvedApproval: any = approvalDetail ? {
    id: approvalDetail.id,
    noReg: approvalDetail.item?.noReg || approvalDetail.design?.noReg || 'N/A',
    designId: approvalDetail.item?.id || approvalDetail.designId,
    itemName: approvalDetail.item?.assyPartName || approvalDetail.design?.assyPartName || 'N/A',
    date: approvalDetail.createdAt ? new Date(approvalDetail.createdAt).toLocaleDateString('id-ID') : '',
    author: approvalDetail.submittedBy?.name || 'PIC Submitter',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD0K5uMa_eyzsLMfQnbYnlDlbL0hBNbMgB43eKGSSrulPd8R9KaBD-eOVIRnjge_lre88wQy32ZMQbO5pKvKoJdf7atqBmlbiSVEQIAF1Wf7obS1uwccX8H_uNfR8SZ6-SE-1fv1hDVDh_g8Jp0I7dS5FLdPtJ_RtVTHs-mnlA6p4X_ZzB-516cPH-NL6fxEyDNf7v4FLZ2X5nqNvfLo15Em1bnYhl46iz08ZtBfbLW2c17XuJTiElB',
    note: approvalDetail.revisionNote || approvalDetail.finalComment || approvalDetail.sectionComment || approvalDetail.deptComment || '',
    type: approvalDetail.type === 'DESIGN_REVISION' ? 'Design Rev' : 'Inventory Update',
    status: approvalDetail.status,
    sectionStatus: approvalDetail.sectionStatus || 'WAITING',
    deptStatus: approvalDetail.deptStatus || 'WAITING',
    sectionHead: approvalDetail.sectionHead,
    deptHead: approvalDetail.deptHead,
    sectionComment: approvalDetail.sectionComment,
    deptComment: approvalDetail.deptComment,
    finalComment: approvalDetail.finalComment,
    markupData: approvalDetail.markupData || contextApproval?.markupData,
    annotatedDocPath: approvalDetail.annotatedDocPath || contextApproval?.annotatedDocPath,
  } : contextApproval;

  const approval = resolvedApproval;
  const baseItem = approval ? items.find((i) => i.noReg === approval.noReg) : null;

  // Load Approval Detail from backend
  const loadApprovalData = async () => {
    setLoadingApproval(true);
    try {
      const data = await fetchApprovalDetail(id);
      setApprovalDetail(data);
      const design = data.design || data.item;
      if (design) {
        setFullItem({
          id: design.id,
          noReg: design.noReg,
          assyPartName: design.assyPartName,
          type: design.type,
          lineProduct: design.line?.lineName || design.lineProduct || '',
          process: design.process?.name || design.process || '',
          revStatus: design.revStatus,
          revisionHistories: design.revisionHistories || [],
          documents: design.documents || [],
        });
      }
    } catch (err) {
      console.warn('[ApprovalReview] Fetch detail error:', err);
    } finally {
      setLoadingApproval(false);
    }
  };

  useEffect(() => {
    loadApprovalData();
  }, [id]);

  // Adjust canvas dimensions accurately to match viewer container without wiping strokes
  const syncCanvasSize = () => {
    const canvas = markupCanvasRef.current;
    const container = viewerContainerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      let existingImg: ImageData | null = null;
      const ctx = canvas.getContext('2d');
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        try {
          existingImg = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch {}
      }
      canvas.width = w;
      canvas.height = h;
      if (existingImg && ctx) {
        try {
          ctx.putImageData(existingImg, 0, 0);
        } catch {}
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(syncCanvasSize, 250);
    window.addEventListener('resize', syncCanvasSize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', syncCanvasSize);
    };
  }, [previewMode, isMarkupMode]);

  // Canvas Drawing Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMarkupMode) return;
    e.preventDefault();
    syncCanvasSize();
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isDrawingRef.current = true;
    prevPointRef.current = { x, y };

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setStrokesHistory((prev) => [...prev.slice(-15), snapshot]);
    } catch {}

    ctx.strokeStyle = inkColor;
    ctx.fillStyle = inkColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    setHasDrawnMarkup(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMarkupMode || !isDrawingRef.current || !prevPointRef.current) return;
    e.preventDefault();
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = inkColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(prevPointRef.current.x, prevPointRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    prevPointRef.current = { x, y };
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    prevPointRef.current = null;
    const canvas = markupCanvasRef.current;
    if (canvas) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        setLocalMarkupData(dataUrl);
        setHasDrawnMarkup(true);
      } catch (e) {
        console.warn('Canvas export toDataURL failed:', e);
      }
    }
  };

  const handleUndo = () => {
    const canvas = markupCanvasRef.current;
    if (!canvas || strokesHistory.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const last = strokesHistory[strokesHistory.length - 1];
    ctx.putImageData(last, 0, 0);
    setStrokesHistory((prev) => prev.slice(0, -1));
    try {
      const dataUrl = canvas.toDataURL('image/png');
      setLocalMarkupData(dataUrl);
    } catch {}
  };

  const handleClearCanvas = () => {
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setStrokesHistory([]);
    setHasDrawnMarkup(false);
    setLocalMarkupData(null);
  };

  // Decision 1: Setujui (Approve)
  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (processApproval) {
        await processApproval(approval.id, 'APPROVE', comment.trim() || undefined);
      } else {
        await approveRevision(approval.id, { comment: comment.trim() || undefined });
      }
      setToastMessage('Dokumen berhasil disetujui!');
      setShowApproveModal(false);
      setComment('');
      setTimeout(() => { router.push('/approval-center'); }, 1000);
    } catch (err: any) {
      alert(err.message || 'Gagal memproses persetujuan');
    }
  };

  // Decision 2: Revisi (Return with Notes & PDF Coretan)
  const handleReviseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      alert('Catatan revisi wajib diisi agar drawer mengetahui apa yang perlu diperbaiki.');
      return;
    }
    try {
      let markupDataUrl: string | undefined = localMarkupData || undefined;
      if (!markupDataUrl && markupCanvasRef.current && hasDrawnMarkup) {
        try {
          markupDataUrl = markupCanvasRef.current.toDataURL('image/png');
        } catch {}
      }

      await rejectRevision(approval.id, {
        comment: comment.trim(),
        markupData: markupDataUrl,
      });

      setToastMessage('Permintaan revisi beserta catatan & coretan berhasil dikembalikan ke drawer.');
      setShowReviseModal(false);
      setIsMarkupMode(false);
      setComment('');
      await loadApprovalData();
      setTimeout(() => { router.push('/approval-center'); }, 1200);
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim permintaan revisi');
    }
  };

  // Drawer Action: Upload Revisian Baru
  const handleResubmitRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revFile2D) {
      alert('File drawing 2D (PDF) revisian baru wajib diunggah.');
      return;
    }
    if (!resubmitNote.trim()) {
      alert('Tuliskan ringkasan perbaikan revisi yang telah dilakukan.');
      return;
    }

    setResubmitting(true);
    try {
      // 1. Upload 2D PDF file
      const uploaded2D = await uploadFile(revFile2D);
      let uploaded3DLoc: string | undefined = undefined;
      if (revFile3D) {
        const uploaded3D = await uploadFile(revFile3D);
        uploaded3DLoc = uploaded3D.url;
      }

      // 2. Call resubmitRevision endpoint (archives old drawing into version history and replaces active doc)
      await resubmitRevision(approval.id, {
        docLocation2D: uploaded2D.url,
        docLocation3D: uploaded3DLoc,
        revStatus: newRevStatus.trim() || undefined,
        revisionNote: resubmitNote.trim(),
      });

      setToastMessage('Revisi baru berhasil diunggah! Drawing lama telah diarsipkan ke Version History.');
      setShowUploadModal(false);
      setRevFile2D(null);
      setRevFile3D(null);
      setResubmitNote('');
      await loadApprovalData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengunggah revisian.');
    } finally {
      setResubmitting(false);
    }
  };

  if (isLoading || loadingApproval) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-3xl text-blue-600 block mb-2">sync</span>
          <p className="text-xs text-gray-500 font-medium">Memuat data permintaan persetujuan...</p>
        </div>
      </div>
    );
  }

  if (!approval) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="text-center">
          <p className="text-sm font-bold text-red-500 mb-2">Permintaan Approval Tidak Ditemukan</p>
          <Link href="/approval-center" className="text-xs text-blue-500 underline">
            Kembali ke Approval Center
          </Link>
        </div>
      </div>
    );
  }

  // Derive active files
  const activeDocFromTable = fullItem?.documents?.slice().reverse().find((d: any) => d.loc2D || d.path2D);
  const revWith2D = fullItem?.revisionHistories?.slice().reverse().find((r) => r.loc2D || r.path2D);
  const revWith3D = fullItem?.revisionHistories?.slice().reverse().find((r) => r.loc3D || r.path3D);
  const latestRev = revWith2D ?? revWith3D ?? fullItem?.revisionHistories?.[fullItem.revisionHistories.length - 1];
  const targetPdf = activeDocFromTable?.loc2D || activeDocFromTable?.path2D || revWith2D?.loc2D || revWith2D?.path2D;
  const target3D = revWith3D?.loc3D || revWith3D?.path3D;
  const pdf2DUrl = targetPdf ? getFileUrl(targetPdf) : null;
  const model3DUrl = target3D ? getFileUrl(target3D) : null;
  const markupImgUrl = approval?.markupData || (approval?.annotatedDocPath ? getFileUrl(approval.annotatedDocPath) : null);
  const item = fullItem ?? baseItem;

  // Status mapping
  const isPending = approval.status === 'WAITING';
  const isApproved = approval.status === 'APPROVED';
  const isRevised = approval.status === 'REJECTED';

  // Role permissions for decisions
  const canDecideSec = user?.role === 'PE_SECTION_HEAD' && approval.sectionStatus === 'WAITING' && isPending;
  const canDecideDept = user?.role === 'PE_DEPT_HEAD' && approval.sectionStatus === 'APPROVED' && approval.deptStatus === 'WAITING' && isPending;
  const canDecide = canDecideSec || canDecideDept;

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 pt-2 bg-white h-full overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xl z-50 animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* ─── COMPACT TOPBAR ──────────────── */}
      <header className="h-12 flex justify-between items-center border-b border-gray-150 mb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <Link
            href="/approval-center"
            className="w-7 h-7 rounded-lg border border-gray-250 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Kembali ke Daftar Approval"
          >
            <span className="material-symbols-outlined text-[17px]">arrow_back</span>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-600">{item?.noReg || approval.noReg}</span>
              <span className="text-gray-300">·</span>
              <h2 className="text-xs font-bold text-gray-800 truncate max-w-[340px]">
                {item?.assyPartName || approval.itemName}
              </h2>
            </div>
            <p className="text-[9.5px] text-gray-400">
              Diajukan oleh <span className="font-semibold text-gray-600">{approval.author}</span> • {approval.date}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`text-[9.5px] font-bold px-2.5 py-1 rounded-full border ${
              isApproved
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isRevised
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {isApproved ? 'Disetujui' : isRevised ? 'Perlu Revisi' : 'Menunggu Persetujuan'}
          </span>
        </div>
      </header>

      {/* ─── 2-COLUMN BALANCED LAYOUT ──────────────── */}
      <div className="flex-1 flex gap-3 min-h-0">

        {/* ── LEFT: DOCUMENT VIEWER + INTERACTIVE REDLINE MARKUP ── */}
        <div className="flex-1 flex flex-col min-w-0 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
          {/* Top Viewer Toolbar */}
          <div className="h-9 flex items-center justify-between px-2.5 border-b border-gray-200 bg-white shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPreviewMode('2D')}
                className={`flex items-center gap-1 px-2.5 h-7 text-[10px] font-bold rounded-md transition-all ${
                  previewMode === '2D'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">picture_as_pdf</span>
                2D Drawing
              </button>
              <button
                onClick={() => setPreviewMode('3D')}
                className={`flex items-center gap-1 px-2.5 h-7 text-[10px] font-bold rounded-md transition-all ${
                  previewMode === '3D'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">deployed_code</span>
                3D Model
              </button>
            </div>

            {/* Drawing Markup Controls */}
            {previewMode === '2D' && (
              <div className="flex items-center gap-1.5">
                {/* Saved Markup Toggle for Drawer or Reviewer */}
                {markupImgUrl && !isMarkupMode && (
                  <button
                    type="button"
                    onClick={() => setShowSavedMarkup(!showSavedMarkup)}
                    className={`px-2 py-1 rounded text-[9.5px] font-bold flex items-center gap-1 transition-all ${
                      showSavedMarkup
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title="Toggle tampilkan coretan revisi approver"
                  >
                    <span className="material-symbols-outlined text-[12px]">
                      {showSavedMarkup ? 'visibility' : 'visibility_off'}
                    </span>
                    <span>{showSavedMarkup ? 'Coretan Revisi' : 'Lihat Asli'}</span>
                  </button>
                )}

                {/* Markup Drawing Tool Toggle (For Approvers during review) */}
                {canDecide && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMarkupMode(!isMarkupMode);
                      if (!isMarkupMode) {
                        setShowSavedMarkup(false);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[9.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      isMarkupMode
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                    }`}
                    title="Aktifkan pena coretan untuk menandai bagian yang harus direvisi"
                  >
                    <span className="material-symbols-outlined text-[13px]">draw</span>
                    <span>{isMarkupMode ? 'Mode Coretan Aktif' : 'Beri Coretan Revisi'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Floating Markup Drawing Toolbar (when markup mode is ON) */}
          {isMarkupMode && (
            <div className="h-8 bg-slate-900 text-white px-3 flex items-center justify-between text-[10px] shrink-0 z-30">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-[9.5px] font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-rose-400">gesture</span>
                  Alat Coretan:
                </span>

                {/* Color swatches */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setInkColor('#dc2626')}
                    className={`w-4 h-4 rounded-full bg-rose-600 ${inkColor === '#dc2626' ? 'ring-2 ring-white scale-110' : 'opacity-70'}`}
                    title="Merah (Coretan Utama)"
                  />
                  <button
                    type="button"
                    onClick={() => setInkColor('#eab308')}
                    className={`w-4 h-4 rounded-full bg-amber-400 ${inkColor === '#eab308' ? 'ring-2 ring-white scale-110' : 'opacity-70'}`}
                    title="Kuning (Penanda)"
                  />
                  <button
                    type="button"
                    onClick={() => setInkColor('#2563eb')}
                    className={`w-4 h-4 rounded-full bg-blue-600 ${inkColor === '#2563eb' ? 'ring-2 ring-white scale-110' : 'opacity-70'}`}
                    title="Biru"
                  />
                </div>

                {/* Brush size */}
                <div className="flex items-center gap-1 ml-2 border-l border-gray-700 pl-3">
                  <button
                    type="button"
                    onClick={() => setBrushSize(2)}
                    className={`px-1.5 py-0.5 rounded text-[8.5px] ${brushSize === 2 ? 'bg-white text-slate-900 font-bold' : 'text-gray-400'}`}
                  >
                    Tipis
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrushSize(4)}
                    className={`px-1.5 py-0.5 rounded text-[8.5px] ${brushSize === 4 ? 'bg-white text-slate-900 font-bold' : 'text-gray-400'}`}
                  >
                    Sedang
                  </button>
                </div>
              </div>

              {/* Actions: Undo / Clear / Selesai */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  className="text-gray-300 hover:text-white flex items-center gap-0.5 text-[9.5px] cursor-pointer"
                  title="Undo coretan terakhir"
                >
                  <span className="material-symbols-outlined text-[13px]">undo</span>
                  Undo
                </button>
                <button
                  type="button"
                  onClick={handleClearCanvas}
                  className="text-rose-400 hover:text-rose-300 flex items-center gap-0.5 text-[9.5px] cursor-pointer ml-1"
                  title="Hapus semua coretan"
                >
                  <span className="material-symbols-outlined text-[13px]">delete</span>
                  Bersihkan
                </button>
                <button
                  type="button"
                  onClick={() => setShowReviseModal(true)}
                  className="ml-2 px-2.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[9.5px] cursor-pointer"
                >
                  Lanjut ke Catatan Revisi →
                </button>
              </div>
            </div>
          )}

          {/* Viewer Canvas Stage */}
          <div ref={viewerContainerRef} className="flex-1 relative min-h-0 bg-slate-200 flex items-center justify-center overflow-hidden">
            {previewMode === '2D' ? (
              pdf2DUrl ? (
                <div className="relative w-full h-full">
                  <iframe
                    src={`${pdf2DUrl}#navpanes=0&pagemode=none&view=FitH`}
                    className="w-full h-full border-0"
                    title="2D Drawing PDF"
                  />
                  {/* Saved Coretan Image Overlay: visible to drawer & approver */}
                  {markupImgUrl && showSavedMarkup && !isMarkupMode && (
                    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                      <img
                        src={markupImgUrl}
                        alt="Coretan Revisi"
                        className="w-full h-full object-fill pointer-events-none select-none"
                      />
                    </div>
                  )}
                  {/* Interactive Coretan Canvas Overlay */}
                  <canvas
                    ref={markupCanvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className={`absolute inset-0 w-full h-full z-20 ${
                      isMarkupMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none hidden'
                    }`}
                  />
                </div>
              ) : markupImgUrl ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center p-4 bg-slate-100">
                  <div className="p-2 mb-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[10px] font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-rose-600">draw</span>
                    <span>Coretan Catatan Revisi dari Approver:</span>
                  </div>
                  <img
                    src={markupImgUrl}
                    alt="Coretan Revisi"
                    className="max-w-full max-h-[85%] object-contain border border-slate-300 rounded shadow-sm bg-white"
                  />
                </div>
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

        {/* ── RIGHT: SPECIFICATIONS & 2-CHOICE DECISION FLOW ── */}
        <div className="w-80 flex flex-col gap-2.5 shrink-0 overflow-y-auto no-scrollbar">

          {/* Card 1: Drawing Specification */}
          <div className="border border-gray-200 rounded-xl p-3 bg-white shadow-3xs">
            <p className="text-[8.5px] font-bold uppercase text-gray-400 tracking-wider mb-2">Detail Drawing</p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[10px]">
              <div>
                <span className="text-[8.5px] text-gray-400 block font-medium">No. Registrasi</span>
                <span className="font-mono font-bold text-gray-800">{item?.noReg || approval.noReg}</span>
              </div>
              <div>
                <span className="text-[8.5px] text-gray-400 block font-medium">Versi</span>
                <span className="font-bold text-gray-800">Rev {item?.revStatus || '0'}</span>
              </div>
              <div>
                <span className="text-[8.5px] text-gray-400 block font-medium">Line Produk</span>
                <span className="font-semibold text-gray-700 truncate block">{item?.lineProduct || '—'}</span>
              </div>
              <div>
                <span className="text-[8.5px] text-gray-400 block font-medium">Proses</span>
                <span className="font-semibold text-gray-700 truncate block">{item?.process || '—'}</span>
              </div>
            </div>

            {/* Submitter's Note */}
            {approval.note && (
              <div className="mt-2.5 pt-2 border-t border-gray-100">
                <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">Catatan Pengajuan</span>
                <p className="text-[9.5px] text-gray-600 italic bg-gray-50 p-2 rounded-lg border border-gray-150 leading-relaxed">
                  &ldquo;{approval.note}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* Card 2: Sequential Stepper (Section Head -> Dept Head) */}
          <div className="border border-gray-200 rounded-xl p-3 bg-white shadow-3xs space-y-2.5">
            <p className="text-[8.5px] font-bold uppercase text-gray-400 tracking-wider">Alur Persetujuan</p>

            <div className="space-y-2 text-[10px]">
              {/* Section Head Stage */}
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-gray-50 border border-gray-150">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white ${
                    approval.sectionStatus === 'APPROVED'
                      ? 'bg-emerald-500'
                      : approval.sectionStatus === 'REJECTED'
                      ? 'bg-rose-500'
                      : 'bg-amber-400'
                  }`}
                >
                  {approval.sectionStatus === 'APPROVED' ? '✓' : approval.sectionStatus === 'REJECTED' ? '✕' : '1'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800">Section Head</span>
                    <span
                      className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded ${
                        approval.sectionStatus === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : approval.sectionStatus === 'REJECTED'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {approval.sectionStatus === 'APPROVED'
                        ? 'Disetujui'
                        : approval.sectionStatus === 'REJECTED'
                        ? 'Perlu Revisi'
                        : 'Menunggu'}
                    </span>
                  </div>
                  <p className="text-[9px] text-gray-500 mt-0.5">
                    {approval.sectionHead?.name || 'Menunggu verifikasi'}
                  </p>
                  {approval.sectionComment && (
                    <p className="text-[9px] text-gray-700 italic mt-1 bg-white p-1.5 rounded border border-gray-200 leading-snug">
                      &ldquo;{approval.sectionComment}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* Dept Head Stage */}
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-gray-50 border border-gray-150">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white ${
                    approval.deptStatus === 'APPROVED'
                      ? 'bg-emerald-500'
                      : approval.deptStatus === 'REJECTED'
                      ? 'bg-rose-500'
                      : approval.sectionStatus === 'APPROVED'
                      ? 'bg-amber-400'
                      : 'bg-gray-300'
                  }`}
                >
                  {approval.deptStatus === 'APPROVED' ? '✓' : approval.deptStatus === 'REJECTED' ? '✕' : '2'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800">Dept Head</span>
                    <span
                      className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded ${
                        approval.deptStatus === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : approval.deptStatus === 'REJECTED'
                          ? 'bg-rose-100 text-rose-700'
                          : approval.sectionStatus === 'APPROVED'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {approval.deptStatus === 'APPROVED'
                        ? 'Disetujui'
                        : approval.deptStatus === 'REJECTED'
                        ? 'Perlu Revisi'
                        : approval.sectionStatus === 'APPROVED'
                        ? 'Menunggu'
                        : 'Antre'}
                    </span>
                  </div>
                  <p className="text-[9px] text-gray-500 mt-0.5">
                    {approval.deptHead?.name || (approval.sectionStatus === 'APPROVED' ? 'Menunggu verifikasi' : 'Menunggu Section Head')}
                  </p>
                  {approval.deptComment && (
                    <p className="text-[9px] text-gray-700 italic mt-1 bg-white p-1.5 rounded border border-gray-200 leading-snug">
                      &ldquo;{approval.deptComment}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Feedback Revisi Aktif (Jika status REJECTED) */}
          {isRevised && (
            <div className="border border-rose-200 rounded-xl p-3 bg-rose-50/80 shadow-3xs space-y-2">
              <div className="flex items-center gap-1.5 text-rose-700 font-bold text-[10px]">
                <span className="material-symbols-outlined text-[15px]">assignment_late</span>
                <span>Catatan Revisi dari Approver</span>
              </div>
              <p className="text-[10px] text-rose-900 bg-white/90 p-2 rounded-lg border border-rose-200 font-medium leading-relaxed">
                {approval.finalComment || approval.sectionComment || approval.deptComment || 'Drawing memerlukan perbaikan.'}
              </p>
              {markupImgUrl && (
                <p className="text-[9px] text-rose-700 flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-[13px]">draw</span>
                  <span>Terdapat coretan penanda revisi pada gambar di sebelah kiri.</span>
                </p>
              )}
            </div>
          )}

          {/* Card 4: Action Decision Panel (HANYA 2 PILIHAN UNTUK APPROVE / REVISI) */}
          <div className="border border-gray-200 rounded-xl p-3 bg-white shadow-3xs space-y-2 mt-auto">
            {canDecide ? (
              <div className="space-y-2">
                <p className="text-[8.5px] font-bold uppercase text-gray-400 tracking-wider">
                  Keputusan Verifikasi ({user?.role === 'PE_DEPT_HEAD' ? 'Dept Head' : 'Section Head'})
                </p>

                {/* HANYA 2 PILIHAN: SETUJUI / REVISI */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Pilihan 1: Setujui */}
                  <button
                    type="button"
                    onClick={() => { setComment(''); setShowApproveModal(true); }}
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10.5px] font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                    <span>Setujui</span>
                  </button>

                  {/* Pilihan 2: Revisi */}
                  <button
                    type="button"
                    onClick={() => { setComment(''); setShowReviseModal(true); }}
                    className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10.5px] font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">history_edu</span>
                    <span>Revisi</span>
                  </button>
                </div>
              </div>
            ) : isRevised && isDrawer ? (
              /* DRAWER ACTION: UPLOAD REVISIAN BARU */
              <div className="space-y-2">
                <p className="text-[8.5px] font-bold uppercase text-gray-400 tracking-wider">Tindakan Drawer</p>
                <button
                  type="button"
                  onClick={() => {
                    const currentRevNum = parseInt(item?.revStatus || '0', 10);
                    setNewRevStatus(isNaN(currentRevNum) ? '1' : String(currentRevNum + 1));
                    setShowUploadModal(true);
                  }}
                  className="w-full py-2.5 px-3 bg-[#0063ff] hover:bg-[#0052d4] text-white rounded-xl text-[10.5px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">upload_file</span>
                  <span>Upload Revisian Baru</span>
                </button>
                <p className="text-[8.5px] text-gray-400 text-center leading-tight">
                  Drawing lama akan otomatis disimpan ke Version History.
                </p>
              </div>
            ) : isPending ? (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-center text-amber-800 text-[9.5px] font-semibold flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-amber-600">schedule</span>
                <span>
                  {approval.sectionStatus === 'WAITING'
                    ? 'Menunggu verifikasi Section Head'
                    : 'Menunggu persetujuan final Dept Head'}
                </span>
              </div>
            ) : (
              <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-center text-gray-600 text-[9.5px] font-semibold flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">
                  {isApproved ? 'verified' : 'cancel'}
                </span>
                <span>Proses selesai ({isApproved ? 'Disetujui' : 'Perlu Revisi'})</span>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ─── MODAL 1: SETUJUI ──────────────── */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleApproveSubmit} className="max-w-sm w-full bg-white rounded-2xl p-5 text-gray-800 shadow-2xl border border-gray-200">
            <h3 className="font-bold text-xs text-emerald-700 mb-1 flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Konfirmasi Persetujuan Dokumen
            </h3>
            <p className="text-[9.5px] text-gray-600 my-2 leading-relaxed">
              Anda menyetujui dokumen drawing ini sebagai <span className="font-bold text-gray-800">{user?.role === 'PE_DEPT_HEAD' ? 'Dept Head' : 'Section Head'}</span>.
            </p>
            <div className="space-y-1 my-2">
              <label className="text-[9px] font-bold text-gray-500 uppercase">Catatan Persetujuan (Opsional)</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-2 text-[10px] h-18 outline-none focus:ring-1 focus:ring-emerald-500 text-gray-700 placeholder-gray-400 resize-none font-medium"
                placeholder="Contoh: Desain telah diverifikasi, dimensi dan toleransi sesuai standar..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-[10.5px] font-bold hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-[10.5px] font-bold hover:bg-emerald-700 transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">check</span>
                Setujui Dokumen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL 2: REVISI (DENGAN CATATAN & CORETAN PDF) ──────────────── */}
      {showReviseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleReviseSubmit} className="max-w-sm w-full bg-white rounded-2xl p-5 text-gray-800 shadow-2xl border border-gray-200">
            <h3 className="font-bold text-xs text-amber-700 mb-1 flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <span className="material-symbols-outlined text-[16px]">history_edu</span>
              Permintaan Revisi Dokumen
            </h3>
            <p className="text-[9.5px] text-gray-600 my-2 leading-relaxed">
              Tuliskan poin-poin yang harus diperbaiki oleh Drawer. Coretan markup yang Anda buat pada drawing akan otomatis dikirimkan ke Drawer.
            </p>

            {localMarkupData ? (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg mb-2 text-[9px] text-rose-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[15px] text-rose-600 shrink-0">check_circle</span>
                  <span className="font-semibold truncate">Coretan revisi tersimpan &amp; akan dilampirkan ke Drawer.</span>
                </div>
                <img src={localMarkupData} alt="Preview Coretan" className="w-12 h-8 object-contain bg-white rounded border border-rose-300 shrink-0 shadow-2xs" />
              </div>
            ) : (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg mb-2 text-[9px] text-amber-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-amber-600 shrink-0">draw</span>
                  <span>Belum ada coretan pada gambar PDF.</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowReviseModal(false);
                    setIsMarkupMode(true);
                  }}
                  className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[8.5px] font-bold cursor-pointer shrink-0"
                >
                  Beri Coretan Dulu
                </button>
              </div>
            )}

            <div className="space-y-1 my-2">
              <label className="text-[9px] font-bold text-gray-700 uppercase">
                Catatan Revisi / Apa Saja yang Perlu Direvisi <span className="text-rose-500">*</span>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-2 text-[10px] h-24 outline-none focus:ring-1 focus:ring-amber-500 text-gray-700 placeholder-gray-400 resize-none font-medium"
                placeholder="Contoh: 1. Perbaiki toleransi pin locator sesuai coretan merah. 2. Tambahkan chamfer pada base plate..."
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => setShowReviseModal(false)}
                className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-[10.5px] font-bold hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-1.5 bg-amber-600 text-white rounded-lg text-[10.5px] font-bold hover:bg-amber-700 transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">send</span>
                Kirim Revisi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL 3: UPLOAD REVISIAN BARU (UNTUK DRAWER) ──────────────── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleResubmitRevision} className="max-w-md w-full bg-white rounded-2xl p-5 text-gray-800 shadow-2xl border border-gray-200">
            <h3 className="font-bold text-xs text-blue-700 mb-1 flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              Unggah Revisian Drawing Baru
            </h3>
            <p className="text-[9.5px] text-gray-500 my-2 leading-relaxed">
              File drawing baru akan menggantikan drawing aktif. Drawing lama otomatis diarsipkan ke <span className="font-bold text-gray-700">Version History</span>.
            </p>

            <div className="space-y-3 my-2 text-[10px]">
              {/* File 2D PDF Upload */}
              <div>
                <label className="text-[9px] font-bold text-gray-700 uppercase block mb-1">
                  File 2D Drawing (PDF Baru) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) => setRevFile2D(e.target.files?.[0] || null)}
                  className="block w-full text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[9.5px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-gray-250 rounded-lg p-1"
                />
              </div>

              {/* File 3D STEP Upload (Optional) */}
              <div>
                <label className="text-[9px] font-bold text-gray-700 uppercase block mb-1">
                  File Model 3D (STEP / STP) - Opsional
                </label>
                <input
                  type="file"
                  accept=".step,.stp,.igs,.iges"
                  onChange={(e) => setRevFile3D(e.target.files?.[0] || null)}
                  className="block w-full text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[9.5px] file:font-bold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer border border-gray-250 rounded-lg p-1"
                />
              </div>

              {/* Nomor Revisi Baru */}
              <div>
                <label className="text-[9px] font-bold text-gray-700 uppercase block mb-1">
                  Nomor Revisi Baru
                </label>
                <input
                  type="text"
                  value={newRevStatus}
                  onChange={(e) => setNewRevStatus(e.target.value)}
                  placeholder="Misal: 1, 2, atau B"
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Catatan Perbaikan */}
              <div>
                <label className="text-[9px] font-bold text-gray-700 uppercase block mb-1">
                  Catatan Perbaikan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-2 text-[10px] h-20 outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 placeholder-gray-400 resize-none font-medium"
                  placeholder="Jelaskan perubahan yang telah diperbaiki sesuai catatan Section Head / Dept Head..."
                  required
                  value={resubmitNote}
                  onChange={(e) => setResubmitNote(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                disabled={resubmitting}
                onClick={() => setShowUploadModal(false)}
                className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-[10.5px] font-bold hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={resubmitting}
                className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-[10.5px] font-bold hover:bg-blue-700 transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {resubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                    Mengunggah...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
                    Ajukan Revisian
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
