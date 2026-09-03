'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useApp, JigFixtureItem, ApprovalItem } from '@/context/AppContext';
import { fetchMasterList } from '@/lib/api/phase3';

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
}

export default function DashboardPage() {
  const { user, items, approvals, isLoading: isAppLoading } = useApp();

  const [masterList, setMasterList] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Center card states (Highlight Tasks & Approvals)
  const [taskFilter, setTaskFilter] = useState<'ALL' | 'WAITING' | 'DESIGN_REV' | 'INVENTORY_UPDATE'>('WAITING');
  const [taskSearch, setTaskSearch] = useState('');

  // Right card states (Due Date & Life Time)
  const [lifetimeFilter, setLifetimeFilter] = useState<'ALL' | 'WARNING_OVERDUE' | 'SAFE'>('ALL');
  const [lifetimeSearch, setLifetimeSearch] = useState('');
  const [selectedLine, setSelectedLine] = useState('All');

  // Load backend master list if items in AppContext are empty
  useEffect(() => {
    async function loadMasterData() {
      setIsLoadingData(true);
      try {
        const res = await fetchMasterList();
        setMasterList(res || []);
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
      }));
    }
    return [];
  }, [items, masterList]);

  // Unique lines for filter dropdown
  const uniqueLines = useMemo(() => {
    const lines = Array.from(new Set(displayItems.map((i) => i.lineProduct).filter(Boolean)));
    return ['All', ...lines];
  }, [displayItems]);

  // Calculate Life Time & Due Date for each item (standard 180-365 days PM cycle)
  const lifetimeItems: LifetimeItem[] = useMemo(() => {
    const now = new Date();

    return displayItems.map((item) => {
      const baseDateStr = item.designDateNew || item.designDateLast;
      const baseDate = baseDateStr ? new Date(baseDateStr) : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      
      // Standard life cycle duration: 180 days (6 months periodic maintenance/review)
      const cycleDays = 180;
      const dueDate = new Date(baseDate.getTime() + cycleDays * 24 * 60 * 60 * 1000);
      
      const diffTime = dueDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Calculate percentage consumed (0% = new, 100% = due)
      const elapsedDays = cycleDays - daysRemaining;
      const lifetimePercent = Math.min(100, Math.max(0, Math.round((elapsedDays / cycleDays) * 100)));

      let status: 'SAFE' | 'WARNING' | 'OVERDUE' = 'SAFE';
      if (daysRemaining <= 0) {
        status = 'OVERDUE';
      } else if (daysRemaining <= 30) {
        status = 'WARNING';
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
        lifetimePercent,
        status,
        actualStock: item.actualStock,
        minimumStock: item.minimumStock,
      };
    }).sort((a, b) => a.daysRemaining - b.daysRemaining);
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

  const currentDateStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const isLoading = isAppLoading || isLoadingData;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50/70 p-5 gap-4">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl p-4 px-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0063ff] flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-2xl">dashboard</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-800 tracking-tight">Dashboard Overview</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live System
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Selamat datang, <span className="font-semibold text-slate-700">{user?.name || 'User'}</span> &bull; {currentDateStr}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/approval-center"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">fact_check</span>
            Approval Center ({taskStats.waiting})
          </Link>
          <Link
            href="/design"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0063ff] hover:bg-[#0052d4] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">table_view</span>
            Design Master List
          </Link>
        </div>
      </div>

      {/* Main 3 Cards Layout: KIRI (Kosong) | TENGAH (Highlight Tasks/Approval) | KANAN (Due Date Lifetime) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 flex-1 items-start">
        
        {/* ========================================================================= */}
        {/* CARD 1: KIRI (xl:col-span-3) - Kosongkan Dulu (Reserved Placeholder)      */}
        {/* ========================================================================= */}
        <div className="xl:col-span-3 flex flex-col justify-between bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs min-h-[560px]">
          {/* Header Card Kiri */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500">
                <span className="material-symbols-outlined text-base">dashboard_customize</span>
              </div>
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Area Informasi</h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-400 rounded-md">
              Reserved
            </span>
          </div>

          {/* Clean Placeholder Body */}
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-300 mb-3 shadow-2xs">
              <span className="material-symbols-outlined text-3xl">space_dashboard</span>
            </div>
            <p className="text-xs font-bold text-slate-600 mb-1">Slot Widget Kiri</p>
            <p className="text-[11px] text-slate-400 max-w-[200px] leading-relaxed">
              Area ini disiapkan untuk penambahan modul grafik atau ringkasan lainnya di masa mendatang.
            </p>
          </div>

          {/* Footer Card Kiri */}
          <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              Slot Kosong
            </span>
            <span>Standby</span>
          </div>
        </div>


        {/* ========================================================================= */}
        {/* CARD 2: TENGAH BESAR (xl:col-span-6) - Highlight Tasks / Approval Center */}
        {/* ========================================================================= */}
        <div className="xl:col-span-6 flex flex-col gap-3.5 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs min-h-[560px]">
          {/* Header Card Tengah */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <span className="material-symbols-outlined text-base">fact_check</span>
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Highlight Tasks & Approval Center
                </h2>
                <p className="text-[10px] text-slate-400">Daftar pengajuan revisi desain dan update inventori yang memerlukan tindakan</p>
              </div>
            </div>

            {/* Quick Badge */}
            <div className="flex items-center gap-1.5">
              {taskStats.waiting > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {taskStats.waiting} Menunggu Approval
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="material-symbols-outlined text-xs">check_circle</span>
                  Semua Selesai
                </span>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Total Tasks</span>
              <span className="text-base font-black text-slate-800 mt-0.5">{taskStats.total}</span>
            </div>
            <div className="bg-amber-50/70 border border-amber-200/80 p-2.5 rounded-xl flex flex-col">
              <span className="text-[10px] font-bold text-amber-700 uppercase">Menunggu</span>
              <span className="text-base font-black text-amber-800 mt-0.5">{taskStats.waiting}</span>
            </div>
            <div className="bg-blue-50/70 border border-blue-200/80 p-2.5 rounded-xl flex flex-col">
              <span className="text-[10px] font-bold text-blue-700 uppercase">Rev Desain</span>
              <span className="text-base font-black text-blue-800 mt-0.5">{taskStats.designRevWaiting}</span>
            </div>
            <div className="bg-emerald-50/70 border border-emerald-200/80 p-2.5 rounded-xl flex flex-col">
              <span className="text-[10px] font-bold text-emerald-700 uppercase">Disetujui</span>
              <span className="text-base font-black text-emerald-800 mt-0.5">{taskStats.approved}</span>
            </div>
          </div>

          {/* Filter Tabs & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            {/* Tabs */}
            <div className="flex items-center p-1 bg-slate-100/90 rounded-xl gap-1 w-full sm:w-auto overflow-x-auto">
              <button
                type="button"
                onClick={() => setTaskFilter('WAITING')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  taskFilter === 'WAITING'
                    ? 'bg-white text-amber-700 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Menunggu ({taskStats.waiting})
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter('ALL')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  taskFilter === 'ALL'
                    ? 'bg-white text-blue-600 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Semua ({taskStats.total})
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter('DESIGN_REV')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  taskFilter === 'DESIGN_REV'
                    ? 'bg-white text-blue-600 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-blue-600'
                }`}
              >
                Design Rev ({approvals.filter((a) => a.type === 'Design Rev').length})
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter('INVENTORY_UPDATE')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  taskFilter === 'INVENTORY_UPDATE'
                    ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-indigo-600'
                }`}
              >
                Inventory ({approvals.filter((a) => a.type === 'Inventory Update').length})
              </button>
            </div>

            {/* Task Search */}
            <div className="relative w-full sm:w-48">
              <span className="material-symbols-outlined text-sm text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">
                search
              </span>
              <input
                type="text"
                placeholder="Cari task / requester..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Task List Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
                <span className="material-symbols-outlined animate-spin text-2xl text-amber-500 mb-2">sync</span>
                <p className="text-xs">Memuat daftar approval tasks...</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <span className="material-symbols-outlined text-4xl mb-1.5 text-emerald-400">task_alt</span>
                <p className="text-xs font-bold text-slate-700">Tidak ada task yang sesuai filter.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Semua antrean approval saat ini dalam status aman.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-[360px] space-y-2.5 pr-1">
                {filteredTasks.map((task) => {
                  const isWaiting = task.status === 'WAITING';
                  const isDesign = task.type === 'Design Rev';

                  return (
                    <div
                      key={task.id}
                      className="bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 rounded-xl p-3.5 flex flex-col gap-2.5 transition-all shadow-2xs"
                    >
                      {/* Top Row: Type, Reg No, Requester, & Status */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isDesign ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {task.type}
                          </span>
                          <span className="font-mono font-bold text-xs text-slate-800">
                            {task.noReg}
                          </span>
                          <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">
                            {task.itemName}
                          </span>
                        </div>

                        {/* Overall Status Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            task.status === 'WAITING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : task.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {task.status === 'WAITING' ? 'Menunggu Approval' : task.status}
                        </span>
                      </div>

                      {/* Middle Row: Note & Requester Details */}
                      <div className="flex items-center justify-between gap-3 text-xs bg-white p-2 rounded-lg border border-slate-150">
                        <div className="min-w-0 flex-1">
                          <p className="text-slate-600 line-clamp-1 text-[11px]">
                            <span className="font-semibold text-slate-700">Catatan: </span>
                            {task.note || 'Pengajuan pembaruan revisi / kuantitas stok.'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span>Diajukan oleh: <b className="text-slate-600">{task.author}</b></span>
                            <span>&bull;</span>
                            <span>{task.date}</span>
                          </p>
                        </div>

                        {/* Multi-level Approval Chips */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Section</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                task.sectionStatus === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : task.sectionStatus === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {task.sectionStatus || 'WAITING'}
                            </span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Dept</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                task.deptStatus === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : task.deptStatus === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {task.deptStatus || 'WAITING'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Row: Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">info</span>
                          ID Task: {task.id.substring(0, 8)}...
                        </span>
                        
                        <Link
                          href={`/approval-center`}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 hover:text-[#0063ff] font-bold text-[11px] rounded-lg transition-colors cursor-pointer shadow-2xs"
                        >
                          Review Detail
                          <span className="material-symbols-outlined text-xs">arrow_forward</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Tengah */}
          <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Menampilkan <b>{filteredTasks.length}</b> tasks
            </span>
            <Link
              href="/approval-center"
              className="text-[#0063ff] hover:underline font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              Buka Approval Center Lengkap
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        </div>


        {/* ========================================================================= */}
        {/* CARD 3: KANAN (xl:col-span-3) - Due Date & Life Time Jig Fixture          */}
        {/* ========================================================================= */}
        <div className="xl:col-span-3 flex flex-col gap-3.5 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs min-h-[560px]">
          {/* Header Card Kanan */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                <span className="material-symbols-outlined text-base">timer</span>
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Due Date & Life Time</h2>
                <p className="text-[10px] text-slate-400">Monitoring masa pakai & jadwal PM Jig Fixture</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
              {lifetimeStats.total} Item
            </span>
          </div>

          {/* Lifetime Status Ratio Badges */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="flex flex-col items-center bg-rose-50/60 border border-rose-200/70 p-2 rounded-xl text-center">
              <span className="text-[9px] font-bold text-rose-600 uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Overdue
              </span>
              <span className="text-base font-black text-rose-700 mt-0.5">{lifetimeStats.overdue}</span>
            </div>
            <div className="flex flex-col items-center bg-amber-50/60 border border-amber-200/70 p-2 rounded-xl text-center">
              <span className="text-[9px] font-bold text-amber-600 uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                &le; 30 Hari
              </span>
              <span className="text-base font-black text-amber-700 mt-0.5">{lifetimeStats.warning}</span>
            </div>
            <div className="flex flex-col items-center bg-emerald-50/60 border border-emerald-200/70 p-2 rounded-xl text-center">
              <span className="text-[9px] font-bold text-emerald-600 uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Aman
              </span>
              <span className="text-base font-black text-emerald-700 mt-0.5">{lifetimeStats.safe}</span>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLifetimeFilter('ALL')}
                className={`flex-1 py-1 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer text-center ${
                  lifetimeFilter === 'ALL'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Semua ({lifetimeStats.total})
              </button>
              <button
                type="button"
                onClick={() => setLifetimeFilter('WARNING_OVERDUE')}
                className={`flex-1 py-1 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                  lifetimeFilter === 'WARNING_OVERDUE'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                Perlu Perhatian ({lifetimeStats.overdue + lifetimeStats.warning})
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative w-full">
              <span className="material-symbols-outlined text-sm text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">
                search
              </span>
              <input
                type="text"
                placeholder="Cari Reg No / Part..."
                value={lifetimeSearch}
                onChange={(e) => setLifetimeSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Lifetime Items List */}
          <div className="flex-1 overflow-y-auto max-h-[350px] space-y-2 pr-1">
            {filteredLifetime.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                <span className="material-symbols-outlined text-3xl mb-1 text-emerald-400">check_circle</span>
                <p className="text-xs font-medium">Tidak ada item yang sesuai filter.</p>
              </div>
            ) : (
              filteredLifetime.map((item) => {
                const isOverdue = item.status === 'OVERDUE';
                const isWarning = item.status === 'WARNING';

                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border transition-colors flex flex-col gap-1.5 ${
                      isOverdue
                        ? 'bg-rose-50/50 border-rose-200/80 hover:bg-rose-50'
                        : isWarning
                        ? 'bg-amber-50/50 border-amber-200/80 hover:bg-amber-50'
                        : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/70'
                    }`}
                  >
                    {/* Header item */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-200 text-slate-800">
                          {item.noReg}
                        </span>
                        <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                          {item.assyPartName}
                        </span>
                      </div>

                      {/* Due Tag */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          isOverdue
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : isWarning
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {isOverdue
                          ? 'OVERDUE'
                          : `${item.daysRemaining} hari lagi`}
                      </span>
                    </div>

                    {/* Due Date & Line */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Line: <b className="text-slate-700">{item.lineProduct || 'Line'}</b></span>
                      <span>Due: <b className="text-slate-700">{item.dueDate}</b></span>
                    </div>

                    {/* Progress Bar of Lifetime Consumed */}
                    <div className="flex flex-col gap-0.5 pt-0.5">
                      <div className="flex justify-between text-[9px] text-slate-400 font-semibold">
                        <span>Pemakaian Life Time</span>
                        <span className={isOverdue ? 'text-rose-600 font-bold' : isWarning ? 'text-amber-600 font-bold' : 'text-slate-600'}>
                          {item.lifetimePercent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOverdue
                              ? 'bg-rose-500'
                              : isWarning
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${item.lifetimePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Kanan */}
          <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">
              Kritis/Warning: <b>{lifetimeStats.overdue + lifetimeStats.warning}</b> item
            </span>
            <Link
              href="/inventory"
              className="text-rose-600 hover:underline font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              Cek Inventori
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
