'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useApp } from '@/context/AppContext';
import { canEdit } from '@/lib/rbac';
import {
  fetchMasterList,
  fetchReplacementHistory,
  recordCellPartReplacement,
  deleteReplacementLog,
  PartReplacementRecord,
  updateCellPart,
} from '@/lib/api/phase3';

interface CellPartItem {
  id: string;
  itemNo?: number;
  partNumber: string;
  name: string;
  description: string | null;
  material?: string | null;
  qty?: string | number;
  lifetimeDays: number;
  lifetimeType?: 'DUAL' | 'USAGE' | 'DAYS';
  maxUsage?: number;
  currentUsage?: number;
  usageRemaining?: number;
  usagePercent?: number;
  installDate: string;
  lastRenewalDate: string | null;
  dueDate?: string;
  daysRemaining?: number;
  lifetimeStatus?: 'OVERDUE' | 'WARNING' | 'SAFE';
  minimumStock: number;
  actualStock: number;
}

interface JigMasterItem {
  id: string;
  noReg: string;
  assyPartName: string;
  qty: string;
  noItem: string;
  type: 'JF' | 'EQ';
  lineProduct: string;
  process: string;
  lifecycleStatus: 'ACTIVE' | 'UNDER_REPAIR' | 'UNDER_IMPROVEMENT' | 'OBSOLETE' | 'SCRAP';
  minimumStock: number;
  actualStock: number;
  lifetimeDays?: number;
  lifetimeType?: 'DUAL' | 'USAGE' | 'DAYS';
  maxUsage?: number;
  currentUsage?: number;
  daysRemaining?: number;
  dueDate?: string;
  lifetimeStatus?: 'OVERDUE' | 'WARNING' | 'SAFE';
  cellParts?: CellPartItem[];
}

