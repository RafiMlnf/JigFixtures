'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useApp, JigFixtureItem, ApprovalItem } from '@/context/AppContext';
import { fetchMasterList, fetchCellPartReminders, renewCellPart } from '@/lib/api/phase3';
import { canApprove } from '@/lib/rbac';

interface LifetimeItem {
  id: string;
  noReg: string;
  assyPartName: string;
  lineProduct: string;
  process: string;
  type: string;
  designDate: string | null;
  dueDate: string;
  daysRemaining: number;
  lifetimePercent: number;
  status: 'SAFE' | 'WARNING' | 'OVERDUE';
  actualStock: number;
  minimumStock: number;
  lifetimeType?: 'DUAL' | 'USAGE' | 'DAYS';
  maxUsage?: number;
  currentUsage?: number;
  usagePercent?: number;
}

export default function DashboardPage() {
  const { user, items, approvals, isLoading: isAppLoading, processApproval } = useApp();
  const userCanApprove = canApprove(user?.role);

  const [masterList, setMasterList] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Center card states (Highlight Tasks & Approvals)
  const [taskFilter, setTaskFilter] = useState<'ALL' | 'WAITING' | 'DESIGN_REV' | 'INVENTORY_UPDATE'>('WAITING');
  const [taskSearch, setTaskSearch] = useState('');

  // Right card states (Due Date & Life Time)
  const [lifetimeFilter, setLifetimeFilter] = useState<'ALL' | 'WARNING_OVERDUE' | 'SAFE'>('ALL');
  const [lifetimeSearch, setLifetimeSearch] = useState('');
  const [selectedLine, setSelectedLine] = useState('All');

  // Left card states (CellPart Lifetime Reminders ≤5 Minggu & Overdue)
  const [cellPartReminders, setCellPartReminders] = useState<any[]>([]);
  const [cellPartSearch, setCellPartSearch] = useState('');
  const [processingCpId, setProcessingCpId] = useState<string | null>(null);

  const loadCellPartReminders = async () => {
    try {
      const res = await fetchCellPartReminders();
      setCellPartReminders(res || []);
    } catch (err) {
      console.warn('Could not fetch cell part reminders', err);
    }
  };

  // Load backend master list if items in AppContext are empty
  useEffect(() => {
    async function loadMasterData() {
      setIsLoadingData(true);
      try {
        const [res, cpReminders] = await Promise.allSettled([
          fetchMasterList(),
          fetchCellPartReminders(),
        ]);
        if (res.status === 'fulfilled') setMasterList(res.value || []);
        if (cpReminders.status === 'fulfilled') setCellPartReminders(cpReminders.value || []);
      } catch (err) {
        console.warn('Using local context items for dashboard data', err);
      } finally {
        setIsLoadingData(false);
      }
    }

    loadMasterData();
  }, []);

  // Combined item list
  const displayItems: JigFixtureItem[] = useMemo(() => {
    if (items && items.length > 0) return items;
    if (masterList && masterList.length > 0) {
      return masterList.map((m, idx) => ({
        id: m.id,
        no: idx + 1,
        lineProduct: m.lineProduct || m.line?.lineName || '',
        process: m.process || m.process?.name || '',
        type: m.type || 'JF',
        noItemAssy: m.noItemAssy || m.noItem || '',
        assyPartName: m.assyPartName || '',
        noReg: m.noReg || '',
        qty: m.qty || '1',
        revStatus: m.revStatus || '0',
        minimumStock: m.inventory?.minimumStock ?? m.minimumStock ?? 1,
        actualStock: m.inventory?.actualStock ?? m.actualStock ?? 1,
        designDateNew: m.designDateNew || m.createdAt,
        designDateLast: m.designDateLast,
        lifecycleStatus: m.lifecycleStatus || 'ACTIVE',
        lifetimeDays: m.lifetimeDays,
        lifetimeType: m.lifetimeType,
        maxUsage: m.maxUsage,
        currentUsage: m.currentUsage,
        lifetimeStatus: m.lifetimeStatus,
        triggerReason: m.triggerReason,
      }));
    }
    return [];
  }, [items, masterList]);

  // Unique lines for filter dropdown
  const uniqueLines = useMemo(() => {
    const lines = Array.from(new Set(displayItems.map((i) => i.lineProduct).filter(Boolean)));
    return ['All', ...lines];
  }, [displayItems]);

  // Calculate Life Time & Due Date for each item (2-Way: Hari & Pemakaian aus 500x)
  const lifetimeItems: LifetimeItem[] = useMemo(() => {
    const now = new Date();

    return displayItems.map((item) => {
      const baseDateStr = item.designDateNew || item.designDateLast;
      const baseDate = baseDateStr ? new Date(baseDateStr) : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const cycleDays = (item as any).lifetimeDays || 180;
      const dueDate = new Date(baseDate.getTime() + cycleDays * 24 * 60 * 60 * 1000);

      const diffTime = dueDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Calculate percentage consumed (0% = new, 100% = due)
      const elapsedDays = cycleDays - daysRemaining;
      const lifetimePercent = Math.min(100, Math.max(0, Math.round((elapsedDays / cycleDays) * 100)));

      const maxUsage = (item as any).maxUsage ?? 500;
      const currentUsage = (item as any).currentUsage ?? 0;
      const usagePercent = maxUsage > 0 ? Math.round((currentUsage / maxUsage) * 100) : 0;
      const lifetimeType = (item as any).lifetimeType || 'DUAL';

      let status: 'SAFE' | 'WARNING' | 'OVERDUE' = 'SAFE';
      if ((item as any).lifetimeStatus) {
        status = (item as any).lifetimeStatus;
      } else {
        const isDayOverdue = daysRemaining <= 0;
        const isDayWarning = daysRemaining <= 35;
        const isUsageOverdue = currentUsage >= maxUsage;
        const isUsageWarning = usagePercent >= 85 || (maxUsage - currentUsage) <= 50;

        if (lifetimeType === 'DAYS') {
          status = isDayOverdue ? 'OVERDUE' : isDayWarning ? 'WARNING' : 'SAFE';
        } else if (lifetimeType === 'USAGE') {
          status = isUsageOverdue ? 'OVERDUE' : isUsageWarning ? 'WARNING' : 'SAFE';
        } else {
          status = isDayOverdue || isUsageOverdue ? 'OVERDUE' : isDayWarning || isUsageWarning ? 'WARNING' : 'SAFE';
        }
      }

      return {
        id: item.id,
        noReg: item.noReg,
        assyPartName: item.assyPartName,
        lineProduct: item.lineProduct,
        process: item.process,
        type: item.type,
        designDate: baseDateStr ? new Date(baseDateStr).toLocaleDateString('id-ID') : null,
        dueDate: dueDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
        daysRemaining,
        lifetimePercent: lifetimeType === 'USAGE' ? usagePercent : lifetimeType === 'DAYS' ? lifetimePercent : Math.max(lifetimePercent, usagePercent),
        status,
        actualStock: item.actualStock,
        minimumStock: item.minimumStock,
        lifetimeType,
        maxUsage,
        currentUsage,
        usagePercent,
      };
    }).sort((a, b) => {
      const priority = { OVERDUE: 0, WARNING: 1, SAFE: 2 };
      if (priority[a.status] !== priority[b.status]) {
        return priority[a.status] - priority[b.status];
      }
      return a.daysRemaining - b.daysRemaining;
    });
  }, [displayItems]);

  // Filtered approvals / tasks for Center Card
  const filteredTasks: ApprovalItem[] = useMemo(() => {
    let list = approvals;

    if (taskFilter === 'WAITING') {
      list = list.filter((a) => a.status === 'WAITING');
    } else if (taskFilter === 'DESIGN_REV') {
      list = list.filter((a) => a.type === 'Design Rev');
    } else if (taskFilter === 'INVENTORY_UPDATE') {
      list = list.filter((a) => a.type === 'Inventory Update');
    }

    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase();
      list = list.filter(
        (a) =>
          a.noReg.toLowerCase().includes(q) ||
          a.itemName.toLowerCase().includes(q) ||
          a.author.toLowerCase().includes(q) ||
          (a.note && a.note.toLowerCase().includes(q))
      );
    }

    return list;
  }, [approvals, taskFilter, taskSearch]);

  // Filtered Due Date / Lifetime for Right Card
  const filteredLifetime = useMemo(() => {
    let list = lifetimeItems;

    if (selectedLine !== 'All') {
      list = list.filter((i) => i.lineProduct === selectedLine);
    }

    if (lifetimeFilter === 'WARNING_OVERDUE') {
      list = list.filter((i) => i.status === 'WARNING' || i.status === 'OVERDUE');
    } else if (lifetimeFilter === 'SAFE') {
      list = list.filter((i) => i.status === 'SAFE');
    }

    if (lifetimeSearch.trim()) {
      const q = lifetimeSearch.toLowerCase();
      list = list.filter(
        (i) =>
          i.noReg.toLowerCase().includes(q) ||
          i.assyPartName.toLowerCase().includes(q) ||
          i.lineProduct.toLowerCase().includes(q)
      );
    }

    return list;
  }, [lifetimeItems, selectedLine, lifetimeFilter, lifetimeSearch]);

  // Task summary statistics
  const taskStats = useMemo(() => {
    const total = approvals.length;
    const waiting = approvals.filter((a) => a.status === 'WAITING').length;
    const approved = approvals.filter((a) => a.status === 'APPROVED').length;
    const rejected = approvals.filter((a) => a.status === 'REJECTED').length;
    const designRevWaiting = approvals.filter((a) => a.type === 'Design Rev' && a.status === 'WAITING').length;
    const invWaiting = approvals.filter((a) => a.type === 'Inventory Update' && a.status === 'WAITING').length;

    return { total, waiting, approved, rejected, designRevWaiting, invWaiting };
  }, [approvals]);

  // Lifetime summary statistics
  const lifetimeStats = useMemo(() => {
    const overdue = lifetimeItems.filter((i) => i.status === 'OVERDUE').length;
    const warning = lifetimeItems.filter((i) => i.status === 'WARNING').length;
    const safe = lifetimeItems.filter((i) => i.status === 'SAFE').length;
    return { overdue, warning, safe, total: lifetimeItems.length };
  }, [lifetimeItems]);

  // CellPart Reminders summary statistics (≤5 minggu / 35 hari & Overdue)
  const cpStats = useMemo(() => {
    const overdue = cellPartReminders.filter((cp) => cp.lifetimeStatus === 'OVERDUE').length;
    const warning = cellPartReminders.filter((cp) => cp.lifetimeStatus === 'WARNING').length;
    return { overdue, warning, total: cellPartReminders.length };
  }, [cellPartReminders]);

  const filteredCpReminders = useMemo(() => {
    if (!cellPartSearch.trim()) return cellPartReminders;
    const q = cellPartSearch.toLowerCase().trim();
    return cellPartReminders.filter(
      (cp) =>
        (cp.partNumber && cp.partNumber.toLowerCase().includes(q)) ||
        (cp.name && cp.name.toLowerCase().includes(q)) ||
        (cp.parentNoReg && cp.parentNoReg.toLowerCase().includes(q)) ||
        (cp.parentName && cp.parentName.toLowerCase().includes(q))
    );
  }, [cellPartReminders, cellPartSearch]);

  const handleRenewCellPartItem = async (cpId: string, cpName: string) => {
    try {
      setProcessingCpId(cpId);
      await renewCellPart(cpId);
      setActionSuccessMsg(`Lifetime CellPart "${cpName}" berhasil di-renew!`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      await loadCellPartReminders();
    } catch (err: any) {
      alert(`Gagal me-renew CellPart: ${err.message || 'Error server'}`);
    } finally {
      setProcessingCpId(null);
    }
  };

  const currentDateStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const isLoading = isAppLoading || isLoadingData;

  const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const handleQuickDecision = async (taskId: string, action: 'APPROVE' | 'REJECT') => {
    if (!userCanApprove) {
      alert('Hanya Section Head atau Dept Head yang dapat menyetujui/menolak approval.');
      return;
    }
    try {
      setProcessingTaskId(taskId);
      await processApproval(taskId, action, action === 'APPROVE' ? 'Quick approval from dashboard' : 'Declined from dashboard');
      setActionSuccessMsg(`Task berhasil di-${action === 'APPROVE' ? 'setujui' : 'tolak'}.`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } catch (err: any) {
      const errMsg = err?.message || 'Error server';
      if (errMsg.toLowerCase().includes('section head') || errMsg.toLowerCase().includes('dept head')) {
        setActionSuccessMsg(null);
        alert('Tidak bisa proses: ' + errMsg);
      } else {
        alert(`Gagal memproses approval: ${errMsg}`);
      }
    } finally {
      setProcessingTaskId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 pt-2 bg-white h-full overflow-hidden">
      {/* Header controls with border-b divider */}
      <header className="h-12 flex justify-between items-center border-b border-gray-150 mb-3 shrink-0">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#0063ff] text-lg">dashboard</span>
            Dashboard Overview
          </h2>
        </div>
      </header>

      {/* Main Content Area (Scrollable) */}
      <div className="flex-1 overflow-y-auto pr-1">
        {/* Main 3 Cards Layout: KIRI (Area Informasi) | TENGAH (Tasks & Approval Simple) | KANAN (Reminder Lifetime & Stock) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start pb-2">

          {/* ========================================================================= */}
          {/* CARD 1: KIRI (xl:col-span-3) - Reminder Lifetime CellPart (≤5 Mgg)        */}
          {/* ========================================================================= */}
          <div className="xl:col-span-3 flex flex-col bg-white border border-blue-200/60 rounded-xl shadow-xs overflow-hidden h-[calc(100vh-140px)] min-h-[480px]">
            {/* Header Card Kiri */}
            <div className="h-8 px-2.5 bg-[#0063ff] text-white flex items-center justify-between shrink-0">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-white flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">notifications_active</span>
                Reminder CellPart
              </h2>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${cpStats.overdue > 0 ? 'bg-rose-500 text-white' : 'bg-white/20 text-white'}`}>
                {cpStats.total}
              </span>
            </div>

            {/* Content Container */}
            <div className="p-2 flex-1 flex flex-col gap-1.5 overflow-hidden">
              {/* Compact Metric Strip */}
              <div className="grid grid-cols-2 gap-1 shrink-0">
                <div className="flex items-center justify-between bg-rose-50/80 border border-rose-200/70 px-2 py-1 rounded-md">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span className="text-[8px] font-bold text-rose-700">Overdue</span>
                  </div>
                  <span className="text-[10px] font-black text-rose-800">{cpStats.overdue}</span>
                </div>
                <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200/70 px-2 py-1 rounded-md">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span className="text-[8px] font-bold text-amber-700">&le;5 Mgg</span>
                  </div>
                  <span className="text-[10px] font-black text-amber-800">{cpStats.warning}</span>
                </div>
              </div>

              {/* Quick Search */}
              <div className="relative w-full shrink-0">
                <span className="material-symbols-outlined text-[13px] text-slate-400 absolute left-2 top-1/2 -translate-y-1/2">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Cari part / parent..."
                  value={cellPartSearch}
                  onChange={(e) => setCellPartSearch(e.target.value)}
                  className="w-full pl-6 pr-2 py-0.5 bg-slate-50 border border-slate-200 rounded-md text-[10px] focus:ring-1 focus:ring-blue-500 outline-none text-slate-700 placeholder:text-slate-400"
                />
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                {isLoading ? (
                  <div className="h-28 flex flex-col items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined animate-spin text-lg text-blue-500 mb-1">sync</span>
                    <p className="text-[10px]">Memuat...</p>
                  </div>
                ) : filteredCpReminders.length === 0 ? (
                  <div className="h-28 flex flex-col items-center justify-center p-3 text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    <span className="material-symbols-outlined text-2xl text-emerald-500">verified</span>
                  </div>
                ) : (
                  filteredCpReminders.map((cp) => {
                    const isOverdue = cp.lifetimeStatus === 'OVERDUE';
                    const isProcessing = processingCpId === cp.id;

                    return (
                      <div
                        key={cp.id}
                        className={`border rounded-lg p-1.5 flex flex-col gap-1 transition-all shadow-3xs ${
                          isOverdue
                            ? 'bg-rose-50/40 border-rose-200 hover:bg-rose-50/70'
                            : 'bg-amber-50/30 border-amber-200 hover:bg-amber-50/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <span className="text-[8px] font-bold text-blue-650 font-mono block truncate">
                              Jig: {cp.parentNoReg || '-'}
                            </span>
                            <h4 className="text-[10px] font-bold text-slate-800 truncate leading-tight">
                              {cp.partNumber} &middot; {cp.name}
                            </h4>
                          </div>
                          <span
                            className={`text-[7px] font-bold px-1.5 py-0.2 rounded-full shrink-0 uppercase ${
                              isOverdue ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-amber-100 text-amber-700 border border-amber-300'
                            }`}
                          >
                            {isOverdue ? 'Overdue' : `${cp.daysRemaining}d`}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[9px] text-slate-500 pt-0.5 border-t border-slate-200/60">
                          <div className="flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[11px] text-slate-400">event</span>
                            <span>Due: {new Date(cp.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                          </div>

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleRenewCellPartItem(cp.id, cp.name)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[8px] font-bold shadow-3xs transition-colors cursor-pointer disabled:opacity-50"
                            title="Renew lifetime part ini"
                          >
                            {isProcessing ? (
                              <span className="material-symbols-outlined text-[9px] animate-spin">sync</span>
                            ) : (
                              <span className="material-symbols-outlined text-[9px]">autorenew</span>
                            )}
                            Renew
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer Kiri */}
              <div className="mt-auto pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
                <Link
                  href="/inventory"
                  className="text-[#0063ff] hover:underline font-bold text-[10px] flex items-center gap-0.5 cursor-pointer"
                >
                  Kontrol Inventory
                  <span className="material-symbols-outlined text-[11px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>


          {/* ========================================================================= */}
          {/* CARD 2: TENGAH (xl:col-span-6) - Simple Task Card + Approval / Decline     */}
          {/* ========================================================================= */}
          <div className="xl:col-span-6 flex flex-col bg-white border border-blue-200/60 rounded-xl shadow-xs overflow-hidden h-[calc(100vh-140px)] min-h-[480px]">
            {/* Header Card Tengah */}
            <div className="h-8 px-2.5 bg-[#0063ff] text-white flex items-center justify-between shrink-0">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-white">
                Daftar Task & Approval
              </h2>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-white/20 text-white rounded">
                {taskStats.waiting}
              </span>
            </div>

            {/* Content Container */}
            <div className="p-2 flex-1 flex flex-col gap-1.5 overflow-hidden">
              {/* Success notification banner */}
              {actionSuccessMsg && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] rounded-lg font-medium shrink-0">
                  <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
                  <span>{actionSuccessMsg}</span>
                </div>
              )}

              {/* Task List Content */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {isLoading ? (
                  <div className="h-28 flex flex-col items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined animate-spin text-lg text-amber-500 mb-1">sync</span>
                    <p className="text-[10px]">Memuat approval...</p>
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center p-3 text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    <span className="material-symbols-outlined text-4xl text-slate-400">task_alt</span>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                    {filteredTasks.map((task) => {
                      const isWaiting = task.status === 'WAITING';
                      const isDesign = task.type === 'Design Rev';
                      const isProcessing = processingTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          className="bg-white hover:bg-slate-50/90 border border-slate-200 rounded-lg p-2 flex flex-col gap-1.5 transition-all shadow-3xs"
                        >
                          {/* Top: Tag, Reg No, Title, and Status */}
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span
                                className={`px-1 py-0.2 rounded text-[8px] font-bold shrink-0 ${isDesign ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                                  }`}
                              >
                                {task.type}
                              </span>
                              <span className="font-mono font-bold text-[10px] text-slate-800 shrink-0">
                                {task.noReg}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-700 truncate" title={task.itemName}>
                                {task.itemName}
                              </span>
                            </div>

                            {/* Status Badge (hanya tampil jika bukan WAITING) */}
                            {task.status !== 'WAITING' && (
                              <span
                                className={`px-1.5 py-0.2 rounded-full text-[8px] font-bold border shrink-0 ${task.status === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                              >
                                {task.status}
                              </span>
                            )}
                          </div>

                          {/* Middle: Submitter & Note */}
                          <div className="text-[9px] text-slate-500 bg-slate-50/70 p-1.5 rounded border border-slate-100 flex flex-col gap-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600 font-medium flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px] text-slate-400">person</span>
                                Diajukan oleh: <b className="text-slate-700">{task.author}</b>
                              </span>
                              <span className="text-[8px] text-slate-400">{task.date}</span>
                            </div>
                            {task.note && (
                              <p className="text-slate-500 line-clamp-1 italic text-[9px]">
                                &ldquo;{task.note}&rdquo;
                              </p>
                            )}
                          </div>

                          {/* Bottom Row: Direct Approval & Decline Buttons */}
                          <div className="flex items-center justify-between pt-0.5 border-t border-slate-100">
                            <Link
                              href={`/approval-center/${task.id}`}
                              className="text-[9px] font-semibold text-slate-500 hover:text-blue-600 inline-flex items-center gap-0.5 cursor-pointer transition-colors"
                            >
                              <span>Detail</span>
                              <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                            </Link>

                            {/* Direct Action Buttons - hanya tampil untuk approver */}
                            {isWaiting && userCanApprove ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => handleQuickDecision(task.id, 'REJECT')}
                                  className="w-5 h-5 flex items-center justify-center bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded transition-colors cursor-pointer disabled:opacity-50"
                                  title="Tolak / Decline task ini"
                                  aria-label="Decline task"
                                >
                                  <span className="material-symbols-outlined text-[13px]">close</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => handleQuickDecision(task.id, 'APPROVE')}
                                  className="w-5 h-5 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-3xs transition-colors cursor-pointer disabled:opacity-50"
                                  title="Setujui / Approve task ini"
                                  aria-label="Approve task"
                                >
                                  <span className="material-symbols-outlined text-[13px]">check</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[8px] font-semibold text-slate-400 italic">
                                {isWaiting && !userCanApprove ? 'Menunggu approver' : 'Selesai'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer Tengah */}
              <div className="mt-auto pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
                <Link
                  href="/approval-center"
                  className="text-[#0063ff] hover:underline font-bold text-[10px] flex items-center gap-0.5 cursor-pointer"
                >
                  Approval Center Lengkap
                  <span className="material-symbols-outlined text-[11px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>


          {/* ========================================================================= */}
          {/* CARD 3: KANAN (xl:col-span-3) - Reminder Lifetime & Stock                 */}
          {/* ========================================================================= */}
          <div className="xl:col-span-3 flex flex-col bg-white border border-blue-200/60 rounded-xl shadow-xs overflow-hidden h-[calc(100vh-140px)] min-h-[480px]">
            {/* Header Card Kanan */}
            <div className="h-8 px-2.5 bg-[#0063ff] text-white flex items-center justify-between shrink-0">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-white">
                Lifetime & Stok
              </h2>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-white/20 text-white rounded">
                {lifetimeStats.total}
              </span>
            </div>

            {/* Content Container */}
            <div className="p-2 flex-1 flex flex-col gap-1.5 overflow-hidden">

            {/* Compact Metric Strip */}
            <div className="grid grid-cols-3 gap-1 shrink-0">
              <div className="flex items-center justify-between bg-rose-50/70 border border-rose-200/70 px-1.5 py-0.5 rounded-md">
                <span className="text-[8px] font-bold text-rose-700">Overdue</span>
                <span className="text-[10px] font-black text-rose-800">{lifetimeStats.overdue}</span>
              </div>
              <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200/70 px-1.5 py-0.5 rounded-md">
                <span className="text-[8px] font-bold text-amber-700">&le;30d</span>
                <span className="text-[10px] font-black text-amber-800">{lifetimeStats.warning}</span>
              </div>
              <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-200/70 px-1.5 py-0.5 rounded-md">
                <span className="text-[8px] font-bold text-emerald-700">Aman</span>
                <span className="text-[10px] font-black text-emerald-800">{lifetimeStats.safe}</span>
              </div>
            </div>

            {/* Quick Search Input */}
            <div className="relative w-full shrink-0">
              <span className="material-symbols-outlined text-[13px] text-slate-400 absolute left-2 top-1/2 -translate-y-1/2">
                search
              </span>
              <input
                type="text"
                placeholder="Cari reg / part..."
                value={lifetimeSearch}
                onChange={(e) => setLifetimeSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-[10px] rounded-md pl-6 pr-2 py-0.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            {/* Items List (Compact Rows) */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
              {filteredLifetime.length === 0 ? (
                <div className="h-28 flex flex-col items-center justify-center text-slate-400 bg-slate-50/60 rounded-lg border border-dashed border-slate-200">
                  <span className="material-symbols-outlined text-2xl text-emerald-500">check_circle</span>
                </div>
              ) : (
                filteredLifetime.map((item) => {
                  const isOverdue = item.status === 'OVERDUE';
                  const isWarning = item.status === 'WARNING';
                  const isLowStock = item.actualStock < item.minimumStock;
                  const isZeroStock = item.actualStock === 0;

                  return (
                    <div
                      key={item.id}
                      className={`p-1.5 rounded-md border transition-colors flex flex-col gap-0.5 ${isOverdue
                          ? 'bg-rose-50/40 border-rose-200'
                          : isWarning
                            ? 'bg-amber-50/40 border-amber-200'
                            : 'bg-white border-slate-200/80 hover:bg-slate-50/60'
                        }`}
                    >
                      {/* Baris 1: Reg, Part Name, Status hr */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <span className="font-mono text-[8px] font-bold text-slate-800 shrink-0">
                            {item.noReg}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-700 truncate" title={item.assyPartName}>
                            {item.assyPartName}
                          </span>
                        </div>
                        <span
                          className={`px-1 py-0.2 rounded text-[8px] font-bold shrink-0 font-mono ${isOverdue
                              ? 'bg-rose-100 text-rose-800'
                              : isWarning
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                        >
                          {isOverdue
                            ? 'OVERDUE'
                            : item.lifetimeType === 'DAYS'
                              ? `${item.daysRemaining}d`
                              : item.lifetimeType === 'USAGE'
                                ? `${item.currentUsage ?? 0}/${item.maxUsage ?? 500}x`
                                : `${item.currentUsage ?? 0}/${item.maxUsage ?? 500}x · ${item.daysRemaining}d`}
                        </span>
                      </div>

                      {/* Baris 2: Stok, Due Date, dan Persentase */}
                      <div className="flex items-center justify-between text-[9px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <span>Stok:</span>
                          <span className={`font-bold ${isZeroStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-700'}`}>
                            {item.actualStock}/{item.minimumStock}
                          </span>
                          {isZeroStock && (
                            <span className="px-1 py-0.2 rounded text-[7px] font-black bg-rose-100 text-rose-700 leading-none">
                              0
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] text-slate-400 font-mono" title={item.lifetimeType === 'USAGE' ? 'Batas Pakai' : `Jatuh tempo: ${item.dueDate}`}>
                            {item.lifetimeType === 'USAGE' ? `${item.maxUsage}x max` : item.dueDate}
                          </span>
                          <span className={`font-bold font-mono text-[9px] ${isOverdue ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-600'
                            }`}>
                            {item.lifetimePercent}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Kanan */}
            <div className="mt-auto pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
              <span className="font-semibold text-slate-600">
                {lifetimeStats.overdue + lifetimeStats.warning} perlu perhatian
              </span>
              <Link
                href="/inventory"
                className="text-rose-600 hover:underline font-bold text-[10px] flex items-center gap-0.5 cursor-pointer"
              >
                Inventori
                <span className="material-symbols-outlined text-[11px]">arrow_forward</span>
              </Link>
            </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
