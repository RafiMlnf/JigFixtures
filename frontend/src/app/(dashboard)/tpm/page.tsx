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
import { renewDesign, renewCellPart } from '@/lib/api/phase3';

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
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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
  }, [schedules, typeFilter, statusFilter, scheduleSearch]);

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
        msg: checklistForm.overallResult === 'NG' && checklistForm.linkToAbnormality
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
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden text-slate-800">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 transition-all duration-300 animate-slide-up ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
            <span className="material-symbols-outlined text-2xl">build_circle</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                TPM (Total Productive Maintenance)
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Sistem Aktif
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Pemeliharaan preventif, checklist inspeksi mandiri, dan monitoring 2-way lifetime Jig &amp; Fixtures
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            title="Muat Ulang Data"
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          >
            <span className={`material-symbols-outlined text-lg ${loadingData ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>

          {isPic && (
            <>
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
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">fact_check</span>
                <span>+ Isi Checklist</span>
              </button>

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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">handyman</span>
                <span>+ Catat Maintenance</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Health Score */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Kesehatan Jig &amp; Fixture
              </span>
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">health_and_safety</span>
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-black text-slate-900">
                  {summary ? `${summary.healthScore}%` : '—'}
                </span>
                <span className="text-xs font-medium text-emerald-600">Jig Berstatus Aman</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${summary ? summary.healthScore : 100}%` }}
                />
                <div
                  className="bg-rose-500 h-full transition-all duration-500"
                  style={{
                    width: `${
                      summary && summary.totalItems > 0
                        ? Math.round((summary.overdueCount / summary.totalItems) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 font-medium">
                <span>{summary?.safeCount ?? 0} Aman</span>
                <span>{summary?.warningCount ?? 0} Warning</span>
                <span className="text-rose-600 font-bold">{summary?.overdueCount ?? 0} Overdue</span>
              </div>
            </div>
          </div>

          {/* Card 2: Items Needing Attention */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Perhatian Segera
              </span>
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  (summary?.overdueCount ?? 0) > 0
                    ? 'bg-rose-50 text-rose-600 animate-pulse'
                    : 'bg-amber-50 text-amber-600'
                }`}
              >
                <span className="material-symbols-outlined text-lg">warning</span>
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-2xl font-black text-rose-600">
                  {(summary?.overdueCount ?? 0) + (summary?.warningCount ?? 0)}
                </span>
                <span className="text-xs text-slate-500 font-medium">Unit Mendekati / Lewat Limit</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {summary?.unscheduledCount ?? 0} unit belum diatur tanggal jadwal TPM
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                onClick={() => {
                  setActiveTab('schedules');
                  setStatusFilter('OVERDUE');
                }}
                className="text-rose-600 hover:text-rose-700 font-bold text-[11px] hover:underline"
              >
                Lihat Overdue ({summary?.overdueCount ?? 0}) →
              </button>
            </div>
          </div>

          {/* Card 3: Checklist Hari Ini */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Inspeksi Hari Ini
              </span>
              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">checklist_rtl</span>
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-2xl font-black text-slate-900">
                  {summary?.checklistTodayCount ?? 0}
                </span>
                <span className="text-xs text-slate-500 font-medium">Form Terisi</span>
              </div>
              <div className="flex items-center gap-3 text-xs mt-1">
                <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                  <span className="material-symbols-outlined text-xs">check_circle</span>
                  {summary?.checklistTodayOk ?? 0} OK
                </span>
                <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                  <span className="material-symbols-outlined text-xs">cancel</span>
                  {summary?.checklistTodayNg ?? 0} NG
                </span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                onClick={() => setActiveTab('checklists')}
                className="text-indigo-600 hover:text-indigo-700 font-bold text-[11px] hover:underline"
              >
                Buka Log Checklist →
              </button>
            </div>
          </div>

          {/* Card 4: Maintenance Bulan Ini */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Maintenance Bulan Ini
              </span>
              <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">event_available</span>
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-2xl font-black text-slate-900">
                  {summary?.maintenanceThisMonth ?? 0}
                </span>
                <span className="text-xs text-slate-500 font-medium">Aktivitas Servis</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Total item terdaftar: {summary?.totalItems ?? 0} ({summary?.totalDesigns ?? 0} Jig, {summary?.totalCellParts ?? 0} Cell Part)
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                onClick={() => setActiveTab('logs')}
                className="text-purple-600 hover:text-purple-700 font-bold text-[11px] hover:underline"
              >
                Lihat Log Riwayat →
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          {/* Tab Navigation Header */}
          <div className="border-b border-slate-200 px-6 pt-3 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('schedules')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
                  activeTab === 'schedules'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-sm">calendar_month</span>
                <span>1. Jadwal Preventif &amp; Lifetime</span>
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
                  {filteredSchedules.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('checklists')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
                  activeTab === 'checklists'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-sm">fact_check</span>
                <span>2. Daily Checklist Inspeksi</span>
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
                  {filteredChecklists.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
                  activeTab === 'logs'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-sm">history_toggle_off</span>
                <span>3. Riwayat Maintenance &amp; Servis</span>
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
                  {filteredLogs.length}
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: SCHEDULES & LIFETIME MONITORING */}
          {activeTab === 'schedules' && (
            <div className="p-6 space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                  {/* Search */}
                  <div className="relative flex-1 max-w-sm">
                    <span className="material-symbols-outlined text-slate-400 absolute left-3 top-2.5 text-lg">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Cari No Reg, nama part, line, proses..."
                      value={scheduleSearch}
                      onChange={(e) => setScheduleSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="ALL">Semua Status Lifetime</option>
                    <option value="OVERDUE">🔴 Overdue (Lewat Batas)</option>
                    <option value="WARNING">🟡 Warning (Mendekati)</option>
                    <option value="SAFE">🟢 Safe (Aman)</option>
                    <option value="UNSCHEDULED">⚪ Belum Ada Jadwal TPM</option>
                  </select>

                  {/* Type Filter */}
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="ALL">Semua Tipe (Jig &amp; Cell Part)</option>
                    <option value="DESIGN">Jig / Fixture Induk Saja</option>
                    <option value="CELL_PART">Cell Part Saja</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-3 px-4">No Reg / Part No</th>
                      <th className="py-3 px-4">Nama Jig / Cell Part</th>
                      <th className="py-3 px-4">Line &amp; Process</th>
                      <th className="py-3 px-4 text-center">Status Lifetime</th>
                      <th className="py-3 px-4 text-center">Monitoring 2-Way (Hari &amp; Siklus)</th>
                      <th className="py-3 px-4 text-center">Jadwal TPM</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSchedules.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <span className="material-symbols-outlined text-4xl text-slate-300 block mb-1">
                            event_busy
                          </span>
                          Tidak ada data jadwal yang sesuai filter pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredSchedules.map((item) => (
                        <tr
                          key={`${item.isCellPart ? 'cp' : 'd'}-${item.id}`}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              {item.isCellPart ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  PART
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  {item.type || 'JIG'}
                                </span>
                              )}
                              <span>{item.isCellPart ? item.partNumber : item.noReg}</span>
                            </div>
                            {item.isCellPart && (
                              <div className="text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                                Induk: {item.parentNoReg}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{item.name}</div>
                            {!item.isCellPart && item.cellPartsCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 font-medium mt-0.5">
                                <span className="material-symbols-outlined text-xs">extension</span>
                                {item.cellPartsCount} Cell Part terdaftar
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <div>{item.lineName}</div>
                            <div className="text-[11px] text-slate-400">{item.processName}</div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.lifetimeStatus === 'OVERDUE' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                <span className="material-symbols-outlined text-xs">error</span>
                                OVERDUE
                              </span>
                            ) : item.lifetimeStatus === 'WARNING' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <span className="material-symbols-outlined text-xs">warning</span>
                                WARNING
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="material-symbols-outlined text-xs">check_circle</span>
                                SAFE
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="max-w-[190px] mx-auto space-y-1">
                              {/* Days meter */}
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500">Sisa Hari:</span>
                                <span
                                  className={`font-bold ${
                                    item.daysRemaining <= 0
                                      ? 'text-rose-600 font-black'
                                      : item.daysRemaining <= 35
                                      ? 'text-amber-600'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  {item.daysRemaining} hari ({item.lifetimeDays}d)
                                </span>
                              </div>

                              {/* Usage meter */}
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500">Pemakaian:</span>
                                <span className="font-semibold text-slate-700">
                                  {item.currentUsage || 0} / {item.maxUsage || 500}x
                                </span>
                              </div>

                              {/* Mini progress bar */}
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full ${
                                    item.lifetimeStatus === 'OVERDUE'
                                      ? 'bg-rose-500'
                                      : item.lifetimeStatus === 'WARNING'
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.round(((item.currentUsage || 0) / (item.maxUsage || 500)) * 100),
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center text-xs">
                            {item.tpmScheduleDeadline ? (
                              <div>
                                <span className="font-semibold text-slate-800">
                                  {new Date(item.tpmScheduleDeadline).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                                <div className="text-[10px] text-slate-400">
                                  Mulai: {item.tpmScheduleStart ? new Date(item.tpmScheduleStart).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—'}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                Belum Terjadwal
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isPic && (
                                <>
                                  <button
                                    onClick={() => openScheduleModal(item)}
                                    title="Atur Jadwal & Lifetime"
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-base">edit_calendar</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setRenewTarget(item);
                                      setShowRenewModal(true);
                                    }}
                                    title="Renew / Reset Lifetime"
                                    className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-base">replay</span>
                                  </button>

                                  <button
                                    onClick={() => openChecklistForTarget(item)}
                                    title="Isi Checklist untuk item ini"
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-base">fact_check</span>
                                  </button>

                                  <button
                                    onClick={() => openLogForTarget(item)}
                                    title="Catat Servis / Maintenance"
                                    className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-base">handyman</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: DAILY CHECKLIST INSPECTION */}
          {activeTab === 'checklists' && (
            <div className="p-6 space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                  <div className="relative flex-1 max-w-sm">
                    <span className="material-symbols-outlined text-slate-400 absolute left-3 top-2.5 text-lg">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Cari nama inspector, no reg, catatan..."
                      value={checklistSearch}
                      onChange={(e) => setChecklistSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <select
                    value={checklistResultFilter}
                    onChange={(e) => setChecklistResultFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="ALL">Semua Hasil</option>
                    <option value="OK">🟢 Hanya Hasil OK</option>
                    <option value="NG">🔴 Hanya Hasil NG</option>
                  </select>

                  <select
                    value={checklistShiftFilter}
                    onChange={(e) => setChecklistShiftFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="ALL">Semua Shift</option>
                    <option value="Shift 1">Shift 1</option>
                    <option value="Shift 2">Shift 2</option>
                    <option value="Shift 3">Shift 3</option>
                    <option value="Non-Shift">Non-Shift</option>
                  </select>
                </div>

                {isPic && (
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">add_task</span>
                    <span>+ Form Checklist Baru</span>
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-3 px-4">Tanggal &amp; Waktu</th>
                      <th className="py-3 px-4">Shift &amp; Inspector</th>
                      <th className="py-3 px-4">Target Jig / Part</th>
                      <th className="py-3 px-4 text-center">Parameter Inspeksi (6 Item)</th>
                      <th className="py-3 px-4 text-center">Hasil Akhir</th>
                      <th className="py-3 px-4">Catatan / Temuan</th>
                      {isPic && <th className="py-3 px-4 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredChecklists.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <span className="material-symbols-outlined text-4xl text-slate-300 block mb-1">
                            fact_check
                          </span>
                          Belum ada catatan checklist inspeksi.
                        </td>
                      </tr>
                    ) : (
                      filteredChecklists.map((check) => (
                        <tr key={check.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-700">
                            <div>
                              {new Date(check.checkDate).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(check.checkDate).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {check.shift}
                            </span>
                            <div className="font-semibold text-slate-800 mt-0.5">{check.inspectorName}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{check.design?.noReg}</div>
                            <div className="text-[11px] text-slate-500">{check.design?.assyPartName}</div>
                            {check.cellPart && (
                              <div className="text-[10px] text-amber-600 font-medium">
                                Part: {check.cellPart.name} ({check.cellPart.partNumber})
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-grid grid-cols-6 gap-1 text-[10px] font-mono">
                              <span
                                title="Kebersihan"
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  check.cleaningStatus === 'OK'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                Clean:{check.cleaningStatus}
                              </span>
                              <span
                                title="Locator Pin"
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  check.locatorPinStatus === 'OK'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                Pin:{check.locatorPinStatus}
                              </span>
                              <span
                                title="Clamping / Klem"
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  check.clampingStatus === 'OK'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                Clamp:{check.clampingStatus}
                              </span>
                              <span
                                title="Sensor / Pokayoke"
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  check.sensorStatus === 'OK'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                Sens:{check.sensorStatus}
                              </span>
                              <span
                                title="Baut & Baseplate"
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  check.boltsStatus === 'OK'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                Bolt:{check.boltsStatus}
                              </span>
                              <span
                                title="Lubrikasi / Grease"
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  check.lubricationStatus === 'OK'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                Lub:{check.lubricationStatus}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {check.overallResult === 'OK' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="material-symbols-outlined text-xs">check_circle</span>
                                OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                <span className="material-symbols-outlined text-xs">cancel</span>
                                NG
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs">
                            <div>{check.notes || '—'}</div>
                            {check.linkToAbnormality && check.abnormalityId && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 font-bold mt-1">
                                <span className="material-symbols-outlined text-xs">link</span>
                                Link ke Abnormality
                              </span>
                            )}
                          </td>
                          {isPic && (
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleDeleteChecklist(check.id)}
                                title="Hapus catatan ini"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MAINTENANCE & REPAIR LOG */}
          {activeTab === 'logs' && (
            <div className="p-6 space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                  <div className="relative flex-1 max-w-sm">
                    <span className="material-symbols-outlined text-slate-400 absolute left-3 top-2.5 text-lg">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Cari judul, teknisi, part diganti, no reg..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <select
                    value={logActionFilter}
                    onChange={(e) => setLogActionFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="ALL">Semua Kategori Aksi</option>
                    <option value="PREVENTIVE">🔧 Preventive Maintenance (PM)</option>
                    <option value="CORRECTIVE">⚠️ Corrective Maintenance (CM)</option>
                    <option value="RENEWAL">🔄 Renewal / Overhaul</option>
                    <option value="CALIBRATION">📐 Kalibrasi &amp; Alignment</option>
                  </select>
                </div>

                {isPic && (
                  <button
                    onClick={() => {
                      setLogForm((prev) => ({
                        ...prev,
                        designId: designOptions[0]?.id || '',
                        cellPartId: '',
                        title: 'Aktivitas Servis / Pemeliharaan',
                        description: '',
                      }));
                      setShowLogModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">build</span>
                    <span>+ Catat Maintenance Baru</span>
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-3 px-4">Tanggal Servis</th>
                      <th className="py-3 px-4">Kategori Aksi</th>
                      <th className="py-3 px-4">Target Jig / Part</th>
                      <th className="py-3 px-4">Aktivitas &amp; Deskripsi</th>
                      <th className="py-3 px-4">Part yang Diganti</th>
                      <th className="py-3 px-4">Teknisi &amp; Durasi</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      {isPic && <th className="py-3 px-4 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <span className="material-symbols-outlined text-4xl text-slate-300 block mb-1">
                            history_toggle_off
                          </span>
                          Belum ada riwayat aktivitas maintenance yang dicatat.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                            {new Date(item.performedAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
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
                              <div className="text-[10px] text-emerald-600 font-bold mt-0.5 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-xs">restart_alt</span>
                                Lifetime Reset
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{item.design?.noReg}</div>
                            <div className="text-[11px] text-slate-500">{item.design?.assyPartName}</div>
                            {item.cellPart && (
                              <div className="text-[10px] text-amber-600 font-medium">
                                Part: {item.cellPart.name} ({item.cellPart.partNumber})
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            <div className="font-bold text-slate-900">{item.title}</div>
                            <div className="text-xs text-slate-600 mt-0.5">{item.description}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs">
                            {item.partsReplaced || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{item.performedBy}</div>
                            <div className="text-[11px] text-slate-400">
                              {item.durationMinutes} menit
                              {item.cost && item.cost > 0
                                ? ` • Rp ${Number(item.cost).toLocaleString('id-ID')}`
                                : ''}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          {isPic && (
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleDeleteLog(item.id)}
                                title="Hapus log ini"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ATUR JADWAL & LIFETIME TPM                       */}
      {/* ========================================================= */}
      {showScheduleModal && selectedScheduleItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">calendar_month</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Atur Jadwal &amp; Lifetime TPM</h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedScheduleItem.noReg} — {selectedScheduleItem.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mulai Jadwal TPM
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.tpmScheduleStart}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, tpmScheduleStart: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Batas / Deadline Servis
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.tpmScheduleDeadline}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, tpmScheduleDeadline: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
                <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block">
                  Konfigurasi 2-Way Lifetime
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Mode Evaluasi
                    </label>
                    <select
                      value={scheduleForm.lifetimeType}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, lifetimeType: e.target.value as any }))
                      }
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="DUAL">DUAL (2-Way)</option>
                      <option value="DAYS">Hanya Hari</option>
                      <option value="USAGE">Hanya Siklus</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Batas Hari
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={scheduleForm.lifetimeDays}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, lifetimeDays: parseInt(e.target.value) || 1 }))
                      }
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Maks Siklus (x)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={scheduleForm.maxUsage}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, maxUsage: parseInt(e.target.value) || 1 }))
                      }
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Counter Pemakaian Saat Ini
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={scheduleForm.currentUsage}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, currentUsage: parseInt(e.target.value) || 0 }))
                    }
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Jadwal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: FORM CHECKLIST INSPEKSI                          */}
      {/* ========================================================= */}
      {showChecklistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">fact_check</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Form Checklist Inspeksi TPM</h3>
                  <p className="text-[11px] text-slate-500">
                    Inspeksi mandiri kondisi fisik, fungsi mekanisme, dan kelayakan Jig &amp; Fixture
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowChecklistModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitChecklist} className="mt-4 space-y-4">
              {/* Target Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Jig / Fixture Induk *
                </label>
                <select
                  required
                  value={checklistForm.designId}
                  onChange={(e) =>
                    setChecklistForm((prev) => ({ ...prev, designId: e.target.value, cellPartId: '' }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20"
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
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Inspector</label>
                  <input
                    type="text"
                    required
                    value={checklistForm.inspectorName}
                    onChange={(e) =>
                      setChecklistForm((prev) => ({ ...prev, inspectorName: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Shift</label>
                  <select
                    value={checklistForm.shift}
                    onChange={(e) => setChecklistForm((prev) => ({ ...prev, shift: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="Shift 1">Shift 1</option>
                    <option value="Shift 2">Shift 2</option>
                    <option value="Shift 3">Shift 3</option>
                    <option value="Non-Shift">Non-Shift</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={checklistForm.checkDate}
                    onChange={(e) =>
                      setChecklistForm((prev) => ({ ...prev, checkDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* 6 Inspection Items */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 block">Item Pemeriksaan Standar:</span>

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
                    className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0 text-xs"
                  >
                    <span className="text-slate-700 font-medium">{item.label}</span>
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
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-[11px] font-bold text-emerald-700">OK</span>
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
                          className="text-rose-600 focus:ring-rose-500"
                        />
                        <span className="text-[11px] font-bold text-rose-700">NG</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Overall Result */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-800">Kesimpulan Hasil Inspeksi:</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="overallResult"
                      value="OK"
                      checked={checklistForm.overallResult === 'OK'}
                      onChange={() => setChecklistForm((prev) => ({ ...prev, overallResult: 'OK' }))}
                      className="text-emerald-600"
                    />
                    <span className="text-xs font-bold text-emerald-700">🟢 LAYAK (OK)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="overallResult"
                      value="NG"
                      checked={checklistForm.overallResult === 'NG'}
                      onChange={() => setChecklistForm((prev) => ({ ...prev, overallResult: 'NG' }))}
                      className="text-rose-600"
                    />
                    <span className="text-xs font-bold text-rose-700">🔴 ABNORMAL (NG)</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan / Keterangan Temuan
                </label>
                <textarea
                  rows={2}
                  placeholder="Tuliskan catatan khusus atau alasan jika ditemukan NG..."
                  value={checklistForm.notes}
                  onChange={(e) => setChecklistForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              {/* Abnormality Link checkbox */}
              {checklistForm.overallResult === 'NG' && (
                <label className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklistForm.linkToAbnormality}
                    onChange={(e) =>
                      setChecklistForm((prev) => ({ ...prev, linkToAbnormality: e.target.checked }))
                    }
                    className="mt-0.5 text-rose-600 rounded"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-rose-900 block">
                      Otomatis Terbitkan Laporan Abnormality
                    </span>
                    <span className="text-rose-700 text-[11px]">
                      Temuan ini akan langsung tercatat di menu Monitoring Abnormality untuk ditindaklanjuti.
                    </span>
                  </div>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChecklistModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Checklist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: TAMBAH MAINTENANCE LOG                           */}
      {/* ========================================================= */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">handyman</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Catat Aktivitas Maintenance</h3>
                  <p className="text-[11px] text-slate-500">
                    Log riwayat servis preventif, perbaikan kerusakan, kalibrasi, atau renewal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitLog} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Jig / Fixture Induk *
                </label>
                <select
                  required
                  value={logForm.designId}
                  onChange={(e) => setLogForm((prev) => ({ ...prev, designId: e.target.value, cellPartId: '' }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">-- Pilih Jig / Fixture --</option>
                  {designOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Tindakan
                  </label>
                  <select
                    value={logForm.actionType}
                    onChange={(e) => setLogForm((prev) => ({ ...prev, actionType: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="PREVENTIVE">🔧 Preventive Maintenance (PM)</option>
                    <option value="CORRECTIVE">⚠️ Corrective Maintenance (CM)</option>
                    <option value="RENEWAL">🔄 Renewal / Ganti Komponen</option>
                    <option value="CALIBRATION">📐 Kalibrasi &amp; Alignment</option>
                    <option value="OVERHAUL">⚙️ Total Overhaul</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Pengerjaan
                  </label>
                  <select
                    value={logForm.status}
                    onChange={(e) => setLogForm((prev) => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="COMPLETED">✅ Selesai (Completed)</option>
                    <option value="IN_PROGRESS">⏳ Sedang Berjalan (In Progress)</option>
                    <option value="SCHEDULED">📅 Terjadwal (Scheduled)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Aktivitas Servis *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Preventive Maintenance Bulanan OP#1"
                  value={logForm.title}
                  onChange={(e) => setLogForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rincian Deskripsi Pengerjaan *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Jelaskan tindakan servis, penyetelan, atau perbaikan yang dilakukan..."
                  value={logForm.description}
                  onChange={(e) => setLogForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teknisi / PIC
                  </label>
                  <input
                    type="text"
                    required
                    value={logForm.performedBy}
                    onChange={(e) => setLogForm((prev) => ({ ...prev, performedBy: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Servis
                  </label>
                  <input
                    type="date"
                    value={logForm.performedAt}
                    onChange={(e) => setLogForm((prev) => ({ ...prev, performedAt: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Durasi (Menit)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={logForm.durationMinutes}
                    onChange={(e) =>
                      setLogForm((prev) => ({ ...prev, durationMinutes: parseInt(e.target.value) || 60 }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Part yang Diganti (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Locator Pin D10, O-ring, Spring..."
                    value={logForm.partsReplaced}
                    onChange={(e) => setLogForm((prev) => ({ ...prev, partsReplaced: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estimasi Biaya (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={logForm.cost}
                    onChange={(e) =>
                      setLogForm((prev) => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Reset lifetime checkbox */}
              <label className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={logForm.resetLifetime}
                  onChange={(e) => setLogForm((prev) => ({ ...prev, resetLifetime: e.target.checked }))}
                  className="mt-0.5 text-emerald-600 rounded"
                />
                <div className="text-xs">
                  <span className="font-bold text-emerald-950 block">
                    Reset Lifetime &amp; Counter Pemakaian (Kembali ke 0)
                  </span >
                  <span className="text-emerald-800 text-[11px]">
                    Centang jika maintenance ini memulihkan kondisi fixture menjadi baru/siap pakai kembali.
                  </span>
                </div>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Maintenance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: QUICK RENEW LIFETIME                             */}
      {/* ========================================================= */}
      {showRenewModal && renewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">replay</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Renew Lifetime</h3>
                <p className="text-xs text-slate-500">{renewTarget.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Pilih parameter lifetime yang ingin di-reset kembali ke awal:
            </p>

            <div className="space-y-2 mb-5">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer p-2 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={renewResetDays}
                  onChange={(e) => setRenewResetDays(e.target.checked)}
                  className="text-emerald-600 rounded"
                />
                <span>Reset Tanggal Pemasangan / Perpanjang Hari</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer p-2 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={renewResetUsage}
                  onChange={(e) => setRenewResetUsage(e.target.checked)}
                  className="text-emerald-600 rounded"
                />
                <span>Reset Counter Pemakaian (Kembali ke 0x)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRenewModal(false)}
                className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting || (!renewResetDays && !renewResetUsage)}
                onClick={handleQuickRenew}
                className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {submitting ? 'Memproses...' : 'Konfirmasi Renew'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
