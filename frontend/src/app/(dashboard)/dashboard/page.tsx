'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useApp, JigFixtureItem, ApprovalItem } from '@/context/AppContext';
import { fetchMasterList, fetchCellPartReminders, renewCellPart } from '@/lib/api/phase3';
import { fetchTpmSummary, fetchTpmSchedules, TpmScheduleItem, TpmSummary } from '@/lib/api/tpm';
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

  // TPM Schedules & Deadlines states (Card 1)
  const [tpmSchedules, setTpmSchedules] = useState<TpmScheduleItem[]>([]);
  const [tpmSummary, setTpmSummary] = useState<TpmSummary | null>(null);
  const [tpmFilter, setTpmFilter] = useState<'ALL' | 'OVERDUE' | 'NEAR_DEADLINE' | 'UNSCHEDULED'>('ALL');
  const [tpmSearch, setTpmSearch] = useState('');

  // Task & Approvals states (Card 2)
  const [taskFilter, setTaskFilter] = useState<'ALL' | 'WAITING' | 'REVISION' | 'DESIGN_REV' | 'INVENTORY_UPDATE'>('ALL');
  const [taskSearch, setTaskSearch] = useState('');

  // CellPart Lifetime Reminders states (Card 3)
  const [cellPartReminders, setCellPartReminders] = useState<any[]>([]);
  const [cellPartSearch, setCellPartSearch] = useState('');
  const [processingCpId, setProcessingCpId] = useState<string | null>(null);

  // Lifetime & Stok states (Card 4)
  const [lifetimeFilter, setLifetimeFilter] = useState<'ALL' | 'WARNING_OVERDUE' | 'SAFE'>('ALL');
  const [lifetimeSearch, setLifetimeSearch] = useState('');
  const [selectedLine, setSelectedLine] = useState('All');

  const loadCellPartReminders = async () => {
    try {
      const res = await fetchCellPartReminders();
      setCellPartReminders(res || []);
    } catch (err) {
      console.warn('Could not fetch cell part reminders', err);
    }
  };

  const loadAllDashboardData = async () => {
    setIsLoadingData(true);
    try {
      const [res, cpReminders, tpmSchedRes, tpmSumRes] = await Promise.allSettled([
        fetchMasterList(),
        fetchCellPartReminders(),
        fetchTpmSchedules(),
        fetchTpmSummary(),
      ]);
      if (res.status === 'fulfilled') setMasterList(res.value || []);
      if (cpReminders.status === 'fulfilled') setCellPartReminders(cpReminders.value || []);
      if (tpmSchedRes.status === 'fulfilled') setTpmSchedules(tpmSchedRes.value || []);
      if (tpmSumRes.status === 'fulfilled') setTpmSummary(tpmSumRes.value || null);
    } catch (err) {
      console.warn('Using local context items for dashboard data', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Load backend master list & TPM data on mount
  useEffect(() => {
    loadAllDashboardData();
  }, []);

  // Combined item list for Stock & Lifetime
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

  // Helper: check if a task is actually pending action for the logged-in user
  const isTaskPendingForUser = (a: ApprovalItem, role?: string) => {
    // If status is REJECTED, it means this item was returned for revision ("disuruh revisi")
    if (a.status === 'REJECTED') {
      return true;
    }
    if (a.status === 'WAITING') {
      if (role === 'PE_SECTION_HEAD') {
        return (a.sectionStatus || 'WAITING') === 'WAITING';
      }
      if (role === 'PE_DEPT_HEAD') {
        return a.sectionStatus === 'APPROVED' && (a.deptStatus || 'WAITING') === 'WAITING';
      }
      return true;
    }
    return false;
  };

  // Filtered approvals / tasks for Task Card (Hanya menampilkan task yang masih aktif & perlu tindakan user)
  const filteredTasks: ApprovalItem[] = useMemo(() => {
    let list = approvals.filter((a) => isTaskPendingForUser(a, user?.role));

    if (taskFilter === 'WAITING') {
      list = list.filter((a) => a.status === 'WAITING');
    } else if (taskFilter === 'REVISION') {
      list = list.filter((a) => a.status === 'REJECTED');
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
  }, [approvals, taskFilter, taskSearch, user?.role]);

  // Filtered Due Date / Lifetime for Stok Card
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
    const pendingList = approvals.filter((a) => isTaskPendingForUser(a, user?.role));
    const total = pendingList.length;
    const waiting = pendingList.filter((a) => a.status === 'WAITING').length;
    const revision = pendingList.filter((a) => a.status === 'REJECTED').length;
    const approved = approvals.filter((a) => a.status === 'APPROVED').length;
    const designRevWaiting = pendingList.filter((a) => a.type === 'Design Rev').length;
    const invWaiting = pendingList.filter((a) => a.type === 'Inventory Update').length;

    return { total, waiting, revision, approved, designRevWaiting, invWaiting };
  }, [approvals, user?.role]);

  // TPM summary statistics
  const tpmStats = useMemo(() => {
    const now = new Date();
    let overdue = 0;
    let nearDeadline = 0;
    let safe = 0;
    let unscheduled = 0;

    tpmSchedules.forEach((item) => {
      const deadlineDate = item.tpmScheduleDeadline ? new Date(item.tpmScheduleDeadline) : null;
      const deadlineDays = deadlineDate ? Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
      const effectiveDays = deadlineDays !== null ? deadlineDays : item.daysRemaining;

      const isOv = item.lifetimeStatus === 'OVERDUE' || (effectiveDays !== null && effectiveDays < 0);
      const isNear = !isOv && ((effectiveDays !== null && effectiveDays <= 7) || item.lifetimeStatus === 'WARNING');

      if (isOv) overdue++;
      else if (isNear) nearDeadline++;
      else safe++;

      if (!item.tpmScheduleDeadline && !item.tpmLifetimeSetAt) {
        unscheduled++;
      }
    });

    return {
      total: tpmSchedules.length,
      overdue,
      nearDeadline,
      safe,
      unscheduled,
      healthScore: tpmSummary?.healthScore ?? (tpmSchedules.length > 0 ? Math.round((safe / tpmSchedules.length) * 100) : 100),
    };
  }, [tpmSchedules, tpmSummary]);

  // Filtered & sorted TPM schedules for Card 1
  const filteredTpmSchedules = useMemo(() => {
    const now = new Date();
    let list = tpmSchedules;

    if (tpmFilter === 'OVERDUE') {
      list = list.filter((i) => {
        const deadlineDate = i.tpmScheduleDeadline ? new Date(i.tpmScheduleDeadline) : null;
        const deadlineDays = deadlineDate ? Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
        const effectiveDays = deadlineDays !== null ? deadlineDays : i.daysRemaining;
        return i.lifetimeStatus === 'OVERDUE' || (effectiveDays !== null && effectiveDays < 0);
      });
    } else if (tpmFilter === 'NEAR_DEADLINE') {
      list = list.filter((i) => {
        const deadlineDate = i.tpmScheduleDeadline ? new Date(i.tpmScheduleDeadline) : null;
        const deadlineDays = deadlineDate ? Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
        const effectiveDays = deadlineDays !== null ? deadlineDays : i.daysRemaining;
        const isOv = i.lifetimeStatus === 'OVERDUE' || (effectiveDays !== null && effectiveDays < 0);
        return !isOv && ((effectiveDays !== null && effectiveDays <= 7) || i.lifetimeStatus === 'WARNING');
      });
    } else if (tpmFilter === 'UNSCHEDULED') {
      list = list.filter((i) => !i.tpmScheduleDeadline && !i.tpmLifetimeSetAt);
    }

    if (tpmSearch.trim()) {
      const q = tpmSearch.toLowerCase().trim();
      list = list.filter(
        (i) =>
          (i.noReg && i.noReg.toLowerCase().includes(q)) ||
          (i.name && i.name.toLowerCase().includes(q)) ||
          (i.partNumber && i.partNumber.toLowerCase().includes(q)) ||
          (i.lineName && i.lineName.toLowerCase().includes(q)) ||
          (i.processName && i.processName.toLowerCase().includes(q)) ||
          (i.parentNoReg && i.parentNoReg.toLowerCase().includes(q)) ||
          (i.parentName && i.parentName.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      const aDead = a.tpmScheduleDeadline ? new Date(a.tpmScheduleDeadline).getTime() : (a.dueDate ? new Date(a.dueDate).getTime() : Infinity);
      const bDead = b.tpmScheduleDeadline ? new Date(b.tpmScheduleDeadline).getTime() : (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);

      const aOverdue = a.lifetimeStatus === 'OVERDUE';
      const bOverdue = b.lifetimeStatus === 'OVERDUE';
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      return aDead - bDead;
    });
  }, [tpmSchedules, tpmFilter, tpmSearch]);

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
      await loadAllDashboardData();
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
      await processApproval(taskId, action, action === 'APPROVE' ? 'Quick approval from dashboard' : 'Memerlukan revisi dari dashboard');
      setActionSuccessMsg(`Task berhasil ${action === 'APPROVE' ? 'disetujui' : 'dikembalikan untuk revisi'}.`);
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

  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  const handleBulkApprove = async () => {
    if (!userCanApprove) {
      alert('Hanya Section Head atau Dept Head yang dapat menyetujui approval.');
      return;
    }
    const waitingTasks = approvals.filter((a) => isTaskPendingForUser(a, user?.role));
    if (waitingTasks.length === 0) {
      setShowBulkApproveModal(false);
      return;
    }

    setIsBulkApproving(true);
    try {
      let successCount = 0;
      for (const t of waitingTasks) {
        try {
          await processApproval(t.id, 'APPROVE', 'Batch approval all tasks from dashboard');
          successCount++;
        } catch (e) {
          console.error(`Failed approving ${t.id}`, e);
        }
      }
      setShowBulkApproveModal(false);
      setActionSuccessMsg(`Berhasil menyetujui ${successCount} dari ${waitingTasks.length} task.`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
      await loadAllDashboardData();
    } catch (err: any) {
      alert(`Gagal memproses bulk approval: ${err?.message || 'Error server'}`);
    } finally {
      setIsBulkApproving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-3 bg-white h-full overflow-hidden">
      {/* Main Content Area (Full height flexible grid across all screen sizes) */}
      <div className="flex-1 h-full min-h-0 overflow-y-auto xl:overflow-hidden">
        {/* Main 4 Cards Layout:
            1. Jadwal & Deadline TPM
            2. Daftar Task & Approval
            3. Reminder CellPart (≤5 Mgg)
            4. Monitoring Lifetime & Stok
        */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5 h-full min-h-0 items-stretch">

          {/* ========================================================================= */}
          {/* CARD 1: Jadwal & Deadline TPM (Preventive Maintenance Schedules & Target)  */}
          {/* ========================================================================= */}
          <div className="flex flex-col bg-white border border-blue-200/60 rounded-xl shadow-xs overflow-hidden h-full min-h-[380px]">
            {/* Header Card TPM (Expand Search on Hover / Focus, Hides Title) */}
            <div className="h-8 px-2.5 bg-[#0063ff] text-white flex items-center justify-between relative overflow-hidden shrink-0 group/header">
              {/* Title (Hidden when hovered/focused or when search query is active) */}
              <h2 className={`text-[11px] font-bold uppercase tracking-wider text-white shrink-0 transition-opacity duration-200 ${
                tpmSearch ? 'opacity-0 pointer-events-none' : 'group-hover/header:opacity-0 group-focus-within/header:opacity-0'
              }`}>
                TPM
              </h2>

              {/* Search Bar: Icon-only by default, expands to full width on hover/focus */}
              <div className={`flex items-center transition-all duration-200 ${
                tpmSearch 
                  ? 'w-full' 
                  : 'w-6 group-hover/header:w-full group-focus-within/header:w-full ml-auto'
              }`}>
                <div className="relative flex items-center w-full">
                  <span
                    className="material-symbols-outlined text-white/90 absolute right-2 pointer-events-none select-none flex items-center justify-center leading-none z-10"
                    style={{ fontSize: '11px', width: '11px', height: '11px', fontVariationSettings: "'wght' 300" }}
                  >
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Cari jadwal TPM..."
                    value={tpmSearch}
                    onChange={(e) => setTpmSearch(e.target.value)}
                    className={`w-full pl-2.5 pr-6 h-5 bg-white/20 hover:bg-white/25 focus:bg-white text-white focus:text-slate-800 placeholder:text-white/70 focus:placeholder:text-slate-400 rounded text-[9px] outline-none transition-all duration-200 ${
                      tpmSearch
                        ? 'opacity-100 cursor-text'
                        : 'opacity-0 group-hover/header:opacity-100 group-focus-within/header:opacity-100 cursor-pointer group-hover/header:cursor-text group-focus-within/header:cursor-text'
                    }`}
                  />
                  {tpmSearch && (
                    <button
                      type="button"
                      onClick={() => setTpmSearch('')}
                      className="absolute right-6 text-white/70 hover:text-white focus:text-slate-600 text-[11px] leading-none cursor-pointer"
                      title="Hapus pencarian"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Content Container */}
            <div className="p-2 flex-1 flex flex-col gap-1.5 overflow-hidden">

              {/* Flat Quick Filter Tabs with Bottom Divider */}
              <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1.5 border-b border-slate-200/80 px-1">
                {[
                  { key: 'ALL', label: 'Semua' },
                  { key: 'OVERDUE', label: `Overdue (${tpmStats.overdue})` },
                  { key: 'NEAR_DEADLINE', label: `≤7 Hari (${tpmStats.nearDeadline})` },
                  { key: 'UNSCHEDULED', label: `Belum (${tpmStats.unscheduled})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTpmFilter(tab.key as any)}
                    className={`text-[9px] font-bold pb-0.5 shrink-0 transition-colors cursor-pointer ${
                      tpmFilter === tab.key
                        ? 'text-[#0063ff] border-b-2 border-[#0063ff]'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                {isLoading ? (
                  <div className="h-28 flex flex-col items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined animate-spin text-lg text-blue-500 mb-1">sync</span>
                    <p className="text-[10px]">Memuat jadwal TPM...</p>
                  </div>
                ) : filteredTpmSchedules.length === 0 ? (
                  <div className="h-28 flex flex-col items-center justify-center p-3 text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    <span className="material-symbols-outlined text-2xl text-emerald-500">verified</span>
                    <p className="text-[9px] mt-1 text-slate-500 font-medium">Tidak ada jadwal yang sesuai</p>
                  </div>
                ) : (
                  filteredTpmSchedules.map((item) => {
                    const now = new Date();
                    const deadlineDate = item.tpmScheduleDeadline ? new Date(item.tpmScheduleDeadline) : null;
                    const deadlineDays = deadlineDate ? Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                    const effectiveDueDate = deadlineDate || (item.dueDate ? new Date(item.dueDate) : null);
                    const effectiveDays = deadlineDays !== null ? deadlineDays : item.daysRemaining;

                    const isOv = item.lifetimeStatus === 'OVERDUE' || (effectiveDays !== null && effectiveDays < 0);
                    const isNear = !isOv && ((effectiveDays !== null && effectiveDays <= 7) || item.lifetimeStatus === 'WARNING');
                    const isUnscheduled = !item.tpmScheduleDeadline && !item.tpmLifetimeSetAt;

                    // Format date to DD/MM/YYYY
                    const formatDDMMYYYY = (d: Date | null) => {
                      if (!d || isNaN(d.getTime())) return 'Belum Diatur';
                      const day = String(d.getDate()).padStart(2, '0');
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const year = d.getFullYear();
                      return `${day}/${month}/${year}`;
                    };

                    return (
                      <Link
                        key={item.id}
                        href={`/tpm?search=${encodeURIComponent(item.noReg)}`}
                        className={`border rounded-lg p-1.5 flex flex-col gap-1 transition-all shadow-3xs cursor-pointer group ${
                          isOv
                            ? 'bg-rose-50/40 border-rose-200 hover:bg-rose-50/70 hover:border-rose-300'
                            : isNear
                            ? 'bg-amber-50/30 border-amber-200 hover:bg-amber-50/60 hover:border-amber-300'
                            : 'bg-white hover:bg-slate-50/90 hover:border-blue-300 border-slate-200'
                        }`}
                      >
                        {/* Row 1: Reg, Line, Type Badge */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <span className="font-mono text-[9px] font-bold text-slate-800 group-hover:text-blue-600 transition-colors shrink-0">
                              {item.noReg}
                            </span>
                            <span className="text-[8px] font-medium px-1 py-0.2 rounded bg-slate-100 text-slate-600 truncate">
                              {item.lineName} · {item.processName}
                            </span>
                          </div>
                          <span
                            className={`text-[7px] font-bold px-1.5 py-0.2 rounded-full uppercase shrink-0 ${
                              item.isCellPart
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {item.isCellPart ? 'Cell Part' : 'Jig'}
                          </span>
                        </div>

                        {/* Row 2: Part / Fixture Name */}
                        <div className="min-w-0">
                          <h4 className="text-[10px] font-bold text-slate-800 truncate leading-tight group-hover:text-blue-700 transition-colors" title={item.name}>
                            {item.name}
                          </h4>
                          {item.isCellPart && item.parentNoReg && (
                            <p className="text-[8px] text-slate-500 font-mono truncate">
                              Parent: {item.parentNoReg} ({item.parentName})
                            </p>
                          )}
                        </div>

                        {/* Row 3: Schedule Deadline / Due Date & Countdown */}
                        <div className="p-1 rounded bg-slate-50/90 border border-slate-100 flex items-center justify-between text-[9px]">
                          <div className="flex flex-col">
                            <span className="text-[7px] text-slate-400 font-semibold uppercase">
                              {item.tpmScheduleDeadline ? 'Target Deadline' : 'Due'}:
                            </span>
                            <span className="font-bold text-slate-700 font-mono text-[9px]">
                              {formatDDMMYYYY(effectiveDueDate)}
                            </span>
                          </div>

                          <div className="text-right">
                            {isUnscheduled ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-200 text-slate-700">
                                Belum Terjadwal
                              </span>
                            ) : isOv ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-600 text-white animate-pulse">
                                Overdue {Math.abs(effectiveDays ?? 0)} Hari
                              </span>
                            ) : isNear ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500 text-white">
                                {effectiveDays === 0 ? 'Hari Ini!' : `H-${effectiveDays} Deadline`}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-600 text-white">
                                H-{effectiveDays}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Row 4: Lifetime Usage */}
                        <div className="flex items-center justify-between pt-0.5 border-t border-slate-100 text-[9px]">
                          <div className="flex items-center gap-1 text-slate-500 text-[8px] font-mono">
                            <span className="material-symbols-outlined text-[10px] text-slate-400">speed</span>
                            <span>
                              {item.lifetimeType === 'DAYS'
                                ? `${item.lifetimeDays}d cycle`
                                : `${item.currentUsage ?? 0}/${item.maxUsage ?? 500}x`}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>

              {/* Footer TPM */}
              <div className="mt-auto pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
                <span className="font-semibold text-slate-600">
                  {tpmStats.overdue + tpmStats.nearDeadline} jadwal mendesak
                </span>
                <Link
                  href="/tpm"
                  className="text-[#0063ff] hover:underline font-bold text-[10px] flex items-center gap-0.5 cursor-pointer"
                >
                  Modul TPM
                  <span className="material-symbols-outlined text-[11px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>


          {/* ========================================================================= */}
          {/* CARD 2: Daftar Task & Approval (Approval Queue & Fast Action)              */}
          {/* ========================================================================= */}
          <div className="flex flex-col bg-white border border-blue-200/60 rounded-xl shadow-xs overflow-hidden h-full min-h-[380px]">
            {/* Header Card Approval (Expand Search on Hover / Focus, Hides Title) */}
            <div className="h-8 px-2.5 bg-[#0063ff] text-white flex items-center justify-between gap-1.5 relative overflow-hidden shrink-0 group/header">
              {/* Title (Hidden when hovered/focused or when taskSearch query is active) */}
              <h2 className={`text-[11px] font-bold uppercase tracking-wider text-white shrink-0 transition-opacity duration-200 ${
                taskSearch ? 'opacity-0 pointer-events-none' : 'group-hover/header:opacity-0 group-focus-within/header:opacity-0'
              }`}>
                Task & Approval
              </h2>

              <div className={`flex items-center gap-1.5 transition-all duration-200 ${
                taskSearch
                  ? 'w-full'
                  : 'w-auto group-hover/header:w-full group-focus-within/header:w-full ml-auto'
              }`}>
                {taskStats.waiting > 0 && userCanApprove && (
                  <button
                    type="button"
                    onClick={() => setShowBulkApproveModal(true)}
                    className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 hover:bg-emerald-600 text-white transition-colors cursor-pointer shadow-3xs flex items-center gap-0.5 shrink-0"
                    title="Setujui semua task sekaligus"
                  >
                    <span className="material-symbols-outlined text-[10px]">done_all</span>
                    Approve
                  </button>
                )}

                {/* Search Bar: Icon-only by default, expands to full width on hover/focus */}
                <div className="relative flex items-center flex-1 min-w-0">
                  <span
                    className="material-symbols-outlined text-white/90 absolute right-2 pointer-events-none select-none flex items-center justify-center leading-none z-10"
                    style={{ fontSize: '11px', width: '11px', height: '11px', fontVariationSettings: "'wght' 300" }}
                  >
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Cari task..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className={`w-full pl-2.5 pr-6 h-5 bg-white/20 hover:bg-white/25 focus:bg-white text-white focus:text-slate-800 placeholder:text-white/70 focus:placeholder:text-slate-400 rounded text-[9px] outline-none transition-all duration-200 ${
                      taskSearch
                        ? 'opacity-100 cursor-text'
                        : 'opacity-0 group-hover/header:opacity-100 group-focus-within/header:opacity-100 cursor-pointer group-hover/header:cursor-text group-focus-within/header:cursor-text'
                    }`}
                  />
                  {taskSearch && (
                    <button
                      type="button"
                      onClick={() => setTaskSearch('')}
                      className="absolute right-6 text-white/70 hover:text-white focus:text-slate-600 text-[11px] leading-none cursor-pointer"
                      title="Hapus pencarian"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
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

              {/* Flat Quick Filter Tabs with Bottom Divider */}
              <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1.5 border-b border-slate-200/80 px-1">
                {[
                  { key: 'ALL', label: `Semua (${taskStats.total})` },
                  { key: 'WAITING', label: `Menunggu (${taskStats.waiting})` },
                  { key: 'REVISION', label: `Revisi (${taskStats.revision})` },
                  { key: 'DESIGN_REV', label: 'Design' },
                  { key: 'INVENTORY_UPDATE', label: 'Inventory' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTaskFilter(tab.key as any)}
                    className={`text-[9px] font-bold pb-0.5 shrink-0 transition-colors cursor-pointer ${
                      taskFilter === tab.key
                        ? 'text-[#0063ff] border-b-2 border-[#0063ff]'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

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
                    <p className="text-[9px] mt-1 text-slate-500 font-medium">Semua task selesai</p>
                  </div>
                ) : (
                    <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
                    {filteredTasks.map((task) => {
                      const isWaiting = task.status === 'WAITING';
                      const isRevision = task.status === 'REJECTED';
                      const isProcessing = processingTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          className={`bg-white hover:bg-slate-50/90 border rounded-lg p-1.5 flex items-center justify-between gap-2 transition-all shadow-3xs group ${
                            isRevision ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'
                          }`}
                        >
                          {/* Info Ringkas: Link ke detail */}
                          <Link
                            href={`/approval-center/${task.id}`}
                            className="min-w-0 flex-1 flex flex-col cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-[9.5px] text-slate-800 group-hover:text-blue-600 transition-colors shrink-0">
                                {task.noReg}
                              </span>
                              {isRevision ? (
                                <span className="text-[7.5px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                                  Revisi
                                </span>
                              ) : (
                                <span className="text-[7.5px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-700">
                                  Menunggu
                                </span>
                              )}
                            </div>
                            <span className="text-[9.5px] font-semibold text-slate-700 truncate leading-tight mt-0.5" title={task.itemName}>
                              {task.itemName}
                            </span>
                            <span className="text-[8px] text-slate-400 truncate">
                              {isRevision && task.note ? (
                                <span className="text-rose-600 font-medium truncate block">
                                  Catatan: &ldquo;{task.note}&rdquo;
                                </span>
                              ) : (
                                `Oleh: ${task.author}`
                              )}
                            </span>
                          </Link>

                          {/* Tombol Aksi */}
                          <div className="shrink-0 flex items-center gap-1">
                            {isRevision ? (
                              <Link
                                href={`/approval-center/${task.id}`}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-md text-[9px] transition-colors flex items-center gap-1 shadow-3xs cursor-pointer"
                                title="Lihat catatan, coretan & upload revisian baru"
                              >
                                <span className="material-symbols-outlined text-[12px]">history_edu</span>
                                <span>Revisi</span>
                              </Link>
                            ) : userCanApprove ? (
                              <>
                                <Link
                                  href={`/approval-center/${task.id}`}
                                  className="w-6 h-6 flex items-center justify-center bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-md transition-colors cursor-pointer"
                                  title="Buka gambar untuk memberi coretan & catatan revisi"
                                  aria-label="Minta Revisi dengan Coretan"
                                >
                                  <span className="material-symbols-outlined text-[12px] font-bold">history_edu</span>
                                </Link>
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => handleQuickDecision(task.id, 'APPROVE')}
                                  className="w-6 h-6 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-3xs transition-colors cursor-pointer disabled:opacity-50"
                                  title="Setujui (Approve)"
                                  aria-label="Setujui"
                                >
                                  <span className="material-symbols-outlined text-[13px] font-bold">check</span>
                                </button>
                              </>
                            ) : (
                              <Link
                                href={`/approval-center/${task.id}`}
                                className="text-gray-400 hover:text-blue-600 p-1 rounded"
                                title="Buka review"
                              >
                                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer Approval */}
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
          {/* CARD 3: Reminder Lifetime CellPart (≤5 Mgg & Overdue)                     */}
          {/* ========================================================================= */}
          <div className="flex flex-col bg-white border border-blue-200/60 rounded-xl shadow-xs overflow-hidden h-full min-h-[380px]">
            {/* Header Card CellPart (Expand Search on Hover / Focus, Hides Title) */}
            <div className="h-8 px-2.5 bg-[#0063ff] text-white flex items-center justify-between relative overflow-hidden shrink-0 group/header">
              {/* Title (Hidden when hovered/focused or when search query is active) */}
              <h2 className={`text-[11px] font-bold uppercase tracking-wider text-white shrink-0 transition-opacity duration-200 ${
                cellPartSearch ? 'opacity-0 pointer-events-none' : 'group-hover/header:opacity-0 group-focus-within/header:opacity-0'
              }`}>
                Childpart Reminder
              </h2>

              {/* Search Bar: Icon-only by default, expands to full width on hover/focus */}
              <div className={`flex items-center transition-all duration-200 ${
                cellPartSearch 
                  ? 'w-full' 
                  : 'w-6 group-hover/header:w-full group-focus-within/header:w-full ml-auto'
              }`}>
                <div className="relative flex items-center w-full">
                  <span
                    className="material-symbols-outlined text-white/90 absolute right-2 pointer-events-none select-none flex items-center justify-center leading-none z-10"
                    style={{ fontSize: '11px', width: '11px', height: '11px', fontVariationSettings: "'wght' 300" }}
                  >
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Cari CellPart..."
                    value={cellPartSearch}
                    onChange={(e) => setCellPartSearch(e.target.value)}
                    className={`w-full pl-2.5 pr-6 h-5 bg-white/20 hover:bg-white/25 focus:bg-white text-white focus:text-slate-800 placeholder:text-white/70 focus:placeholder:text-slate-400 rounded text-[9px] outline-none transition-all duration-200 ${
                      cellPartSearch
                        ? 'opacity-100 cursor-text'
                        : 'opacity-0 group-hover/header:opacity-100 group-focus-within/header:opacity-100 cursor-pointer group-hover/header:cursor-text group-focus-within/header:cursor-text'
                    }`}
                  />
                  {cellPartSearch && (
                    <button
                      type="button"
                      onClick={() => setCellPartSearch('')}
                      className="absolute right-6 text-white/70 hover:text-white focus:text-slate-600 text-[11px] leading-none cursor-pointer"
                      title="Hapus pencarian"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Content Container */}
            <div className="p-2 flex-1 flex flex-col gap-1.5 overflow-hidden">
              {/* Flat Metric Strip with Bottom Divider */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80 px-1 text-[9px] shrink-0">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-rose-600">Overdue:</span>
                  <span className="font-black text-rose-700">{cpStats.overdue}</span>
                </div>
                <div className="h-3 w-px bg-slate-200"></div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-amber-600">&le;5 Mgg:</span>
                  <span className="font-black text-amber-700">{cpStats.warning}</span>
                </div>
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
                    <p className="text-[9px] mt-1 text-slate-500 font-medium">Semua CellPart aman</p>
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

              {/* Footer CellPart */}
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
          {/* CARD 4: Monitoring Lifetime & Stok Jig (Stock vs Minimum & Due Date)      */}
          {/* ========================================================================= */}
          <div className="flex flex-col bg-white border border-blue-200/60 rounded-xl shadow-xs overflow-hidden h-full min-h-[380px]">
            {/* Header Card Stok (Expand Search on Hover / Focus, Hides Title) */}
            <div className="h-8 px-2.5 bg-[#0063ff] text-white flex items-center justify-between relative overflow-hidden shrink-0 group/header">
              {/* Title (Hidden when hovered/focused or when search query is active) */}
              <h2 className={`text-[11px] font-bold uppercase tracking-wider text-white shrink-0 transition-opacity duration-200 ${
                lifetimeSearch ? 'opacity-0 pointer-events-none' : 'group-hover/header:opacity-0 group-focus-within/header:opacity-0'
              }`}>
                Lifetime & Stok Jig
              </h2>

              {/* Search Bar: Icon-only by default, expands to full width on hover/focus */}
              <div className={`flex items-center transition-all duration-200 ${
                lifetimeSearch 
                  ? 'w-full' 
                  : 'w-6 group-hover/header:w-full group-focus-within/header:w-full ml-auto'
              }`}>
                <div className="relative flex items-center w-full">
                  <span
                    className="material-symbols-outlined text-white/90 absolute right-2 pointer-events-none select-none flex items-center justify-center leading-none z-10"
                    style={{ fontSize: '11px', width: '11px', height: '11px', fontVariationSettings: "'wght' 300" }}
                  >
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Cari stok / part..."
                    value={lifetimeSearch}
                    onChange={(e) => setLifetimeSearch(e.target.value)}
                    className={`w-full pl-2.5 pr-6 h-5 bg-white/20 hover:bg-white/25 focus:bg-white text-white focus:text-slate-800 placeholder:text-white/70 focus:placeholder:text-slate-400 rounded text-[9px] outline-none transition-all duration-200 ${
                      lifetimeSearch
                        ? 'opacity-100 cursor-text'
                        : 'opacity-0 group-hover/header:opacity-100 group-focus-within/header:opacity-100 cursor-pointer group-hover/header:cursor-text group-focus-within/header:cursor-text'
                    }`}
                  />
                  {lifetimeSearch && (
                    <button
                      type="button"
                      onClick={() => setLifetimeSearch('')}
                      className="absolute right-6 text-white/70 hover:text-white focus:text-slate-600 text-[11px] leading-none cursor-pointer"
                      title="Hapus pencarian"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Content Container */}
            <div className="p-2 flex-1 flex flex-col gap-1.5 overflow-hidden">
              {/* Flat Metric Strip with Bottom Divider */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80 px-1 text-[9px] shrink-0">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-rose-600">Overdue:</span>
                  <span className="font-black text-rose-700">{lifetimeStats.overdue}</span>
                </div>
                <div className="h-3 w-px bg-slate-200"></div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-amber-600">&le;30d:</span>
                  <span className="font-black text-amber-700">{lifetimeStats.warning}</span>
                </div>
                <div className="h-3 w-px bg-slate-200"></div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-emerald-600">Aman:</span>
                  <span className="font-black text-emerald-700">{lifetimeStats.safe}</span>
                </div>
              </div>

              {/* Items List (Compact Rows) */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
                {filteredLifetime.length === 0 ? (
                  <div className="h-28 flex flex-col items-center justify-center text-slate-400 bg-slate-50/60 rounded-lg border border-dashed border-slate-200">
                    <span className="material-symbols-outlined text-2xl text-emerald-500">check_circle</span>
                    <p className="text-[9px] mt-1 text-slate-500 font-medium">Tidak ada data stok</p>
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
                        className={`p-1.5 rounded-md border transition-colors flex flex-col gap-0.5 ${
                          isOverdue
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
                            className={`px-1 py-0.2 rounded text-[8px] font-bold shrink-0 font-mono ${
                              isOverdue
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
                            <span className={`font-bold font-mono text-[9px] ${
                              isOverdue ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-600'
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

              {/* Footer Stok */}
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

      {/* POP UP KONFIRMASI: APPROVE SEMUA TASK */}
      {showBulkApproveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[99]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl relative text-gray-800 animate-in fade-in zoom-in-95">
            {/* Header Standar (Icon + Teks, Tanpa background berwarna tebal) */}
            <div className="p-3.5 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-600 text-sm">done_all</span>
                Konfirmasi Setujui Semua Task
              </h3>
              <button
                type="button"
                disabled={isBulkApproving}
                onClick={() => setShowBulkApproveModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-600">
                  <span className="material-symbols-outlined text-lg">help</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 leading-snug">
                    Yakin ingin menyetujui semua task yang sedang menunggu?
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                    Terdapat <strong className="text-emerald-700 font-semibold">{taskStats.waiting} task</strong> yang akan disetujui sekaligus. Tindakan ini akan melanjutkan seluruh revisi atau pembaruan stok ke tahap berikutnya.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-gray-150">
                <button
                  type="button"
                  disabled={isBulkApproving}
                  onClick={() => setShowBulkApproveModal(false)}
                  className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isBulkApproving}
                  onClick={handleBulkApprove}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isBulkApproving ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">check</span>
                      <span>Ya, Setujui Semua</span>
                    </>
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
