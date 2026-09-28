'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { canEdit } from '@/lib/rbac';
import {
  fetchTpmSummary,
  fetchTpmSchedules,
  updateTpmSchedule,
  fetchTpmChecklists,
  createTpmChecklist,
  deleteTpmChecklist,
  fetchTpmLogs,
  createTpmLog,
  deleteTpmLog,
  TpmSummary,
  TpmScheduleItem,
  TpmChecklistItem,
  TpmMaintenanceLogItem,
  CreateTpmChecklistPayload,
  CreateTpmLogPayload,
} from '@/lib/api/tpm';
import { renewDesign, renewCellPart, recordUsage } from '@/lib/api/phase3';

type ActiveTab = 'schedules' | 'checklists' | 'logs';

export default function TPMPage() {
  const { user, isLoading } = useApp();
  const isPic = !isLoading && canEdit(user?.role);

  const [activeTab, setActiveTab] = useState<ActiveTab>('schedules');
  const [loadingData, setLoadingData] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Data states
  const [summary, setSummary] = useState<TpmSummary | null>(null);
  const [schedules, setSchedules] = useState<TpmScheduleItem[]>([]);
  const [checklists, setChecklists] = useState<TpmChecklistItem[]>([]);
  const [logs, setLogs] = useState<TpmMaintenanceLogItem[]>([]);

  // Filter states: Schedules
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DESIGN' | 'CELL_PART'>('ALL');
  const [lineFilter, setLineFilter] = useState('All');

  // Filter states: Checklists
  const [checklistSearch, setChecklistSearch] = useState('');
  const [checklistResultFilter, setChecklistResultFilter] = useState('ALL');
  const [checklistShiftFilter, setChecklistShiftFilter] = useState('ALL');

  // Filter states: Logs
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('ALL');

  // Modal: Update Schedule & Lifetime
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<TpmScheduleItem | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    lifetimeDays: 180,
    lifetimeType: 'DUAL' as 'DUAL' | 'USAGE' | 'DAYS',
    maxUsage: 500,
    currentUsage: 0,
    tpmScheduleStart: '',
    tpmScheduleDeadline: '',
  });

  // Modal: Quick Usage
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usageTarget, setUsageTarget] = useState<TpmScheduleItem | null>(null);
  const [usageAmountInput, setUsageAmountInput] = useState<number>(50);
  const [usageMode, setUsageMode] = useState<'ADD' | 'SET'>('ADD');

  // Modal: Create Checklist
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [checklistForm, setChecklistForm] = useState<CreateTpmChecklistPayload>({
    designId: '',
    cellPartId: '',
    inspectorName: user?.name || '',
    shift: 'Shift 1',
    checkDate: new Date().toISOString().split('T')[0],
    overallResult: 'OK',
    cleaningStatus: 'OK',
    locatorPinStatus: 'OK',
    clampingStatus: 'OK',
    sensorStatus: 'OK',
    boltsStatus: 'OK',
    lubricationStatus: 'OK',
    notes: '',
    linkToAbnormality: true,
  });

  // Modal: Create Maintenance Log
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState<CreateTpmLogPayload>({
    designId: '',
    cellPartId: '',
    actionType: 'PREVENTIVE',
    title: '',
    description: '',
    performedBy: user?.name || '',
    performedAt: new Date().toISOString().split('T')[0],
    durationMinutes: 60,
    partsReplaced: '',
    status: 'COMPLETED',
    cost: 0,
    resetLifetime: false,
  });

  // Modal: Quick Renew
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewTarget, setRenewTarget] = useState<TpmScheduleItem | null>(null);
  const [renewResetDays, setRenewResetDays] = useState(true);
  const [renewResetUsage, setRenewResetUsage] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load all initial data
  const loadData = async () => {
    setLoadingData(true);
    try {
      const [sum, scheds, checks, maintenanceLogs] = await Promise.all([
        fetchTpmSummary().catch(() => null),
        fetchTpmSchedules().catch(() => []),
        fetchTpmChecklists().catch(() => []),
        fetchTpmLogs().catch(() => []),
      ]);

      setSummary(sum);
      setSchedules(scheds || []);
      setChecklists(checks || []);
      setLogs(maintenanceLogs || []);
    } catch (err: any) {
      console.error('Failed to load TPM data:', err);
      setToast({ type: 'error', msg: 'Gagal memuat data TPM.' });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update inspector default name when user loads
  useEffect(() => {
    if (user?.name) {
      setChecklistForm((prev) => ({ ...prev, inspectorName: user.name }));
      setLogForm((prev) => ({ ...prev, performedBy: user.name }));
    }
  }, [user]);

  // Toast auto-clear
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Unique lines
  const uniqueLines = useMemo(() => {
    const lines = Array.from(new Set(schedules.map((s) => s.lineName).filter(Boolean)));
    return ['All', ...lines];
  }, [schedules]);

  // Filtered schedules
  const filteredSchedules = useMemo(() => {
    return schedules.filter((item) => {
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'DESIGN' && item.isCellPart) return false;
        if (typeFilter === 'CELL_PART' && !item.isCellPart) return false;
      }
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'UNSCHEDULED') {
          if (item.tpmScheduleDeadline || item.tpmLifetimeSetAt) return false;
        } else if (item.lifetimeStatus !== statusFilter) {
          return false;
        }
      }
      if (lineFilter !== 'All' && item.lineName !== lineFilter) {
        return false;
      }
      if (scheduleSearch) {
        const q = scheduleSearch.toLowerCase();
        const matchNoReg = item.noReg?.toLowerCase().includes(q);
        const matchName = item.name?.toLowerCase().includes(q);
        const matchPart = item.partNumber?.toLowerCase().includes(q);
        const matchLine = item.lineName?.toLowerCase().includes(q);
        const matchProcess = item.processName?.toLowerCase().includes(q);
        if (!matchNoReg && !matchName && !matchPart && !matchLine && !matchProcess) return false;
      }
      return true;
    });
  }, [schedules, typeFilter, statusFilter, lineFilter, scheduleSearch]);

  // Filtered checklists
  const filteredChecklists = useMemo(() => {
    return checklists.filter((item) => {
      if (checklistResultFilter !== 'ALL' && item.overallResult !== checklistResultFilter) return false;
      if (checklistShiftFilter !== 'ALL' && item.shift !== checklistShiftFilter) return false;
      if (checklistSearch) {
        const q = checklistSearch.toLowerCase();
        const matchInspector = item.inspectorName?.toLowerCase().includes(q);
        const matchNoReg = item.design?.noReg?.toLowerCase().includes(q);
        const matchName = item.design?.assyPartName?.toLowerCase().includes(q);
        const matchNotes = item.notes?.toLowerCase().includes(q);
        if (!matchInspector && !matchNoReg && !matchName && !matchNotes) return false;
      }
      return true;
    });
  }, [checklists, checklistResultFilter, checklistShiftFilter, checklistSearch]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      if (logActionFilter !== 'ALL' && item.actionType !== logActionFilter) return false;
      if (logSearch) {
        const q = logSearch.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        const matchBy = item.performedBy?.toLowerCase().includes(q);
        const matchNoReg = item.design?.noReg?.toLowerCase().includes(q);
        const matchPart = item.partsReplaced?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchBy && !matchNoReg && !matchPart) return false;
      }
      return true;
    });
  }, [logs, logActionFilter, logSearch]);

  // Handlers for Schedule Modal
  const openScheduleModal = (item: TpmScheduleItem) => {
    setSelectedScheduleItem(item);
    setScheduleForm({
      lifetimeDays: item.lifetimeDays || 180,
      lifetimeType: item.lifetimeType || 'DUAL',
      maxUsage: item.maxUsage || 500,
      currentUsage: item.currentUsage || 0,
      tpmScheduleStart: item.tpmScheduleStart ? item.tpmScheduleStart.split('T')[0] : '',
      tpmScheduleDeadline: item.tpmScheduleDeadline ? item.tpmScheduleDeadline.split('T')[0] : '',
    });
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScheduleItem) return;
    setSubmitting(true);
    try {
      await updateTpmSchedule(selectedScheduleItem.id, {
        isCellPart: selectedScheduleItem.isCellPart,
        lifetimeDays: scheduleForm.lifetimeDays,
        lifetimeType: scheduleForm.lifetimeType,
        maxUsage: scheduleForm.maxUsage,
        currentUsage: scheduleForm.currentUsage,
        tpmScheduleStart: scheduleForm.tpmScheduleStart || undefined,
        tpmScheduleDeadline: scheduleForm.tpmScheduleDeadline || undefined,
      });

      setToast({ type: 'success', msg: `Jadwal & Lifetime "${selectedScheduleItem.name}" berhasil diperbarui!` });
      setShowScheduleModal(false);
      loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal menyimpan jadwal TPM.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Open Checklist with preset target
  const openChecklistForTarget = (item: TpmScheduleItem) => {
    setChecklistForm((prev) => ({
      ...prev,
      designId: item.isCellPart ? item.parentId || item.id : item.id,
      cellPartId: item.isCellPart ? item.id : '',
      overallResult: 'OK',
      cleaningStatus: 'OK',
      locatorPinStatus: 'OK',
      clampingStatus: 'OK',
      sensorStatus: 'OK',
      boltsStatus: 'OK',
      lubricationStatus: 'OK',
      notes: '',
    }));
    setShowChecklistModal(true);
  };

  // Quick Open Maintenance Log with preset target
  const openLogForTarget = (item: TpmScheduleItem) => {
    setLogForm((prev) => ({
      ...prev,
      designId: item.isCellPart ? item.parentId || item.id : item.id,
      cellPartId: item.isCellPart ? item.id : '',
      title: `Preventive Maintenance ${item.noReg}`,
      actionType: item.lifetimeStatus === 'OVERDUE' ? 'CORRECTIVE' : 'PREVENTIVE',
      description: `Perawatan dan pengecekan fisik menyeluruh untuk ${item.name}`,
      resetLifetime: true,
    }));
    setShowLogModal(true);
  };

  // Quick Usage modal trigger
  const handleOpenUsageModal = (item: TpmScheduleItem) => {
    setUsageTarget(item);
    setUsageAmountInput(50);
    setUsageMode('ADD');
    setShowUsageModal(true);
  };

  const handleSaveUsage = async () => {
    if (!usageTarget) return;
    setSubmitting(true);
    try {
      await recordUsage(
        usageTarget.isCellPart ? 'cell-part' : 'design',
        usageTarget.id,
        usageAmountInput,
        usageMode,
      );
      setToast({
        type: 'success',
        msg: `Pemakaian "${usageTarget.name}" berhasil dicatat (${usageMode === 'ADD' ? `+${usageAmountInput}` : `set ${usageAmountInput}`}x)!`,
      });
      setShowUsageModal(false);
      setUsageTarget(null);
      await loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal mencatat pemakaian.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Checklist
  const handleSubmitChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checklistForm.designId) {
      setToast({ type: 'error', msg: 'Pilih Jig / Fixture terlebih dahulu.' });
      return;
    }
    setSubmitting(true);
    try {
      await createTpmChecklist(checklistForm);
      setToast({
        type: 'success',
        msg:
          checklistForm.overallResult === 'NG' && checklistForm.linkToAbnormality
            ? 'Checklist tersimpan & Abnormality otomatis dilaporkan!'
            : 'Laporan checklist TPM berhasil disimpan!',
      });
      setShowChecklistModal(false);
      loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal menyimpan checklist.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Maintenance Log
  const handleSubmitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logForm.designId) {
      setToast({ type: 'error', msg: 'Pilih Jig / Fixture terlebih dahulu.' });
      return;
    }
    setSubmitting(true);
    try {
      await createTpmLog(logForm);
      setToast({
        type: 'success',
        msg: logForm.resetLifetime
          ? 'Aktivitas pemeliharaan tercatat & Counter Lifetime berhasil di-reset!'
          : 'Aktivitas pemeliharaan berhasil dicatat!',
      });
      setShowLogModal(false);
      loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal menyimpan log maintenance.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Renew Lifetime Handler
  const handleQuickRenew = async () => {
    if (!renewTarget) return;
    setSubmitting(true);
    try {
      if (renewTarget.isCellPart) {
        await renewCellPart(renewTarget.id, {
          resetDays: renewResetDays,
          resetUsage: renewResetUsage,
        });
      } else {
        await renewDesign(renewTarget.id, {
          resetDays: renewResetDays,
          resetUsage: renewResetUsage,
        });
      }
      setToast({ type: 'success', msg: `Lifetime "${renewTarget.name}" berhasil di-renew!` });
      setShowRenewModal(false);
      loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal me-renew lifetime.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Checklist
  const handleDeleteChecklist = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan checklist ini?')) return;
    try {
      await deleteTpmChecklist(id);
      setToast({ type: 'success', msg: 'Catatan checklist berhasil dihapus.' });
      loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: 'Gagal menghapus checklist.' });
    }
  };

  // Delete Log
  const handleDeleteLog = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan maintenance ini?')) return;
    try {
      await deleteTpmLog(id);
      setToast({ type: 'success', msg: 'Catatan maintenance berhasil dihapus.' });
      loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: 'Gagal menghapus maintenance log.' });
    }
  };

  // Unique designs list for dropdowns
  const designOptions = useMemo(() => {
    const map = new Map<string, string>();
    schedules.forEach((s) => {
      const id = s.isCellPart ? s.parentId || s.id : s.id;
      const label = `${s.noReg} - ${s.isCellPart ? s.parentName || s.name : s.name}`;
      if (!map.has(id)) map.set(id, label);
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [schedules]);

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 pt-2 bg-white h-full overflow-hidden">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[99] px-4 py-2 rounded-lg text-xs font-bold shadow-lg transition-all ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header controls matching standard dashboard layout */}
      <header className="h-12 flex justify-between items-center border-b border-gray-150 mb-3 shrink-0">
        <div className="flex items-center gap-4">
          {/* Title: changed to TPM only */}
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-1.5 shrink-0">
            <span className="material-symbols-outlined text-[#0063ff] text-lg">build_circle</span>
            TPM
          </h2>

          {/* 4 Compact & Simple Mini Cards in Topbar (Solid colors, rounded-lg, matching height) */}
          <div className="flex items-center gap-1.5">
            {/* Safe */}
            <button
              type="button"
              onClick={() => {
                if (activeTab !== 'schedules') setActiveTab('schedules');
                setStatusFilter(statusFilter === 'SAFE' ? 'ALL' : 'SAFE');
              }}
              title="Filter Aman (Safe)"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-xs ${
                statusFilter === 'SAFE'
                  ? 'bg-green-600 text-white ring-2 ring-green-400'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[13px] leading-none">check_circle</span>
              <span>Aman</span>
              <span className="px-1.5 py-0.2 rounded bg-black/20 text-white text-[9px] font-black">
                {summary?.safeCount ?? 0}
              </span>
            </button>

            {/* Warning */}
            <button
              type="button"
              onClick={() => {
                if (activeTab !== 'schedules') setActiveTab('schedules');
                setStatusFilter(statusFilter === 'WARNING' ? 'ALL' : 'WARNING');
              }}
              title="Filter Warning (Mendekati Limit)"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-xs ${
                statusFilter === 'WARNING'
                  ? 'bg-yellow-500 text-yellow-950 ring-2 ring-yellow-300'
                  : 'bg-yellow-400 hover:bg-yellow-500 text-yellow-950'
              }`}
            >
              <span className="material-symbols-outlined text-[13px] leading-none">warning</span>
              <span>Warning</span>
              <span className="px-1.5 py-0.2 rounded bg-black/15 text-yellow-950 text-[9px] font-black">
                {summary?.warningCount ?? 0}
              </span>
            </button>

            {/* Overdue */}
            <button
              type="button"
              onClick={() => {
                if (activeTab !== 'schedules') setActiveTab('schedules');
                setStatusFilter(statusFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE');
              }}
              title="Filter Overdue (Lewat Batas)"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-xs relative overflow-hidden ${
                statusFilter === 'OVERDUE'
                  ? 'bg-red-700 text-white ring-2 ring-red-400'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              {(summary?.overdueCount ?? 0) > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
              )}
              <span className="material-symbols-outlined text-[13px] leading-none">error</span>
              <span>Overdue</span>
              <span className="px-1.5 py-0.2 rounded bg-black/25 text-white text-[9px] font-black">
                {summary?.overdueCount ?? 0}
              </span>
            </button>

            {/* Inspeksi */}
            <button
              type="button"
              onClick={() => setActiveTab('checklists')}
              title="Lihat Inspeksi Hari Ini"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-xs ${
                activeTab === 'checklists'
                  ? 'bg-blue-700 text-white ring-2 ring-blue-400'
                  : 'bg-[#0063ff] hover:bg-[#0052d4] text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[13px] leading-none">checklist_rtl</span>
              <span>Inspeksi</span>
              <span className="px-1.5 py-0.2 rounded bg-black/20 text-white text-[9px] font-black">
                {summary?.checklistTodayCount ?? 0}
              </span>
            </button>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Action Button for PIC */}
          {isPic && (
            <div className="flex items-center gap-1.5">
              {activeTab === 'schedules' && (
                <button
                  onClick={() => {
                    setChecklistForm((prev) => ({
                      ...prev,
                      designId: designOptions[0]?.id || '',
                      cellPartId: '',
                      notes: '',
                    }));
                    setShowChecklistModal(true);
                  }}
                  className="bg-[#0063ff] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#0052d4] transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-xs">fact_check</span>
                  Isi Checklist
                </button>
              )}

              {activeTab === 'checklists' && (
                <button
                  onClick={() => {
                    setChecklistForm((prev) => ({
                      ...prev,
                      designId: designOptions[0]?.id || '',
                      cellPartId: '',
                      notes: '',
                    }));
                    setShowChecklistModal(true);
                  }}
                  className="bg-[#0063ff] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#0052d4] transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-xs">add_task</span>
                  Form Checklist
                </button>
              )}

              {activeTab === 'logs' && (
                <button
                  onClick={() => {
                    setLogForm((prev) => ({
                      ...prev,
                      designId: designOptions[0]?.id || '',
                      cellPartId: '',
                      title: 'Preventive Maintenance Rutin',
                      description: '',
                    }));
                    setShowLogModal(true);
                  }}
                  className="bg-[#0063ff] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#0052d4] transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-xs">handyman</span>
                  Catat Servis
                </button>
              )}
            </div>
          )}

          {/* Reload button */}
          <button
            onClick={loadData}
            title="Muat Ulang Data"
            className="px-2.5 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors cursor-pointer flex items-center justify-center shadow-xs"
          >
            <span className={`material-symbols-outlined text-xs ${loadingData ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
        </div>
      </header>

      {/* Button Switch Tabs (Dipindahkan ke lokasi 4 card sebelumnya) */}
      <div className="flex gap-2.5 mb-3 shrink-0">
        <button
          onClick={() => setActiveTab('schedules')}
          className={`flex-1 rounded-xl px-4 py-2 flex items-center justify-between border transition-all cursor-pointer shadow-xs ${
            activeTab === 'schedules'
              ? 'bg-blue-50/70 border-[#0063ff] ring-1 ring-[#0063ff]'
              : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                activeTab === 'schedules' ? 'bg-[#0063ff] text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className="material-symbols-outlined text-base">calendar_month</span>
            </div>
            <div className="text-left">
              <h3 className={`text-xs font-bold leading-none ${activeTab === 'schedules' ? 'text-blue-900' : 'text-gray-800'}`}>
                Jadwal Preventif &amp; Lifetime
              </h3>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'schedules' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {filteredSchedules.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('checklists')}
          className={`flex-1 rounded-xl px-4 py-2 flex items-center justify-between border transition-all cursor-pointer shadow-xs ${
            activeTab === 'checklists'
              ? 'bg-blue-50/70 border-[#0063ff] ring-1 ring-[#0063ff]'
              : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                activeTab === 'checklists' ? 'bg-[#0063ff] text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className="material-symbols-outlined text-base">fact_check</span>
            </div>
            <div className="text-left">
              <h3 className={`text-xs font-bold leading-none ${activeTab === 'checklists' ? 'text-blue-900' : 'text-gray-800'}`}>
                Daily Checklist Inspeksi
              </h3>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'checklists' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {filteredChecklists.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 rounded-xl px-4 py-2 flex items-center justify-between border transition-all cursor-pointer shadow-xs ${
            activeTab === 'logs'
              ? 'bg-blue-50/70 border-[#0063ff] ring-1 ring-[#0063ff]'
              : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                activeTab === 'logs' ? 'bg-[#0063ff] text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className="material-symbols-outlined text-base">history_toggle_off</span>
            </div>
            <div className="text-left">
              <h3 className={`text-xs font-bold leading-none ${activeTab === 'logs' ? 'text-blue-900' : 'text-gray-800'}`}>
                Riwayat Servis &amp; Maintenance
              </h3>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'logs' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {filteredLogs.length}
          </span>
        </button>
      </div>

      {/* Main Tab Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* ============================================================== */}
        {/* TAB 1: JADWAL PREVENTIF & LIFETIME MONITORING                 */}
        {/* ============================================================== */}
        {activeTab === 'schedules' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filter toolbar with right-aligned search bar */}
            <div className="flex items-center justify-between gap-3 mb-2 shrink-0">
              <div className="flex items-center gap-2">
                {/* Status dropdown pill */}
                <div className="relative flex items-center gap-1 text-[9px] text-gray-500 font-semibold border border-gray-200 rounded-full px-2 py-0.5 cursor-pointer hover:bg-gray-50">
                  <span>Status: {statusFilter}</span>
                  <span className="material-symbols-outlined text-[12px]">expand_more</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer text-xs"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="SAFE">Safe (Aman)</option>
                    <option value="WARNING">Warning (Mendekati)</option>
                    <option value="OVERDUE">Overdue (Lewat Batas)</option>
                    <option value="UNSCHEDULED">Belum Terjadwal</option>
                  </select>
                </div>

                {/* Type dropdown pill */}
                <div className="relative flex items-center gap-1 text-[9px] text-gray-500 font-semibold border border-gray-200 rounded-full px-2 py-0.5 cursor-pointer hover:bg-gray-50">
                  <span>Tipe: {typeFilter}</span>
                  <span className="material-symbols-outlined text-[12px]">expand_more</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="absolute inset-0 opacity-0 cursor-pointer text-xs"
                  >
                    <option value="ALL">Semua Tipe</option>
                    <option value="DESIGN">Jig / Fixture Induk</option>
                    <option value="CELL_PART">Cell Part</option>
                  </select>
                </div>

                {/* Line dropdown pill */}
                <div className="relative flex items-center gap-1 text-[9px] text-gray-500 font-semibold border border-gray-200 rounded-full px-2 py-0.5 cursor-pointer hover:bg-gray-50">
                  <span>Line: {lineFilter}</span>
                  <span className="material-symbols-outlined text-[12px]">expand_more</span>
                  <select
                    value={lineFilter}
                    onChange={(e) => setLineFilter(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer text-xs"
                  >
                    {uniqueLines.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right: Search Bar & Count */}
              <div className="flex items-center gap-2.5">
                <div className="text-[10px] text-gray-400 font-medium hidden sm:inline">
                  <strong className="text-gray-700">{filteredSchedules.length}</strong> item
                </div>
                <div className="relative">
                  <span
                    className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]"
                    style={{ fontSize: '10px' }}
                  >
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search No.Reg, Part Name, Line..."
                    value={scheduleSearch}
                    onChange={(e) => setScheduleSearch(e.target.value)}
                    className="pl-7 pr-3 py-1 bg-gray-100 border border-gray-300 rounded-full text-[10px] w-56 focus:ring-1 focus:ring-[#0063ff] focus:border-[#0063ff] focus:bg-white outline-none text-gray-700 placeholder-gray-400 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-y-auto no-scrollbar rounded-lg border border-gray-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-semibold sticky top-0 z-10 border-b border-gray-200">
                    <th className="px-3 py-2">No. Reg / Part</th>
                    <th className="px-2 py-2">Item Name / Assy</th>
                    <th className="px-2 py-2">Line &amp; OP</th>
                    <th className="px-2 text-center py-2">Lifetime (2-Way)</th>
                    <th className="px-2 text-center py-2">Jadwal Servis</th>
                    <th className="px-2 text-center py-2">Status</th>
                    {isPic && <th className="px-2 text-center py-2">Action</th>}
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {filteredSchedules.map((item) => {
                    const isOverdue = item.lifetimeStatus === 'OVERDUE';
                    const isWarning = item.lifetimeStatus === 'WARNING';
                    const days = item.daysRemaining;
                    const maxUsage = item.maxUsage || 500;
                    const curUsage = item.currentUsage || 0;
                    const usagePct = Math.min(100, Math.round((curUsage / maxUsage) * 100));

                    return (
                      <tr
                        key={`${item.isCellPart ? 'cp' : 'd'}-${item.id}`}
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          isOverdue ? 'bg-red-50/50 hover:bg-red-100/50' : ''
                        }`}
                      >
                        {/* No Reg */}
                        <td className="px-3 font-normal font-mono py-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[8px] font-bold px-1 py-0.2 rounded-full uppercase ${
                                item.isCellPart
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {item.isCellPart ? 'PART' : item.type || 'JIG'}
                            </span>
                            <span className="font-bold text-gray-800">
                              {item.isCellPart ? item.partNumber : item.noReg}
                            </span>
                          </div>
                          {item.isCellPart && item.parentNoReg && (
                            <div className="text-[9px] text-gray-400 font-sans mt-0.5">
                              Induk: {item.parentNoReg}
                            </div>
                          )}
                        </td>

                        {/* Name */}
                        <td className="px-2 py-2">
                          <div className="font-bold text-gray-800">{item.name}</div>
                          {!item.isCellPart && item.cellPartsCount > 0 && (
                            <span className="text-[8.5px] text-blue-600 bg-blue-50 px-1 py-0.2 rounded font-medium inline-block mt-0.5">
                              {item.cellPartsCount} Cell Part terdaftar
                            </span>
                          )}
                        </td>

                        {/* Line & Process */}
                        <td className="px-2 py-2">
                          <div className="font-medium text-gray-800">{item.lineName || '—'}</div>
                          <div className="text-[9px] text-gray-400">{item.processName || '—'}</div>
                        </td>

                        {/* 2-Way Lifetime Column */}
                        <td className="px-2 py-2 text-center">
                          <div className="inline-flex flex-col items-center gap-1 min-w-[130px]">
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full font-mono ${
                                isOverdue
                                  ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                  : isWarning
                                  ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                              }`}
                            >
                              {item.lifetimeType === 'DAYS'
                                ? `${days}d rem (${item.lifetimeDays}d)`
                                : item.lifetimeType === 'USAGE'
                                ? `${curUsage}/${maxUsage}x`
                                : `${curUsage}/${maxUsage}x · ${days}d`}
                            </span>

                            {/* Mini progress meter */}
                            <div className="w-24 bg-gray-200 rounded-full h-1 overflow-hidden">
                              <div
                                className={`h-full ${
                                  isOverdue ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${usagePct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Scheduled Date */}
                        <td className="px-2 py-2 text-center text-[10px]">
                          {item.tpmScheduleDeadline ? (
                            <div>
                              <span className="font-semibold text-gray-800">
                                {new Date(item.tpmScheduleDeadline).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                              {item.tpmScheduleStart && (
                                <div className="text-[8.5px] text-gray-400">
                                  Start:{' '}
                                  {new Date(item.tpmScheduleStart).toLocaleDateString('id-ID', {
                                    day: '2-digit',
                                    month: 'short',
                                  })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-[9px]">Belum diatur</span>
                          )}
                        </td>

                        {/* Status Column with solid color badge like Inventory */}
                        <td
                          className={`px-2 py-2 text-center font-bold text-[9px] uppercase tracking-wider ${
                            isOverdue
                              ? 'bg-red-500 text-white'
                              : isWarning
                              ? 'bg-yellow-400 text-yellow-950'
                              : 'bg-green-500 text-white'
                          }`}
                        >
                          {isOverdue ? 'Overdue' : isWarning ? 'Warning' : 'Aman'}
                        </td>

                        {/* Actions */}
                        {isPic && (
                          <td className="px-2 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Quick Usage Counter */}
                              <button
                                type="button"
                                onClick={() => handleOpenUsageModal(item)}
                                className="text-[8px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 cursor-pointer"
                                title="Catat Pemakaian Siklus"
                              >
                                + Catat
                              </button>

                              {/* Quick Renew */}
                              <button
                                type="button"
                                onClick={() => {
                                  setRenewTarget(item);
                                  setShowRenewModal(true);
                                }}
                                className="text-[8px] font-bold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 cursor-pointer"
                                title="Renew Lifetime"
                              >
                                Renew
                              </button>

                              {/* Atur Jadwal */}
                              <button
                                type="button"
                                onClick={() => openScheduleModal(item)}
                                className="text-gray-400 hover:text-indigo-600 p-0.5 hover:bg-indigo-50 rounded cursor-pointer"
                                title="Atur Jadwal & Limit TPM"
                              >
                                <span className="material-symbols-outlined text-[15px]">edit_calendar</span>
                              </button>

                              {/* Isi Checklist */}
                              <button
                                type="button"
                                onClick={() => openChecklistForTarget(item)}
                                className="text-gray-400 hover:text-emerald-600 p-0.5 hover:bg-emerald-50 rounded cursor-pointer"
                                title="Isi Checklist Inspeksi"
                              >
                                <span className="material-symbols-outlined text-[15px]">fact_check</span>
                              </button>

                              {/* Catat Servis */}
                              <button
                                type="button"
                                onClick={() => openLogForTarget(item)}
                                className="text-gray-400 hover:text-purple-600 p-0.5 hover:bg-purple-50 rounded cursor-pointer"
                                title="Catat Servis / Maintenance"
                              >
                                <span className="material-symbols-outlined text-[15px]">handyman</span>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {filteredSchedules.length === 0 && (
                    <tr>
                      <td colSpan={isPic ? 7 : 6} className="text-center py-12 text-gray-400 text-xs">
                        Tidak ada data jadwal TPM yang sesuai filter pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: DAILY CHECKLIST INSPECTION                             */}
        {/* ============================================================== */}
        {activeTab === 'checklists' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filter Toolbar with right-aligned search bar */}
            <div className="flex items-center justify-between gap-3 mb-2 shrink-0">
              <div className="flex items-center gap-2">
                {/* Result filter pill */}
                <div className="relative flex items-center gap-1 text-[9px] text-gray-500 font-semibold border border-gray-200 rounded-full px-2 py-0.5 cursor-pointer hover:bg-gray-50">
                  <span>Hasil: {checklistResultFilter}</span>
                  <span className="material-symbols-outlined text-[12px]">expand_more</span>
                  <select
                    value={checklistResultFilter}
                    onChange={(e) => setChecklistResultFilter(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer text-xs"
                  >
                    <option value="ALL">Semua Hasil</option>
                    <option value="OK">Hanya Hasil OK</option>
                    <option value="NG">Hanya Hasil NG</option>
                  </select>
                </div>

                {/* Shift filter pill */}
                <div className="relative flex items-center gap-1 text-[9px] text-gray-500 font-semibold border border-gray-200 rounded-full px-2 py-0.5 cursor-pointer hover:bg-gray-50">
                  <span>Shift: {checklistShiftFilter}</span>
                  <span className="material-symbols-outlined text-[12px]">expand_more</span>
                  <select
                    value={checklistShiftFilter}
                    onChange={(e) => setChecklistShiftFilter(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer text-xs"
                  >
                    <option value="ALL">Semua Shift</option>
                    <option value="Shift 1">Shift 1</option>
                    <option value="Shift 2">Shift 2</option>
                    <option value="Shift 3">Shift 3</option>
                    <option value="Non-Shift">Non-Shift</option>
                  </select>
                </div>
              </div>

              {/* Right: Search Bar & Count */}
              <div className="flex items-center gap-2.5">
                <div className="text-[10px] text-gray-400 font-medium hidden sm:inline">
                  <strong className="text-gray-700">{filteredChecklists.length}</strong> catatan
                </div>
                <div className="relative">
                  <span
                    className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]"
                    style={{ fontSize: '10px' }}
                  >
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search Inspector, No.Reg, Part..."
                    value={checklistSearch}
                    onChange={(e) => setChecklistSearch(e.target.value)}
                    className="pl-7 pr-3 py-1 bg-gray-100 border border-gray-300 rounded-full text-[10px] w-56 focus:ring-1 focus:ring-[#0063ff] focus:border-[#0063ff] focus:bg-white outline-none text-gray-700 placeholder-gray-400 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-y-auto no-scrollbar rounded-lg border border-gray-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-semibold sticky top-0 z-10 border-b border-gray-200">
                    <th className="px-3 py-2">Tanggal / Waktu</th>
                    <th className="px-2 py-2">Shift &amp; Inspector</th>
                    <th className="px-2 py-2">Target Jig / Part</th>
                    <th className="px-2 text-center py-2">Parameter (6 Poin)</th>
                    <th className="px-2 text-center py-2">Hasil</th>
                    <th className="px-2 py-2">Catatan Temuan</th>
                    {isPic && <th className="px-2 text-center py-2">Action</th>}
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {filteredChecklists.map((check) => {
                    const isNg = check.overallResult === 'NG';
                    return (
                      <tr
                        key={check.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          isNg ? 'bg-red-50/40 hover:bg-red-100/40' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-[10px] text-gray-700">
                          <div>
                            {new Date(check.checkDate).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                          <div className="text-[8.5px] text-gray-400">
                            {new Date(check.checkDate).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>

                        <td className="px-2 py-2">
                          <span className="text-[8.5px] font-bold bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded border border-gray-200">
                            {check.shift}
                          </span>
                          <div className="font-bold text-gray-800 text-[11px] mt-0.5">{check.inspectorName}</div>
                        </td>

                        <td className="px-2 py-2">
                          <div className="font-mono font-bold text-gray-900">{check.design?.noReg}</div>
                          <div className="text-[10px] text-gray-500">{check.design?.assyPartName}</div>
                          {check.cellPart && (
                            <div className="text-[9px] text-amber-700 font-medium">
                              Part: {check.cellPart.name} ({check.cellPart.partNumber})
                            </div>
                          )}
                        </td>

                        <td className="px-2 py-2 text-center">
                          <div className="inline-grid grid-cols-6 gap-0.5 text-[8.5px] font-mono">
                            <span
                              title="Kebersihan"
                              className={`px-1 py-0.2 rounded font-bold ${
                                check.cleaningStatus === 'OK'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-700 border border-rose-300'
                              }`}
                            >
                              Cln
                            </span>
                            <span
                              title="Locator Pin"
                              className={`px-1 py-0.2 rounded font-bold ${
                                check.locatorPinStatus === 'OK'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-700 border border-rose-300'
                              }`}
                            >
                              Pin
                            </span>
                            <span
                              title="Clamping / Klem"
                              className={`px-1 py-0.2 rounded font-bold ${
                                check.clampingStatus === 'OK'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-700 border border-rose-300'
                              }`}
                            >
                              Clp
                            </span>
                            <span
                              title="Sensor / Pokayoke"
                              className={`px-1 py-0.2 rounded font-bold ${
                                check.sensorStatus === 'OK'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-700 border border-rose-300'
                              }`}
                            >
                              Sen
                            </span>
                            <span
                              title="Baut & Baseplate"
                              className={`px-1 py-0.2 rounded font-bold ${
                                check.boltsStatus === 'OK'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-700 border border-rose-300'
                              }`}
                            >
                              Blt
                            </span>
                            <span
                              title="Pelumasan"
                              className={`px-1 py-0.2 rounded font-bold ${
                                check.lubricationStatus === 'OK'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-700 border border-rose-300'
                              }`}
                            >
                              Lub
                            </span>
                          </div>
                        </td>

                        <td
                          className={`px-2 py-2 text-center font-bold text-[9px] uppercase tracking-wider ${
                            isNg ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                          }`}
                        >
                          {isNg ? 'NG' : 'OK'}
                        </td>

                        <td className="px-2 py-2 text-gray-600 text-[10px]">
                          <div>{check.notes || '—'}</div>
                          {check.linkToAbnormality && check.abnormalityId && (
                            <span className="inline-flex items-center gap-0.5 text-[8.5px] text-red-600 font-bold mt-0.5">
                              <span className="material-symbols-outlined text-[10px]">link</span>
                              Link Abnormality
                            </span>
                          )}
                        </td>

                        {isPic && (
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => handleDeleteChecklist(check.id)}
                              title="Hapus checklist"
                              className="text-gray-400 hover:text-red-600 p-0.5 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[15px]">delete</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {filteredChecklists.length === 0 && (
                    <tr>
                      <td colSpan={isPic ? 7 : 6} className="text-center py-12 text-gray-400 text-xs">
                        Belum ada catatan checklist inspeksi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: MAINTENANCE & SERVICE LOGS                             */}
        {/* ============================================================== */}
        {activeTab === 'logs' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filter Toolbar with right-aligned search bar */}
            <div className="flex items-center justify-between gap-3 mb-2 shrink-0">
              <div className="flex items-center gap-2">
                {/* Action category pill */}
                <div className="relative flex items-center gap-1 text-[9px] text-gray-500 font-semibold border border-gray-200 rounded-full px-2 py-0.5 cursor-pointer hover:bg-gray-50">
                  <span>Kategori: {logActionFilter}</span>
                  <span className="material-symbols-outlined text-[12px]">expand_more</span>
                  <select
                    value={logActionFilter}
                    onChange={(e) => setLogActionFilter(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer text-xs"
                  >
                    <option value="ALL">Semua Kategori</option>
                    <option value="PREVENTIVE">Preventive Maintenance (PM)</option>
                    <option value="CORRECTIVE">Corrective Maintenance (CM)</option>
                    <option value="RENEWAL">Renewal / Overhaul</option>
                    <option value="CALIBRATION">Kalibrasi &amp; Alignment</option>
                  </select>
                </div>
              </div>

              {/* Right: Search Bar & Count */}
              <div className="flex items-center gap-2.5">
                <div className="text-[10px] text-gray-400 font-medium hidden sm:inline">
                  <strong className="text-gray-700">{filteredLogs.length}</strong> riwayat
                </div>
                <div className="relative">
                  <span
                    className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]"
                    style={{ fontSize: '10px' }}
                  >
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search Judul, Teknisi, No.Reg..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="pl-7 pr-3 py-1 bg-gray-100 border border-gray-300 rounded-full text-[10px] w-56 focus:ring-1 focus:ring-[#0063ff] focus:border-[#0063ff] focus:bg-white outline-none text-gray-700 placeholder-gray-400 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-y-auto no-scrollbar rounded-lg border border-gray-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-semibold sticky top-0 z-10 border-b border-gray-200">
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-2 py-2">Kategori</th>
                    <th className="px-2 py-2">Target Jig / Part</th>
                    <th className="px-2 py-2">Aktivitas &amp; Deskripsi</th>
                    <th className="px-2 py-2">Part Diganti</th>
                    <th className="px-2 py-2">Teknisi &amp; Durasi</th>
                    <th className="px-2 text-center py-2">Status</th>
                    {isPic && <th className="px-2 text-center py-2">Action</th>}
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {filteredLogs.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 font-mono text-[10px] text-gray-700 whitespace-nowrap">
                        {new Date(item.performedAt).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="px-2 py-2">
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded text-[8.5px] font-bold ${
                            item.actionType === 'PREVENTIVE'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : item.actionType === 'CORRECTIVE'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : item.actionType === 'RENEWAL'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {item.actionType}
                        </span>
                        {item.resetLifetime && (
                          <div className="text-[8px] text-emerald-600 font-bold mt-0.5 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[10px]">restart_alt</span>
                            Reset Lifetime
                          </div>
                        )}
                      </td>

                      <td className="px-2 py-2">
                        <div className="font-mono font-bold text-gray-900">{item.design?.noReg}</div>
                        <div className="text-[10px] text-gray-500">{item.design?.assyPartName}</div>
                        {item.cellPart && (
                          <div className="text-[9px] text-amber-700 font-medium">
                            Part: {item.cellPart.name} ({item.cellPart.partNumber})
                          </div>
                        )}
                      </td>

                      <td className="px-2 py-2 text-gray-700">
                        <div className="font-bold text-gray-800 text-[11px]">{item.title}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{item.description}</div>
                      </td>

                      <td className="px-2 py-2 text-[10px] text-gray-600">{item.partsReplaced || '—'}</td>

                      <td className="px-2 py-2">
                        <div className="font-semibold text-gray-800 text-[11px]">{item.performedBy}</div>
                        <div className="text-[9px] text-gray-400">
                          {item.durationMinutes}m
                          {item.cost && item.cost > 0
                            ? ` · Rp ${Number(item.cost).toLocaleString('id-ID')}`
                            : ''}
                        </div>
                      </td>

                      <td className="px-2 py-2 text-center">
                        <span
                          className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full ${
                            item.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      {isPic && (
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => handleDeleteLog(item.id)}
                            title="Hapus log servis"
                            className="text-gray-400 hover:text-red-600 p-0.5 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}

                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={isPic ? 8 : 7} className="text-center py-12 text-gray-400 text-xs">
                        Belum ada riwayat aktivitas maintenance yang dicatat.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* QUICK MODAL 1: ATUR JADWAL & LIFETIME TPM                 */}
      {/* ========================================================= */}
      {showScheduleModal && selectedScheduleItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[95]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            {/* Header */}
            <div className="p-4 border-b border-gray-150 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#0063ff] text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-lg">calendar_month</span>
                </div>
                <div>
                  <h3 className="font-bold text-xs text-gray-800">Atur Jadwal &amp; Lifetime TPM</h3>
                  <p className="text-[9px] text-gray-500">
                    {selectedScheduleItem.noReg} — {selectedScheduleItem.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                    Mulai Jadwal TPM
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.tpmScheduleStart}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, tpmScheduleStart: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#0063ff]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                    Deadline Servis
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.tpmScheduleDeadline}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, tpmScheduleDeadline: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#0063ff]"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200/60 space-y-2.5">
                <span className="text-[9px] font-bold text-blue-900 uppercase tracking-wider block">
                  Konfigurasi 2-Way Lifetime
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-medium text-gray-600 mb-1">
                      Mode Evaluasi
                    </label>
                    <select
                      value={scheduleForm.lifetimeType}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, lifetimeType: e.target.value as any }))
                      }
                      className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none"
                    >
                      <option value="DUAL">DUAL (2-Way)</option>
                      <option value="DAYS">Hanya Hari</option>
                      <option value="USAGE">Hanya Siklus</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-medium text-gray-600 mb-1">
                      Batas Hari
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={scheduleForm.lifetimeDays}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, lifetimeDays: parseInt(e.target.value) || 1 }))
                      }
                      className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-medium text-gray-600 mb-1">
                      Maks Siklus (x)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={scheduleForm.maxUsage}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, maxUsage: parseInt(e.target.value) || 1 }))
                      }
                      className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-medium text-gray-600 mb-1">
                    Counter Pemakaian Saat Ini
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={scheduleForm.currentUsage}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, currentUsage: parseInt(e.target.value) || 0 }))
                    }
                    className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3.5 py-1.5 bg-[#0063ff] text-white hover:bg-[#0052d4] rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Jadwal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* QUICK MODAL 2: LOG / RECORD USAGE                         */}
      {/* ========================================================= */}
      {showUsageModal && usageTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[95]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            {/* Header */}
            <div className="p-4 border-b border-gray-150 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#0063ff] text-white flex items-center justify-center shadow-xs">
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
            <div className="p-4 space-y-3">
              {/* Target Item Card */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[8.5px] font-bold text-gray-500 uppercase">
                    {usageTarget.isCellPart ? 'CellPart (Komponen)' : 'Jig & Fixture (Induk)'}
                  </span>
                  <span className="font-mono text-[9px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                    {usageTarget.isCellPart ? usageTarget.partNumber : usageTarget.noReg}
                  </span>
                </div>
                <div className="font-bold text-xs text-gray-900 truncate" title={usageTarget.name}>
                  {usageTarget.name}
                </div>
                <div className="flex items-center justify-between pt-1 text-[10px] text-gray-600">
                  <span>Pemakaian Saat Ini:</span>
                  <span className="font-mono font-bold text-gray-800">
                    {usageTarget.currentUsage || 0} / {usageTarget.maxUsage || 500}x
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
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Number Input */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  {usageMode === 'ADD' ? 'Jumlah Pemakaian yang Ditambahkan' : 'Nilai Counter Baru'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={usageAmountInput}
                  onChange={(e) => setUsageAmountInput(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold font-mono outline-none focus:ring-1 focus:ring-[#0063ff]"
                />
              </div>

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
                  className="flex-1 py-2 bg-[#0063ff] text-white rounded-lg text-xs font-bold hover:bg-[#0052d4] transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
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

      {/* ========================================================= */}
      {/* QUICK MODAL 3: FORM CHECKLIST INSPEKSI                    */}
      {/* ========================================================= */}
      {showChecklistModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[95] overflow-y-auto">
          <div className="bg-white border border-gray-300 rounded-2xl max-w-lg w-full p-5 shadow-2xl relative my-6 text-gray-800">
            <div className="flex items-center justify-between pb-3 border-b border-gray-150">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0063ff] flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">fact_check</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900">Form Checklist Inspeksi TPM</h3>
                  <p className="text-[9px] text-gray-500">
                    Inspeksi mandiri kondisi fisik, fungsi mekanisme, dan kelayakan Jig
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowChecklistModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitChecklist} className="mt-3 space-y-3">
              {/* Target Selection */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Pilih Jig / Fixture Induk *
                </label>
                <select
                  required
                  value={checklistForm.designId}
                  onChange={(e) =>
                    setChecklistForm((prev) => ({ ...prev, designId: e.target.value, cellPartId: '' }))
                  }
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#0063ff]"
                >
                  <option value="">-- Pilih Jig / Fixture --</option>
                  {designOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Inspector info */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                    Inspector
                  </label>
                  <input
                    type="text"
                    required
                    value={checklistForm.inspectorName}
                    onChange={(e) =>
                      setChecklistForm((prev) => ({ ...prev, inspectorName: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                    Shift
                  </label>
                  <select
                    value={checklistForm.shift}
                    onChange={(e) => setChecklistForm((prev) => ({ ...prev, shift: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none"
                  >
                    <option value="Shift 1">Shift 1</option>
                    <option value="Shift 2">Shift 2</option>
                    <option value="Shift 3">Shift 3</option>
                    <option value="Non-Shift">Non-Shift</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={checklistForm.checkDate}
                    onChange={(e) =>
                      setChecklistForm((prev) => ({ ...prev, checkDate: e.target.value }))
                    }
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none"
                  />
                </div>
              </div>

              {/* 6 Inspection Items */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
                <span className="text-[10px] font-bold text-gray-800 block uppercase">
                  Item Pemeriksaan Standar:
                </span>

                {[
                  { key: 'cleaningStatus', label: '1. Kebersihan dari chips / gram & debu' },
                  { key: 'locatorPinStatus', label: '2. Locator Pin & Guide Bushing (tidak aus/oblak)' },
                  { key: 'clampingStatus', label: '3. Fungsi Clamping / Toggle / Pneumatic (kencang)' },
                  { key: 'sensorStatus', label: '4. Sensor Proximity / Pokayoke (deteksi baik)' },
                  { key: 'boltsStatus', label: '5. Kekencangan Baut-baut & Baseplate' },
                  { key: 'lubricationStatus', label: '6. Pelumasan / Greasing pada bagian bergerak' },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-0.5 border-b border-gray-100 last:border-0 text-xs"
                  >
                    <span className="text-gray-700 text-[11px]">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name={item.key}
                          value="OK"
                          checked={(checklistForm as any)[item.key] === 'OK'}
                          onChange={() =>
                            setChecklistForm((prev) => ({ ...prev, [item.key]: 'OK' }))
                          }
                          className="text-green-600 focus:ring-green-500"
                        />
                        <span className="text-[10px] font-bold text-green-700">OK</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name={item.key}
                          value="NG"
                          checked={(checklistForm as any)[item.key] === 'NG'}
                          onChange={() =>
                            setChecklistForm((prev) => ({
                              ...prev,
                              [item.key]: 'NG',
                              overallResult: 'NG',
                            }))
                          }
                          className="text-red-600 focus:ring-red-500"
                        />
                        <span className="text-[10px] font-bold text-red-700">NG</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Overall Result */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-gray-200 bg-white">
                <span className="text-[10px] font-bold text-gray-800 uppercase">Hasil Inspeksi:</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="overallResult"
                      value="OK"
                      checked={checklistForm.overallResult === 'OK'}
                      onChange={() => setChecklistForm((prev) => ({ ...prev, overallResult: 'OK' }))}
                      className="text-green-600"
                    />
                    <span className="text-xs font-bold text-green-700">🟢 OK</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="overallResult"
                      value="NG"
                      checked={checklistForm.overallResult === 'NG'}
                      onChange={() => setChecklistForm((prev) => ({ ...prev, overallResult: 'NG' }))}
                      className="text-red-600"
                    />
                    <span className="text-xs font-bold text-red-700">🔴 NG</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Catatan Temuan
                </label>
                <textarea
                  rows={2}
                  placeholder="Tuliskan catatan khusus atau temuan kerusakan jika ada..."
                  value={checklistForm.notes}
                  onChange={(e) => setChecklistForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#0063ff]"
                />
              </div>

              {/* Abnormality Link checkbox */}
              {checklistForm.overallResult === 'NG' && (
                <label className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklistForm.linkToAbnormality}
                    onChange={(e) =>
                      setChecklistForm((prev) => ({ ...prev, linkToAbnormality: e.target.checked }))
                    }
                    className="mt-0.5 text-red-600 rounded"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-red-900 block text-[11px]">
                      Otomatis Terbitkan Laporan Abnormality
                    </span>
                    <span className="text-red-700 text-[10px]">
                      Temuan ini akan langsung tercatat di Monitoring Abnormality.
                    </span>
                  </div>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChecklistModal(false)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3.5 py-1.5 bg-[#0063ff] text-white hover:bg-[#0052d4] rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Checklist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* QUICK MODAL 4: TAMBAH MAINTENANCE LOG                     */}
      {/* ========================================================= */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[95] overflow-y-auto">
          <div className="bg-white border border-gray-300 rounded-2xl max-w-lg w-full p-5 shadow-2xl relative my-6 text-gray-800">
            <div className="flex items-center justify-between pb-3 border-b border-gray-150">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">handyman</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900">Catat Aktivitas Maintenance</h3>
                  <p className="text-[9px] text-gray-500">
                    Log riwayat servis preventif, perbaikan kerusakan, atau renewal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitLog} className="mt-3 space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Pilih Jig / Fixture Induk *
                </label>
                <select
                  required
                  value={logForm.designId}
                  onChange={(e) => setLogForm((prev) => ({ ...prev, designId: e.target.value, cellPartId: '' }))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#0063ff]"
                >
                  <option value="">-- Pilih Jig / Fixture --</option>
                  {designOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                    Jenis Tindakan
                  </label>
                  <select
                    value={logForm.actionType}
                    onChange={(e) => setLogForm((prev) => ({ ...prev, actionType: e.target.value as any }))}
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none"
                  >
                    <option value="PREVENTIVE">Preventive Maintenance (PM)</option>
                    <option value="CORRECTIVE">Corrective Maintenance (CM)</option>
                    <option value="RENEWAL">Renewal / Ganti Komponen</option>
                    <option value="CALIBRATION">Kalibrasi &amp; Alignment</option>
                    <option value="OVERHAUL">Total Overhaul</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                    Status Pengerjaan
                  </label>
                  <select
                    value={logForm.status}
                    onChange={(e) => setLogForm((prev) => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none"
                  >
                    <option value="COMPLETED">Selesai (Completed)</option>
                    <option value="IN_PROGRESS">Sedang Berjalan (In Progress)</option>
                    <option value="SCHEDULED">Terjadwal (Scheduled)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Judul Aktivitas Servis *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Preventive Maintenance Bulanan OP#1"
                  value={logForm.title}
                  onChange={(e) => setLogForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#0063ff]"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Rincian Deskripsi Pengerjaan *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Jelaskan tindakan servis, penyetelan, atau perbaikan..."
                  value={logForm.description}
                  onChange={(e) => setLogForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#0063ff]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                    Teknisi / PIC
                  </label>
                  <input
                    type="text"
                    required
                    value={logForm.performedBy}
                    onChange={(e) => setLogForm((prev) => ({ ...prev, performedBy: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                    Tanggal Servis
                  </label>
                  <input
                    type="date"
                    value={logForm.performedAt}
                    onChange={(e) => setLogForm((prev) => ({ ...prev, performedAt: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                    Durasi (Menit)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={logForm.durationMinutes}
                    onChange={(e) =>
                      setLogForm((prev) => ({ ...prev, durationMinutes: parseInt(e.target.value) || 60 }))
                    }
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                    Part yang Diganti (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Locator Pin D10, O-ring..."
                    value={logForm.partsReplaced}
                    onChange={(e) => setLogForm((prev) => ({ ...prev, partsReplaced: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                    Estimasi Biaya (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={logForm.cost}
                    onChange={(e) =>
                      setLogForm((prev) => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs outline-none"
                  />
                </div>
              </div>

              {/* Reset lifetime checkbox */}
              <label className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={logForm.resetLifetime}
                  onChange={(e) => setLogForm((prev) => ({ ...prev, resetLifetime: e.target.checked }))}
                  className="mt-0.5 text-emerald-600 rounded"
                />
                <div className="text-xs">
                  <span className="font-bold text-emerald-950 block text-[11px]">
                    Reset Lifetime &amp; Counter Pemakaian (Kembali ke 0)
                  </span>
                  <span className="text-emerald-800 text-[10px]">
                    Centang jika maintenance ini memulihkan kondisi fixture menjadi baru/siap pakai kembali.
                  </span>
                </div>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3.5 py-1.5 bg-[#0063ff] text-white hover:bg-[#0052d4] rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Maintenance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* QUICK MODAL 5: QUICK RENEW LIFETIME                       */}
      {/* ========================================================= */}
      {showRenewModal && renewTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[95]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            {/* Header */}
            <div className="p-4 border-b border-gray-150 flex justify-between items-center bg-gradient-to-r from-amber-50 to-orange-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-lg">autorenew</span>
                </div>
                <div>
                  <h3 className="font-bold text-xs text-gray-800">Renew Lifetime</h3>
                  <p className="text-[9px] text-gray-500">Reset parameter keausan setelah perbaikan atau rekondisi</p>
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
            <div className="p-4 space-y-3">
              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[8.5px] font-bold text-gray-500 uppercase">
                    {renewTarget.isCellPart ? 'CellPart (Komponen)' : 'Jig & Fixture (Induk)'}
                  </span>
                  <span className="font-mono text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    {renewTarget.isCellPart ? renewTarget.partNumber : renewTarget.noReg}
                  </span>
                </div>
                <div className="font-bold text-xs text-gray-900 truncate" title={renewTarget.name}>
                  {renewTarget.name}
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <input
                    type="checkbox"
                    checked={renewResetDays}
                    onChange={(e) => setRenewResetDays(e.target.checked)}
                    className="text-[#0063ff] rounded"
                  />
                  <span>Reset Tanggal Pemasangan / Hari</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <input
                    type="checkbox"
                    checked={renewResetUsage}
                    onChange={(e) => setRenewResetUsage(e.target.checked)}
                    className="text-[#0063ff] rounded"
                  />
                  <span>Reset Counter Pemakaian (Kembali ke 0x)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRenewModal(false);
                    setRenewTarget(null);
                  }}
                  className="px-3.5 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={submitting || (!renewResetDays && !renewResetUsage)}
                  onClick={handleQuickRenew}
                  className="px-4 py-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Memproses...' : 'Konfirmasi Renew'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
