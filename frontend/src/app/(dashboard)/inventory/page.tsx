'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { canEdit } from '@/lib/rbac';
import { fetchMasterList, renewCellPart, renewDesign, recordUsage } from '@/lib/api/phase3';

interface CellPartInfo {
  id: string;
  partNumber: string;
  name: string;
  lifetimeDays: number;
  dueDate: string;
  daysRemaining: number;
  lifetimeStatus: 'OVERDUE' | 'WARNING' | 'SAFE';
  minimumStock: number;
  actualStock: number;
  lifetimeType?: 'DUAL' | 'USAGE' | 'DAYS';
  maxUsage?: number;
  currentUsage?: number;
  usageRemaining?: number;
  usagePercent?: number;
  dayStatus?: 'OVERDUE' | 'WARNING' | 'SAFE';
  usageStatus?: 'OVERDUE' | 'WARNING' | 'SAFE';
  triggerReason?: 'DAYS' | 'USAGE' | 'BOTH' | 'NONE';
}

export default function InventoryPage() {
  const { items, user, isLoading, reloadData } = useApp();
  const router = useRouter();

  const [cellPartsMap, setCellPartsMap] = useState<Record<string, CellPartInfo[]>>({});
  const [masterItemMap, setMasterItemMap] = useState<Record<string, any>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !canEdit(user?.role)) {
      router.replace('/design');
    }
  }, [isLoading, user, router]);

  const loadMasterData = async () => {
    try {
      const masterList = await fetchMasterList();
      const map: Record<string, CellPartInfo[]> = {};
      const itemMap: Record<string, any> = {};
      masterList.forEach((item: any) => {
        itemMap[item.id] = item;
        if (item.cellParts && item.cellParts.length > 0) {
          map[item.id] = item.cellParts;
        }
      });
      setCellPartsMap(map);
      setMasterItemMap(itemMap);
    } catch (e) {
      console.error('Failed to load cellParts & master data:', e);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  const isPic = !isLoading && canEdit(user?.role);
  const [search, setSearch] = useState('');
  const [lineFilter, setLineFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveUsage = async () => {
    if (!usageTarget) return;
    setSubmitting(true);
    try {
      await recordUsage(usageTarget.target, usageTarget.id, usageAmountInput, usageMode);
      setToast({
        type: 'success',
        msg: `Pemakaian ${usageTarget.noRegOrPart} berhasil dicatat (${usageMode === 'ADD' ? `+${usageAmountInput}` : `set ${usageAmountInput}`}x)!`,
      });
      setShowUsageModal(false);
      setUsageTarget(null);
      await loadMasterData();
      if (reloadData) await reloadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal mencatat pemakaian.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRenew = async () => {
    if (!renewTarget) return;
    setSubmitting(true);
    try {
      if (renewTarget.target === 'design') {
        await renewDesign(renewTarget.id, {
          resetDays: renewResetDays,
          resetUsage: renewResetUsage,
        });
      } else {
        await renewCellPart(renewTarget.id, {
          resetDays: renewResetDays,
          resetUsage: renewResetUsage,
        });
      }
      setToast({
        type: 'success',
        msg: `Lifetime ${renewTarget.noRegOrPart} berhasil diperbarui (Renew)!`,
      });
      setShowRenewModal(false);
      setRenewTarget(null);
      await loadMasterData();
      if (reloadData) await reloadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal memperbarui lifetime.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const searchTerms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matchesSearch = searchTerms.every((term) => {
      return (
        item.noReg.toLowerCase().includes(term) ||
        item.assyPartName.toLowerCase().includes(term) ||
        item.lineProduct.toLowerCase().includes(term) ||
        item.process.toLowerCase().includes(term)
      );
    });

    const matchesLine = lineFilter === 'All' || item.lineProduct === lineFilter;

    let matchesStatus = true;
    if (statusFilter === 'GREEN') {
      matchesStatus = item.actualStock >= item.minimumStock && item.actualStock > 0;
    } else if (statusFilter === 'YELLOW') {
      matchesStatus = item.actualStock > 0 && item.actualStock < item.minimumStock;
    } else if (statusFilter === 'RED') {
      matchesStatus = item.actualStock === 0;
    }

    return matchesSearch && matchesLine && matchesStatus;
  });

  const greenItems = items.filter((i) => i.actualStock >= i.minimumStock && i.actualStock > 0).length;
  const yellowItems = items.filter((i) => i.actualStock > 0 && i.actualStock < i.minimumStock).length;
  const redItems = items.filter((i) => i.actualStock === 0).length;
  const uniqueLines = ['All', ...Array.from(new Set(items.map((i) => i.lineProduct)))];

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 pt-2 bg-white h-full overflow-hidden">
      {toast && (
        <div className={`fixed top-4 right-4 z-[99] px-4 py-2 rounded-lg text-xs font-bold shadow-lg ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <header className="h-12 flex justify-between items-center border-b border-gray-150 mb-3 shrink-0">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-blue-500 text-lg">inventory_2</span>
            Update Inventory &amp; 2-Way Lifetime
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]" style={{ fontSize: '10px' }}>search</span>
            <input
              className="pl-7 pr-3 py-1 bg-gray-100 border border-gray-400 rounded-full text-[10px] w-48 focus:ring-1 focus:ring-primary outline-none text-gray-700 placeholder-gray-500"
              placeholder="Search No.Reg, Part Name..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative flex items-center gap-1 text-[9px] text-gray-500 font-semibold border border-gray-200 rounded-full px-2 py-0.5 cursor-pointer hover:bg-gray-50">
            <span>Line: {lineFilter}</span>
            <span className="material-symbols-outlined text-[12px]">expand_more</span>
            <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer text-xs">
              {uniqueLines.map((line) => (<option key={line} value={line}>{line}</option>))}
            </select>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="flex gap-3 mb-3 h-14">
        <div onClick={() => setStatusFilter(statusFilter === 'GREEN' ? 'All' : 'GREEN')} className={`flex-1 rounded-xl px-3 py-1.5 flex items-center gap-3 shadow-sm border cursor-pointer transition-all ${statusFilter === 'GREEN' ? 'bg-green-500/10 border-green-500' : 'bg-white border-gray-200 hover:border-green-500/30'}`}>
          <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-green-500 text-base">check_circle</span></div>
          <div><p className="text-[9px] text-gray-500 leading-none mb-0.5">Aman (Green)</p><h3 className="text-base font-bold text-gray-800 leading-none">{greenItems} <span className="text-[9px] font-normal text-gray-500">Items</span></h3></div>
        </div>
        <div onClick={() => setStatusFilter(statusFilter === 'YELLOW' ? 'All' : 'YELLOW')} className={`flex-1 rounded-xl px-3 py-1.5 flex items-center gap-3 shadow-sm border cursor-pointer transition-all ${statusFilter === 'YELLOW' ? 'bg-yellow-500/10 border-yellow-500' : 'bg-white border-gray-200 hover:border-yellow-500/30'}`}>
          <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-yellow-500 text-base">warning</span></div>
          <div><p className="text-[9px] text-gray-500 leading-none mb-0.5">Warning (Yellow)</p><h3 className="text-base font-bold text-gray-800 leading-none">{yellowItems} <span className="text-[9px] font-normal text-gray-500">Items</span></h3></div>
        </div>
        <div onClick={() => setStatusFilter(statusFilter === 'RED' ? 'All' : 'RED')} className={`flex-1 rounded-xl px-3 py-1.5 flex items-center gap-3 shadow-sm border cursor-pointer transition-all relative overflow-hidden ${statusFilter === 'RED' ? 'bg-red-500/10 border-red-500' : 'bg-white border-gray-200 hover:border-red-500/30'}`}>
          {redItems > 0 && <div className="absolute inset-0 bg-red-500/5 animate-pulse"></div>}
          <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center z-10 shrink-0"><span className="material-symbols-outlined text-white text-base">error</span></div>
          <div className="z-10"><p className="text-[9px] text-gray-500 leading-none mb-0.5">Critical/Stok 0</p><h3 className="text-base font-bold text-gray-800 leading-none">{redItems} <span className="text-[9px] font-normal text-gray-500">Items</span></h3></div>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-y-auto no-scrollbar rounded-lg border border-gray-200">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-500 font-semibold sticky top-0 z-10 border-b border-gray-200">
              <th className="px-3 py-2">No. Reg</th>
              <th className="px-2 py-2">Part Name</th>
              <th className="px-2 py-2">Line</th>
              <th className="px-2 py-2">Process</th>
              <th className="px-2 text-center py-2">Lifecycle</th>
              <th className="px-2 text-right py-2">Min Stock</th>
              <th className="px-2 text-right py-2">Actual</th>
              <th className="px-2 text-center py-2">Lifetime (2-Way)</th>
              <th className="px-2 text-center py-2">Status</th>
              {isPic && <th className="px-2 text-center py-2">Action</th>}
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {filteredItems.map((item) => {
              const isRed = item.actualStock === 0;
              const isYellow = item.actualStock > 0 && item.actualStock < item.minimumStock;
              const cellParts = cellPartsMap[item.id] || [];
              const isExpanded = expandedRows.has(item.id);

              const m = masterItemMap[item.id] || item;
              const lifetimeType = m.lifetimeType || 'DUAL';
              const currentUsage = m.currentUsage ?? 0;
              const maxUsage = m.maxUsage ?? 500;
              const daysRemaining = m.daysRemaining ?? 180;
              const status = m.lifetimeStatus || (daysRemaining <= 0 || currentUsage >= maxUsage ? 'OVERDUE' : (daysRemaining <= 35 || currentUsage >= maxUsage * 0.85) ? 'WARNING' : 'SAFE');
              const isOverdue = status === 'OVERDUE';
              const isWarning = status === 'WARNING';

              return (
                <React.Fragment key={item.id}>
                  <tr
                    onClick={() => cellParts.length > 0 ? toggleExpand(item.id) : undefined}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isRed ? 'border-red-100 bg-red-50 hover:bg-red-100/60' : ''} ${cellParts.length > 0 ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-blue-50/30' : ''}`}
                  >
                    <td className={`px-3 font-normal font-mono py-2 ${isRed ? 'text-red-700' : ''}`}>
                      <div className="flex items-center gap-1">
                        {cellParts.length > 0 && (
                          <span className={`material-symbols-outlined text-[10px] transition-transform ${isExpanded ? 'rotate-90' : ''} text-blue-500`}>chevron_right</span>
                        )}
                        {item.noReg}
                        {cellParts.length > 0 && (
                          <span className="text-[7px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded-full font-bold">{cellParts.length}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 flex items-center gap-1.5">
                      <div className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-gray-400 text-xs">view_in_ar</span>
                      </div>
                      <span className="truncate max-w-[150px] font-medium">{item.assyPartName}</span>
                    </td>
                    <td className="px-2 text-gray-500 py-2">{item.lineProduct}</td>
                    <td className="px-2 text-gray-500 py-2">{item.process}</td>
                    <td className="px-2 text-center py-2">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${item.lifecycleStatus === 'UNDER_REPAIR' ? 'bg-orange-100 text-orange-700' : item.lifecycleStatus === 'UNDER_IMPROVEMENT' ? 'bg-blue-100 text-blue-700' : item.lifecycleStatus === 'OBSOLETE' ? 'bg-gray-100 text-gray-700' : item.lifecycleStatus === 'SCRAP' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {item.lifecycleStatus || 'ACTIVE'}
                      </span>
                    </td>
                    <td className={`px-2 text-right py-2 ${isRed ? 'text-red-700 font-semibold' : ''}`}>{item.minimumStock}</td>
                    <td className={`px-2 text-right font-bold py-2 ${isRed ? 'text-red-600' : isYellow ? 'text-yellow-600' : ''}`}>{item.actualStock}</td>
                    
                    {/* Lifetime 2-Way Column */}
                    <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full font-mono ${
                            isOverdue
                              ? 'bg-rose-100 text-rose-700 border border-rose-300'
                              : isWarning
                              ? 'bg-amber-100 text-amber-700 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                          }`}
                        >
                          {isOverdue
                            ? 'OVERDUE (Aus)'
                            : lifetimeType === 'DAYS'
                            ? `${daysRemaining}d`
                            : lifetimeType === 'USAGE'
                            ? `${currentUsage}/${maxUsage}x`
                            : `${currentUsage}/${maxUsage}x · ${daysRemaining}d`}
                        </span>
                        {isPic && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setUsageTarget({
                                  target: 'design',
                                  id: item.id,
                                  noRegOrPart: item.noReg,
                                  name: item.assyPartName,
                                  currentUsage,
                                  maxUsage,
                                });
                                setUsageAmountInput(50);
                                setUsageMode('ADD');
                                setShowUsageModal(true);
                              }}
                              className="text-[7.5px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-1 py-0.2 rounded border border-blue-200 cursor-pointer"
                              title="Catat Pemakaian Siklus"
                            >
                              + Catat
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRenewTarget({
                                  target: 'design',
                                  id: item.id,
                                  noRegOrPart: item.noReg,
                                  name: item.assyPartName,
                                });
                                setRenewResetDays(true);
                                setRenewResetUsage(true);
                                setShowRenewModal(true);
                              }}
                              className="text-[7.5px] font-bold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-1 py-0.2 rounded border border-amber-200 cursor-pointer"
                              title="Renew Lifetime"
                            >
                              Renew
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className={`px-2 py-2 text-center font-bold text-[9px] uppercase tracking-wider ${isRed ? 'bg-red-500 text-white' : isYellow ? 'bg-yellow-400 text-yellow-950' : 'bg-green-500 text-white'}`}>
                      {isRed ? 'Critical' : isYellow ? 'Warning' : 'Aman'}
                    </td>
                    {isPic && (
                      <td className="px-2 text-center py-2" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/inventory/${item.id}`} className="text-primary hover:text-blue-600">
                          <span className="material-symbols-outlined text-sm font-semibold text-blue-500 hover:text-blue-700">edit</span>
                        </Link>
                      </td>
                    )}
                  </tr>

                  {isExpanded && cellParts.length > 0 && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={isPic ? 10 : 9} className="px-4 py-2">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-150">
                            <span className="material-symbols-outlined text-blue-600 text-xs">account_tree</span>
                            <span className="text-[9px] font-bold text-gray-700">CellParts — {item.noReg}</span>
                          </div>
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-150">
                                <th className="px-3 py-1 text-left">Part No</th>
                                <th className="px-2 py-1 text-left">Nama</th>
                                <th className="px-2 py-1 text-center">Min</th>
                                <th className="px-2 py-1 text-center">Act</th>
                                <th className="px-2 py-1 text-center">Stock</th>
                                <th className="px-2 py-1 text-center">Lifetime (2-Way)</th>
                                <th className="px-2 py-1 text-center">Due Date</th>
                                {isPic && <th className="px-2 py-1 text-center">Aksi</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {cellParts.map((cp) => {
                                const cpRed = cp.actualStock === 0;
                                const cpYellow = cp.actualStock > 0 && cp.actualStock < cp.minimumStock;
                                return (
                                  <tr key={cp.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                                    <td className="px-3 py-1 font-mono font-bold text-gray-800">{cp.partNumber}</td>
                                    <td className="px-2 py-1 text-gray-700 font-medium">{cp.name}</td>
                                    <td className="px-2 py-1 text-center text-gray-500">{cp.minimumStock}</td>
                                    <td className={`px-2 py-1 text-center font-bold ${cpRed ? 'text-red-600' : cpYellow ? 'text-yellow-600' : 'text-gray-700'}`}>{cp.actualStock}</td>
                                    <td className="px-2 py-1 text-center">
                                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${cpRed ? 'bg-red-100 text-red-700' : cpYellow ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                        {cpRed ? 'Critical' : cpYellow ? 'Warning' : 'Aman'}
                                      </span>
                                    </td>
                                    <td className="px-2 py-1 text-center">
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span
                                          className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full font-mono ${
                                            cp.lifetimeStatus === 'OVERDUE'
                                              ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                              : cp.lifetimeStatus === 'WARNING'
                                              ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                              : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                          }`}
                                        >
                                          {cp.lifetimeStatus === 'OVERDUE'
                                            ? 'OVERDUE (Aus)'
                                            : cp.lifetimeType === 'DAYS'
                                            ? `${cp.daysRemaining}d`
                                            : cp.lifetimeType === 'USAGE'
                                            ? `${cp.currentUsage ?? 0}/${cp.maxUsage ?? 500}x`
                                            : `${cp.currentUsage ?? 0}/${cp.maxUsage ?? 500}x · ${cp.daysRemaining}d`}
                                        </span>
                                        {isPic && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setUsageTarget({
                                                target: 'cell-part',
                                                id: cp.id,
                                                noRegOrPart: cp.partNumber,
                                                name: cp.name,
                                                currentUsage: cp.currentUsage ?? 0,
                                                maxUsage: cp.maxUsage ?? 500,
                                              });
                                              setUsageAmountInput(50);
                                              setUsageMode('ADD');
                                              setShowUsageModal(true);
                                            }}
                                            className="text-[7.5px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-1 rounded border border-blue-200 mt-0.5 cursor-pointer"
                                          >
                                            + Catat
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-2 py-1 text-center text-gray-500 text-[9px]">
                                      {cp.dueDate ? new Date(cp.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                    </td>
                                    {isPic && (
                                      <td className="px-2 py-1 text-center">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setRenewTarget({
                                              target: 'cell-part',
                                              id: cp.id,
                                              noRegOrPart: cp.partNumber,
                                              name: cp.name,
                                            });
                                            setRenewResetDays(true);
                                            setRenewResetUsage(true);
                                            setShowRenewModal(true);
                                          }}
                                          className="text-amber-600 hover:text-amber-700 transition-colors cursor-pointer p-0.5 hover:bg-amber-50 rounded"
                                          title="Renew Lifetime (Reset opsi)"
                                        >
                                          <span className="material-symbols-outlined text-[14px]">autorenew</span>
                                        </button>
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
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={isPic ? 10 : 9} className="text-center py-12 text-gray-400 text-xs">
                  No inventory items match current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* QUICK MODAL: LOG / RECORD USAGE */}
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
                  <p className="text-[9px] text-gray-500">Update siklus kerja jig untuk pelacakan keausan fisik</p>
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

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Target Item Card */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
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
                <div className="flex items-center justify-between pt-1 text-[10px] text-gray-600">
                  <span>Pemakaian Saat Ini:</span>
                  <span className="font-mono font-bold text-gray-800">
                    {usageTarget.currentUsage} / {usageTarget.maxUsage}x
                  </span>
                </div>
              </div>

              {/* Input Mode Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs">
                <button
                  type="button"
                  onClick={() => setUsageMode('ADD')}
                  className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    usageMode === 'ADD' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  + Tambah Siklus
                </button>
                <button
                  type="button"
                  onClick={() => setUsageMode('SET')}
                  className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    usageMode === 'SET' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Set Counter Total
                </button>
              </div>

              {/* Quick Presets for ADD mode */}
              {usageMode === 'ADD' && (
                <div>
                  <div className="text-[9px] font-bold text-gray-500 mb-1.5 uppercase">Quick Preset:</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[10, 25, 50, 100, 200].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setUsageAmountInput(preset)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          usageAmountInput === preset
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
                        }`}
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Field */}
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1">
                  {usageMode === 'ADD' ? 'Jumlah Pemakaian yang Ditambahkan:' : 'Set Nilai Counter Pemakaian:'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
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
                  disabled={submitting || usageAmountInput < 0}
                  onClick={handleSaveUsage}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
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

              <p className="text-[10px] text-gray-600 leading-relaxed">
                Pilih opsi parameter yang ingin di-reset ke kondisi awal:
              </p>

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
                  disabled={submitting || (!renewResetDays && !renewResetUsage)}
                  onClick={handleConfirmRenew}
                  className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
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
    </div>
  );
}
