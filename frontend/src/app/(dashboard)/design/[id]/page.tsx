'use client';

import React, { useState, useEffect, use, lazy, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { fetchMasterList, getFileUrl } from '@/lib/api/phase3';

const StepViewer = lazy(() => import('@/components/design/StepViewer'));

interface DocumentInfo {
  id: string;
  path2D: string | null;
  loc2D: string | null;
  approvalStatus: string;
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
  lineProduct: string;
  process: string;
  vendor: { id: string; name: string } | null;
  documents: DocumentInfo[];
  revisionHistories: RevHistoryInfo[];
  abnormalities: AbnormalityInfo[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

type InspectorTab = 'info' | 'rev' | 'cost' | 'stock' | 'abn';

export default function DesignDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();
  const { logout } = useApp();
  const [item, setItem] = useState<MasterItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<InspectorTab>('info');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState(false);
  const [viewer3DUrl, setViewer3DUrl] = useState<string | null>(null);
  const [viewer3DName, setViewer3DName] = useState<string | undefined>();
  const [previewMode, setPreviewMode] = useState<'2D' | '3D'>('2D');

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
              <span className="font-semibold">Design</span>
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
              className="text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: stockColor + '12', color: stockColor, border: `1px solid ${stockColor}30` }}
            >
              Stok: {stockLabel}
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

                  <div className="absolute right-0 mt-1 w-28 bg-white border border-gray-300 rounded-lg shadow-lg z-50 py-1 text-[10px] text-gray-700">
                    {activeDoc?.loc2D ? (
                      <a
                        href={activeDoc.loc2D}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setDownloadDropdownOpen(false)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-50 text-gray-700 font-bold transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[12px] text-gray-550">picture_as_pdf</span>
                        2D Drawing
                      </a>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-500 opacity-40 font-bold cursor-not-allowed select-none">
                        <span className="material-symbols-outlined text-[12px]">picture_as_pdf</span>
                        2D Drawing
                      </div>
                    )}

                    {(() => {
                      const active3DRev = item.revisionHistories.find((rev) => rev.loc3D);
                      return active3DRev?.loc3D ? (
                        <a
                          href={getFileUrl(active3DRev.loc3D!) ?? undefined}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setDownloadDropdownOpen(false)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-50 text-gray-700 font-bold transition-colors cursor-pointer border-t border-gray-100"
                        >
                          <span className="material-symbols-outlined text-[12px] text-gray-550">download</span>
                          Unduh 3D
                        </a>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-500 opacity-40 font-bold cursor-not-allowed select-none border-t border-gray-100">
                          <span className="material-symbols-outlined text-[12px]">download</span>
                          Unduh 3D
                        </div>
                      );
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
            </div>

            {/* Canvas content */}
            <div className="flex-1 flex items-stretch min-h-0 bg-gray-100 relative">
              {previewMode === '2D' ? (
                activeDoc?.loc2D ? (() => {
                  const pdfUrl = getFileUrl(activeDoc.loc2D);
                  return pdfUrl ? (
                    <iframe
                      src={pdfUrl}
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
    </>
  );
}