function JigManagementContent() {
  const { user, isLoading, updateItemStock } = useApp();
  const isPic = !isLoading && canEdit(user?.role);

  // Data states
  const [items, setItems] = useState<JigMasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [replacementLogs, setReplacementLogs] = useState<PartReplacementRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'MANAGEMENT' | 'HISTORY'>('MANAGEMENT');

  // UI state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [lineFilter, setLineFilter] = useState('All');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'GREEN' | 'YELLOW' | 'RED'>('ALL');
  const [lifetimeFilter, setLifetimeFilter] = useState<'ALL' | 'OVERDUE' | 'WARNING' | 'SAFE'>('ALL');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Modal: Edit Stock & Lifetime Jig Induk
  const [editingJig, setEditingJig] = useState<JigMasterItem | null>(null);
  const [jigMinStock, setJigMinStock] = useState(0);
  const [jigActStock, setJigActStock] = useState(0);
  const [jigLifecycle, setJigLifecycle] = useState<string>('ACTIVE');
  const [jigLifetimeDays, setJigLifetimeDays] = useState(180);
  const [jigLifetimeType, setJigLifetimeType] = useState<'DUAL' | 'USAGE' | 'DAYS'>('DUAL');
  const [jigMaxUsage, setJigMaxUsage] = useState(500);
  const [jigCurrentUsage, setJigCurrentUsage] = useState(0);

  // Modal: Edit Stock & Lifetime CellPart
  const [editingCp, setEditingCp] = useState<{ parentNoReg: string; cp: CellPartItem } | null>(null);
  const [cpMinStock, setCpMinStock] = useState(0);
  const [cpActStock, setCpActStock] = useState(0);
  const [cpLifetimeDays, setCpLifetimeDays] = useState(180);
  const [cpLifetimeType, setCpLifetimeType] = useState<'DUAL' | 'USAGE' | 'DAYS'>('DUAL');
  const [cpMaxUsage, setCpMaxUsage] = useState(500);
  const [cpCurrentUsage, setCpCurrentUsage] = useState(0);

  // Modal: Ganti Part Baru (Record Replacement)
  const [replacingCp, setReplacingCp] = useState<{ parentNoReg: string; cp: CellPartItem } | null>(null);
  const [replaceDate, setReplaceDate] = useState(new Date().toISOString().split('T')[0]);
  const [replacePic, setReplacePic] = useState(user?.name || 'PIC Jig Fixture');
  const [replaceReason, setReplaceReason] = useState('Keausan Pemakaian (Aus Normal)');
  const [replaceNotes, setReplaceNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const masterList = await fetchMasterList();
      setItems(masterList || []);
    } catch (e: any) {
      console.error('Failed to load jig data:', e);
      setToast({ type: 'error', msg: 'Gagal memuat data master' });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const logs = await fetchReplacementHistory();
      setReplacementLogs(logs || []);
    } catch (e: any) {
      console.error('Failed to load replacement history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadData();
    loadHistory();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatLastRenewal = (dateStr?: string | null, installStr?: string) => {
    const raw = dateStr || installStr;
    if (!raw) return '-';
    const date = new Date(raw);
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
    const dateFormatted = date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    });
    if (diffDays === 0) return `Hari ini (${dateFormatted})`;
    if (diffDays === 1) return `1 hr lalu (${dateFormatted})`;
    return `${diffDays} hr lalu (${dateFormatted})`;
  };

  // Open Jig Edit
  const handleOpenJigEdit = (item: JigMasterItem) => {
    setEditingJig(item);
    setJigMinStock(item.minimumStock ?? 0);
    setJigActStock(item.actualStock ?? 0);
    setJigLifecycle(item.lifecycleStatus || 'ACTIVE');
    setJigLifetimeDays(item.lifetimeDays ?? 180);
    setJigLifetimeType(item.lifetimeType || 'DUAL');
    setJigMaxUsage(item.maxUsage ?? 500);
    setJigCurrentUsage(item.currentUsage ?? 0);
  };

  const handleSaveJigEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJig) return;
    setSubmitting(true);
    try {
      await updateItemStock(
        editingJig.id,
        jigMinStock,
        jigActStock,
        jigLifecycle,
        jigLifetimeDays,
        jigLifetimeType,
        jigMaxUsage,
        jigCurrentUsage,
      );
      setToast({ type: 'success', msg: `Data ${editingJig.noReg} diperbarui` });
      setEditingJig(null);
      await loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal menyimpan data' });
    } finally {
      setSubmitting(false);
    }
  };

  // Open CP Edit
  const handleOpenCpEdit = (parentNoReg: string, cp: CellPartItem) => {
    setEditingCp({ parentNoReg, cp });
    setCpMinStock(cp.minimumStock ?? 0);
    setCpActStock(cp.actualStock ?? 0);
    setCpLifetimeDays(cp.lifetimeDays ?? 180);
    setCpLifetimeType(cp.lifetimeType || 'DUAL');
    setCpMaxUsage(cp.maxUsage ?? 500);
    setCpCurrentUsage(cp.currentUsage ?? 0);
  };

  const handleSaveCpEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCp) return;
    setSubmitting(true);
    try {
      await updateCellPart(editingCp.cp.id, {
        minimumStock: cpMinStock,
        actualStock: cpActStock,
        lifetimeDays: cpLifetimeDays,
        lifetimeType: cpLifetimeType,
        maxUsage: cpMaxUsage,
        currentUsage: cpCurrentUsage,
      });
      setToast({ type: 'success', msg: `Part ${editingCp.cp.partNumber} diperbarui` });
      setEditingCp(null);
      await loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal menyimpan part' });
    } finally {
      setSubmitting(false);
    }
  };

  // Open Replace Modal
  const handleOpenReplace = (parentNoReg: string, cp: CellPartItem) => {
    setReplacingCp({ parentNoReg, cp });
    setReplaceDate(new Date().toISOString().split('T')[0]);
    setReplacePic(user?.name || 'PIC Jig Fixture');
    setReplaceReason('Keausan Pemakaian (Aus Normal)');
    setReplaceNotes('');
  };

  const handleSaveReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacingCp) return;
    setSubmitting(true);
    try {
      await recordCellPartReplacement(replacingCp.cp.id, {
        replacedBy: replacePic,
        reason: replaceReason,
        notes: replaceNotes || undefined,
        replacedAt: replaceDate ? new Date(replaceDate).toISOString() : undefined,
      });
      setToast({ type: 'success', msg: `Part ${replacingCp.cp.partNumber} berhasil diganti & direset` });
      setReplacingCp(null);
      await loadData();
      await loadHistory();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal mencatat pergantian part' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHistoryLog = async (logId: string) => {
    if (!confirm('Hapus riwayat pergantian part ini?')) return;
    try {
      await deleteReplacementLog(logId);
      setToast({ type: 'success', msg: 'Riwayat berhasil dihapus' });
      await loadHistory();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal menghapus riwayat' });
    }
  };

  // Filter Items
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      const matchSearch =
        !q ||
        item.noReg.toLowerCase().includes(q) ||
        item.assyPartName.toLowerCase().includes(q) ||
        item.lineProduct.toLowerCase().includes(q) ||
        item.process.toLowerCase().includes(q) ||
        (item.cellParts || []).some(
          (cp) =>
            cp.partNumber.toLowerCase().includes(q) ||
            cp.name.toLowerCase().includes(q),
        );

      const matchLine = lineFilter === 'All' || item.lineProduct === lineFilter;

      let matchStock = true;
      if (stockStatusFilter === 'GREEN') {
        matchStock = item.actualStock >= item.minimumStock && item.actualStock > 0;
      } else if (stockStatusFilter === 'YELLOW') {
        matchStock = item.actualStock > 0 && item.actualStock < item.minimumStock;
      } else if (stockStatusFilter === 'RED') {
        matchStock = item.actualStock === 0;
      }

      let matchLifetime = true;
      if (lifetimeFilter !== 'ALL') {
        matchLifetime =
          item.lifetimeStatus === lifetimeFilter ||
          (item.cellParts || []).some((cp) => cp.lifetimeStatus === lifetimeFilter);
      }

      return matchSearch && matchLine && matchStock && matchLifetime;
    });
  }, [items, search, lineFilter, stockStatusFilter, lifetimeFilter]);

  // Filter History
  const filteredHistory = useMemo(() => {
    const q = search.toLowerCase().trim();
    return replacementLogs;
  }, [replacementLogs]);

  const uniqueLines = ['All', ...Array.from(new Set(items.map((i) => i.lineProduct).filter(Boolean)))];

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 pt-2 bg-white h-full overflow-hidden text-gray-800">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[99] px-4 py-2 rounded-lg text-xs font-bold shadow-lg flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Standard Header (Konsisten 1:1 dengan Master Drawing) */}
      <header className="h-12 flex justify-between items-center border-b border-gray-150 mb-3 shrink-0">
        <div className="flex items-center gap-4 flex-1">
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-1.5 shrink-0">
            <span className="material-symbols-outlined text-blue-600 text-lg">precision_manufacturing</span>
            Jig Management
          </h2>

          {/* Search bar inside header */}
          <div className="relative flex items-center w-80">
            <span
              className="material-symbols-outlined absolute left-2.5 text-gray-400 pointer-events-none select-none flex items-center justify-center leading-none"
              style={{ fontSize: '11px', width: '11px', height: '11px' }}
            >
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Reg ID / Part Name / Line / Part No..."
              className="pl-7 pr-2.5 py-1.5 bg-gray-50 hover:bg-gray-100/70 border border-gray-300 rounded-lg w-full text-[10px] outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-medium transition-all"
            />
          </div>
        </div>

        {/* Tab Switcher Ringkas */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('MANAGEMENT')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'MANAGEMENT'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span className="material-symbols-outlined text-xs">tune</span>
              <span>Data Jig &amp; Stok</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'HISTORY'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span className="material-symbols-outlined text-xs">history</span>
              <span>Riwayat Part</span>
              {replacementLogs.length > 0 && (
                <span className="ml-1 bg-blue-600 text-white text-[8px] px-1 py-0.2 rounded-full font-mono">
                  {replacementLogs.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* TAB 1: DATA JIG & KOMPONEN (MANAGEMENT) */}
      {activeTab === 'MANAGEMENT' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Filter Bar (1 Baris Ringkas Konsisten Master Drawing) */}
          <div className="grid grid-cols-4 gap-2 bg-gray-50 p-2 rounded-xl mb-3 border border-gray-150 text-[9px] font-semibold text-gray-600 shrink-0">
            {/* Line Filter */}
            <div>
              <label className="block text-[8px] text-gray-400 mb-0.5 uppercase">Line Produksi</label>
              <select
                value={lineFilter}
                onChange={(e) => setLineFilter(e.target.value)}
                className="w-full border border-gray-300 bg-white rounded p-1 text-[9px] outline-none"
              >
                <option value="All">Semua Line</option>
                {uniqueLines.filter((l) => l !== 'All').map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Stock Status Filter */}
            <div>
              <label className="block text-[8px] text-gray-400 mb-0.5 uppercase">Status Stok</label>
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value as any)}
                className="w-full border border-gray-300 bg-white rounded p-1 text-[9px] outline-none"
              >
                <option value="ALL">Semua Stok</option>
                <option value="GREEN">Aman (Stok &gt;= Min)</option>
                <option value="YELLOW">Low (Stok &lt; Min)</option>
                <option value="RED">Kritis (Stok 0)</option>
              </select>
            </div>

            {/* Lifetime Filter */}
            <div>
              <label className="block text-[8px] text-gray-400 mb-0.5 uppercase">Kondisi Lifetime</label>
              <select
                value={lifetimeFilter}
                onChange={(e) => setLifetimeFilter(e.target.value as any)}
                className="w-full border border-gray-300 bg-white rounded p-1 text-[9px] outline-none"
              >
                <option value="ALL">Semua Kondisi</option>
                <option value="SAFE">Aman</option>
                <option value="WARNING">Waspada (&gt;85% / &lt;35 hari)</option>
                <option value="OVERDUE">Jatuh Tempo (Perlu Ganti)</option>
              </select>
            </div>

            {/* Summary & Reset Filter */}
            <div className="flex items-end justify-between pb-0.5">
              <span className="text-[9px] text-gray-500 font-medium">
                Total: <strong>{filteredItems.length}</strong> Jig
              </span>
              {(lineFilter !== 'All' || stockStatusFilter !== 'ALL' || lifetimeFilter !== 'ALL' || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setLineFilter('All');
                    setStockStatusFilter('ALL');
                    setLifetimeFilter('ALL');
                    setSearch('');
                  }}
                  className="text-blue-600 hover:underline text-[9px] font-bold cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Main Datatable */}
          <div className="flex-1 overflow-x-auto overflow-y-auto no-scrollbar rounded-lg border border-gray-200 bg-white shadow-3xs">
            {loading ? (
              <div className="h-full flex flex-col justify-center items-center text-gray-400 text-xs py-12">
                <span className="material-symbols-outlined animate-spin text-2xl mb-1 text-blue-600">sync</span>
                <span>Memuat data Jig &amp; komponen...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-gray-400 text-xs py-12">
                <span className="material-symbols-outlined text-3xl mb-1 text-gray-300">search_off</span>
                <span>Tidak ada data Jig yang cocok.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-50/90 text-gray-500 font-semibold border-b border-gray-200 sticky top-0 z-10 text-[9px] uppercase tracking-wider whitespace-nowrap select-none">
                    <th className="px-2 py-2 w-[38px] text-center">No</th>
                    <th className="px-3 py-2 w-[150px]">No. Reg</th>
                    <th className="px-3 py-2 min-w-[180px]">Nama Jig &amp; Fixture</th>
                    <th className="px-2.5 py-2 w-[100px]">Line</th>
                    <th className="px-2.5 py-2 w-[90px]">OP (Process)</th>
                    <th className="px-3 py-2 text-right w-[75px]">Min</th>
                    <th className="px-3 py-2 text-right w-[75px]">Actual</th>
                    <th className="px-3 py-2 text-center w-[120px]">Lifetime / Siklus</th>
                    <th className="px-3 py-2 text-center w-[120px]">Terakhir Ganti Part</th>
                    {isPic && <th className="px-2 py-2 text-center w-[70px]">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="text-gray-700 divide-y divide-gray-100">
                  {filteredItems.map((item, idx) => {
                    const cellParts = item.cellParts || [];
                    const isExpanded = expandedRows.has(item.id);
                    const isRed = item.actualStock === 0;
                    const isYellow = item.actualStock > 0 && item.actualStock < item.minimumStock;

                    // Latest part renewal among its cellparts
                    let latestPartRenewal: string | null = null;
                    cellParts.forEach((cp) => {
                      const d = cp.lastRenewalDate || cp.installDate;
                      if (d && (!latestPartRenewal || new Date(d) > new Date(latestPartRenewal))) {
                        latestPartRenewal = d;
                      }
                    });

                    const statusBorderClass = isRed
                      ? 'border-l-[3.5px] border-l-rose-500'
                      : isYellow
                      ? 'border-l-[3.5px] border-l-amber-400'
                      : 'border-l-[3.5px] border-l-emerald-500';

                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          onClick={() => cellParts.length > 0 && toggleExpand(item.id)}
                          className={`hover:bg-blue-50/40 transition-colors ${
                            cellParts.length > 0 ? 'cursor-pointer' : ''
                          } ${isExpanded ? 'bg-blue-50/20' : ''}`}
                        >
                          {/* No */}
                          <td className={`px-2 py-2 text-center font-semibold text-gray-400 ${statusBorderClass}`}>
                            {idx + 1}
                          </td>

                          {/* No Reg */}
                          <td className="px-3 py-2 font-mono font-bold text-blue-650 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {cellParts.length > 0 && (
                                <span
                                  className={`material-symbols-outlined text-[13px] text-blue-600 transition-transform ${
                                    isExpanded ? 'rotate-90' : ''
                                  }`}
                                >
                                  chevron_right
                                </span>
                              )}
                              <span>{item.noReg}</span>
                              {cellParts.length > 0 && (
                                <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full font-bold">
                                  {cellParts.length} CP
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Assy Part Name */}
                          <td className="px-3 py-2 font-medium text-gray-900" title={item.assyPartName}>
                            <span className="truncate block max-w-sm">{item.assyPartName}</span>
                          </td>

                          {/* Line */}
                          <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap text-[9.5px]">
                            {item.lineProduct || '-'}
                          </td>

                          {/* Process */}
                          <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap text-[9.5px]">
                            {item.process || '-'}
                          </td>

                          {/* Min Stock */}
                          <td className="px-3 py-2 text-right font-mono font-semibold text-gray-500 whitespace-nowrap">
                            {item.minimumStock}
                          </td>

                          {/* Actual Stock */}
                          <td
                            className={`px-3 py-2 text-right font-mono font-bold whitespace-nowrap ${
                              isRed ? 'text-rose-600' : isYellow ? 'text-amber-600' : 'text-gray-800'
                            }`}
                          >
                            {item.actualStock}
                          </td>

                          {/* Lifetime Induk */}
                          <td className="px-3 py-2 text-center whitespace-nowrap font-mono text-[9px]">
                            <div className="flex items-center justify-center gap-1">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  item.lifetimeStatus === 'OVERDUE'
                                    ? 'bg-rose-500'
                                    : item.lifetimeStatus === 'WARNING'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                              />
                              <span>
                                {item.currentUsage || 0}/{item.maxUsage || 500}x
                              </span>
                              <span className="text-gray-400">({item.lifetimeDays || 180} hr)</span>
                            </div>
                          </td>

                          {/* Terakhir Ganti Part */}
                          <td className="px-3 py-2 text-center whitespace-nowrap text-[9px] text-gray-600">
                            {formatLastRenewal(latestPartRenewal)}
                          </td>

                          {/* Aksi */}
                          {isPic && (
                            <td className="px-2 py-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleOpenJigEdit(item)}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-blue-100/70 text-blue-600 transition-colors cursor-pointer"
                                title="Atur Stok & Lifetime Jig"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                            </td>
                          )}
                        </tr>

                        {/* Expandable Sub-Row: Komponen CellParts */}
                        {isExpanded && cellParts.length > 0 && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={isPic ? 10 : 9} className="px-4 py-2.5">
                              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-150">
                                  <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-blue-600 text-xs">account_tree</span>
                                    <span className="text-[9.5px] font-bold text-gray-700">
                                      Komponen CellParts — {item.noReg}
                                    </span>
                                  </div>
                                  <span className="text-[8.5px] text-gray-400">
                                    {cellParts.length} komponen terdaftar
                                  </span>
                                </div>
                                <table className="w-full text-[10px]">
                                  <thead>
                                    <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-150 text-[9px] uppercase tracking-wider">
                                      <th className="px-3 py-1.5 text-left w-[140px]">Part No</th>
                                      <th className="px-3 py-1.5 text-left">Nama Komponen</th>
                                      <th className="px-3 py-1.5 text-right w-[80px]">Min</th>
                                      <th className="px-3 py-1.5 text-right w-[80px]">Actual</th>
                                      <th className="px-3 py-1.5 text-center w-[120px]">Masa Pakai</th>
                                      <th className="px-3 py-1.5 text-left w-[140px]">Terakhir Diganti</th>
                                      {isPic && <th className="px-3 py-1.5 text-center w-[120px]">Aksi</th>}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {cellParts.map((cp) => {
                                      const cpRed = cp.actualStock === 0;
                                      const cpYellow = cp.actualStock > 0 && cp.actualStock < cp.minimumStock;

                                      return (
                                        <tr key={cp.id} className="hover:bg-gray-50/60 transition-colors">
                                          <td className="px-3 py-1.5 font-mono font-bold text-gray-800 whitespace-nowrap">
                                            {cp.partNumber}
                                          </td>
                                          <td className="px-3 py-1.5 text-gray-700 font-medium">
                                            {cp.name}
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono font-medium text-gray-500">
                                            {cp.minimumStock}
                                          </td>
                                          <td
                                            className={`px-3 py-1.5 text-right font-mono font-bold ${
                                              cpRed ? 'text-red-600' : cpYellow ? 'text-yellow-600' : 'text-gray-800'
                                            }`}
                                          >
                                            {cp.actualStock}
                                          </td>
                                          <td className="px-3 py-1.5 text-center font-mono text-[9px]">
                                            <div className="flex items-center justify-center gap-1">
                                              <span
                                                className={`w-1.5 h-1.5 rounded-full ${
                                                  cp.lifetimeStatus === 'OVERDUE'
                                                    ? 'bg-rose-500'
                                                    : cp.lifetimeStatus === 'WARNING'
                                                    ? 'bg-amber-500'
                                                    : 'bg-emerald-500'
                                                }`}
                                              />
                                              <span>
                                                {cp.currentUsage || 0}/{cp.maxUsage || 500}x
                                              </span>
                                              <span className="text-gray-400">({cp.lifetimeDays || 180} hr)</span>
                                            </div>
                                          </td>
                                          <td className="px-3 py-1.5 text-[9px] text-gray-600 whitespace-nowrap">
                                            {formatLastRenewal(cp.lastRenewalDate, cp.installDate)}
                                          </td>
                                          {isPic && (
                                            <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                              <div className="flex items-center justify-center gap-1">
                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenReplace(item.noReg, cp)}
                                                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[8.5px] flex items-center gap-0.5 cursor-pointer"
                                                  title="Ganti Part Baru &amp; Reset Siklus"
                                                >
                                                  <span className="material-symbols-outlined text-[10px]">autorenew</span>
                                                  <span>Ganti Part</span>
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenCpEdit(item.noReg, cp)}
                                                  className="p-1 rounded hover:bg-blue-100 text-blue-600 cursor-pointer"
                                                  title="Edit Stok &amp; Lifetime Part"
                                                >
                                                  <span className="material-symbols-outlined text-[14px]">tune</span>
                                                </button>
                                              </div>
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: RIWAYAT PERGANTIAN PART (HISTORICAL) */}
      {activeTab === 'HISTORY' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between pb-2 text-[10px] text-gray-500">
            <span>
              Total <strong>{filteredHistory.length}</strong> rekam jejak pergantian part
            </span>
          </div>
          <div className="flex-1 overflow-x-auto overflow-y-auto no-scrollbar rounded-lg border border-gray-200 bg-white shadow-3xs">
            {loadingHistory ? (
              <div className="h-full flex flex-col justify-center items-center text-gray-400 text-xs py-12">
                <span className="material-symbols-outlined animate-spin text-2xl mb-1 text-blue-600">sync</span>
                <span>Memuat riwayat pergantian part...</span>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-gray-400 text-xs py-12">
                <span className="material-symbols-outlined text-3xl mb-1 text-gray-300">history_toggle_off</span>
                <span>Belum ada riwayat pergantian part yang tercatat.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-50/90 text-gray-500 font-semibold border-b border-gray-200 sticky top-0 z-10 text-[9px] uppercase tracking-wider whitespace-nowrap select-none">
                    <th className="px-2 py-2 w-[38px] text-center">No</th>
                    <th className="px-3 py-2 w-[110px]">Tanggal Ganti</th>
                    <th className="px-3 py-2 w-[130px]">Part Number</th>
                    <th className="px-3 py-2 min-w-[160px]">Nama Komponen</th>
                    <th className="px-3 py-2 w-[130px]">Induk Jig</th>
                    <th className="px-2.5 py-2 w-[110px]">PIC Eksekutor</th>
                    <th className="px-3 py-2 min-w-[180px]">Alasan Pergantian</th>
                    <th className="px-3 py-2 w-[140px]">Catatan</th>
                    {isPic && <th className="px-2 py-2 text-center w-[50px]">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="text-gray-700 divide-y divide-gray-100">
                  {filteredHistory.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-2 py-2 text-center font-semibold text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono text-gray-800 whitespace-nowrap">
                        {new Date(log.replacedAt).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-blue-650 whitespace-nowrap">
                        {log.partNumber}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">{log.partName}</td>
                      <td className="px-3 py-2 font-mono text-[9.5px] text-gray-600 whitespace-nowrap">
                        {log.design.noReg}
                      </td>
                      <td className="px-2.5 py-2 font-medium text-gray-700 whitespace-nowrap">
                        {log.replacedBy}
                      </td>
                      <td className="px-3 py-2 text-gray-800">{log.reason}</td>
                      <td className="px-3 py-2 text-gray-500 italic text-[9.5px]">
                        {log.notes || '-'}
                      </td>
                      {isPic && (
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteHistoryLog(log.id)}
                            className="text-gray-400 hover:text-red-600 p-1 rounded"
                            title="Hapus Log Riwayat"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: ATUR STOK & LIFETIME JIG INDUK */}
      {editingJig && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[95]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            <div className="p-3.5 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-sm">tune</span>
                Atur Stok &amp; Lifetime Jig ({editingJig.noReg})
              </h3>
              <button
                type="button"
                onClick={() => setEditingJig(null)}
                className="text-gray-400 hover:text-gray-600 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveJigEdit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Min Stock Limit</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full mt-1 border border-gray-300 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500"
                    value={jigMinStock}
                    onChange={(e) => setJigMinStock(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Actual Stock</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full mt-1 border border-gray-300 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500"
                    value={jigActStock}
                    onChange={(e) => setJigActStock(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Batas Siklus (Max Usage)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full mt-1 border border-gray-300 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500"
                    value={jigMaxUsage}
                    onChange={(e) => setJigMaxUsage(parseInt(e.target.value) || 500)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Target Lifetime (Hari)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full mt-1 border border-gray-300 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500"
                    value={jigLifetimeDays}
                    onChange={(e) => setJigLifetimeDays(parseInt(e.target.value) || 180)}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase">Lifecycle Status</label>
                <select
                  className="w-full mt-1 border border-gray-300 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500 cursor-pointer"
                  value={jigLifecycle}
                  onChange={(e) => setJigLifecycle(e.target.value)}
                >
                  <option value="ACTIVE">Active (Siap Pakai)</option>
                  <option value="UNDER_REPAIR">Under Repair (Perbaikan)</option>
                  <option value="UNDER_IMPROVEMENT">Under Improvement</option>
                  <option value="OBSOLETE">Obsolete</option>
                  <option value="SCRAP">Scrap</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setEditingJig(null)}
                  className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ATUR STOK & LIFETIME CELLPART */}
      {editingCp && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[95]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            <div className="p-3.5 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-sm">tune</span>
                Atur Part ({editingCp.cp.partNumber})
              </h3>
              <button
                type="button"
                onClick={() => setEditingCp(null)}
                className="text-gray-400 hover:text-gray-600 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCpEdit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Min Stock Limit</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full mt-1 border border-gray-300 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500"
                    value={cpMinStock}
                    onChange={(e) => setCpMinStock(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Actual Stock</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full mt-1 border border-gray-300 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500"
                    value={cpActStock}
                    onChange={(e) => setCpActStock(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Batas Siklus (Max Usage)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full mt-1 border border-gray-300 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500"
                    value={cpMaxUsage}
                    onChange={(e) => setCpMaxUsage(parseInt(e.target.value) || 500)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Target Lifetime (Hari)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full mt-1 border border-gray-300 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500"
                    value={cpLifetimeDays}
                    onChange={(e) => setCpLifetimeDays(parseInt(e.target.value) || 180)}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setEditingCp(null)}
                  className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GANTI PART BARU (RECORD REPLACEMENT) */}
      {replacingCp && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[95]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            <div className="p-3.5 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-600 text-sm">autorenew</span>
                Ganti Part Baru — {replacingCp.cp.partNumber}
              </h3>
              <button
                type="button"
                onClick={() => setReplacingCp(null)}
                className="text-gray-400 hover:text-gray-600 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReplacement} className="p-4 space-y-3">
              <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg text-xs">
                <div className="font-bold text-blue-900">{replacingCp.cp.name}</div>
                <div className="text-[10px] text-blue-700 mt-0.5">
                  Induk: <strong>{replacingCp.parentNoReg}</strong> · Siklus pemakaian saat ini: <strong>{replacingCp.cp.currentUsage || 0}x</strong>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase">Tanggal Pergantian</label>
                <input
                  type="date"
                  required
                  className="w-full mt-1 border border-gray-300 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500"
                  value={replaceDate}
                  onChange={(e) => setReplaceDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase">PIC Eksekutor</label>
                <input
                  type="text"
                  required
                  className="w-full mt-1 border border-gray-300 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500"
                  value={replacePic}
                  onChange={(e) => setReplacePic(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase">Alasan Pergantian</label>
                <select
                  className="w-full mt-1 border border-gray-300 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500 cursor-pointer"
                  value={replaceReason}
                  onChange={(e) => setReplaceReason(e.target.value)}
                >
                  <option value="Keausan Pemakaian (Aus Normal)">Keausan Pemakaian (Aus Normal)</option>
                  <option value="Patah / Retak (Fatigue)">Patah / Retak (Fatigue)</option>
                  <option value="Deformasi Dimensi (Out of Spec)">Deformasi Dimensi (Out of Spec)</option>
                  <option value="Preventive Renewal (Jatuh Tempo TPM)">Preventive Renewal (Jatuh Tempo TPM)</option>
                  <option value="Modifikasi / Upgrade Material">Modifikasi / Upgrade Material</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  className="w-full mt-1 border border-gray-300 rounded-lg p-2 text-xs outline-none focus:border-blue-500"
                  placeholder="Kondisi part bekas, penyebab aus, dll..."
                  value={replaceNotes}
                  onChange={(e) => setReplaceNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setReplacingCp(null)}
                  className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  {submitting ? 'Menyimpan...' : 'Konfirmasi Ganti Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JigManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-6 bg-white">
          <div className="text-center">
            <span className="material-symbols-outlined animate-spin text-2xl text-blue-600">sync</span>
            <p className="text-xs text-gray-500 mt-2 font-medium">Memuat Jig Management...</p>
          </div>
        </div>
      }
    >
      <JigManagementContent />
    </Suspense>
  );
}
