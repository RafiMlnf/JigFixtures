'use client';

import React, { useState, use, useEffect, useRef, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { canApprove } from '@/lib/rbac';
import { getFileUrl, approveRevision, rejectRevision, uploadFile, resubmitRevision, fetchApprovalDetail } from '@/lib/api/phase3';
import SnapshotEditorModal from '@/components/approval/SnapshotEditorModal';

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

  // Snapshot & Revision Editor States
  const [snapshotImage, setSnapshotImage] = useState<string | null>(null);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);
  const [showSnapshotEditor, setShowSnapshotEditor] = useState(false);
  const [viewingSavedSnapshot, setViewingSavedSnapshot] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [pdfTotalPages, setPdfTotalPages] = useState<number>(1);
  const [selectedSnapshotPage, setSelectedSnapshotPage] = useState<number>(1);
  const [showPagePickerModal, setShowPagePickerModal] = useState<boolean>(false);
  const [isSwitchingPage, setIsSwitchingPage] = useState<boolean>(false);

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

  // Snapshot Capture & Revision Submission Handlers
  const handleTakeSnapshot = async () => {
    if (!pdf2DUrl) {
      alert('File PDF 2D Drawing belum tersedia untuk diambil snapshot.');
      return;
    }
    setIsCapturingSnapshot(true);
    try {
      // Load standalone PDF.js in the browser (avoids Turbopack / Webpack canvas module resolution)
      let pdfjs: any = (window as any).pdfjsLib;
      if (!pdfjs) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/pdf.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Gagal memuat engine PDF reader'));
          document.head.appendChild(script);
        });
        pdfjs = (window as any).pdfjsLib;
      }

      if (!pdfjs) {
        throw new Error('PDF Engine tidak dapat diinisialisasi.');
      }

      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      const loadingTask = pdfjs.getDocument(pdf2DUrl);
      const pdfDoc = await loadingTask.promise;
      const total = pdfDoc.numPages || 1;
      setPdfTotalPages(total);

      if (total > 1) {
        // If multi-page, prompt user to select which page
        setShowPagePickerModal(true);
      } else {
        await renderPdfPageSnapshot(1);
      }
    } catch (err: any) {
      console.error('Failed to capture PDF snapshot:', err);
      alert(`Gagal memeriksa file PDF: ${err.message || 'Error server'}.`);
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  const renderPdfPageSnapshot = async (pageNum: number) => {
    if (!pdf2DUrl) return;
    setIsCapturingSnapshot(true);
    try {
      let pdfjs: any = (window as any).pdfjsLib;
      if (!pdfjs) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/pdf.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Gagal memuat engine PDF reader'));
          document.head.appendChild(script);
        });
        pdfjs = (window as any).pdfjsLib;
      }
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      const loadingTask = pdfjs.getDocument(pdf2DUrl);
      const pdfDoc = await loadingTask.promise;
      const safePage = Math.min(Math.max(1, pageNum), pdfDoc.numPages);
      const page = await pdfDoc.getPage(safePage);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Context canvas tidak tersedia');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/png');
      setSnapshotImage(dataUrl);
      setSelectedSnapshotPage(safePage);
      setShowPagePickerModal(false);
      setShowSnapshotEditor(true);
    } catch (err: any) {
      console.error('Failed to render page snapshot:', err);
      alert(`Gagal merender snapshot halaman ${pageNum}: ${err.message || 'Error server'}`);
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  const handleSnapshotRevisionSubmit = async ({
    comment: revComment,
    markupData: revMarkup,
  }: {
    comment: string;
    markupData: string;
  }) => {
    await rejectRevision(approval.id, {
      comment: revComment,
      markupData: revMarkup,
    });
    setToastMessage('Permintaan revisi beserta snapshot coretan berhasil dikirim ke Drawer.');
    setShowSnapshotEditor(false);
    await loadApprovalData();
    setTimeout(() => {
      router.push('/approval-center');
    }, 1200);
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

  // Decision 2: Revisi (Return with Notes)
  const handleReviseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      alert('Catatan revisi wajib diisi agar drawer mengetahui apa yang perlu diperbaiki.');
      return;
    }
    try {
      await rejectRevision(approval.id, {
        comment: comment.trim(),
      });

      setToastMessage('Permintaan revisi berhasil dikembalikan ke drawer.');
      setShowReviseModal(false);
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

            {/* Drawing Markup Controls (Only when saved markup exists) */}
            {previewMode === '2D' && markupImgUrl && (
              <div className="flex items-center gap-1.5">
                {/* Saved Markup Toggle for Drawer or Reviewer */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setViewingSavedSnapshot(!viewingSavedSnapshot)}
                    className={`px-2.5 py-1 rounded-lg text-[9.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      viewingSavedSnapshot
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300'
                    }`}
                    title="Lihat snapshot gambar yang telah diberi coretan & pin tanda oleh approver"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {viewingSavedSnapshot ? 'picture_as_pdf' : 'draw'}
                    </span>
                    <span>{viewingSavedSnapshot ? 'Buka PDF Asli' : 'Lihat Coretan Revisi'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLightboxImg(markupImgUrl)}
                    className="px-2 py-1 rounded-lg text-[9.5px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer"
                    title="Buka gambar coretan resolusi penuh (Lightbox)"
                  >
                    <span className="material-symbols-outlined text-[13px]">fullscreen</span>
                    <span>Perbesar</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Viewer Canvas Stage */}
          <div className="flex-1 relative min-h-0 bg-slate-200 flex items-center justify-center overflow-hidden">
            {previewMode === '2D' ? (
              viewingSavedSnapshot && markupImgUrl ? (
                /* Viewing Saved Annotated Snapshot */
                <div className="relative w-full h-full flex flex-col items-center justify-between p-3 bg-slate-900/95 overflow-auto">
                  <div className="w-full flex items-center justify-between pb-2 border-b border-slate-700 text-white shrink-0">
                    <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-rose-400">draw</span>
                      Snapshot Coretan &amp; Pin Penanda Revisi
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLightboxImg(markupImgUrl)}
                        className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">fullscreen</span>
                        <span>Ukuran Penuh</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingSavedSnapshot(false)}
                        className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>Tutup &amp; Lihat PDF</span>
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-center p-2 min-h-0 w-full">
                    <img
                      src={markupImgUrl}
                      alt="Coretan Revisi"
                      onClick={() => setLightboxImg(markupImgUrl)}
                      className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl border border-slate-700 bg-white cursor-zoom-in"
                      title="Klik untuk melihat ukuran penuh"
                    />
                  </div>
                </div>
              ) : pdf2DUrl ? (
                /* Standard Clean PDF Iframe */
                <div className="relative w-full h-full">
                  <iframe
                    src={`${pdf2DUrl}#navpanes=0&pagemode=none&view=FitH`}
                    className="w-full h-full border-0"
                    title="2D Drawing PDF"
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
                    onClick={() => setLightboxImg(markupImgUrl)}
                    className="max-w-full max-h-[85%] object-contain border border-slate-300 rounded shadow-sm bg-white cursor-zoom-in"
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
          <div className="flex flex-col bg-white border border-blue-200/60 rounded-xl shadow-xs overflow-hidden">
            <div className="h-7 px-3 bg-[#0063ff] text-white flex items-center justify-between shrink-0">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[13px]">description</span>
                Detail Drawing
              </h3>
            </div>
            <div className="p-3">
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
          </div>

          {/* Card 2: Sequential Stepper (Section Head -> Dept Head) */}
          <div className="flex flex-col bg-white border border-blue-200/60 rounded-xl shadow-xs overflow-hidden">
            <div className="h-7 px-3 bg-[#0063ff] text-white flex items-center justify-between shrink-0">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[13px]">timeline</span>
                Alur Persetujuan
              </h3>
            </div>

            <div className="p-3 space-y-2 text-[10px]">
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
            <div className="flex flex-col bg-rose-50/50 border border-rose-300 rounded-xl shadow-xs overflow-hidden">
              <div className="h-7 px-3 bg-rose-600 text-white flex items-center justify-between shrink-0">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px]">assignment_late</span>
                  Catatan Revisi dari Approver
                </h3>
              </div>
              <div className="p-3 space-y-2">
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
            </div>
          )}

          {/* Card 4: Action Decision Panel (HANYA 2 PILIHAN UNTUK APPROVE / REVISI) */}
          <div className="flex flex-col bg-white border border-blue-200/60 rounded-xl shadow-xs overflow-hidden mt-auto">
            <div className="h-7 px-3 bg-[#0063ff] text-white flex items-center justify-between shrink-0">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[13px]">gavel</span>
                Keputusan ({user?.role === 'PE_DEPT_HEAD' ? 'Dept Head' : 'Section Head'})
              </h3>
            </div>
            <div className="p-3 space-y-2">
            {canDecide ? (
              <div className="space-y-2">
                <p className="text-[8.5px] font-bold uppercase text-gray-400 tracking-wider">
                  Keputusan Verifikasi ({user?.role === 'PE_DEPT_HEAD' ? 'Dept Head' : 'Section Head'})
                </p>

                {/* HANYA 2 PILIHAN: SETUJUI / REVISI (SNAPSHOT & PIN) */}
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

                  {/* Pilihan 2: Revisi (Snapshot & Pin) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (pdf2DUrl) {
                        handleTakeSnapshot();
                      } else {
                        setComment('');
                        setShowReviseModal(true);
                      }
                    }}
                    disabled={isCapturingSnapshot}
                    className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10.5px] font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {isCapturingSnapshot ? 'sync' : 'screenshot_monitor'}
                    </span>
                    <span>{isCapturingSnapshot ? 'Mengambil...' : 'Revisi (Snapshot)'}</span>
                  </button>
                </div>

                {pdf2DUrl && (
                  <button
                    type="button"
                    onClick={() => { setComment(''); setShowReviseModal(true); }}
                    className="w-full text-center text-[9px] text-gray-400 hover:text-amber-700 hover:underline pt-0.5 cursor-pointer"
                  >
                    Atau beri revisi berupa catatan teks saja...
                  </button>
                )}
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
              Tuliskan catatan perbaikan atau ambil snapshot drawing untuk menandai bagian yang perlu direvisi secara visual dengan pin (📍) dan coretan.
            </p>

            {pdf2DUrl && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg mb-2 text-[9px] text-amber-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-amber-600 shrink-0">screenshot_monitor</span>
                  <span className="font-medium">Ingin menandai langsung pada gambar drawing?</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowReviseModal(false);
                    handleTakeSnapshot();
                  }}
                  className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[8.5px] font-bold cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[12px]">draw</span>
                  <span>Snapshot &amp; Pin</span>
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

      {/* ─── MODAL: PILIH HALAMAN DRAWING (UNTUK MULTI-PAGE PDF) ─── */}
      {showPagePickerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            {/* Header Standar App */}
            <div className="h-9 px-3.5 bg-[#0063ff] text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-xs flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px]">auto_stories</span>
                Pilih Halaman Drawing
              </h3>
              <button
                type="button"
                onClick={() => setShowPagePickerModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg w-6 h-6 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Drawing PDF ini memiliki <strong className="text-gray-800 font-bold">{pdfTotalPages} lembar halaman</strong>. Pilih lembar gambar yang ingin diambil snapshot untuk diberi tanda revisi:
              </p>

              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {Array.from({ length: pdfTotalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    disabled={isCapturingSnapshot}
                    onClick={() => renderPdfPageSnapshot(pageNum)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer text-center group ${
                      selectedSnapshotPage === pageNum
                        ? 'border-[#0063ff] bg-blue-50/70 text-[#0063ff] shadow-xs ring-1 ring-[#0063ff]'
                        : 'border-gray-200 bg-gray-50 hover:bg-blue-50/40 hover:border-blue-300 text-gray-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-2xl text-[#0063ff] group-hover:scale-110 transition-transform">
                      picture_as_pdf
                    </span>
                    <span className="text-[11px] font-bold">Halaman {pageNum}</span>
                    <span className="text-[8.5px] text-gray-400">Lembar ke-{pageNum}</span>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-150 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowPagePickerModal(false)}
                  className="w-full py-1.5 border border-gray-300 text-gray-700 font-bold rounded-lg text-xs hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: SNAPSHOT EDITOR (PIN & DRAWING MARKUP) ─── */}
      {showSnapshotEditor && snapshotImage && (
        <SnapshotEditorModal
          isOpen={showSnapshotEditor}
          snapshotImage={snapshotImage}
          designNoReg={item?.noReg || approval.noReg || 'Drawing'}
          initialComment={comment}
          currentPage={selectedSnapshotPage}
          totalPages={pdfTotalPages}
          isChangingPage={isSwitchingPage}
          onChangePage={async (newPage) => {
            setIsSwitchingPage(true);
            await renderPdfPageSnapshot(newPage);
            setIsSwitchingPage(false);
          }}
          onClose={() => setShowSnapshotEditor(false)}
          onSubmitRevision={handleSnapshotRevisionSubmit}
        />
      )}

      {/* ─── LIGHTBOX ZOOM VIEW (FOR ANNOTATED SNAPSHOT) ─── */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImg(null)}
        >
          <div className="w-full max-w-6xl flex items-center justify-between pb-3 text-white">
            <span className="text-xs font-bold flex items-center gap-2 text-rose-300">
              <span className="material-symbols-outlined text-sm text-rose-400">draw</span>
              Detail Coretan &amp; Pin Penanda Revisi
            </span>
            <button
              type="button"
              onClick={() => setLightboxImg(null)}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Tutup</span>
              <span className="text-[10px] text-gray-300">(ESC)</span>
            </button>
          </div>
          <div
            className="relative max-w-6xl max-h-[85vh] overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImg}
              alt="Perbesaran Coretan Revisi"
              className="max-w-full max-h-[80vh] object-contain mx-auto rounded"
            />
          </div>
        </div>
      )}

    </div>
  );
}
