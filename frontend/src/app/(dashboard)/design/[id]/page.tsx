'use client';

import React, { useState, useEffect, use, lazy, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { fetchMasterList, getFileUrl, createCellPart, renewCellPart, renewDesign, recordUsage, deleteCellPart, downloadDesignPdfPage } from '@/lib/api/phase3';
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
  cost: number;
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
  minimumStock: number;
  actualStock: number;
  pdfPageIndex: number | null;
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

type InspectorTab = 'info' | 'etiket' | 'cellpart' | 'rev' | 'cost' | 'stock' | 'abn';

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
    const tabParam = searchParams.get('tab') as InspectorTab | null;
    if (tabParam && ['info', 'etiket', 'cellpart', 'rev', 'cost', 'stock', 'abn'].includes(tabParam)) {
      setActiveTab(tabParam);
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

  // Quick Modal: Log Usage
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usageTarget, setUsageTarget] = useState<{
    target: 'design' | 'cell-part';
    id: string;
    noRegOrPart: string;
    name: string;
    currentUsage: number;
    maxUsage: number;
  } | null>(null);
  const [usageAmountInput, setUsageAmountInput] = useState<number>(50);
  const [usageMode, setUsageMode] = useState<'ADD' | 'SET'>('ADD');

  // Quick Modal: Renew Lifetime
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewTarget, setRenewTarget] = useState<{
    target: 'design' | 'cell-part';
    id: string;
    noRegOrPart: string;
    name: string;
  } | null>(null);
  const [renewResetDays, setRenewResetDays] = useState(true);
  const [renewResetUsage, setRenewResetUsage] = useState(true);
  const [modalSubmitting, setModalSubmitting] = useState(false);

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

  // Quick Usage Logging Handler
  const handleOpenUsageModal = (
    target: 'design' | 'cell-part',
    targetId: string,
    noRegOrPart: string,
    name: string,
    currentUsage: number = 0,
    maxUsage: number = 500,
  ) => {
    setUsageTarget({ target, id: targetId, noRegOrPart, name, currentUsage, maxUsage });
    setUsageAmountInput(50);
    setUsageMode('ADD');
    setShowUsageModal(true);
  };

  const handleSaveUsage = async () => {
    if (!usageTarget) return;
    setModalSubmitting(true);
    try {
      await recordUsage(usageTarget.target, usageTarget.id, usageAmountInput, usageMode);
      setShowUsageModal(false);
      setUsageTarget(null);
      await loadItem();
    } catch (err: any) {
      alert(`Gagal mencatat pemakaian: ${err.message || 'Error server'}`);
    } finally {
      setModalSubmitting(false);
    }
  };

  // Quick Lifetime Renewal Handler
  const handleOpenRenewModal = (
    target: 'design' | 'cell-part',
    targetId: string,
    noRegOrPart: string,
    name: string,
  ) => {
    setRenewTarget({ target, id: targetId, noRegOrPart, name });
    setRenewResetDays(true);
    setRenewResetUsage(true);
    setShowRenewModal(true);
  };

  const handleConfirmRenew = async () => {
    if (!renewTarget) return;
    setModalSubmitting(true);
    try {
      if (renewTarget.target === 'design') {
        await renewDesign(renewTarget.id, { resetDays: renewResetDays, resetUsage: renewResetUsage });
      } else {
        await renewCellPart(renewTarget.id, { resetDays: renewResetDays, resetUsage: renewResetUsage });
      }
      setShowRenewModal(false);
      setRenewTarget(null);
      await loadItem();
    } catch (err: any) {
      alert(`Gagal me-renew lifetime: ${err.message || 'Error server'}`);
    } finally {
      setModalSubmitting(false);
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

  const isRed = item.actualStock < item.minimumStock * 0.5;
  const isYellow = item.actualStock < item.minimumStock && item.actualStock >= item.minimumStock * 0.5;
  const stockColor = isRed ? '#dc2626' : isYellow ? '#ca8a04' : '#16a34a';
  const stockLabel = isRed ? 'Critical' : isYellow ? 'Warning' : 'Aman';

  const reversedDocs = [...item.documents].reverse();
  const activeDoc = reversedDocs.find((d) => d.approvalStatus === 'APPROVED' && d.loc2D)
    || reversedDocs.find((d) => d.loc2D)
    || reversedDocs[0];

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
    { key: 'etiket', icon: 'verified', label: 'E-Tiket' },
    { key: 'cellpart', icon: 'account_tree', label: 'CellPart' },
    { key: 'rev', icon: 'history', label: 'Revisi' },
    { key: 'cost', icon: 'monetization_on', label: 'Cost' },
    { key: 'stock', icon: 'inventory', label: 'Stok' },
    { key: 'abn', icon: 'report_problem', label: 'Anomali' },
  ];

  return (
    <>
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white text-gray-800">

        {/* ── TOP BAR ── */}
        <div className="h-10 flex items-center justify-between px-3 border-b border-gray-200 bg-gray-50 shrink-0 gap-3">
          {/* Left: back + breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/design"
              className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-900 shrink-0"
              title="Kembali"
            >
              <span className="material-symbols-outlined text-sm font-bold">arrow_back</span>
            </Link>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 truncate">
              <Link href="/design" className="font-semibold hover:text-blue-600 transition-colors">Master Data</Link>
              <span className="material-symbols-outlined text-[10px] font-bold">chevron_right</span>
              <span className="font-mono text-gray-700 font-bold truncate">{item.noReg}</span>
              <span className="text-gray-300 mx-0.5">·</span>
              <span className="text-gray-600 font-semibold truncate max-w-[180px]">{item.assyPartName}</span>
            </div>
          </div>

          {/* Center: status pills */}
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: lifecycle.color + '15', color: lifecycle.color, border: `1px solid ${lifecycle.color}30` }}
            >
              {lifecycle.label}
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-650 border border-blue-200">
              Rev {item.revStatus}
            </span>
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
              style={{ background: stockColor + '15', color: stockColor, border: `1px solid ${stockColor}40` }}
              title={`Status Stok: ${stockLabel} (${item.actualStock}/${item.minimumStock})`}
            >
              <span className="material-symbols-outlined text-[11px]">
                {isRed ? 'error' : isYellow ? 'warning' : 'check_circle'}
              </span>
              <span>{item.actualStock}/{item.minimumStock}</span>
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 shrink-0 relative">
            <div className="relative">
              <button
                onClick={() => setDownloadDropdownOpen(!downloadDropdownOpen)}
                className={`flex items-center justify-center w-6 h-6 rounded transition-colors hover:bg-gray-150 text-gray-500 ${downloadDropdownOpen ? 'bg-gray-150 text-gray-800' : ''}`}
                title="Unduh Dokumen"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
              </button>

              {downloadDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDownloadDropdownOpen(false)}
                  ></div>

                  <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-250 rounded-xl shadow-xl z-50 py-1.5 text-[10px] text-gray-700 max-h-80 overflow-y-auto no-scrollbar">
                    {/* Header */}
                    <div className="px-3 py-1 text-[8.5px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 flex items-center justify-between">
                      <span>Pilihan Unduh</span>
                      {downloadingPage && <span className="text-blue-600 animate-pulse font-bold">Mengunduh Hal {downloadingPage}...</span>}
                    </div>

                    {/* Full 2D Drawing */}
                    {activeDoc?.loc2D ? (
                      <a
                        href={activeDoc.loc2D}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setDownloadDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50/70 text-gray-800 font-semibold transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px] text-blue-600">picture_as_pdf</span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-bold">2D Drawing Lengkap</p>
                          <p className="text-[8px] text-gray-400">Semua halaman dalam 1 PDF</p>
                        </div>
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2 text-gray-400 opacity-50 font-medium cursor-not-allowed select-none">
                        <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                        <span>2D Drawing Belum Tersedia</span>
                      </div>
                    )}

                    {/* Single Page: Induk Jig (Hal 1) */}
                    {activeDoc?.loc2D && (
                      <button
                        type="button"
                        onClick={() => {
                          handleDownloadSinglePage(1, `${item.noReg}_Induk_Hal_1.pdf`);
                          setDownloadDropdownOpen(false);
                        }}
                        disabled={downloadingPage !== null}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50/70 text-left text-gray-800 font-semibold transition-colors cursor-pointer border-t border-gray-100"
                      >
                        <span className="material-symbols-outlined text-[14px] text-indigo-600">home</span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-bold">Hal 1: Induk Jig (1 Halaman)</p>
                          <p className="text-[8px] text-gray-400">Gambar teknik utama {item.noReg}</p>
                        </div>
                        <span className="material-symbols-outlined text-[12px] text-gray-400">file_download</span>
                      </button>
                    )}

                    {/* Single Page: CellParts */}
                    {activeDoc?.loc2D && item.cellParts && item.cellParts.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-[8px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-t border-b border-gray-100 mt-0.5">
                          Cell Parts (1 Halaman)
                        </div>
                        {item.cellParts.map((cp, idx) => {
                          const pageNum = cp.pdfPageIndex || (idx + 2);
                          return (
                            <button
                              key={cp.id}
                              type="button"
                              onClick={() => {
                                handleDownloadSinglePage(pageNum, `${item.noReg}_CP_${cp.partNumber}_Hal_${pageNum}.pdf`);
                                setDownloadDropdownOpen(false);
                              }}
                              disabled={downloadingPage !== null}
                              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50/70 text-left text-gray-800 transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[13px] text-blue-500">widgets</span>
                              <div className="flex-1 min-w-0">
                                <p className="truncate font-bold text-[9px] font-mono">{cp.partNumber}</p>
                                <p className="text-[8px] text-gray-400 truncate">Hal {pageNum} · {cp.name}</p>
                              </div>
                              <span className="material-symbols-outlined text-[11px] text-gray-400">file_download</span>
                            </button>
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
            </div>

            <button
              onClick={() => setInspectorOpen(!inspectorOpen)}
              className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${inspectorOpen ? 'bg-blue-50 text-blue-650 border border-blue-200' : 'hover:bg-gray-200 text-gray-500'}`}
              title="Toggle Inspector"
            >
              <span className="material-symbols-outlined text-[14px]">dock_to_right</span>
            </button>
          </div>
        </div>

        {/* ── MAIN BODY ── */}
        <div className="flex-1 flex min-h-0">

          {/* ── LEFT ICON RAIL ── */}
          <div className="w-9 border-r border-gray-200 bg-gray-50 flex flex-col items-center py-2 gap-1 shrink-0">
            {inspectorTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); if (!inspectorOpen) setInspectorOpen(true); }}
                title={t.label}
                className={`flex flex-col items-center justify-center w-7 h-7 rounded transition-all text-[8px] font-bold gap-0.5 ${activeTab === t.key && inspectorOpen ? 'bg-blue-50 text-blue-650 border border-blue-200' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}
              >
                <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
              </button>
            ))}
          </div>

          {/* ── PREVIEW CANVAS (2D / 3D TABS) ── */}
          <div className="flex-1 flex flex-col min-w-0 bg-gray-200">
            {/* Canvas header with Tabs */}
            <div className="h-8 flex items-center justify-between px-3 border-b border-gray-200 bg-gray-100 shrink-0 select-none">
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

                {/* Multi-page Navigation: Induk Jig (Hal 1) + Child CellParts (Hal 2+) */}
                {previewMode === '2D' && item.cellParts && item.cellParts.length > 0 && (
                  <div className="flex items-center gap-1 pl-2 border-l border-gray-300 ml-1 overflow-x-auto no-scrollbar py-0.5">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mr-0.5">Lembar:</span>
                    <button
                      type="button"
                      onClick={() => setActivePdfPage(1)}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
                        activePdfPage === 1
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                      title="Halaman 1: Gambar Teknik Induk Jig"
                    >
                      <span className="material-symbols-outlined text-[11px]">home</span>
                      <span>Hal 1: Induk Jig</span>
                    </button>
                    {item.cellParts.map((cp, idx) => {
                      const pageNum = cp.pdfPageIndex || (idx + 2);
                      const isSelected = activePdfPage === pageNum;
                      return (
                        <button
                          key={cp.id}
                          type="button"
                          onClick={() => setActivePdfPage(pageNum)}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                          }`}
                          title={`Halaman ${pageNum}: ${cp.name} (${cp.partNumber})`}
                        >
                          <span className="material-symbols-outlined text-[11px]">widgets</span>
                          <span className="truncate max-w-[120px]">Hal {pageNum}: {cp.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

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

                {/* E-Tiket Quick Action */}
                <button
                  type="button"
                  onClick={() => {
                    setInspectorOpen(true);
                    setActiveTab('etiket');
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-bold transition-all cursor-pointer ${
                    activeTab === 'etiket' && inspectorOpen
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                  }`}
                  title="Buka Panel Informasi Dokumen & Legalitas"
                >
                  <span className="material-symbols-outlined text-xs">verified</span>
                  <span>Legalitas Desain</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeDoc?.approvalStatus === 'APPROVED'
                        ? 'bg-emerald-500'
                        : activeDoc?.approvalStatus === 'WAITING'
                        ? 'bg-amber-500'
                        : 'bg-gray-300'
                    }`}
                  />
                </button>

                {/* Lebarkan PDF / Toggle Sidebar Button */}
                <button
                  type="button"
                  onClick={() => setInspectorOpen(!inspectorOpen)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-bold transition-all cursor-pointer ${
                    !inspectorOpen
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-gray-750 border-gray-250 hover:bg-gray-100'
                  }`}
                  title={inspectorOpen ? 'Lebarkan PDF (Tutup sidebar inspector)' : 'Buka sidebar inspector'}
                >
                  <span className="material-symbols-outlined text-xs">
                    {inspectorOpen ? 'fullscreen' : 'fullscreen_exit'}
                  </span>
                  <span>{inspectorOpen ? 'Lebarkan PDF' : 'Tampilkan Sidebar'}</span>
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
                      className="flex-1 w-full border-0"
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
                {activeTab === 'info' && (
                  <div className="space-y-4 text-[10px]">
                    {/* Identity block */}
                    <div>
                      <p className="text-[8px] font-bold uppercase text-gray-400 mb-2 tracking-widest">Identitas Item</p>
                      <div className="space-y-2 bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                        {[
                          { label: 'No. Registrasi', value: item.noReg, mono: true },
                          { label: 'Part Name', value: item.assyPartName },
                          { label: 'Assy / Item No', value: item.noItem || '—' },
                          { label: 'Tipe', value: item.type },
                        ].map(({ label, value, mono }) => (
                          <div key={label} className="flex justify-between gap-2 border-b border-gray-50 last:border-0 pb-1.5 last:pb-0">
                            <span className="text-gray-450 shrink-0">{label}</span>
                            <span className={`text-gray-800 text-right truncate max-w-[140px] font-semibold ${mono ? 'font-mono text-gray-900' : ''}`}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[8px] font-bold uppercase text-gray-400 mb-2 tracking-widest">Produksi</p>
                      <div className="space-y-2 bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                        {[
                          { label: 'Line Product', value: item.lineProduct },
                          { label: 'OP / Process', value: item.process },
                          { label: 'Vendor', value: item.vendor?.name || '—' },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between gap-2 border-b border-gray-50 last:border-0 pb-1.5 last:pb-0">
                            <span className="text-gray-450 shrink-0">{label}</span>
                            <span className="text-gray-800 text-right font-bold truncate max-w-[140px]">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[8px] font-bold uppercase text-gray-400 mb-2 tracking-widest">Status Design</p>
                      <div className="space-y-2 bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                        <div className="flex justify-between gap-2 items-center">
                          <span className="text-gray-450">Lifecycle</span>
                          <span className="font-bold text-[9px] px-1.5 py-0.5 rounded" style={{ background: lifecycle.color + '15', color: lifecycle.color }}>{lifecycle.label}</span>
                        </div>
                        <div className="flex justify-between gap-2 items-center">
                          <span className="text-gray-450">Revisi Terkini</span>
                          <span className="text-blue-600 font-bold font-mono">Rev {item.revStatus}</span>
                        </div>
                        <div className="flex justify-between gap-2 items-center">
                          <span className="text-gray-450">Tgl. Revisi</span>
                          <span className="text-gray-800 font-semibold">{item.designDateNew ? new Date(item.designDateNew).toLocaleDateString('id-ID') : '—'}</span>
                        </div>
                        <div className="flex justify-between gap-2 items-center">
                          <span className="text-gray-450">Approval</span>
                          <span className="text-gray-800 font-semibold">{activeDoc?.approvalStatus || 'APPROVED'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Lifetime & Pemakaian (2-Way) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[8px] font-bold uppercase text-gray-400 tracking-widest">Lifetime &amp; Pemakaian (2-Way)</p>
                        <span
                          className={`text-[7.5px] font-bold px-1.5 py-0.2 rounded-full border ${
                            item.lifetimeStatus === 'OVERDUE'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : item.lifetimeStatus === 'WARNING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {item.lifetimeStatus === 'OVERDUE' ? 'AUS / OVERDUE' : item.lifetimeStatus === 'WARNING' ? 'MENDEKATI AUS' : 'SAFE (AMAN)'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs space-y-2">
                        <div className="flex justify-between items-center text-[9px]">
                          <span className="text-gray-450">Mode Lifetime</span>
                          <span className="font-bold text-gray-800">
                            {item.lifetimeType === 'DAYS' ? 'By Hari' : item.lifetimeType === 'USAGE' ? 'By Pemakaian' : '2-Way (Hari & Pemakaian)'}
                          </span>
                        </div>

                        {/* Usage Counter Bar */}
                        <div className="border-t border-gray-50 pt-1.5">
                          <div className="flex justify-between items-center text-[8.5px] mb-1">
                            <span className="text-gray-450">Counter Pemakaian</span>
                            <span className="font-mono font-bold text-gray-900">
                              {item.currentUsage ?? 0} / {item.maxUsage ?? 500}x ({item.usagePercent ?? 0}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-150 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                (item.currentUsage ?? 0) >= (item.maxUsage ?? 500)
                                  ? 'bg-rose-500'
                                  : (item.usagePercent ?? 0) >= 85
                                  ? 'bg-amber-500'
                                  : 'bg-blue-600'
                              }`}
                              style={{ width: `${Math.min(100, item.usagePercent ?? 0)}%` }}
                            />
                          </div>
                        </div>

                        {/* Calendar Days */}
                        <div className="flex justify-between items-center text-[9px] border-t border-gray-50 pt-1.5">
                          <span className="text-gray-450">Sisa Hari Kalender</span>
                          <span className="font-bold text-gray-800">
                            {item.daysRemaining ?? 0} hari{' '}
                            <span className="text-[8px] font-normal text-gray-400">
                              (s/d {item.dueDate ? new Date(item.dueDate).toLocaleDateString('id-ID') : '—'})
                            </span>
                          </span>
                        </div>

                        {/* Actions */}
                        {isPic && (
                          <div className="flex gap-1.5 pt-2 border-t border-gray-100">
                            <button
                              type="button"
                              onClick={() => handleOpenUsageModal('design', item.id, item.noReg, item.assyPartName, item.currentUsage ?? 0, item.maxUsage ?? 500)}
                              className="flex-1 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[8px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[11px]">speed</span>
                              + Catat Pemakaian
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenRenewModal('design', item.id, item.noReg, item.assyPartName)}
                              className="py-1 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-[8px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[11px]">autorenew</span>
                              Renew
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─ E-TIKET TAB ─ */}
                {activeTab === 'etiket' && (() => {
                  const waitingApproval = item ? approvals?.find((a) => a.noReg === item.noReg && a.status === 'WAITING') : null;
                  return (
                    <div className="space-y-3 text-[10px]">
                      {waitingApproval && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold flex items-center gap-1.5 text-[10px]">
                              <span className="material-symbols-outlined text-sm text-amber-600 animate-pulse">pending</span>
                              Proses Approval Sedang Berjalan
                            </span>
                            <Link
                              href={`/approval-center/${waitingApproval.id}`}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[9px] font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span>Review &amp; Tanda Tangan</span>
                              <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                            </Link>
                          </div>
                          <p className="text-[8px] text-amber-700 font-medium">
                            Tahap saat ini: {waitingApproval.sectionStatus !== 'APPROVED' ? 'Menunggu Tanda Tangan Section Head (Checked)' : 'Menunggu Tanda Tangan Dept Head (Approved)'}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[8px] font-bold uppercase text-gray-400 tracking-widest">Status Legalitas Desain</p>
                          <p className="text-[9px] text-gray-500 font-semibold">Persetujuan &amp; Status Dokumen Resmi</p>
                        </div>
                        <span className={`font-bold px-2 py-0.5 rounded text-[8px] ${
                          activeDoc?.approvalStatus === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : activeDoc?.approvalStatus === 'WAITING'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}>
                          {activeDoc?.approvalStatus || 'APPROVED'}
                        </span>
                      </div>

                      {/* Metadata Informasi Dokumen */}
                      <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs space-y-1.5 text-[9px]">
                        <span className="text-[8px] font-bold uppercase text-gray-400 block mb-1">Informasi Gambar Teknik</span>
                        <div className="flex justify-between border-b border-gray-100 pb-1">
                          <span className="text-gray-400">Part Name:</span>
                          <span className="font-bold text-gray-800 text-right truncate max-w-[140px]">{item.assyPartName}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-100 pb-1">
                          <span className="text-gray-400">Part Number:</span>
                          <span className="font-mono font-bold text-gray-800">{item.noItem || item.noReg}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-100 pb-1">
                          <span className="text-gray-400">Model / Line:</span>
                          <span className="font-semibold text-gray-800">{item.lineProduct}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-100 pb-1">
                          <span className="text-gray-400">Revisi:</span>
                          <span className="font-mono font-bold text-blue-600">Rev {item.revStatus}</span>
                        </div>
                        <div className="flex justify-between items-center pt-0.5">
                          <span className="text-gray-400">Status Legalitas:</span>
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[8px] ${
                            activeDoc?.approvalStatus === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : activeDoc?.approvalStatus === 'WAITING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {activeDoc?.approvalStatus === 'APPROVED' ? 'Resmi (Fully Approved)' : activeDoc?.approvalStatus === 'WAITING' ? 'Menunggu Persetujuan' : 'Draft'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ─ CELLPART TAB ─ */}
                {activeTab === 'cellpart' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[8px] font-bold uppercase text-gray-400 tracking-widest">Child Cell Parts</p>
                        <p className="text-[9px] text-gray-500">Komponen turunan &amp; lifetime control</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAddCpModal}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[9px] font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xs">add</span>
                        Tambah
                      </button>
                    </div>

                    {(!item.cellParts || item.cellParts.length === 0) ? (
                      <div className="text-center py-8 bg-white rounded-lg border border-gray-200 p-4 shadow-2xs">
                        <span className="material-symbols-outlined text-2xl text-blue-400 block mb-1">widgets</span>
                        <p className="text-[10px] font-bold text-gray-700">Belum Ada Child CellPart</p>
                        <p className="text-[9px] text-gray-400 mt-0.5">Tambahkan sub-komponen dengan drawing child pada halaman multi-page.</p>
                        <button
                          type="button"
                          onClick={handleOpenAddCpModal}
                          className="mt-2.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded text-[9px] font-bold transition-colors cursor-pointer"
                        >
                          + Tambah CellPart Baru
                        </button>
                      </div>
                    ) : (
                      item.cellParts.map((cp, idx) => {
                        const pageNum = cp.pdfPageIndex || (idx + 2);
                        const isOverdue = cp.lifetimeStatus === 'OVERDUE';
                        const isWarning = cp.lifetimeStatus === 'WARNING';
                        const isSelectedPage = activePdfPage === pageNum;

                        return (
                          <div
                            key={cp.id}
                            className={`bg-white rounded-lg p-2.5 border transition-all shadow-2xs ${
                              isSelectedPage ? 'border-blue-500 ring-1 ring-blue-400' : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1.5">
                              <div className="min-w-0">
                                <span className="font-mono text-[9px] font-bold text-blue-650 block">
                                  {cp.partNumber}
                                </span>
                                <h4 className="text-[10px] font-bold text-gray-800 truncate">{cp.name}</h4>
                              </div>
                              <span
                                className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 border ${
                                  isOverdue
                                    ? 'bg-rose-100 text-rose-700 border-rose-300'
                                    : isWarning
                                    ? 'bg-amber-100 text-amber-700 border-amber-300'
                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                }`}
                                title={
                                  isOverdue
                                    ? `AUS / OVERDUE! (${cp.currentUsage ?? 0}/${cp.maxUsage ?? 500}x | ${cp.daysRemaining ?? 0}d)`
                                    : isWarning
                                    ? `PERINGATAN MENDEKATI AUS (${cp.currentUsage ?? 0}/${cp.maxUsage ?? 500}x | ${cp.daysRemaining ?? 0}d)`
                                    : `LIFETIME AMAN (${cp.currentUsage ?? 0}/${cp.maxUsage ?? 500}x | ${cp.daysRemaining ?? 0}d)`
                                }
                              >
                                {cp.lifetimeType === 'DAYS'
                                  ? `${cp.daysRemaining} hari`
                                  : cp.lifetimeType === 'USAGE'
                                  ? `${cp.currentUsage ?? 0}/${cp.maxUsage ?? 500}x`
                                  : `${cp.currentUsage ?? 0}/${cp.maxUsage ?? 500}x · ${cp.daysRemaining}d`}
                              </span>
                            </div>

                            {cp.description && (
                              <p className="text-[9px] text-gray-500 mb-1.5 leading-tight italic">"{cp.description}"</p>
                            )}

                            {/* Usage Progress Bar */}
                            <div className="border-t border-gray-100 pt-1.5 mb-1.5">
                              <div className="flex justify-between items-center text-[7.5px] text-gray-500 mb-0.5">
                                <span>Pemakaian</span>
                                <span className="font-mono font-bold text-gray-800">
                                  {cp.currentUsage ?? 0} / {cp.maxUsage ?? 500}x ({cp.usagePercent ?? 0}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-150 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    (cp.currentUsage ?? 0) >= (cp.maxUsage ?? 500)
                                      ? 'bg-rose-500'
                                      : (cp.usagePercent ?? 0) >= 85
                                      ? 'bg-amber-500'
                                      : 'bg-blue-600'
                                  }`}
                                  style={{ width: `${Math.min(100, cp.usagePercent ?? 0)}%` }}
                                />
                              </div>
                            </div>

                            {/* Details Grid */}
                            <div className="space-y-1 text-[8px] text-gray-400 border-t border-gray-100 pt-1.5 mb-2">
                              <div className="flex justify-between">
                                <span>Halaman Drawing</span>
                                <span className="font-bold text-gray-700">Halaman {pageNum}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Due Date</span>
                                <span className="font-semibold text-gray-700">{new Date(cp.dueDate).toLocaleDateString('id-ID')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Stok (Aktual / Min)</span>
                                <span className={`font-bold ${cp.actualStock < cp.minimumStock ? 'text-amber-600' : 'text-gray-700'}`}>
                                  {cp.actualStock} / {cp.minimumStock} unit
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1 border-t border-gray-100 pt-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewMode('2D');
                                  setActivePdfPage(pageNum);
                                }}
                                className={`flex-1 py-1 rounded text-[8px] font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                                  isSelectedPage && previewMode === '2D'
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700'
                                }`}
                                title="Lihat gambar teknik di PDF viewer"
                              >
                                <span className="material-symbols-outlined text-[10px]">visibility</span>
                                Drawing
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDownloadSinglePage(pageNum, `${item.noReg}_CP_${cp.partNumber}_Hal_${pageNum}.pdf`)}
                                disabled={downloadingPage !== null}
                                className="py-1 px-1.5 rounded text-[8px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors flex items-center justify-center gap-0.5 cursor-pointer"
                                title={`Unduh 1 Halaman PDF (${cp.partNumber})`}
                              >
                                <span className="material-symbols-outlined text-[10px]">
                                  {downloadingPage === pageNum ? 'sync' : 'download'}
                                </span>
                              </button>

                              {isPic && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenUsageModal('cell-part', cp.id, cp.partNumber, cp.name, cp.currentUsage ?? 0, cp.maxUsage ?? 500)}
                                    className="px-1.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[8px] font-bold transition-colors cursor-pointer"
                                    title="Catat Pemakaian CellPart (+X)"
                                  >
                                    + Catat
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenRenewModal('cell-part', cp.id, cp.partNumber, cp.name)}
                                    className="px-1.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-[8px] font-bold transition-colors cursor-pointer"
                                    title="Renew lifetime part ini"
                                  >
                                    Renew
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCp(cp.id, cp.name)}
                                    className="p-1 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                    title="Hapus Child CellPart"
                                  >
                                    <span className="material-symbols-outlined text-xs">delete</span>
                                  </button>
                                </>
                              )}
                            </div>
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
                            <span className="font-bold text-green-600">Rp {rev.cost.toLocaleString('id-ID')}</span>
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
                                <a
                                  href={getFileUrl(rev.loc2D!) ?? undefined}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex-1 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[8px] font-bold transition-all text-center flex items-center justify-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[10px]">download</span>
                                  2D Drawing
                                </a>
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

                {/* ─ COST TAB ─ */}
                {activeTab === 'cost' && (
                  <div className="space-y-2">
                    <p className="text-[8px] font-bold uppercase text-gray-400 mb-2 tracking-widest">Vendor &amp; Biaya PO</p>
                    {item.revisionHistories.length === 0 ? (
                      <p className="text-[10px] text-gray-400 italic">Belum ada histori biaya.</p>
                    ) : (
                      item.revisionHistories.map((rev) => (
                        <div key={rev.id} className="bg-white rounded-lg p-2.5 border border-gray-200 hover:border-gray-300 transition-colors shadow-2xs">
                          <div className="flex justify-between items-center mb-2 border-b border-gray-50 pb-1.5">
                            <span className="text-[9px] font-bold text-gray-800">{rev.vendorName}</span>
                            <span className="text-[9px] font-bold text-green-600">Rp {rev.cost.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="space-y-1 text-[8px] text-gray-400">
                            <div className="flex justify-between">
                              <span>PO Number</span>
                              <span className="font-mono text-gray-700 font-semibold">{rev.poNumber || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Lead Time</span>
                              <span className="text-gray-700 font-semibold">{rev.leadTime ? `${rev.leadTime} hari` : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Tanggal PO</span>
                              <span className="text-gray-700 font-semibold">{new Date(rev.createdAt).toLocaleDateString('id-ID')}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    {/* Total cost summary */}
                    {item.revisionHistories.length > 0 && (
                      <div className="bg-green-50 rounded-lg p-2.5 border border-green-200 mt-3 shadow-2xs">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-green-700 font-bold">Total Akumulasi Cost</span>
                          <span className="text-green-650 font-bold">
                            Rp {item.revisionHistories.reduce((sum, r) => sum + r.cost, 0).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─ STOK TAB ─ */}
                {activeTab === 'stock' && (
                  <div className="space-y-3">
                    <p className="text-[8px] font-bold uppercase text-gray-400 mb-2 tracking-widest">Status Inventaris</p>

                    {/* Gauge visual */}
                    <div className="bg-white rounded-xl p-4 border border-gray-250 text-center shadow-2xs">
                      <div
                        className="w-16 h-16 rounded-full border-4 flex items-center justify-center mx-auto mb-2 bg-gray-50"
                        style={{ borderColor: stockColor }}
                      >
                        <span className="text-xl font-black" style={{ color: stockColor }}>{item.actualStock}</span>
                      </div>
                      <p className="text-[9px] text-gray-400">dari <strong className="text-gray-700">{item.minimumStock}</strong> minimum</p>
                      <span
                        className="inline-block mt-2 text-[9px] font-bold px-3 py-0.5 rounded-full uppercase"
                        style={{ background: stockColor + '12', color: stockColor, border: `1px solid ${stockColor}30` }}
                      >
                        {stockLabel}
                      </span>
                    </div>

                    <div className="space-y-2 text-[10px] bg-white p-2.5 rounded-lg border border-gray-200">
                      {[
                        { label: 'Stok Minimum', value: `${item.minimumStock} unit` },
                        { label: 'Stok Aktual', value: `${item.actualStock} unit` },
                        { label: 'Selisih', value: `${item.actualStock - item.minimumStock} unit` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between gap-2 border-b border-gray-50 last:border-0 pb-1.5 last:pb-0">
                          <span className="text-gray-450">{label}</span>
                          <span className="text-gray-800 font-bold">{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-2 px-1">
                      <div className="flex justify-between text-[8px] text-gray-400 mb-1">
                        <span>0</span><span>{item.minimumStock}</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (item.actualStock / Math.max(item.minimumStock, 1)) * 100)}%`,
                            background: stockColor
                          }}
                        />
                      </div>
                    </div>
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
            <div className="p-3.5 border-b border-gray-150 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
              <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-sm">widgets</span>
                Tambah Child CellPart
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCpModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer"
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

                {/* 2-Way Lifetime System Configuration */}
                <div className="col-span-2 bg-slate-50/80 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] font-bold text-gray-700 uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-blue-600">published_with_changes</span>
                      Konfigurasi Lifetime (2-Way)
                    </label>
                    <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full font-bold">
                      Aus: 500x / 180 Hari
                    </span>
                  </div>

                  {/* Mode Selector */}
                  <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                    <button
                      type="button"
                      onClick={() => setCpLifetimeType('DUAL')}
                      className={`py-1.5 px-2 rounded-lg text-[9px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                        cpLifetimeType === 'DUAL'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-gray-600 border-gray-250 hover:bg-gray-100'
                      }`}
                    >
                      <span>2-Way (Dual)</span>
                      <span className="text-[7.5px] opacity-80 font-normal">Hari &amp; Pemakaian</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCpLifetimeType('USAGE')}
                      className={`py-1.5 px-2 rounded-lg text-[9px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                        cpLifetimeType === 'USAGE'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-gray-600 border-gray-250 hover:bg-gray-100'
                      }`}
                    >
                      <span>By Pemakaian</span>
                      <span className="text-[7.5px] opacity-80 font-normal">Siklus / Counter</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCpLifetimeType('DAYS')}
                      className={`py-1.5 px-2 rounded-lg text-[9px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                        cpLifetimeType === 'DAYS'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-gray-600 border-gray-250 hover:bg-gray-100'
                      }`}
                    >
                      <span>By Hari</span>
                      <span className="text-[7.5px] opacity-80 font-normal">Kalender</span>
                    </button>
                  </div>

                  {/* Dynamic Inputs based on Mode */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {(cpLifetimeType === 'DUAL' || cpLifetimeType === 'USAGE') && (
                      <div className={cpLifetimeType === 'USAGE' ? 'col-span-2' : ''}>
                        <label className="block text-[8.5px] font-bold text-gray-600 uppercase mb-0.5">
                          Batas Aus Pemakaian (Siklus) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            required
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none text-gray-800 font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                            value={cpMaxUsage}
                            onChange={(e) => setCpMaxUsage(parseInt(e.target.value) || 500)}
                            placeholder="500"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">kali</span>
                        </div>
                        <p className="text-[7.5px] text-gray-400 mt-0.5">Aus jika mencapai batas ini (default: 500x).</p>
                      </div>
                    )}

                    {(cpLifetimeType === 'DUAL' || cpLifetimeType === 'DAYS') && (
                      <div className={cpLifetimeType === 'DAYS' ? 'col-span-2' : ''}>
                        <label className="block text-[8.5px] font-bold text-gray-600 uppercase mb-0.5">
                          Lifetime Hari (Kalender) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            required
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none text-gray-800 font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                            value={cpLifetimeDays}
                            onChange={(e) => setCpLifetimeDays(parseInt(e.target.value) || 180)}
                            placeholder="180"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">hari</span>
                        </div>
                        <p className="text-[7.5px] text-gray-400 mt-0.5">Reminder 5 minggu sebelum habis (default: 180d).</p>
                      </div>
                    )}
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

      {/* QUICK MODAL: CATAT PEMAKAIAN (LOG USAGE) */}
      {showUsageModal && usageTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[95]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            {/* Header */}
            <div className="p-4 border-b border-gray-150 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-lg">speed</span>
                </div>
                <div>
                  <h3 className="font-bold text-xs text-gray-800">Catat Pemakaian (Usage Counter)</h3>
                  <p className="text-[9px] text-gray-500">Log siklus kerja / stroke count harian atau batch</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUsageModal(false);
                  setUsageTarget(null);
                }}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Target Card & Progress */}
            <div className="p-4 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[8.5px] font-bold text-gray-500 uppercase">
                    {usageTarget.target === 'design' ? 'Jig & Fixture (Induk)' : 'CellPart (Komponen)'}
                  </span>
                  <span className="font-mono text-[9px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                    {usageTarget.noRegOrPart}
                  </span>
                </div>
                <div className="font-bold text-xs text-gray-900 truncate" title={usageTarget.name}>
                  {usageTarget.name}
                </div>

                {/* Current Counter Status */}
                <div className="pt-1">
                  <div className="flex justify-between items-center text-[9px] font-semibold text-gray-600 mb-1">
                    <span>Counter Saat Ini:</span>
                    <span className="font-mono font-bold text-gray-900">
                      {usageTarget.currentUsage} / {usageTarget.maxUsage}x
                      <span className="text-gray-500 font-normal ml-1">
                        ({Math.round(((usageTarget.currentUsage || 0) / (usageTarget.maxUsage || 500)) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        usageTarget.currentUsage >= usageTarget.maxUsage
                          ? 'bg-rose-500'
                          : usageTarget.currentUsage >= usageTarget.maxUsage * 0.85
                          ? 'bg-amber-500'
                          : 'bg-blue-600'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.round(((usageTarget.currentUsage || 0) / (usageTarget.maxUsage || 500)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Mode Toggle: ADD (+X) vs SET (=X) */}
              <div>
                <label className="block text-[9px] font-bold text-gray-600 uppercase mb-1.5">
                  Metode Input Counter
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUsageMode('ADD')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      usageMode === 'ADD'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-gray-600 border-gray-250 hover:bg-gray-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    <span>Tambah Pemakaian (+X)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUsageMode('SET');
                      setUsageAmountInput(usageTarget.currentUsage);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      usageMode === 'SET'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-gray-600 border-gray-250 hover:bg-gray-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">tune</span>
                    <span>Set Langsung Counter (=X)</span>
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons (if ADD mode) */}
              {usageMode === 'ADD' && (
                <div>
                  <label className="block text-[8.5px] font-bold text-gray-400 uppercase mb-1">
                    Preset Cepat
                  </label>
                  <div className="flex gap-1.5">
                    {[10, 25, 50, 100, 200].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setUsageAmountInput(preset)}
                        className={`flex-1 py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                          usageAmountInput === preset
                            ? 'bg-blue-50 border-blue-400 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Value */}
              <div>
                <label className="block text-[9px] font-bold text-gray-600 uppercase mb-1">
                  {usageMode === 'ADD' ? 'Jumlah Pemakaian yang Ditambahkan (siklus) *' : 'Nilai Total Counter Pemakaian (siklus) *'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                    value={usageAmountInput}
                    onChange={(e) => setUsageAmountInput(parseInt(e.target.value) || 0)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">kali / siklus</span>
                </div>
              </div>

              {/* Simulation Result Preview */}
              {(() => {
                const simulatedNew =
                  usageMode === 'ADD'
                    ? (usageTarget.currentUsage || 0) + (usageAmountInput || 0)
                    : usageAmountInput || 0;
                const max = usageTarget.maxUsage || 500;
                const isOverdue = simulatedNew >= max;
                const isWarning = !isOverdue && (simulatedNew >= max * 0.85 || max - simulatedNew <= 50);

                return (
                  <div
                    className={`p-2.5 rounded-xl border text-[9.5px] flex items-center justify-between ${
                      isOverdue
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : isWarning
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">
                        {isOverdue ? 'error' : isWarning ? 'warning' : 'check_circle'}
                      </span>
                      <span>
                        Hasil simulasi:{' '}
                        <strong>
                          {simulatedNew} / {max}x
                        </strong>
                      </span>
                    </div>
                    <span className="font-bold uppercase text-[8.5px] px-1.5 py-0.5 rounded-full bg-white/80 border">
                      {isOverdue ? 'Aus / Overdue' : isWarning ? 'Mendekati Aus' : 'Aman'}
                    </span>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUsageModal(false);
                    setUsageTarget(null);
                  }}
                  className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={modalSubmitting || usageAmountInput < 0}
                  onClick={handleSaveUsage}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Pemakaian'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK MODAL: RENEW LIFETIME (RESET OPTIONS) */}
      {showRenewModal && renewTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[95]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            {/* Header */}
            <div className="p-4 border-b border-gray-150 flex justify-between items-center bg-gradient-to-r from-amber-50 to-orange-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-lg">autorenew</span>
                </div>
                <div>
                  <h3 className="font-bold text-xs text-gray-800">Renew Lifetime</h3>
                  <p className="text-[9px] text-gray-500">Reset parameter keausan setelah rekondisi atau ganti part</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRenewModal(false);
                  setRenewTarget(null);
                }}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Target Card & Options */}
            <div className="p-4 space-y-4">
              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[8.5px] font-bold text-gray-500 uppercase">
                    {renewTarget.target === 'design' ? 'Jig & Fixture (Induk)' : 'CellPart (Komponen)'}
                  </span>
                  <span className="font-mono text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    {renewTarget.noRegOrPart}
                  </span>
                </div>
                <div className="font-bold text-xs text-gray-900 truncate" title={renewTarget.name}>
                  {renewTarget.name}
                </div>
              </div>

              {/* Explanation */}
              <p className="text-[10px] text-gray-600 leading-relaxed">
                Pilih opsi parameter yang ingin di-reset ke kondisi awal:
              </p>

              {/* Checkboxes */}
              <div className="space-y-2.5">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 hover:border-blue-400 bg-white transition-all cursor-pointer">
                  <input
                    type="checkbox"
                    checked={renewResetUsage}
                    onChange={(e) => setRenewResetUsage(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1 text-[10px]">
                    <div className="font-bold text-gray-800">Reset Counter Pemakaian ke 0</div>
                    <div className="text-gray-500 text-[8.5px] mt-0.5">
                      Jumlah pemakaian (siklus) akan dikembalikan ke 0x. Status keausan kembali <strong>SAFE (Aman)</strong>.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 hover:border-blue-400 bg-white transition-all cursor-pointer">
                  <input
                    type="checkbox"
                    checked={renewResetDays}
                    onChange={(e) => setRenewResetDays(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1 text-[10px]">
                    <div className="font-bold text-gray-800">Reset Tanggal Pasang / Desain ke Hari Ini</div>
                    <div className="text-gray-500 text-[8.5px] mt-0.5">
                      Menjadikan hari ini sebagai tanggal pasang/pembaruan baru sehingga sisa hari kalender kembali penuh (180 hari).
                    </div>
                  </div>
                </label>
              </div>

              {!renewResetDays && !renewResetUsage && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[9px] font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs">warning</span>
                  Pilih minimal salah satu opsi reset di atas.
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRenewModal(false);
                    setRenewTarget(null);
                  }}
                  className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={modalSubmitting || (!renewResetDays && !renewResetUsage)}
                  onClick={handleConfirmRenew}
                  className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      Memproses...
                    </>
                  ) : (
                    'Konfirmasi Renew'
                  )}
                </button>
              </div>
            </div>
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

