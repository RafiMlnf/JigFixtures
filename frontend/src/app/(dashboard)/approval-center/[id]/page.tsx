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

function parseRevisionNotes(rawNote: string) {
  if (!rawNote) return { generalNote: '', pins: [] };

  const lines = rawNote.split('\n');
  const pins: Array<{ number: number; text: string }> = [];
  const generalLines: string[] = [];

  let currentPin: { number: number; text: string } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Matches: • [Pin #1] desc, [Pin #1] desc, [Pin 1] desc, Pin #1: desc, Pin 1 - desc
    const pinMatch = trimmed.match(/^(?:•\s*)?\[?(?:Pin|PIN)\s*#?(\d+)\]?:?\s*(.*)$/i);
    if (pinMatch) {
      if (currentPin) {
        pins.push(currentPin);
      }
      currentPin = {
        number: parseInt(pinMatch[1], 10),
        text: pinMatch[2]?.trim() || '',
      };
    } else if (currentPin && !trimmed.toLowerCase().startsWith('detail poin revisi')) {
      currentPin.text = currentPin.text ? `${currentPin.text} ${trimmed}` : trimmed;
    } else {
      if (currentPin) {
        pins.push(currentPin);
        currentPin = null;
      }
      if (!trimmed.toLowerCase().startsWith('detail poin revisi')) {
        generalLines.push(trimmed);
      }
    }
  }

  if (currentPin) {
    pins.push(currentPin);
  }

  // If no pins were found via "[Pin #X]", check if there are numbered points like "1. ..." or "2. ..."
  if (pins.length === 0) {
    const numberedMatches: Array<{ number: number; text: string }> = [];
    const nonNumbered: string[] = [];
    lines.forEach((l) => {
      const t = l.trim();
      const numMatch = t.match(/^(\d+)[\.\)]\s*(.+)$/);
      if (numMatch) {
        numberedMatches.push({
          number: parseInt(numMatch[1], 10),
          text: numMatch[2].trim(),
        });
      } else if (t && !t.toLowerCase().startsWith('detail poin revisi')) {
        nonNumbered.push(t);
      }
    });

    if (numberedMatches.length > 0) {
      return {
        generalNote: nonNumbered.join('\n').trim(),
        pins: numberedMatches,
      };
    }
  }

  return {
    generalNote: generalLines.join('\n').trim(),
    pins,
  };
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

  // Auto dismiss toast notification after 3.5 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);
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
  const [activePdfPage, setActivePdfPage] = useState<number>(1);
  const [selectedSnapshotPage, setSelectedSnapshotPage] = useState<number>(1);
  const [isSwitchingPage, setIsSwitchingPage] = useState<boolean>(false);
  const [selectedRevisionDetail, setSelectedRevisionDetail] = useState<any>(null);

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



  // Snapshot Capture Handler (Direct snapshot of active page without modal popup)
  const handleTakeSnapshot = async (pageToSnap?: number) => {
    if (!pdf2DUrl) {
      alert('File PDF 2D Drawing belum tersedia untuk diambil snapshot.');
      return;
    }
    const targetPage = pageToSnap || activePdfPage || 1;
    await renderPdfPageSnapshot(targetPage);
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

  // Derive active files and items
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

  // Inspect PDF total pages automatically when PDF URL becomes available
  useEffect(() => {
    if (!pdf2DUrl) return;
    let cancelled = false;
    const inspectPdf = async () => {
      try {
        let pdfjs: any = (window as any).pdfjsLib;
        if (!pdfjs) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/pdf.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Gagal load pdf reader'));
            document.head.appendChild(script);
          });
          pdfjs = (window as any).pdfjsLib;
        }
        if (!pdfjs || cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        const doc = await pdfjs.getDocument(pdf2DUrl).promise;
        if (!cancelled && doc) {
          setPdfTotalPages(doc.numPages || 1);
        }
      } catch (err) {
        console.warn('Gagal membaca info halaman PDF:', err);
      }
    };
    inspectPdf();
    return () => { cancelled = true; };
  }, [pdf2DUrl]);

  // Derived Revision Events (Chronological: latest first)
  const revisionEvents = React.useMemo(() => {
    const list: any[] = [];

    // 1. Current approval cycle
    if (approval) {
      const isReject = approval.status === 'REJECTED' || approval.sectionStatus === 'REJECTED' || approval.deptStatus === 'REJECTED';
      const isApprove = approval.status === 'APPROVED';
      const isWaiting = approval.status === 'WAITING';

      const drafterName = approval.submittedBy?.name || approval.author || 'Kukuh W.';
      const reviewerName = approval.sectionStatus === 'REJECTED'
        ? (approval.sectionHead?.name || 'M. Fariedl')
        : approval.deptStatus === 'REJECTED'
          ? (approval.deptHead?.name || 'Rahmat K.')
          : approval.sectionHead?.name || approval.deptHead?.name || 'Section Head';

      if (isReject) {
        // Status sedang ditolak / diminta revisi oleh Approver
        const revNote = approval.finalComment || approval.sectionComment || approval.deptComment || approval.note || 'Perlu perbaikan drawing';
        const hasMarkup = !!(approval.markupData || approval.annotatedDocPath);
        list.push({
          id: `current_reject_${approval.id}`,
          isCurrent: true,
          revStatus: item?.revStatus ? `Rev ${item.revStatus}` : 'Aktif',
          status: 'REJECTED',
          date: approval.date || 'Saat ini',
          dateShort: approval.date ? approval.date.slice(0, 5) : 'Kini',
          requester: reviewerName,
          requesterRole: approval.sectionStatus === 'REJECTED' ? 'Section Head' : 'Dept Head',
          submitter: drafterName,
          displayAuthor: reviewerName, // Diminta revisi oleh Approver (Sect/Dept)
          eventType: 'REQUEST',
          note: revNote,
          hasMarkup,
          markupImgUrl: hasMarkup ? (approval.markupData || (approval.annotatedDocPath ? getFileUrl(approval.annotatedDocPath) : null)) : null,
          doc2D: targetPdf ? getFileUrl(targetPdf) : null,
          doc3D: target3D ? getFileUrl(target3D) : null,
        });
      } else {
        // Status sedang diajukan revisi baru oleh Drafter (WAITING) atau disetujui (APPROVED)
        const drafterNote = approval.revisionNote || approval.note || (isApprove ? 'Desain telah disetujui' : 'Revisi drawing diajukan');
        list.push({
          id: `current_submit_${approval.id}`,
          isCurrent: true,
          revStatus: item?.revStatus ? `Rev ${item.revStatus}` : 'Aktif',
          status: approval.status,
          date: approval.date || 'Saat ini',
          dateShort: approval.date ? approval.date.slice(0, 5) : 'Kini',
          requester: reviewerName,
          requesterRole: 'Approver',
          submitter: drafterName,
          displayAuthor: drafterName, // Diajukan oleh Drafter
          eventType: 'SUBMIT',
          note: drafterNote,
          hasMarkup: false, // Drawing baru yang disubmit Drafter belum dicoret
          markupImgUrl: null,
          doc2D: targetPdf ? getFileUrl(targetPdf) : null,
          doc3D: target3D ? getFileUrl(target3D) : null,
        });
      }
    }

    // 2. Archived revision histories from database
    if (fullItem?.revisionHistories && fullItem.revisionHistories.length > 0) {
      fullItem.revisionHistories.forEach((rh: any) => {
        const hasMarkup = !!(rh.markupData || rh.annotatedDocPath);
        const d = rh.createdAt ? new Date(rh.createdAt) : null;
        const drafterName = rh.changedBy?.name || 'Kukuh W.';
        const reviewerName = rh.requestedByName || rh.approvedByName || 'Section Head';
        
        // Pada arsip revisi yang memiliki catatan coretan atau feedback, tampilkan reviewer yang meminta revisi tersebut
        const authorToShow = hasMarkup || rh.revisionNote ? reviewerName : drafterName;

        list.push({
          id: rh.id,
          isCurrent: false,
          revStatus: `Rev ${rh.revStatus || '0'}`,
          status: 'ARCHIVED',
          date: d ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
          dateShort: d ? `${d.getDate()}/${d.getMonth() + 1}` : '—',
          requester: reviewerName,
          requesterRole: 'Approver',
          submitter: drafterName,
          displayAuthor: authorToShow,
          eventType: hasMarkup ? 'REQUEST' : 'SUBMIT',
          note: rh.revisionNote || rh.description || 'Perubahan drawing',
          hasMarkup,
          markupImgUrl: rh.markupData || (rh.annotatedDocPath ? getFileUrl(rh.annotatedDocPath) : null),
          doc2D: (rh.loc2D || rh.path2D) ? getFileUrl(rh.loc2D || rh.path2D) : null,
          doc3D: (rh.loc3D || rh.path3D) ? getFileUrl(rh.loc3D || rh.path3D) : null,
        });
      });
    }

    return list;
  }, [approval, fullItem, item, targetPdf, target3D]);

  // Status mapping
  const isPending = approval?.status === 'WAITING';
  const isApproved = approval?.status === 'APPROVED';
  const isRevised = approval?.status === 'REJECTED';

  // Role permissions for decisions
  const canDecideSec = user?.role === 'PE_SECTION_HEAD' && approval?.sectionStatus === 'WAITING' && isPending;
  const canDecideDept = user?.role === 'PE_DEPT_HEAD' && approval?.sectionStatus === 'APPROVED' && approval?.deptStatus === 'WAITING' && isPending;
  const canDecide = canDecideSec || canDecideDept;

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

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 pt-2 bg-white h-full overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-xs text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 flex items-center gap-2.5 border border-gray-700/60 max-w-lg">
          <span className="material-symbols-outlined text-emerald-400 text-base shrink-0">check_circle</span>
          <span className="leading-snug">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-1 text-gray-400 hover:text-white rounded-md p-0.5 transition-colors cursor-pointer shrink-0"
            title="Tutup"
          >
            <span className="material-symbols-outlined text-sm block">close</span>
          </button>
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

        {/* ─── ALUR SIMPLE DOT (APPROVAL DRAFTER, SECT, DEPT) ─── */}
        <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 px-3 py-1 rounded-full shadow-3xs">
          {/* Drafter */}
          <div className="flex items-center gap-1.5" title={`Drafter: ${approval.author} (Diajukan)`}>
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-2xs" />
            <span className="text-[8.5px] font-bold text-gray-700">Drafter</span>
          </div>

          <div className="w-2.5 h-px bg-gray-300" />

          {/* Section Head */}
          <div
            className="flex items-center gap-1.5"
            title={`Section Head: ${approval.sectionHead?.name || 'Section Head'} (${approval.sectionStatus === 'APPROVED' ? 'Disetujui' : approval.sectionStatus === 'REJECTED' ? 'Perlu Revisi' : 'Menunggu'
              })`}
          >
            <div
              className={`w-2 h-2 rounded-full ${approval.sectionStatus === 'APPROVED'
                ? 'bg-emerald-500'
                : approval.sectionStatus === 'REJECTED'
                  ? 'bg-rose-500 animate-pulse'
                  : 'bg-amber-400'
                } shadow-2xs`}
            />
            <span className="text-[8.5px] font-bold text-gray-700">Sect</span>
          </div>

          <div className="w-2.5 h-px bg-gray-300" />

          {/* Dept Head */}
          <div
            className="flex items-center gap-1.5"
            title={`Dept Head: ${approval.deptHead?.name || 'Dept Head'} (${approval.deptStatus === 'APPROVED'
              ? 'Disetujui'
              : approval.deptStatus === 'REJECTED'
                ? 'Perlu Revisi'
                : approval.sectionStatus === 'APPROVED'
                  ? 'Menunggu'
                  : 'Antre'
              })`}
          >
            <div
              className={`w-2 h-2 rounded-full ${approval.deptStatus === 'APPROVED'
                ? 'bg-emerald-500'
                : approval.deptStatus === 'REJECTED'
                  ? 'bg-rose-500 animate-pulse'
                  : approval.sectionStatus === 'APPROVED'
                    ? 'bg-amber-400'
                    : 'bg-gray-300'
                } shadow-2xs`}
            />
            <span className="text-[8.5px] font-bold text-gray-700">Dept</span>
          </div>
        </div>
      </header>

      {/* ─── 2-COLUMN BALANCED LAYOUT ──────────────── */}
      <div className="flex-1 flex gap-3 min-h-0">

        {/* ── LEFT: DOCUMENT VIEWER + INTERACTIVE REDLINE MARKUP ── */}
        <div className="flex-1 flex flex-col min-w-0 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
          {/* Top Viewer Toolbar */}
          <div className="h-9 flex items-center justify-between px-2.5 border-b border-gray-200 bg-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPreviewMode('2D')}
                  className={`flex items-center gap-1 px-2.5 h-7 text-[10px] font-bold rounded-md transition-all ${previewMode === '2D'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  <span className="material-symbols-outlined text-[13px]">picture_as_pdf</span>
                  2D Drawing
                </button>
                <button
                  onClick={() => setPreviewMode('3D')}
                  className={`flex items-center gap-1 px-2.5 h-7 text-[10px] font-bold rounded-md transition-all ${previewMode === '3D'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  <span className="material-symbols-outlined text-[13px]">deployed_code</span>
                  3D Model
                </button>
              </div>

              {/* In-Viewer Direct Page Navigation (No popup modal needed!) */}
              {previewMode === '2D' && pdfTotalPages > 1 && !viewingSavedSnapshot && (
                <div className="flex items-center gap-1 bg-gray-100 border border-gray-250 rounded-lg p-0.5">
                  <button
                    type="button"
                    disabled={activePdfPage <= 1}
                    onClick={() => setActivePdfPage((p) => Math.max(1, p - 1))}
                    className="w-5 h-5 rounded flex items-center justify-center hover:bg-white text-gray-600 disabled:opacity-30 cursor-pointer transition-colors"
                    title="Halaman Sebelumnya"
                  >
                    <span className="material-symbols-outlined text-[13px]">chevron_left</span>
                  </button>
                  <span className="text-[9px] font-mono font-bold text-gray-700 px-1 select-none">
                    Hal <strong className="text-blue-600">{activePdfPage}</strong> / {pdfTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={activePdfPage >= pdfTotalPages}
                    onClick={() => setActivePdfPage((p) => Math.min(pdfTotalPages, p + 1))}
                    className="w-5 h-5 rounded flex items-center justify-center hover:bg-white text-gray-600 disabled:opacity-30 cursor-pointer transition-colors"
                    title="Halaman Berikutnya"
                  >
                    <span className="material-symbols-outlined text-[13px]">chevron_right</span>
                  </button>
                </div>
              )}
            </div>

            {/* Drawing Markup Controls (Only when saved markup exists and viewing snapshot) */}
            {previewMode === '2D' && markupImgUrl && viewingSavedSnapshot && (
              <div className="flex items-center gap-1.5">
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
            )}
          </div>

          {/* Viewer Canvas Stage */}
          <div className="flex-1 relative min-h-0 bg-slate-200 flex items-center justify-center overflow-hidden">
            {previewMode === '2D' ? (
              viewingSavedSnapshot && markupImgUrl ? (
                /* Viewing Saved Annotated Snapshot */
                <div className="relative w-full h-full flex items-center justify-center bg-slate-900/95 overflow-auto p-2">
                  <img
                    src={markupImgUrl}
                    alt="Coretan Revisi"
                    onClick={() => setLightboxImg(markupImgUrl)}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-slate-700 bg-white cursor-zoom-in"
                    title="Klik untuk melihat ukuran penuh"
                  />
                </div>
              ) : pdf2DUrl ? (
                /* Standard Clean PDF Iframe with Direct Page Navigation */
                <div className="relative w-full h-full">
                  <iframe
                    key={activePdfPage}
                    src={`${pdf2DUrl}#page=${activePdfPage}&navpanes=0&pagemode=none&view=FitH`}
                    className="w-full h-full border-0"
                    title={`2D Drawing PDF - Halaman ${activePdfPage}`}
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

        {/* ── RIGHT: DETAIL DRAWING, COMPACT REVISION HISTORY & DECISION FLOW ── */}
        <div className="w-80 flex flex-col gap-2.5 shrink-0 overflow-y-auto no-scrollbar">

          {/* Card 1: Drawing Specification */}
          <div className="flex flex-col bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden shrink-0">
            <div className="h-6 px-2.5 bg-slate-100 border-b border-gray-200 flex items-center justify-between shrink-0">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-gray-700">
                Detail Drawing
              </span>
            </div>
            <div className="p-2.5">
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[10px]">
                <div>
                  <span className="text-[8px] text-gray-400 block font-medium uppercase">No. Registrasi</span>
                  <span className="font-mono font-bold text-gray-800 text-[9.5px] truncate block">{item?.noReg || approval.noReg}</span>
                </div>
                <div>
                  <span className="text-[8px] text-gray-400 block font-medium uppercase">Versi</span>
                  <span className="font-bold text-gray-800 text-[9.5px]">Rev {item?.revStatus || '0'}</span>
                </div>
                <div>
                  <span className="text-[8px] text-gray-400 block font-medium uppercase">Line Produk</span>
                  <span className="font-semibold text-gray-700 truncate block text-[9.5px]">{item?.lineProduct || '—'}</span>
                </div>
                <div>
                  <span className="text-[8px] text-gray-400 block font-medium uppercase">Proses</span>
                  <span className="font-semibold text-gray-700 truncate block text-[9.5px]">{item?.process || '—'}</span>
                </div>
              </div>

              {/* Submitter's Note */}
              {approval.note && (
                <div className="mt-2 pt-1.5 border-t border-gray-100">
                  <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">Catatan Pengajuan</span>
                  <p className="text-[9px] text-gray-600 italic bg-gray-50 p-1.5 rounded-lg border border-gray-150 leading-relaxed break-words" title={approval.note}>
                    &ldquo;{approval.note}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: SANGAT COMPACT TABLE REVISION HISTORY LISTING */}
          <div className="flex flex-col bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden shrink-0">
            <div className="h-6 px-2.5 bg-slate-100 border-b border-gray-200 flex items-center justify-between shrink-0">
              <div className="flex items-center text-gray-700">
                <span className="text-[9.5px] font-bold uppercase tracking-wider">Histori Event Revisi</span>
              </div>
              <span className="text-[8.5px] font-mono text-gray-400 font-bold">
                {revisionEvents.length} event
              </span>
            </div>

            <div>
              {revisionEvents.length === 0 ? (
                <div className="p-3 text-center text-gray-400 text-[9px] italic">
                  Belum ada event revisi tercatat.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-[9px] table-fixed">
                  <thead>
                    <tr className="bg-slate-50 text-gray-500 font-semibold border-b border-gray-200 text-[8px] uppercase select-none">
                      <th className="px-1.5 py-1 w-[40px]">Rev</th>
                      <th className="px-1.5 py-1 w-[44px]">Tgl</th>
                      <th className="px-1.5 py-1 w-[58px]">Oleh</th>
                      <th className="px-1.5 py-1">Deskripsi Revisi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {revisionEvents.map((ev) => (
                      <tr
                        key={ev.id}
                        onClick={() => setSelectedRevisionDetail(ev)}
                        className={`hover:bg-blue-50/80 cursor-pointer transition-colors ${ev.isCurrent && isRevised ? 'bg-rose-50/40' : ''
                          }`}
                        title="Klik untuk melihat detail lengkap revisi & coretan"
                      >
                        <td className="px-1.5 py-1.5 font-mono font-bold text-blue-600 truncate text-[9px] align-top">
                          {ev.revStatus}
                        </td>
                        <td className="px-1.5 py-1.5 text-gray-400 whitespace-nowrap text-[8px] align-top">
                          {ev.dateShort}
                        </td>
                        <td className="px-1.5 py-1.5 font-medium text-gray-800 text-[8.5px] break-words align-top" title={ev.displayAuthor || ev.submitter}>
                          {ev.displayAuthor || ev.submitter}
                        </td>
                        <td className="px-1.5 py-1.5 text-gray-600 text-[8.5px] break-words leading-tight align-top" title={ev.note}>
                          {ev.note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Action Decision Buttons (HANYA TOMBOL) */}
          <div className="mt-auto shrink-0 pt-1">
            {canDecide ? (
              <div className="space-y-1.5">
                {/* HANYA 2 PILIHAN: ACC (SETUJUI) & REVISI (PENA ICON) */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Pilihan 1: Setujui (ACC) */}
                  <button
                    type="button"
                    onClick={() => { setComment(''); setShowApproveModal(true); }}
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10.5px] font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                    <span>Setujui</span>
                  </button>

                  {/* Pilihan 2: Revisi (Icon Pena & Teks Revisi) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (pdf2DUrl) {
                        handleTakeSnapshot(activePdfPage);
                      } else {
                        setComment('');
                        setShowReviseModal(true);
                      }
                    }}
                    disabled={isCapturingSnapshot}
                    className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10.5px] font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {isCapturingSnapshot ? 'sync' : 'edit'}
                    </span>
                    <span>{isCapturingSnapshot ? 'Memuat...' : 'Revisi'}</span>
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
              <div className="space-y-1.5">
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
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-center text-amber-800 text-[9px] font-semibold flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-[13px] text-amber-600">schedule</span>
                <span>
                  {approval.sectionStatus === 'WAITING'
                    ? 'Menunggu verifikasi Section Head'
                    : 'Menunggu persetujuan final Dept Head'}
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {markupImgUrl && (
                  <button
                    type="button"
                    onClick={() => setViewingSavedSnapshot(!viewingSavedSnapshot)}
                    className={`w-full py-2 px-3 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-3xs ${viewingSavedSnapshot
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300'
                      }`}
                    title="Lihat snapshot gambar yang telah diberi coretan & pin tanda oleh approver"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {viewingSavedSnapshot ? 'picture_as_pdf' : 'draw'}
                    </span>
                    <span>{viewingSavedSnapshot ? 'Buka PDF Asli' : 'Lihat Coretan Revisi'}</span>
                  </button>
                )}

                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-center text-gray-600 text-[9px] font-semibold flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px]">
                    {isApproved ? 'verified' : 'cancel'}
                  </span>
                  <span>Proses selesai ({isApproved ? 'Disetujui' : 'Perlu Revisi'})</span>
                </div>
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
              <span className="material-symbols-outlined text-[16px]">edit</span>
              Revisi Dokumen
            </h3>
            <p className="text-[9.5px] text-gray-600 my-2 leading-relaxed">
              Tuliskan catatan perbaikan atau ambil snapshot drawing untuk menandai bagian yang perlu direvisi secara visual dengan pin (📍) dan coretan.
            </p>

            {pdf2DUrl && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg mb-2 text-[9px] text-amber-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-amber-600 shrink-0">draw</span>
                  <span className="font-medium">Ingin menandai langsung pada gambar drawing?</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowReviseModal(false);
                    handleTakeSnapshot(activePdfPage);
                  }}
                  className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[8.5px] font-bold cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[12px]">edit</span>
                  <span>Coretan &amp; Pin</span>
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

      {/* ─── MODAL: DETAIL REVISION HISTORY LENGKAP DENGAN CORETAN & DESC PIN TERPISAH ─── */}
      {selectedRevisionDetail && (() => {
        const parsedNotes = parseRevisionNotes(selectedRevisionDetail.note);
        return (
          <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 text-gray-800">
              {/* Header */}
              <div className="h-9 px-4 bg-slate-100 border-b border-gray-200 text-gray-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-xs flex items-center gap-1.5 text-gray-800">
                    <span>Detail Revisi —</span>
                    <span className="font-mono bg-white border border-gray-300 text-blue-600 px-2 py-0.5 rounded text-[10.5px] font-bold">
                      {selectedRevisionDetail.revStatus}
                    </span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRevisionDetail(null)}
                  className="text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg w-7 h-7 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                  title="Tutup Modal"
                >
                  ✕
                </button>
              </div>

              {/* Body: 2 Kolom (Kiri: Preview Coretan Gambar, Kanan: Kolom Deskripsi Tiap Pin) */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-gray-200 min-h-0">

                {/* ─── KOLOM KIRI: PREVIEW GAMBAR & CORETAN ─── */}
                <div className="w-full md:w-7/12 flex flex-col bg-slate-950 overflow-hidden min-h-[280px]">
                  <div className="flex-1 overflow-auto p-3 flex items-center justify-center bg-slate-950/90 relative">
                    {selectedRevisionDetail.markupImgUrl ? (
                      <img
                        src={selectedRevisionDetail.markupImgUrl}
                        alt="Coretan Visual Revisi"
                        onClick={() => setLightboxImg(selectedRevisionDetail.markupImgUrl)}
                        className="max-h-full max-w-full object-contain rounded-lg cursor-zoom-in hover:opacity-95 transition-opacity bg-white shadow-lg"
                        title="Klik untuk memperbesar gambar"
                      />
                    ) : (
                      <div className="p-6 text-center text-slate-500 text-[10.5px] flex flex-col items-center gap-1.5">
                        <span className="material-symbols-outlined text-2xl text-slate-600">hide_image</span>
                        <span>Tidak ada coretan visual pada event ini (revisi catatan teks saja).</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ─── KOLOM KANAN: DESKRIPSI TERPISAH TIAP PIN ─── */}
                <div className="w-full md:w-5/12 flex flex-col bg-white overflow-hidden min-h-0">
                  <div className="p-3.5 overflow-y-auto space-y-3 flex-1 text-[11px] no-scrollbar">

                    {/* 1. Tracking Information Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-gray-200">
                      <div>
                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider block">
                          Diminta Oleh
                        </span>
                        <span className="font-bold text-gray-800 flex items-center gap-1 mt-0.5 text-[9.5px] truncate">
                          {selectedRevisionDetail.requester || 'Approver'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider block">
                          Diajukan Oleh
                        </span>
                        <span className="font-bold text-gray-800 flex items-center gap-1 mt-0.5 text-[9.5px] truncate">
                          {selectedRevisionDetail.submitter || 'Kukuh W.'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider block">
                          Waktu / Tanggal
                        </span>
                        <span className="font-semibold text-gray-700 text-[9.5px]">
                          {selectedRevisionDetail.date}
                        </span>
                      </div>

                      <div>
                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider block">
                          Status Siklus
                        </span>
                        <span className={`font-bold text-[9.5px] ${selectedRevisionDetail.isCurrent ? 'text-amber-600' : 'text-gray-600'
                          }`}>
                          {selectedRevisionDetail.isCurrent ? 'Siklus Aktif' : 'Arsip Riwayat'}
                        </span>
                      </div>
                    </div>

                    {/* 2. Catatan Pengantar / Umum (Jika Ada) */}
                    {parsedNotes.generalNote && (
                      <div>
                        <label className="text-[8.5px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                          Catatan Umum Revisi
                        </label>
                        <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 text-[10px] leading-relaxed italic break-words">
                          &ldquo;{parsedNotes.generalNote}&rdquo;
                        </div>
                      </div>
                    )}

                    {/* 3. Daftar Kolom Deskripsi Tiap Pin (Terpisah per Pin) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[8.5px] font-mono text-gray-400 font-bold">
                          {parsedNotes.pins.length > 0 ? `${parsedNotes.pins.length} Pin` : 'Tanpa Pin'}
                        </span>
                      </div>

                      {parsedNotes.pins.length > 0 ? (
                        <div className="space-y-2">
                          {parsedNotes.pins.map((pin) => (
                            <div
                              key={pin.number}
                              className="p-2.5 bg-rose-50/70 border border-rose-200/90 rounded-xl flex items-start gap-2.5 shadow-3xs hover:border-rose-300 transition-colors"
                            >
                              <div className="w-5 h-5 rounded-full bg-rose-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                                {pin.number}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-[8.5px] font-bold text-rose-800 uppercase tracking-wider block mb-0.5">
                                  Keterangan Pin #{pin.number}
                                </span>
                                <p className="text-[10px] text-gray-800 leading-snug break-words font-medium">
                                  {pin.text || 'Periksa area penanda ini pada drawing.'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* Fallback jika revisi teks manual tanpa nomor pin */
                        <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-gray-800 text-[10px] leading-relaxed break-words font-medium">
                          {selectedRevisionDetail.note || 'Tidak ada catatan perbaikan.'}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Action Buttons in Modal Footer */}
                  <div className="p-2.5 border-t border-gray-150 bg-gray-50 flex gap-2 shrink-0">
                    {selectedRevisionDetail.markupImgUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setViewingSavedSnapshot(true);
                          setSelectedRevisionDetail(null);
                        }}
                        className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#0063ff] border border-blue-200 font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1 text-[9.5px]"
                      >
                        <span className="material-symbols-outlined text-[13px]">visibility</span>
                        Tampilkan di Viewer Utama
                      </button>
                    )}

                    {selectedRevisionDetail.doc2D && (
                      <a
                        href={selectedRevisionDetail.doc2D}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-1 text-[9.5px]"
                      >
                        <span className="material-symbols-outlined text-[13px]">download</span>
                        Unduh Drawing
                      </a>
                    )}
                  </div>

                </div>

              </div>
            </div>
          </div>
        );
      })()}

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
