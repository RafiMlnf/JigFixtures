'use client';

import React, { useState, useEffect, use, lazy, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { fetchMasterList, getFileUrl, createCellPart, deleteCellPart, downloadDesignPdfPage, downloadDesignPdfFull } from '@/lib/api/phase3';
import { canEdit } from '@/lib/rbac';

const StepViewer = lazy(() => import('@/components/design/StepViewer'));

interface DocumentInfo {
  id: string;
  path2D: string | null;
  loc2D: string | null;
  approvalStatus: string;
  updatedAt?: string | null;
}

interface RevHistoryInfo {
  id: string;
  revStatus: string;
  description: string;
  poNumber: string | null;
  leadTime: number | null;
  approvedByName: string | null;
  createdAt: string;
  vendorName: string;
  changedBy: string;
  loc3D?: string | null;
  path3D?: string | null;
  loc2D?: string | null;
  path2D?: string | null;
}

interface AbnormalityInfo {
  id: string;
  type: string;
  description: string;
  status: 'OPEN' | 'MONITORING' | 'CLOSED';
  dateFound: string;
  foundBy: string;
  rootCause: string;
  tempAction: string;
  correctiveAction: string;
  actionPic: string;
  linkToRevision: boolean;
  createdAt: string;
  reportedBy: string;
}

interface CellPartInfo {
  id: string;
  partNumber: string;
  name: string;
  description: string | null;
  lifetimeDays: number;
  lifetimeType?: 'DUAL' | 'USAGE' | 'DAYS';
  maxUsage?: number;
  currentUsage?: number;
  usageRemaining?: number;
  usagePercent?: number;
  dayStatus?: 'OVERDUE' | 'WARNING' | 'SAFE';
  usageStatus?: 'OVERDUE' | 'WARNING' | 'SAFE';
  triggerReason?: 'DAYS' | 'USAGE' | 'BOTH' | 'NONE';
  installDate: string;
  lastRenewalDate: string | null;
  dueDate: string;
  daysRemaining: number;
  lifetimeStatus: 'OVERDUE' | 'WARNING' | 'SAFE';
  minimumStock?: number;
  actualStock?: number;
  pdfPageIndex: number | null;
  material?: string | null;
  qty?: string | number;
  tpmScheduleStart?: string | null;
  tpmScheduleDeadline?: string | null;
  tpmLifetimeSetAt?: string | null;
}

interface MasterItem {
  id: string;
  noReg: string;
  assyPartName: string;
  qty: string;
  noItem: string;
  type: 'JF' | 'EQ';
  lifecycleStatus: 'ACTIVE' | 'UNDER_REPAIR' | 'UNDER_IMPROVEMENT' | 'OBSOLETE' | 'SCRAP';
  inventoryStatus: 'RED' | 'YELLOW' | 'GREEN';
  abnormalityStatus: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  minimumStock: number;
  actualStock: number;
  designDateNew: string | null;
  revStatus: string;
  lifetimeDays?: number;
  lifetimeType?: 'DUAL' | 'USAGE' | 'DAYS';
  maxUsage?: number;
  currentUsage?: number;
  usageRemaining?: number;
  usagePercent?: number;
  dayStatus?: 'OVERDUE' | 'WARNING' | 'SAFE';
  usageStatus?: 'OVERDUE' | 'WARNING' | 'SAFE';
  lifetimeStatus?: 'OVERDUE' | 'WARNING' | 'SAFE';
  triggerReason?: 'DAYS' | 'USAGE' | 'BOTH' | 'NONE';
  daysRemaining?: number;
  dueDate?: string;
  tpmScheduleStart?: string | null;
  tpmScheduleDeadline?: string | null;
  tpmLifetimeSetAt?: string | null;
  lineProduct: string;
  process: string;
  vendor: { id: string; name: string } | null;
  documents: DocumentInfo[];
  revisionHistories: RevHistoryInfo[];
  abnormalities: AbnormalityInfo[];
  cellParts: CellPartInfo[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

type InspectorTab = 'info' | 'cellpart' | 'rev' | 'abn';

function DesignDetailPageContent({ params }: PageProps) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout, user, approvals } = useApp();
  const isPic = canEdit(user?.role);
  const [item, setItem] = useState<MasterItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<InspectorTab>('info');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState(false);
  const [viewer3DUrl, setViewer3DUrl] = useState<string | null>(null);
  const [viewer3DName, setViewer3DName] = useState<string | undefined>();
  const [previewMode, setPreviewMode] = useState<'2D' | '3D'>('2D');

  // Sync tab with URL query parameter ?tab=
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'etiket') {
      setActiveTab('info');
      setInspectorOpen(true);
    } else if (tabParam && ['info', 'cellpart', 'rev', 'abn'].includes(tabParam)) {
      setActiveTab(tabParam as InspectorTab);
      setInspectorOpen(true);
    }
  }, [searchParams]);

  // Multi-page 2D drawing state (Page 1 = Parent Jig, Page 2+ = Child CellParts)
  const [activePdfPage, setActivePdfPage] = useState<number>(1);

  // CellPart management modal state
  const [showAddCpModal, setShowAddCpModal] = useState(false);
  const [cpPartNumber, setCpPartNumber] = useState('');
  const [cpName, setCpName] = useState('');
  const [cpDescription, setCpDescription] = useState('');
  const [cpLifetimeDays, setCpLifetimeDays] = useState(180);
  const [cpLifetimeType, setCpLifetimeType] = useState<'DUAL' | 'USAGE' | 'DAYS'>('DUAL');
  const [cpMaxUsage, setCpMaxUsage] = useState<number>(500);
  const [cpInstallDate, setCpInstallDate] = useState(new Date().toISOString().split('T')[0]);
  const [cpMinStock, setCpMinStock] = useState(0);
  const [cpActStock, setCpActStock] = useState(0);
  const [cpPdfPageIndex, setCpPdfPageIndex] = useState<number>(2);
  const [cpSubmitting, setCpSubmitting] = useState(false);



  const loadItem = async () => {
    setLoading(true);
    try {
      const list = await fetchMasterList();
      const found = list.find((i: MasterItem) => i.id === id);
      setItem(found || null);
    } catch (e: any) {
      if (e.status === 401 || e.status === 403) logout();
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddCpModal = () => {
    const nextPageIndex = item?.cellParts ? item.cellParts.length + 2 : 2;
    setCpPartNumber('');
    setCpName('');
    setCpDescription('');
    setCpLifetimeDays(180);
    setCpLifetimeType('DUAL');
    setCpMaxUsage(500);
    setCpInstallDate(new Date().toISOString().split('T')[0]);
    setCpMinStock(0);
    setCpActStock(0);
    setCpPdfPageIndex(nextPageIndex);
    setShowAddCpModal(true);
  };

  const handleCreateCellPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setCpSubmitting(true);
    try {
      await createCellPart({
        designId: item.id,
        partNumber: cpPartNumber,
        name: cpName,
        description: cpDescription || undefined,
        lifetimeDays: cpLifetimeDays,
        lifetimeType: cpLifetimeType,
        maxUsage: cpMaxUsage,
        currentUsage: 0,
        installDate: cpInstallDate,
        minimumStock: cpMinStock,
        actualStock: cpActStock,
        pdfPageIndex: cpPdfPageIndex,
      });
      setShowAddCpModal(false);
      await loadItem();
    } catch (err: any) {
      alert(`Gagal menambah CellPart: ${err.message || 'Error server'}`);
    } finally {
      setCpSubmitting(false);
    }
  };



  const handleDeleteCp = async (cpId: string, cpName: string) => {
    if (!window.confirm(`Hapus CellPart "${cpName}"?`)) return;
    try {
      await deleteCellPart(cpId);
      await loadItem();
    } catch (err: any) {
      alert(`Gagal menghapus CellPart: ${err.message || 'Error server'}`);
    }
  };

  const [downloadingPage, setDownloadingPage] = useState<number | null>(null);
  const [downloadingFull, setDownloadingFull] = useState(false);

  const handleDownloadSinglePage = async (pageNum: number, filename?: string) => {
    if (!item) return;
    setDownloadingPage(pageNum);
    try {
      await downloadDesignPdfPage(item.id, pageNum, filename);
    } catch (err: any) {
      alert(`Gagal mengunduh Halaman ${pageNum}: ${err.message || 'Error server'}`);
    } finally {
      setDownloadingPage(null);
    }
  };

  const handleDownloadFullPdf = async (filename?: string) => {
    if (!item) return;
    setDownloadingFull(true);
    try {
      await downloadDesignPdfFull(item.id, filename);
    } catch (err: any) {
      alert(`Gagal mengunduh PDF Lengkap Resmi: ${err.message || 'Error server'}`);
    } finally {
      setDownloadingFull(false);
    }
  };

  useEffect(() => { loadItem(); }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-gray-50 gap-2">
        <span className="material-symbols-outlined animate-spin text-3xl text-blue-600">sync</span>
        <span className="text-xs text-gray-500 font-medium">Memuat data design...</span>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-gray-400 mb-3 block">find_in_page</span>
          <p className="text-sm font-bold text-red-500 mb-2">Design Item Not Found</p>
          <Link href="/design" className="text-xs text-blue-650 hover:text-blue-800 underline font-semibold">Kembali</Link>
        </div>
      </div>
    );
  }

  const reversedDocs = [...item.documents].reverse();
  const activeDoc = reversedDocs.find((d) => d.approvalStatus === 'APPROVED' && d.loc2D)
    || reversedDocs.find((d) => d.loc2D)
    || reversedDocs[0];
  const isDrawingApproved = activeDoc?.approvalStatus === 'APPROVED';
  const itemApproval = approvals.find((a) => a.noReg === item.noReg);

  const lifecycleBadge: Record<string, { color: string; label: string }> = {
    ACTIVE: { color: '#16a34a', label: 'Active' },
    UNDER_REPAIR: { color: '#ea580c', label: 'Under Repair' },
    UNDER_IMPROVEMENT: { color: '#2563eb', label: 'Improvement' },
    OBSOLETE: { color: '#4b5563', label: 'Obsolete' },
    SCRAP: { color: '#dc2626', label: 'Scrap' },
  };
  const lifecycle = lifecycleBadge[item.lifecycleStatus] || { color: '#4b5563', label: item.lifecycleStatus };

  const inspectorTabs: { key: InspectorTab; icon: string; label: string }[] = [
    { key: 'info', icon: 'info', label: 'Info' },
    { key: 'cellpart', icon: 'account_tree', label: 'CellPart' },
    { key: 'rev', icon: 'history', label: 'Revisi' },
    { key: 'abn', icon: 'report_problem', label: 'Anomali' },
  ];

  return (
    <>
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white text-gray-800">

        {/* ── REVISI ALERT BANNER (JIKA STATUS BUTUH REVISI) ── */}
        {itemApproval?.status === 'REJECTED' && (
          <div className="h-8 bg-rose-50 border-b border-rose-200 px-3 flex items-center justify-between text-[10px] text-rose-800 shrink-0">
            <div className="flex items-center gap-1.5 font-semibold">
              <span className="material-symbols-outlined text-[15px] text-rose-600">report_problem</span>
              <span>Drawing memerlukan revisi: &ldquo;{itemApproval.note || 'Terdapat catatan revisi dari approver'}&rdquo;</span>
            </div>
            <Link
              href={`/approval-center/${itemApproval.id}`}
              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[9.5px] transition-colors flex items-center gap-1"
            >
              <span>Lihat Coretan &amp; Upload Revisian</span>
              <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
            </Link>
          </div>
        )}

        {/* ── TOP BAR ── */}
        <div className="h-10 flex items-center justify-between px-3 border-b border-gray-200 bg-gray-50 shrink-0 gap-3">
          {/* Left: noReg + name part */}
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 min-w-0">
            <span className="font-mono text-gray-900 font-bold truncate">{item.noReg}</span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-700 font-semibold truncate max-w-[260px]">{item.assyPartName}</span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 shrink-0 relative">
            <div className="relative">
              {/* Download Dropdown */}
              {(() => {
                const isDrawingApproved = activeDoc?.approvalStatus === 'APPROVED';

                return (
                  <>
                    <button
                      onClick={() => setDownloadDropdownOpen(!downloadDropdownOpen)}
                      className={`flex items-center justify-center w-6 h-6 rounded transition-colors hover:bg-gray-150 text-gray-500 ${downloadDropdownOpen ? 'bg-gray-150 text-gray-800' : ''}`}
                      title={isDrawingApproved ? 'Unduh Dokumen Gambar Kerja (Resmi)' : 'Unduh Dokumen (Menunggu Approval)'}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isDrawingApproved ? 'download' : 'download'}
                      </span>
                    </button>

                    {downloadDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setDownloadDropdownOpen(false)}
                        ></div>

                        <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-250 rounded-xl shadow-xl z-50 py-1.5 text-[10px] text-gray-700 max-h-80 overflow-y-auto no-scrollbar">
                          {/* Header */}
                          <div className="px-3 py-1 text-[8.5px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 flex items-center justify-between">
                            <span>Pilihan Unduh</span>
                            {downloadingFull && <span className="text-emerald-600 animate-pulse font-bold">Mengunduh Dokumen Resmi...</span>}
                            {downloadingPage && <span className="text-blue-600 animate-pulse font-bold">Mengunduh Hal {downloadingPage}...</span>}
                          </div>

                          {/* Approval Status Banner if Not Approved */}
                          {!isDrawingApproved && (
                            <div className="mx-2.5 my-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[8.5px] flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[14px] text-amber-600 shrink-0">lock</span>
                              <span>Drawing belum dapat diunduh karena belum disetujui resmi oleh Section Head &amp; Dept Head.</span>
                            </div>
                          )}

                          {/* Full 2D Drawing */}
                          {activeDoc?.loc2D ? (
                            isDrawingApproved ? (
                              <button
                                type="button"
                                onClick={() => {
                                  handleDownloadFullPdf(`${item.noReg}_Drawing_Resmi.pdf`);
                                  setDownloadDropdownOpen(false);
                                }}
                                disabled={downloadingFull || downloadingPage !== null}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-emerald-50/70 text-left text-gray-800 font-semibold transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[15px] text-emerald-600">verified</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <p className="truncate font-bold text-emerald-900">2D Drawing Lengkap Resmi</p>
                                    <span className="text-[7.5px] bg-emerald-100 text-emerald-700 font-bold px-1 rounded">Stempel</span>
                                  </div>
                                  <p className="text-[8px] text-gray-400">Semua halaman berstempel legalitas</p>
                                </div>
                                <span className="material-symbols-outlined text-[12px] text-gray-400">file_download</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 px-3 py-2 text-gray-400 opacity-60 font-medium cursor-not-allowed select-none bg-gray-50/60">
                                <span className="material-symbols-outlined text-[14px] text-gray-400">lock</span>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate font-medium text-gray-500">2D Drawing Lengkap</p>
                                  <p className="text-[8px] text-amber-600 font-semibold">Terkunci (Belum di-approve)</p>
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-2 text-gray-400 opacity-50 font-medium cursor-not-allowed select-none">
                              <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                              <span>2D Drawing Belum Tersedia</span>
                            </div>
                          )}

                          {/* Single Page: Induk Jig (Hal 1) */}
                          {activeDoc?.loc2D && (
                            isDrawingApproved ? (
                              <button
                                type="button"
                                onClick={() => {
                                  handleDownloadSinglePage(1, `${item.noReg}_Induk_Hal_1.pdf`);
                                  setDownloadDropdownOpen(false);
                                }}
                                disabled={downloadingPage !== null || downloadingFull}
                                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50/70 text-left text-gray-800 font-semibold transition-colors cursor-pointer border-t border-gray-100"
                              >
                                <span className="font-mono text-base font-extrabold text-indigo-600 shrink-0 w-6 text-center leading-none">
                                  1
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate font-bold">Hal 1: Induk Jig (1 Halaman)</p>
                                  <p className="text-[8px] text-gray-400">Gambar teknik utama {item.noReg}</p>
                                </div>
                                <span className="material-symbols-outlined text-[12px] text-gray-400">file_download</span>
                              </button>
                            ) : (
                              <div className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-400 opacity-60 font-medium cursor-not-allowed select-none border-t border-gray-100 bg-gray-50/60">
                                <span className="font-mono text-base font-extrabold text-gray-400 shrink-0 w-6 text-center leading-none">
                                  1
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate font-medium text-gray-500">Hal 1: Induk Jig</p>
                                  <p className="text-[8px] text-amber-600 font-semibold">Terkunci (Belum di-approve)</p>
                                </div>
                              </div>
                            )
                          )}

                          {/* Single Page: CellParts */}
                          {activeDoc?.loc2D && item.cellParts && item.cellParts.length > 0 && (
                            <>
                              <div className="px-3 py-1 text-[8px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-t border-b border-gray-100 mt-0.5">
                                Cell Parts (1 Halaman)
                              </div>
                              {[...item.cellParts]
                                .sort((a, b) => {
                                  const pageA = a.pdfPageIndex || 9999;
                                  const pageB = b.pdfPageIndex || 9999;
                                  if (pageA !== pageB) return pageA - pageB;
                                  return (a.partNumber || '').localeCompare(b.partNumber || '', undefined, { numeric: true });
                                })
                                .map((cp, idx) => {
                                const pageNum = cp.pdfPageIndex || (idx + 2);
                                return isDrawingApproved ? (
                                  <button
                                    key={cp.id}
                                    type="button"
                                    onClick={() => {
                                      handleDownloadSinglePage(pageNum, `${item.noReg}_CP_${cp.partNumber}_Hal_${pageNum}.pdf`);
                                      setDownloadDropdownOpen(false);
                                    }}
                                    disabled={downloadingPage !== null || downloadingFull}
                                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-blue-50/70 text-left text-gray-800 transition-colors cursor-pointer"
                                  >
                                    <span className="font-mono text-base font-extrabold text-blue-600 shrink-0 w-6 text-center leading-none">
                                      {pageNum}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="truncate font-bold text-[9px] font-mono">{cp.partNumber}</p>
                                      <p className="text-[8px] text-gray-400 truncate">Hal {pageNum} · {cp.name}</p>
                                    </div>
                                    <span className="material-symbols-outlined text-[11px] text-gray-400">file_download</span>
                                  </button>
                                ) : (
                                  <div
                                    key={cp.id}
                                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-400 opacity-60 font-medium cursor-not-allowed select-none"
                                  >
                                    <span className="font-mono text-base font-extrabold text-gray-400 shrink-0 w-6 text-center leading-none">
                                      {pageNum}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="truncate font-bold text-[9px] font-mono text-gray-500">{cp.partNumber}</p>
                                      <p className="text-[8px] text-gray-400 truncate">Hal {pageNum} · {cp.name}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          )}

                          {/* 3D Model CAD */}
                          {(() => {
                            const active3DRev = item.revisionHistories.find((rev) => rev.loc3D);
                            return active3DRev?.loc3D ? (
                              <a
                                href={getFileUrl(active3DRev.loc3D!) ?? undefined}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setDownloadDropdownOpen(false)}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-purple-50/70 text-gray-800 font-semibold transition-colors cursor-pointer border-t border-gray-100"
                              >
                                <span className="material-symbols-outlined text-[14px] text-purple-600">deployed_code</span>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate font-bold">Unduh 3D CAD</p>
                                  <p className="text-[8px] text-gray-400">File STEP / IGS</p>
                                </div>
                              </a>
                            ) : null;
                          })()}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ── MAIN BODY ── */}
        <div className="flex-1 flex min-h-0">

          {/* ── LEFT PAGE NUMBER RAIL ── */}
          <div className="w-8 border-r border-gray-200 bg-gray-50 flex flex-col items-center py-2 gap-1 shrink-0 overflow-y-auto no-scrollbar">
            {(() => {
              // Kumpulkan semua nomor halaman unik dan urutkan secara menaik (1, 2, 3...)
              const pageSet = new Set<number>([1]);
              (item.cellParts || []).forEach((cp, idx) => {
                const pageNum = cp.pdfPageIndex || (idx + 2);
                if (pageNum > 0) pageSet.add(pageNum);
              });
              const sortedPages = Array.from(pageSet).sort((a, b) => a - b);

              return sortedPages.map((pageNum) => {
                const isSelected = activePdfPage === pageNum;
                return (
                  <button
                    key={`page-btn-${pageNum}`}
                    type="button"
                    onClick={() => setActivePdfPage(pageNum)}
                    className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-2xs ring-1 ring-blue-600'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                    title={`Halaman ${pageNum}`}
                  >
                    {pageNum}
                  </button>
                );
              });
            })()}
          </div>

          {/* ── PREVIEW CANVAS (2D / 3D TABS) ── */}
          <div className="flex-1 flex flex-col min-w-0 bg-gray-200">
            {/* Canvas header with Tabs */}
            <div className="h-8 flex items-center justify-between px-3 border-b border-gray-200 bg-gray-100 shrink-0 select-none">
              {/* Left: Tab 2D & 3D */}
              <div className="flex gap-2 h-full items-center">
                {/* Tab 2D */}
                <button
                  onClick={() => setPreviewMode('2D')}
                  className={`flex items-center gap-1.5 px-3 h-full text-[10px] font-bold border-b-2 transition-all ${previewMode === '2D'
                      ? 'border-blue-500 text-blue-650 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <span className="material-symbols-outlined text-[13px]">picture_as_pdf</span>
                  2D Drawing
                </button>

                {/* Tab 3D */}
                {(item.revisionHistories.some((rev) => rev.loc3D) || viewer3DUrl) && (
                  <button
                    onClick={() => {
                      if (!viewer3DUrl) {
                        const latest3D = item.revisionHistories.find((rev) => rev.loc3D);
                        if (latest3D) {
                          setViewer3DUrl(getFileUrl(latest3D.loc3D!));
                          setViewer3DName(latest3D.path3D || undefined);
                        }
                      }
                      setPreviewMode('3D');
                    }}
                    className={`flex items-center gap-1.5 px-3 h-full text-[10px] font-bold border-b-2 transition-all ${previewMode === '3D'
                        ? 'border-blue-500 text-blue-650 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">deployed_code</span>
                    3D Model Preview
                  </button>
                )}
              </div>

              {/* Right: Status Pills & Toggle / Lebarkan PDF Button */}
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded text-white shadow-2xs"
                  style={{ backgroundColor: lifecycle.color }}
                >
                  {lifecycle.label}
                </span>


                <button
                  type="button"
                  onClick={() => setInspectorOpen(!inspectorOpen)}
                  className={`w-6 h-6 flex items-center justify-center rounded border transition-all cursor-pointer ${
                    !inspectorOpen
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  title={inspectorOpen ? 'Lebarkan PDF (Tutup sidebar inspector)' : 'Tampilkan sidebar inspector'}
                >
                  <span className="material-symbols-outlined text-sm">
                    {inspectorOpen ? 'fullscreen' : 'fullscreen_exit'}
                  </span>
                </button>
              </div>
            </div>

            {/* Canvas content */}
            <div className="flex-1 flex items-stretch min-h-0 bg-gray-100 relative">
              {previewMode === '2D' ? (
                activeDoc?.loc2D ? (() => {
                  const targetDocPath = activeDoc.loc2D;
                  const pdfUrl = getFileUrl(targetDocPath);
                  const fullUrl = pdfUrl
                    ? `${pdfUrl}#page=${activePdfPage}&navpanes=0&pagemode=none&view=FitH`
                    : null;
                  return fullUrl ? (
                    <iframe
                      key={`pdf-frame-page-${activePdfPage}`}
                      src={fullUrl}
                      className="flex-1 w-full h-full border-0"
                      title="2D Drawing PDF"
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3">
                      <span className="material-symbols-outlined text-5xl text-gray-400">broken_image</span>
                      <p className="text-xs text-gray-555 font-semibold text-center px-4">
                        Drawing PDF tidak dapat dimuat (path tidak valid)
                      </p>
                      <div className="bg-white border border-gray-200 rounded px-2.5 py-1 text-[9px] font-mono text-gray-600 max-w-sm truncate shadow-2xs">
                        {activeDoc.loc2D}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <span className="material-symbols-outlined text-5xl text-gray-300">picture_as_pdf</span>
                    <p className="text-xs text-gray-555 font-medium">File PDF 2D Drawing belum diunggah untuk item ini.</p>
                    <Link
                      href={`/update-design`}
                      className="text-[10px] font-bold text-blue-650 hover:text-blue-800 border border-blue-300 hover:border-blue-500 px-3 py-1.5 rounded-lg bg-white shadow-2xs transition-all"
                    >
                      Unggah Drawing Sekarang →
                    </Link>
                  </div>
                )
              ) : (() => {
                const active3DUrl = viewer3DUrl || getFileUrl(item.revisionHistories.find((rev) => rev.loc3D)?.loc3D || '');
                const active3DName = viewer3DName || item.revisionHistories.find((rev) => rev.loc3D)?.path3D || undefined;

                return active3DUrl ? (
                  <Suspense fallback={
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-[#0f1117] text-gray-400">
                      <span className="material-symbols-outlined animate-spin text-2xl text-indigo-500">sync</span>
                      <span className="text-xs">Memuat 3D Engine...</span>
                    </div>
                  }>
                    <StepViewer
                      fileUrl={active3DUrl}
                      fileName={active3DName}
                      onClose={() => {
                        setPreviewMode('2D');
                      }}
                    />
                  </Suspense>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-gray-50">
                    <span className="material-symbols-outlined text-5xl text-gray-300">deployed_code</span>
                    <p className="text-xs text-gray-555 font-medium">File model 3D (STEP/STP) belum diunggah.</p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── RIGHT INSPECTOR ── */}
          {inspectorOpen && (
            <div className="w-72 border-l border-gray-200 bg-gray-50 flex flex-col shrink-0 min-h-0">
              {/* Inspector Tab Bar */}
              <div className="flex border-b border-gray-200 bg-gray-100 shrink-0">
                {inspectorTabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    title={t.label}
                    className={`flex-1 flex items-center justify-center py-2 text-[9px] font-bold transition-all border-b-2 gap-1 ${activeTab === t.key ? 'border-blue-500 text-blue-650 bg-white' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
                  >
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Inspector Content */}
              <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-4">

                {/* ─ INFO TAB ─ */}
                {/* ─ INFO & E-TIKET TAB ─ */}
                {activeTab === 'info' && (() => {
                  const waitingApproval = item ? approvals?.find((a) => a.noReg === item.noReg && a.status === 'WAITING') : null;
                  
                  // Deteksi apakah saat ini sedang di halaman CellPart (Halaman > 1)
                  const currentCellPart = activePdfPage > 1
                    ? item.cellParts?.find((cp, idx) => (cp.pdfPageIndex || idx + 2) === activePdfPage)
                    : null;

                  return (
                    <div className="space-y-3 text-[10px]">
                      {/* Banner jika ada approval berjalan */}
                      {waitingApproval && (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-2 shadow-2xs">
                          <div className="min-w-0">
                            <span className="font-bold flex items-center gap-1 text-[9.5px]">
                              <span className="material-symbols-outlined text-sm text-amber-600 animate-pulse">pending</span>
                              Proses Approval Berjalan
                            </span>
                            <p className="text-[8px] text-amber-700 truncate">
                              {waitingApproval.sectionStatus !== 'APPROVED' ? 'Menunggu Section Head' : 'Menunggu Dept Head'}
                            </p>
                          </div>
                          <Link
                            href={`/approval-center/${waitingApproval.id}`}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[8.5px] font-bold shrink-0 transition-colors"
                          >
                            Review
                          </Link>
                        </div>
                      )}

                      {/* Header Penanda Halaman Aktif dari Scroll */}
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[8.5px] font-bold text-gray-500 uppercase tracking-wider">
                          {currentCellPart ? `Halaman ${activePdfPage} · Child Part` : `Halaman 1 · Drawing Induk Jig`}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-mono font-bold text-[8px]">
                          Hal {activePdfPage}
                        </span>
                      </div>

                      {/* TAMPILAN JIKA SCROLL KE HALAMAN CHILD CELLPART */}
                      {currentCellPart ? (
                        <>
                          {/* Identitas CellPart */}
                          <div className="bg-white p-2.5 rounded-lg border border-blue-200 ring-1 ring-blue-100 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                              <div>
                                <span className="text-[8px] font-bold uppercase tracking-wider text-blue-600 block">Child CellPart</span>
                                <span className="font-mono font-bold text-gray-900 text-[11px]">{currentCellPart.partNumber}</span>
                              </div>
                              <span className="font-bold text-[8.5px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                Sheet #{activePdfPage}
                              </span>
                            </div>

                            <div className="space-y-1 text-[9px]">
                              <div>
                                <span className="text-gray-400 block text-[8px]">Nama Komponen</span>
                                <span className="font-semibold text-gray-800">{currentCellPart.name}</span>
                              </div>
                              {currentCellPart.description && (
                                <div>
                                  <span className="text-gray-400 block text-[8px]">Keterangan</span>
                                  <span className="text-gray-600 italic leading-tight block">{currentCellPart.description}</span>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 text-[8.5px]">
                                <div>
                                  <span className="text-gray-400 block text-[8px]">Induk Jig</span>
                                  <span className="font-mono text-gray-700 truncate block">{item.noReg}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400 block text-[8px]">Material</span>
                                  <span className="font-semibold text-gray-800 truncate block">{currentCellPart.material || currentCellPart.description || '—'}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                        </>
                      ) : (
                        /* TAMPILAN HALAMAN 1 (INDUK JIG) */
                        <>
                          {/* E-Tiket & Identitas Inti */}
                          <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                              <div>
                                <span className="text-[8px] font-bold uppercase tracking-wider text-gray-400 block">E-Tiket &amp; Identitas</span>
                                <span className="font-mono font-bold text-gray-900 text-[11px]">{item.noReg}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold font-mono text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  Rev {item.revStatus || '0'}
                                </span>
                                <span className={`font-bold px-1.5 py-0.5 rounded text-[8.5px] ${
                                  activeDoc?.approvalStatus === 'APPROVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : activeDoc?.approvalStatus === 'WAITING'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {activeDoc?.approvalStatus || 'APPROVED'}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[9px]">
                              <div>
                                <span className="text-gray-400 block text-[8px]">Part Name</span>
                                <span className="font-semibold text-gray-800 truncate block" title={item.assyPartName}>{item.assyPartName}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block text-[8px]">Item / Assy No</span>
                                <span className="font-mono text-gray-800 truncate block">{item.noItem || '—'}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block text-[8px]">Line / Process</span>
                                <span className="font-medium text-gray-800 truncate block">{item.lineProduct} · {item.process}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block text-[8px]">Vendor / Tipe</span>
                                <span className="font-medium text-gray-800 truncate block">{item.vendor?.name || '—'} · {item.type}</span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-1 border-t border-gray-100 text-[8.5px]">
                              <span className="text-gray-400">Lifecycle</span>
                              <span className="font-bold px-1.5 py-0.2 rounded" style={{ background: lifecycle.color + '15', color: lifecycle.color }}>
                                {lifecycle.label}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* ─ CELLPART TAB ─ */}
                {activeTab === 'cellpart' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[8px] font-bold uppercase text-gray-400 tracking-wider">
                        Child Cell Parts ({item.cellParts?.length || 0})
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenAddCpModal}
                        className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[8px] font-bold flex items-center gap-0.5 shadow-2xs transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[10px]">add</span>
                        Tambah
                      </button>
                    </div>

                    {(!item.cellParts || item.cellParts.length === 0) ? (
                      <div className="text-center py-6 bg-white rounded-lg border border-gray-200 p-3 shadow-2xs">
                        <span className="material-symbols-outlined text-xl text-blue-400 block mb-0.5">widgets</span>
                        <p className="text-[9px] font-bold text-gray-700">Belum Ada Child CellPart</p>
                        <button
                          type="button"
                          onClick={handleOpenAddCpModal}
                          className="mt-2 px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded text-[8px] font-bold transition-colors cursor-pointer"
                        >
                          + Tambah CellPart
                        </button>
                      </div>
                    ) : (
                      [...item.cellParts]
                        .sort((a, b) => {
                          const pageA = a.pdfPageIndex || 9999;
                          const pageB = b.pdfPageIndex || 9999;
                          if (pageA !== pageB) return pageA - pageB;
                          return (a.partNumber || '').localeCompare(b.partNumber || '', undefined, { numeric: true });
                        })
                        .map((cp, idx) => {
                          const pageNum = cp.pdfPageIndex || (idx + 2);
                          const isSelectedPage = activePdfPage === pageNum;

                        return (
                          <div
                            key={cp.id}
                            onClick={() => {
                              setPreviewMode('2D');
                              setActivePdfPage(pageNum);
                            }}
                            className={`px-2 py-1.5 rounded-md border transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                              isSelectedPage && previewMode === '2D'
                                ? 'bg-blue-50/70 border-blue-500 ring-1 ring-blue-400'
                                : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] font-bold text-blue-650 shrink-0">
                                  {cp.partNumber}
                                </span>
                                <h4 className="text-[9.5px] font-medium text-gray-800 truncate" title={cp.name}>
                                  {cp.name}
                                </h4>
                              </div>
                              <div className="flex items-center gap-2 text-[7.5px] text-gray-400 mt-0.5">
                                <span>Hal <strong className="text-gray-600 font-mono">{pageNum}</strong></span>
                                {cp.material && (
                                  <>
                                    <span>·</span>
                                    <span className="truncate max-w-[100px]">{cp.material}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {(() => {
                              const isDrawingApproved = activeDoc?.approvalStatus === 'APPROVED';
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isDrawingApproved) {
                                      alert('Drawing belum disetujui (Approved) secara resmi.');
                                      return;
                                    }
                                    handleDownloadSinglePage(pageNum, `${item.noReg}_CP_${cp.partNumber}_Hal_${pageNum}.pdf`);
                                  }}
                                  disabled={downloadingPage !== null || !isDrawingApproved}
                                  className={`p-1 rounded shrink-0 transition-colors ${
                                    isDrawingApproved
                                      ? 'text-blue-600 hover:bg-blue-100 hover:text-blue-800'
                                      : 'text-gray-300 cursor-not-allowed'
                                  }`}
                                  title={isDrawingApproved ? `Download Hal ${pageNum} (${cp.partNumber})` : 'Belum approved'}
                                >
                                  <span className="material-symbols-outlined text-[13px]">
                                    {!isDrawingApproved ? 'lock' : downloadingPage === pageNum ? 'sync' : 'download'}
                                  </span>
                                </button>
                              );
                            })()}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* ─ REVISI TAB ─ */}
                {activeTab === 'rev' && (
                  <div className="space-y-2">
                    <p className="text-[8px] font-bold uppercase text-gray-400 mb-2 tracking-widest">Riwayat Revisi</p>
                    {item.revisionHistories.length === 0 ? (
                      <p className="text-[10px] text-gray-400 italic">Belum ada riwayat revisi.</p>
                    ) : (
                      item.revisionHistories.map((rev) => (
                        <div key={rev.id} className="bg-white rounded-lg p-2.5 border border-gray-200 hover:border-gray-300 transition-colors shadow-2xs">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[9px] font-bold font-mono text-blue-600">Rev {rev.revStatus}</span>
                            <span className="text-[8px] text-gray-400">{new Date(rev.createdAt).toLocaleDateString('id-ID')}</span>
                          </div>
                          <p className="text-[9px] text-gray-600 mb-1.5 leading-relaxed font-medium">"{rev.description}"</p>
                          <div className="flex justify-between text-[8px] text-gray-400 border-t border-gray-50 pt-1.5">
                            <span>{rev.vendorName}</span>
                            {rev.poNumber && <span className="font-mono text-gray-600">PO: {rev.poNumber}</span>}
                          </div>
                          {rev.approvedByName && (
                            <div className="mt-1.5 pt-1.5 border-t border-gray-50 text-[8px] text-gray-400 flex justify-between">
                              <span>Approved by</span>
                              <span className="text-gray-700 font-bold">{rev.approvedByName}</span>
                            </div>
                          )}
                          {(rev.loc2D || rev.loc3D) && (
                            <div className="mt-2 pt-2 border-t border-dashed border-gray-100 flex gap-2">
                              {rev.loc2D && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isDrawingApproved) {
                                      alert('Drawing belum disetujui (Approved) secara resmi oleh Section Head dan Dept Head.');
                                      return;
                                    }
                                    handleDownloadFullPdf(`${item.noReg}_Rev_${rev.revStatus}_Drawing_Resmi.pdf`);
                                  }}
                                  disabled={!isDrawingApproved || downloadingFull}
                                  className={`flex-1 py-1 rounded text-[8px] font-bold transition-all text-center flex items-center justify-center gap-1 ${
                                    isDrawingApproved
                                      ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 cursor-pointer'
                                      : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                                  }`}
                                  title={isDrawingApproved ? 'Unduh 2D Drawing Resmi' : 'Drawing belum disetujui (Menunggu approval resmi)'}
                                >
                                  <span className="material-symbols-outlined text-[10px]">
                                    {isDrawingApproved ? 'download' : 'lock'}
                                  </span>
                                  2D Drawing
                                </button>
                              )}
                              {rev.loc3D && (
                                <button
                                  onClick={() => {
                                    setViewer3DUrl(getFileUrl(rev.loc3D!));
                                    setViewer3DName(rev.path3D || undefined);
                                    setPreviewMode('3D');
                                  }}
                                  className="flex-1 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[8px] font-bold transition-all text-center flex items-center justify-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[10px]">deployed_code</span>
                                  View 3D
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}



                {/* ─ ANOMALI TAB ─ */}
                {activeTab === 'abn' && (
                  <div className="space-y-2">
                    <p className="text-[8px] font-bold uppercase text-gray-400 mb-2 tracking-widest">Log Abnormality</p>
                    {item.abnormalities.length === 0 ? (
                      <div className="text-center py-8 bg-white rounded-lg border border-gray-200 p-4">
                        <span className="material-symbols-outlined text-2xl text-green-500 block mb-2">check_circle</span>
                        <p className="text-[10px] text-gray-400">Tidak ada abnormality tercatat.</p>
                      </div>
                    ) : (
                      item.abnormalities.map((abn) => {
                        const abnColor = abn.status === 'CLOSED' ? '#16a34a' : abn.status === 'MONITORING' ? '#ca8a04' : '#dc2626';
                        return (
                          <div key={abn.id} className="bg-white rounded-lg p-2.5 border border-gray-200 hover:border-gray-300 transition-colors shadow-2xs">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[9px] font-bold text-orange-600">{abn.type}</span>
                              <span
                                className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                                style={{ background: abnColor + '12', color: abnColor }}
                              >
                                {abn.status}
                              </span>
                            </div>
                            <p className="text-[9px] text-gray-600 mb-1.5 leading-relaxed font-semibold">"{abn.description}"</p>
                            <div className="space-y-1 text-[8px] text-gray-400 border-t border-gray-50 pt-1.5">
                              <div className="flex justify-between">
                                <span>Ditemukan</span>
                                <span className="text-gray-700 font-semibold">{new Date(abn.dateFound).toLocaleDateString('id-ID')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Oleh</span>
                                <span className="text-gray-700 font-semibold">{abn.foundBy}</span>
                              </div>
                              {abn.actionPic && (
                                <div className="flex justify-between">
                                  <span>PIC Tindakan</span>
                                  <span className="text-gray-700 font-semibold">{abn.actionPic}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Inspector footer */}
              <div className="border-t border-gray-200 bg-gray-100 p-2.5 shrink-0">
                <div className="text-[8px] text-gray-400 font-mono truncate font-bold">{item.id}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: TAMBAH CHILD CELLPART */}
      {showAddCpModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[90]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            {/* Header */}
            <div className="p-3.5 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#0063ff] text-sm">widgets</span>
                Tambah Child CellPart
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCpModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleCreateCellPart} className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar text-xs">
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-lg p-2 text-[10px] text-blue-800">
                <span className="font-bold">Induk Jig:</span> {item.noReg} — {item.assyPartName}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Part Number */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Part Number *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500"
                    placeholder="Contoh: CP-LOC-01"
                    value={cpPartNumber}
                    onChange={(e) => setCpPartNumber(e.target.value)}
                  />
                  <p className="text-[8px] text-gray-400 mt-0.5">Part number sublist drawing harus unik di bawah Jig ini.</p>
                </div>

                {/* Nama CellPart */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Nama Part *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500"
                    placeholder="Contoh: Pin Locator Guide Block"
                    value={cpName}
                    onChange={(e) => setCpName(e.target.value)}
                  />
                </div>

                {/* Halaman PDF Drawing */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Halaman Drawing (PDF) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500"
                    value={cpPdfPageIndex}
                    onChange={(e) => setCpPdfPageIndex(parseInt(e.target.value) || 2)}
                  />
                  <p className="text-[8px] text-gray-400 mt-0.5">Halaman 1 = Parent, Hal 2+ = Child</p>
                </div>

                {/* TPM Notice: Jadwal dan target diset via Modul TPM */}
                <div className="col-span-2 bg-blue-50/50 border border-blue-250 rounded-xl p-3 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-blue-600 text-lg shrink-0 mt-0.5">event_upcoming</span>
                  <div className="text-[9.5px] leading-relaxed text-blue-900">
                    <span className="font-bold block text-blue-950 text-[10px]">Kontrol Servis &amp; TPM Terintegrasi</span>
                    Target preventive maintenance (jadwal hari &amp; batas counter pemakaian) dapat diatur secara fleksibel melalui fitur <strong>Set Schedule TPM</strong> setelah part berhasil didaftarkan.
                  </div>
                </div>

                {/* Tanggal Install */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Tanggal Pasang / Install *</label>
                  <input
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 focus:ring-1 focus:ring-blue-500 bg-white"
                    value={cpInstallDate}
                    onChange={(e) => setCpInstallDate(e.target.value)}
                  />
                </div>

                {/* Minimum Stock */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Stok Minimum</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500"
                    value={cpMinStock}
                    onChange={(e) => setCpMinStock(parseInt(e.target.value) || 0)}
                  />
                </div>

                {/* Actual Stock */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Stok Aktual</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500"
                    value={cpActStock}
                    onChange={(e) => setCpActStock(parseInt(e.target.value) || 0)}
                  />
                </div>

                {/* Deskripsi */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Keterangan (Opsional)</label>
                  <textarea
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500 resize-none"
                    placeholder="Catatan material, toleransi, atau spesifikasi khusus..."
                    value={cpDescription}
                    onChange={(e) => setCpDescription(e.target.value)}
                  />
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex gap-2 pt-2 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setShowAddCpModal(false)}
                  className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={cpSubmitting}
                  className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {cpSubmitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan CellPart'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}

export default function DesignDetailPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-6 bg-white">
          <div className="text-center">
            <span className="material-symbols-outlined animate-spin text-2xl text-blue-600">sync</span>
            <p className="text-xs text-gray-500 mt-2 font-medium">Memuat data desain &amp; E-Tiket...</p>
          </div>
        </div>
      }
    >
      <DesignDetailPageContent {...props} />
    </Suspense>
  );
}

