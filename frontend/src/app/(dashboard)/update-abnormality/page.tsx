'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { canEdit } from '@/lib/rbac';
import {
  fetchDesignItems,
  fetchAbnormalities,
  createAbnormality,
  updateAbnormalityStatus,
  fetchMachinesDashboard,
  updateMachineStatus,
  registerMachine,
  deleteMachine,
  fetchLinesAndProcesses,
  MachineDashboardItem,
} from '@/lib/api/phase3';

const ABNORMALITY_TYPES = ['RUSAK', 'AUS', 'DEFORMASI', 'LAINNYA'];

const STATUS_CONFIG = {
  OPEN: { label: 'Open', color: 'bg-red-100 text-red-700 border-red-200' },
  MONITORING: { label: 'Monitoring', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  CLOSED: { label: 'Closed', color: 'bg-green-100 text-green-700 border-green-200' },
};

interface DesignItem {
  id: string;
  noReg: string;
  assyPartName: string;
  lineProduct: string;
  process?: string;
  type?: 'JF' | 'EQ';
}

interface AbnormalityReport {
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
  linkToSpare: boolean;
  createdAt: string;
  item: {
    noReg: string;
    assyPartName: string;
    lineProduct: string;
    process?: string;
    type?: 'JF' | 'EQ';
  };
  reportedBy: { name: string };
}

export default function UpdateAbnormalityPage() {
  const { user, isLoading } = useApp();
  const isPic = !isLoading && canEdit(user?.role);

  // Active view tab: 'dashboard' (cards), 'reports' (table), 'form' (create report)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'form'>('dashboard');

  // Data states
  const [machines, setMachines] = useState<MachineDashboardItem[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [items, setItems] = useState<DesignItem[]>([]);
  const [reports, setReports] = useState<AbnormalityReport[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [lineFilter, setLineFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SAFE' | 'WARNING' | 'OVERDUE'>('ALL');

  // Selected Machine modal
  const [selectedMachineDetail, setSelectedMachineDetail] = useState<MachineDashboardItem | null>(null);

  // Register Machine Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [mName, setMName] = useState('');
  const [mCode, setMCode] = useState('');
  const [mLineId, setMLineId] = useState('');
  const [mDesignId, setMDesignId] = useState('');
  const [mLocation, setMLocation] = useState('');
  const [mDescription, setMDescription] = useState('');
  const [registering, setRegistering] = useState(false);

  // Create Abnormality Form states
  const [selectedItemId, setSelectedItemId] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const [abnType, setAbnType] = useState('RUSAK');
  const [dateFound, setDateFound] = useState(new Date().toISOString().split('T')[0]);
  const [foundBy, setFoundBy] = useState('');
  const [description, setDescription] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [tempAction, setTempAction] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [actionPic, setActionPic] = useState('');
  const [abnStatus, setAbnStatus] = useState<'OPEN' | 'MONITORING' | 'CLOSED'>('OPEN');
  const [linkToRevision, setLinkToRevision] = useState<boolean>(false);
  const [linkToSpare, setLinkToSpare] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mList, dItems, rList, meta] = await Promise.all([
        fetchMachinesDashboard().catch(() => []),
        fetchDesignItems().catch(() => []),
        fetchAbnormalities().catch(() => []),
        fetchLinesAndProcesses().catch(() => ({ lines: [], processes: [] })),
      ]);
      setMachines(mList || []);
      setItems(dItems || []);
      setReports(rList || []);
      setLines(meta?.lines || []);
      if (!mLineId && meta?.lines?.length > 0) {
        setMLineId(meta.lines[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load abnormality dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [mLineId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toast timeout
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Unique lines
  const uniqueLines = useMemo(() => {
    const list = Array.from(
      new Set([...lines.map((l) => l.lineName), ...machines.map((m) => m.lineName)].filter(Boolean))
    );
    return ['All', ...list];
  }, [lines, machines]);

  // Machine counts by status
  const safeCount = machines.filter(
    (m) => m.jigCondition === 'SAFE' && m.tpmSchedule === 'SAFE'
  ).length;
  const warningCount = machines.filter(
    (m) => m.jigCondition === 'WARNING' || m.tpmSchedule === 'WARNING'
  ).length;
  const overdueCount = machines.filter(
    (m) => m.jigCondition === 'OVERDUE' || m.tpmSchedule === 'OVERDUE'
  ).length;

  // Filtered Machines
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      const q = search.toLowerCase().trim();
      const searchTerms = q.split(/\s+/).filter(Boolean);
      const matchesSearch =
        searchTerms.length === 0 ||
        searchTerms.every(
          (term) =>
            m.name.toLowerCase().includes(term) ||
            m.code.toLowerCase().includes(term) ||
            (m.lineName && m.lineName.toLowerCase().includes(term)) ||
            (m.location && m.location.toLowerCase().includes(term)) ||
            (m.designNoReg && m.designNoReg.toLowerCase().includes(term))
        );

      let matchesStatus = true;
      if (statusFilter === 'SAFE') {
        matchesStatus = m.jigCondition === 'SAFE' && m.tpmSchedule === 'SAFE';
      } else if (statusFilter === 'WARNING') {
        matchesStatus =
          (m.jigCondition === 'WARNING' || m.tpmSchedule === 'WARNING') &&
          m.jigCondition !== 'OVERDUE' &&
          m.tpmSchedule !== 'OVERDUE';
      } else if (statusFilter === 'OVERDUE') {
        matchesStatus = m.jigCondition === 'OVERDUE' || m.tpmSchedule === 'OVERDUE';
      }

      return matchesSearch && matchesStatus;
    });
  }, [machines, search, statusFilter]);

  // Group filtered machines by Lane / Line (sorted by machine count then name for balanced grid layout)
  const groupedMachines = useMemo(() => {
    const groups: Record<string, MachineDashboardItem[]> = {};
    filteredMachines.forEach((m) => {
      const key = m.lineName || 'Area Lainnya';
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });

    // Sort so cards with similar sizes/capacities pair up side-by-side neatly
    return Object.fromEntries(
      Object.entries(groups).sort((a, b) => {
        // First sort by number of machines descending (pair large lanes together, small lanes together)
        if (b[1].length !== a[1].length) {
          return b[1].length - a[1].length;
        }
        // Then naturally by line name
        return a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' });
      })
    );
  }, [filteredMachines]);

  // Register Machine Handler
  const handleRegisterMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mName.trim() || !mCode.trim() || !mLineId) {
      setToast({ type: 'error', msg: 'Harap isi Nama Mesin, Kode Mesin, dan Line Produksi!' });
      return;
    }
    setRegistering(true);
    try {
      await registerMachine({
        name: mName.trim(),
        code: mCode.trim(),
        lineId: mLineId,
        designId: mDesignId || undefined,
        location: mLocation.trim() || undefined,
        description: mDescription.trim() || undefined,
      });
      setToast({ type: 'success', msg: `Mesin "${mName}" berhasil didaftarkan!` });
      setShowRegisterModal(false);
      setMName('');
      setMCode('');
      setMDesignId('');
      setMLocation('');
      setMDescription('');
      await loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal mendaftarkan mesin' });
    } finally {
      setRegistering(false);
    }
  };

  // Delete Machine Handler
  const handleDeleteMachine = async (id: string, name: string) => {
    if (!window.confirm(`Hapus pendaftaran mesin "${name}"?`)) return;
    try {
      await deleteMachine(id);
      setToast({ type: 'success', msg: `Mesin "${name}" telah dihapus.` });
      if (selectedMachineDetail?.id === id) {
        setSelectedMachineDetail(null);
      }
      await loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal menghapus mesin' });
    }
  };

  const [updatingMachineStatus, setUpdatingMachineStatus] = useState(false);

  // Manual Status Change Handler (Kondisi Jig / Jadwal TPM: Hijau, Kuning, Merah, atau Auto)
  const handleManualStatusChange = async (
    field: 'jigCondition' | 'tpmSchedule',
    newStatus: 'SAFE' | 'WARNING' | 'OVERDUE' | 'AUTO'
  ) => {
    if (!selectedMachineDetail) return;
    setUpdatingMachineStatus(true);
    try {
      await updateMachineStatus(selectedMachineDetail.id, {
        [field]: newStatus,
      });

      // Update locally
      setSelectedMachineDetail((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          [field]: newStatus === 'AUTO' ? prev[field] : newStatus,
        };
      });

      setToast({
        type: 'success',
        msg: `Status ${field === 'jigCondition' ? 'Kondisi Jig' : 'Jadwal TPM'} berhasil diubah ke ${
          newStatus === 'AUTO' ? 'Otomatis' : newStatus === 'WARNING' ? 'Kuning (Warning)' : newStatus === 'OVERDUE' ? 'Merah (Overdue)' : 'Hijau (Safe)'
        }!`,
      });

      await loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal mengubah status mesin' });
    } finally {
      setUpdatingMachineStatus(false);
    }
  };

  // Open Abnormality Form for Jig Condition
  const handleOpenReportForJig = (machine: MachineDashboardItem) => {
    if (machine.designId) {
      setSelectedItemId(machine.designId);
    } else {
      const match = items.find((i) => i.lineProduct === machine.lineName);
      if (match) setSelectedItemId(match.id);
    }
    setAbnType('AUS');
    setDescription(`[Kondisi Jig] Laporan masalah/ketidaksesuaian jig pada mesin ${machine.code}${machine.name ? ` (${machine.name})` : ''}`);
    setSelectedMachineDetail(null);
    setActiveTab('form');
  };

  // Open Abnormality Form for TPM Schedule
  const handleOpenReportForTpm = (machine: MachineDashboardItem) => {
    if (machine.designId) {
      setSelectedItemId(machine.designId);
    } else {
      const match = items.find((i) => i.lineProduct === machine.lineName);
      if (match) setSelectedItemId(match.id);
    }
    setAbnType('LAINNYA');
    setDescription(`[Jadwal TPM] Laporan keterlambatan/temuan jadwal preventif pada mesin ${machine.code}${machine.name ? ` (${machine.name})` : ''}`);
    setSelectedMachineDetail(null);
    setActiveTab('form');
  };

  // Submit Abnormality Report Form
  const handleSubmitAbnormality = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !description.trim() || !foundBy.trim()) {
      setToast({ type: 'error', msg: 'Harap isi semua input wajib.' });
      return;
    }

    setSubmitting(true);
    try {
      await createAbnormality({
        itemId: selectedItemId,
        type: abnType,
        description,
        dateFound,
        foundBy,
        rootCause,
        tempAction,
        correctiveAction,
        actionPic,
        status: abnStatus,
        linkToRevision,
        linkToSpare,
      });

      setToast({
        type: 'success',
        msg: 'Laporan abnormality berhasil diajukan! Notifikasi terkirim.',
      });

      setSelectedItemId('');
      setItemSearchQuery('');
      setDescription('');
      setFoundBy('');
      setRootCause('');
      setTempAction('');
      setCorrectiveAction('');
      setActionPic('');
      setLinkToRevision(false);
      setLinkToSpare(false);
      setAbnStatus('OPEN');

      await loadData();
      setActiveTab('reports');
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal mengirim laporan.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'OPEN' | 'MONITORING' | 'CLOSED') => {
    try {
      await updateAbnormalityStatus(id, newStatus);
      await loadData();
      setToast({ type: 'success', msg: 'Status abnormality berhasil di-update.' });
    } catch (err: any) {
      setToast({ type: 'error', msg: 'Gagal update status.' });
    }
  };

  // Helper circle color mapper
  // Top: Jig Condition, Bottom: TPM Schedule
  // Green: SAFE, Yellow: WARNING, Red: OVERDUE
  const getCircleColor = (status: 'SAFE' | 'WARNING' | 'OVERDUE') => {
    if (status === 'OVERDUE') {
      return 'bg-rose-500 shadow-rose-300 ring-rose-200 border-rose-600';
    }
    if (status === 'WARNING') {
      return 'bg-amber-400 shadow-amber-200 ring-amber-200 border-amber-500';
    }
    return 'bg-emerald-500 shadow-emerald-200 ring-emerald-200 border-emerald-600';
  };

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 pt-2 bg-white h-full overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[99] px-4 py-2 rounded-lg text-xs font-bold shadow-lg transition-all ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* ─── STANDARD TOPBAR ──────────────── */}
      <header className="h-12 flex justify-between items-center border-b border-gray-150 mb-3 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          {/* Search bar inside header */}
          <div className="relative flex items-center w-80">
            <span
              className="material-symbols-outlined absolute left-2.5 text-gray-400 pointer-events-none select-none flex items-center justify-center leading-none"
              style={{ fontSize: '11px', width: '11px', height: '11px' }}
            >
              search
            </span>
            <input
              className="pl-7 pr-2.5 py-1.5 bg-gray-50 hover:bg-gray-100/70 border border-gray-300 rounded-lg w-full text-[10px] outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-medium transition-all text-gray-700 placeholder-gray-400"
              placeholder="Cari Line / Mesin / Kode / Area..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Right side actions group */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Tombol Daftarkan Mesin di Topbar */}
          {isPic && (
            <button
              type="button"
              onClick={() => setShowRegisterModal(true)}
              className="bg-[#0063ff] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#0052d4] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Daftarkan Mesin Baru di Line Produksi"
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              <span>Daftarkan Mesin</span>
            </button>
          )}

          {/* Tab buttons */}
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg text-xs font-bold">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'dashboard'
                  ? 'bg-white text-[#0063ff] shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span className="material-symbols-outlined text-xs">dashboard</span>
              <span>Dashboard Mesin</span>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'reports'
                  ? 'bg-white text-[#0063ff] shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span className="material-symbols-outlined text-xs">list</span>
              <span>Daftar Laporan</span>
              {reports.filter((r) => r.status === 'OPEN').length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[8px] px-1 py-0.2 rounded-full font-mono">
                  {reports.filter((r) => r.status === 'OPEN').length}
                </span>
              )}
            </button>
            {activeTab === 'form' && (
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className="px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 bg-white text-[#0063ff] shadow-sm"
              >
                <span className="material-symbols-outlined text-xs">edit_note</span>
                <span>Form Laporan</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── TAB 1: DASHBOARD MESIN (CARDS) ─────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Cards Grid Container */}
          <div className="flex-1 overflow-y-auto pr-1 pb-4">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-xs">
                <span className="material-symbols-outlined animate-spin mr-2 text-blue-600">sync</span>
                Memuat data mesin di line...
              </div>
            ) : filteredMachines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-300 p-8">
                <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">
                  precision_manufacturing
                </span>
                <p className="text-xs font-bold text-gray-600">Belum ada mesin yang terdaftar</p>
                <p className="text-[10px] text-gray-400 max-w-xs mt-1">
                  Klik tombol <strong>"Daftarkan Mesin"</strong> untuk menambahkan mesin di line produksi.
                </p>
                {isPic && (
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(true)}
                    className="mt-3 bg-[#0063ff] text-white text-xs font-bold px-3.5 py-1.5 rounded-lg hover:bg-[#0052d4] transition-colors cursor-pointer shadow-sm"
                  >
                    + Daftarkan Mesin Sekarang
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
                {Object.entries(groupedMachines).map(([laneName, laneMachines]) => (
                  <div key={laneName} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-2xs">
                    {/* Lane Header Bar (Gaya Tabel Header) */}
                    <div className="flex items-center justify-between px-2.5 py-1 bg-slate-50 border-b border-gray-200">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-[11px] font-bold text-gray-800 leading-tight">{laneName}</h3>
                        <span className="text-[8px] font-semibold px-1 py-0.5 rounded bg-blue-100/70 text-blue-700 leading-none">
                          {laneMachines.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[8.5px] text-gray-400 font-medium">
                        <span className="flex items-center gap-1" title="Aman">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {laneMachines.filter((m) => m.jigCondition === 'SAFE' && m.tpmSchedule === 'SAFE').length}
                        </span>
                        <span className="flex items-center gap-1" title="Peringatan">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          {laneMachines.filter((m) => m.jigCondition === 'WARNING' || m.tpmSchedule === 'WARNING').length}
                        </span>
                        <span className="flex items-center gap-1" title="Lewat Lifetime / Overdue">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {laneMachines.filter((m) => m.jigCondition === 'OVERDUE' || m.tpmSchedule === 'OVERDUE').length}
                        </span>
                      </div>
                    </div>

                    {/* Flat Grid Cell Table Layout - Tanpa Card, Border Pemisah Presisi */}
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8 border-t border-l border-gray-200 bg-gray-200 gap-px">
                      {laneMachines.map((machine) => {
                        const topCircleClass = getCircleColor(machine.jigCondition);
                        const btmCircleClass = getCircleColor(machine.tpmSchedule);

                        return (
                          <div
                            key={machine.id}
                            onClick={() => setSelectedMachineDetail(machine)}
                            className="aspect-square bg-white hover:bg-blue-50/50 p-1 flex flex-col justify-between items-center cursor-pointer group select-none transition-colors"
                            title={`${machine.code} - ${machine.name} (${laneName})`}
                          >
                            {/* Machine Code at top */}
                            <div className="w-full text-center">
                              <span className="text-[9.5px] font-black font-mono text-gray-800 group-hover:text-blue-600 transition-colors block truncate leading-tight">
                                {machine.code}
                              </span>
                            </div>

                            {/* 2-Circle Status Indicators in Center */}
                            <div className="flex flex-col items-center justify-center gap-1.5 my-auto">
                              {/* Bulat Atas: Kondisi Jig */}
                              <div
                                className={`w-3 h-3 rounded-full border shadow-2xs transition-transform group-hover:scale-110 ${topCircleClass}`}
                                title={`Kondisi Jig: ${machine.jigCondition}`}
                              />
                              {/* Bulat Bawah: Jadwal TPM */}
                              <div
                                className={`w-3 h-3 rounded-full border shadow-2xs transition-transform group-hover:scale-110 ${btmCircleClass}`}
                                title={`Jadwal TPM: ${machine.tpmSchedule}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: LAPORAN HISTORIS ABNORMALITY ────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-lg border border-gray-200">
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-semibold sticky top-0 border-b border-gray-200 text-[10px]">
                  <th className="px-3 py-2">No. Reg</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Found By</th>
                  <th className="px-2 py-2">Problem Description</th>
                  <th className="px-2 py-2">Root Cause</th>
                  <th className="px-2 py-2">PIC Action</th>
                  <th className="px-2 py-2 text-center">Status</th>
                  {isPic && <th className="px-2 py-2 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="text-gray-700 text-xs">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={isPic ? 8 : 7} className="text-center py-12 text-gray-400 text-xs">
                      Belum ada laporan abnormality.
                    </td>
                  </tr>
                ) : (
                  reports
                    .filter((r) => {
                      const q = search.toLowerCase().trim();
                      const matchesReg = !q || r.item.noReg.toLowerCase().includes(q);
                      const matchesLine =
                        lineFilter === 'All' || r.item.lineProduct === lineFilter;
                      return matchesReg && matchesLine;
                    })
                    .map((r) => {
                      const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.OPEN;
                      return (
                        <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono font-bold text-[10px] text-gray-800">
                            {r.item.noReg}
                          </td>
                          <td className="px-2 py-2">
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[8px] font-bold">
                              {r.item.type || 'JF'}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-gray-600 font-medium">
                            {r.foundBy}{' '}
                            <span className="block text-[8px] text-gray-400">
                              {new Date(r.dateFound).toLocaleDateString('id-ID')}
                            </span>
                          </td>
                          <td className="px-2 py-2 max-w-[160px]" title={r.description}>
                            <p className="truncate text-[10px] text-gray-800">{r.description}</p>
                          </td>
                          <td className="px-2 py-2 max-w-[160px]" title={r.rootCause || 'N/A'}>
                            <p className="truncate text-[10px] text-gray-500 italic">
                              {r.rootCause || 'N/A'}
                            </p>
                          </td>
                          <td className="px-2 py-2 font-medium text-gray-700">
                            {r.actionPic || <span className="text-gray-400 italic">None</span>}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span
                              className={`text-[8px] font-bold px-2 py-0.5 rounded-full border ${sc.color}`}
                            >
                              {sc.label}
                            </span>
                          </td>
                          {isPic && (
                            <td className="px-2 py-2 text-center">
                              <select
                                value={r.status}
                                onChange={(e) => handleStatusChange(r.id, e.target.value as any)}
                                className="text-[9px] border border-gray-200 rounded px-1.5 py-0.5 bg-white cursor-pointer font-bold text-gray-700"
                              >
                                <option value="OPEN">Open</option>
                                <option value="MONITORING">Monitoring</option>
                                <option value="CLOSED">Closed</option>
                              </select>
                            </td>
                          )}
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 3: FORM LAPORAN ABNORMALITY ───────────────────────────────── */}
      {activeTab === 'form' && (
        <form
          onSubmit={handleSubmitAbnormality}
          className="flex-1 grid grid-cols-2 gap-4 overflow-hidden bg-white p-4 rounded-xl border border-gray-200 shadow-sm"
        >
          {/* Left Column: Problem Definition */}
          <div className="space-y-2 flex flex-col justify-start h-full">
            <h3 className="font-bold text-xs text-gray-800 border-b border-gray-150 pb-1 flex items-center gap-1.5 shrink-0">
              <span className="material-symbols-outlined text-blue-600 text-sm">assignment_late</span>
              Informasi Masalah
            </h3>

            {/* Item selector */}
            <div className="shrink-0">
              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">
                Pilih Item Jig/Fixture *
              </label>
              {(() => {
                const selectedItem = items.find((item) => item.id === selectedItemId);
                const filteredItems = items.filter((item) => {
                  const query = itemSearchQuery.toLowerCase();
                  return (
                    item.noReg.toLowerCase().includes(query) ||
                    item.assyPartName.toLowerCase().includes(query) ||
                    item.lineProduct.toLowerCase().includes(query)
                  );
                });

                return (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsItemDropdownOpen(!isItemDropdownOpen)}
                      className="w-full border border-gray-300 bg-white rounded-lg px-2.5 py-1.5 text-xs text-left outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500 flex justify-between items-center cursor-pointer"
                    >
                      <span className="truncate">
                        {selectedItem
                          ? `${selectedItem.noReg} — ${selectedItem.assyPartName} (${selectedItem.lineProduct})`
                          : 'Cari & Pilih Item Jig/Fixture...'}
                      </span>
                      <span className="material-symbols-outlined text-[14px] text-gray-400">
                        arrow_drop_down
                      </span>
                    </button>

                    {isItemDropdownOpen && (
                      <div className="absolute left-0 mt-1 w-full rounded-lg bg-white border border-gray-250 shadow-xl p-2 z-50 text-xs">
                        <div className="relative mb-2">
                          <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                            search
                          </span>
                          <input
                            type="text"
                            className="w-full pl-6 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-[10px] focus:ring-1 focus:ring-blue-500 outline-none text-gray-700 font-medium"
                            placeholder="Ketik No. Reg / Part Name / Line..."
                            value={itemSearchQuery}
                            onChange={(e) => setItemSearchQuery(e.target.value)}
                            autoFocus
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                          {filteredItems.length === 0 ? (
                            <p className="text-[10px] text-gray-400 text-center py-2">
                              Tidak ditemukan.
                            </p>
                          ) : (
                            filteredItems.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setSelectedItemId(item.id);
                                  setIsItemDropdownOpen(false);
                                  setItemSearchQuery('');
                                }}
                                className={`w-full text-left px-2 py-1.5 rounded hover:bg-blue-50 hover:text-blue-800 transition-colors block text-[10px] ${
                                  selectedItemId === item.id
                                    ? 'bg-blue-50 text-blue-700 font-bold'
                                    : 'text-gray-700 font-medium'
                                }`}
                              >
                                <span className="font-mono font-bold mr-1">{item.noReg}</span> —{' '}
                                {item.assyPartName}{' '}
                                <span className="text-gray-400 text-[9px]">({item.lineProduct})</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Type & Date */}
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">
                  Tipe Abnormality *
                </label>
                <select
                  value={abnType}
                  onChange={(e) => setAbnType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-gray-700"
                >
                  {ABNORMALITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">
                  Tanggal Ditemukan *
                </label>
                <input
                  type="date"
                  value={dateFound}
                  onChange={(e) => setDateFound(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium text-gray-700"
                />
              </div>
            </div>

            {/* Found By */}
            <div className="shrink-0">
              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">
                Ditemukan Oleh (Operator / Inspector) *
              </label>
              <input
                type="text"
                placeholder="Contoh: Budi Santoso (QC)"
                value={foundBy}
                onChange={(e) => setFoundBy(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium text-gray-700"
              />
            </div>

            {/* Description */}
            <div className="flex-1 flex flex-col min-h-0">
              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">
                Deskripsi Masalah / Kerusakan *
              </label>
              <textarea
                placeholder="Jelaskan kondisi abnormality secara detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full flex-1 border border-gray-300 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-blue-500 resize-none font-medium text-gray-700"
              />
            </div>
          </div>

          {/* Right Column: Actions & Cause */}
          <div className="space-y-2 flex flex-col justify-start h-full">
            <h3 className="font-bold text-xs text-gray-800 border-b border-gray-150 pb-1 flex items-center gap-1.5 shrink-0">
              <span className="material-symbols-outlined text-blue-600 text-sm">build</span>
              Analisis & Tindakan Perbaikan
            </h3>

            {/* Root Cause */}
            <div className="shrink-0">
              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">
                Root Cause (Penyebab Akar Masalah)
              </label>
              <input
                type="text"
                placeholder="Penyebab kerusakan..."
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium text-gray-700"
              />
            </div>

            {/* Temporary Action */}
            <div className="shrink-0">
              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">
                Tindakan Sementara (Quick Action)
              </label>
              <input
                type="text"
                placeholder="Tindakan penanganan sementara..."
                value={tempAction}
                onChange={(e) => setTempAction(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium text-gray-700"
              />
            </div>

            {/* Corrective Action */}
            <div className="shrink-0">
              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">
                Tindakan Korektif (Permanen)
              </label>
              <input
                type="text"
                placeholder="Tindakan pencegahan & perbaikan permanen..."
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium text-gray-700"
              />
            </div>

            {/* Action PIC & Status */}
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">
                  PIC Tindakan
                </label>
                <input
                  type="text"
                  placeholder="Nama PIC..."
                  value={actionPic}
                  onChange={(e) => setActionPic(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium text-gray-700"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">
                  Status Laporan
                </label>
                <select
                  value={abnStatus}
                  onChange={(e) => setAbnStatus(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-gray-700"
                >
                  <option value="OPEN">Open</option>
                  <option value="MONITORING">Monitoring</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            </div>

            {/* Options Checkbox */}
            <div className="flex gap-4 pt-1 shrink-0 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 font-medium text-[10px]">
                <input
                  type="checkbox"
                  checked={linkToRevision}
                  onChange={(e) => setLinkToRevision(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-600 rounded"
                />
                Kaitkan dengan Pengajuan Revisi Desain
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 font-medium text-[10px]">
                <input
                  type="checkbox"
                  checked={linkToSpare}
                  onChange={(e) => setLinkToSpare(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-600 rounded"
                />
                Perlu Penggantian Sparepart
              </label>
            </div>

            {/* Form submit & cancel button */}
            <div className="pt-2 mt-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="w-1/3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Batal</span>
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 bg-[#0063ff] hover:bg-[#0052d4] text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-sm">send</span>
                )}
                {submitting ? 'Mengirim Laporan...' : 'Kirim Laporan Abnormality'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ─── MODAL 1: DAFTARKAN MESIN (TRIGGERED FROM TOPBAR) ──────────────── */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-3.5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#0063ff] text-sm">precision_manufacturing</span>
                Daftarkan Mesin Baru di Line
              </h3>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleRegisterMachine} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Nama Mesin *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: CNC Milling 01 / Spot Welding A1"
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                    Kode Mesin *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: MCH-WELD-01"
                    value={mCode}
                    onChange={(e) => setMCode(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                    Line Produksi *
                  </label>
                  <select
                    required
                    value={mLineId}
                    onChange={(e) => setMLineId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 bg-white"
                  >
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        Line {l.lineName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Jig / Fixture Terpasang (Opsional)
                </label>
                <select
                  value={mDesignId}
                  onChange={(e) => setMDesignId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700 bg-white"
                >
                  <option value="">-- Tanpa Jig Terpasang (Otomatis match Line) --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.noReg} — {i.assyPartName} ({i.lineProduct})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Lokasi / Posisi Station (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Station 3 OP-10"
                  value={mLocation}
                  onChange={(e) => setMLocation(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">
                  Keterangan Tambahan
                </label>
                <textarea
                  placeholder="Catatan mengenai mesin..."
                  value={mDescription}
                  onChange={(e) => setMDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 h-16 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-1.5 rounded-lg border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {registering && (
                    <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  )}
                  {registering ? 'Menyimpan...' : 'Simpan Mesin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: DETAIL MESIN ────────────────────────────────────────── */}
      {/* ─── MODAL 2: DETAIL MESIN (SIMPLE: 2 BULATAN BESAR & TEKS INTI) ─── */}
      {selectedMachineDetail && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-xs overflow-hidden p-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Header Ringkas */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 leading-tight">
                  {selectedMachineDetail.code || selectedMachineDetail.name}
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  {selectedMachineDetail.lineName} {selectedMachineDetail.name && selectedMachineDetail.code ? `• ${selectedMachineDetail.name}` : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedMachineDetail(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer text-lg leading-none p-1 -mr-1 -mt-1"
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>

            {/* 2 Bulatan Besar Indikator (Atas - Bawah) dengan Kontrol Ubah Manual */}
            <div className="flex flex-col gap-3.5 my-4 p-3.5 bg-gray-50 rounded-xl border border-gray-150">
              {/* Bulatan Atas: Kondisi Jig */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-10 h-10 shrink-0 rounded-full shadow-sm transition-transform hover:scale-105 ${getCircleColor(
                      selectedMachineDetail.jigCondition
                    )}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800">Kondisi Jig</span>
                      <span
                        className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${
                          selectedMachineDetail.jigCondition === 'OVERDUE'
                            ? 'bg-rose-100 text-rose-700'
                            : selectedMachineDetail.jigCondition === 'WARNING'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {selectedMachineDetail.jigCondition === 'OVERDUE' ? 'Merah' : selectedMachineDetail.jigCondition === 'WARNING' ? 'Kuning' : 'Hijau'}
                      </span>
                    </div>
                    <span className="text-[9px] text-gray-400">Bulatan Atas</span>
                  </div>
                </div>

                {/* Dot Warna Ubah Manual Kondisi Jig */}
                {isPic && (
                  <div className="flex items-center gap-1.5 mt-1 pt-1.5 border-t border-gray-200/50">
                    <button
                      type="button"
                      disabled={updatingMachineStatus}
                      onClick={() => handleManualStatusChange('jigCondition', 'SAFE')}
                      className={`w-4 h-4 rounded-full bg-emerald-500 hover:scale-110 transition-transform cursor-pointer shadow-3xs ${
                        selectedMachineDetail.jigCondition === 'SAFE'
                          ? 'ring-2 ring-emerald-600 ring-offset-1 scale-105'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      title="Set Hijau (Safe)"
                      aria-label="Set Hijau"
                    />
                    <button
                      type="button"
                      disabled={updatingMachineStatus}
                      onClick={() => handleManualStatusChange('jigCondition', 'WARNING')}
                      className={`w-4 h-4 rounded-full bg-amber-400 hover:scale-110 transition-transform cursor-pointer shadow-3xs ${
                        selectedMachineDetail.jigCondition === 'WARNING'
                          ? 'ring-2 ring-amber-500 ring-offset-1 scale-105'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      title="Set Kuning (Warning)"
                      aria-label="Set Kuning"
                    />
                    <button
                      type="button"
                      disabled={updatingMachineStatus}
                      onClick={() => handleManualStatusChange('jigCondition', 'OVERDUE')}
                      className={`w-4 h-4 rounded-full bg-rose-500 hover:scale-110 transition-transform cursor-pointer shadow-3xs ${
                        selectedMachineDetail.jigCondition === 'OVERDUE'
                          ? 'ring-2 ring-rose-600 ring-offset-1 scale-105'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      title="Set Merah (Overdue / Rusak)"
                      aria-label="Set Merah"
                    />
                    <button
                      type="button"
                      disabled={updatingMachineStatus}
                      onClick={() => handleManualStatusChange('jigCondition', 'AUTO')}
                      className="ml-auto w-4 h-4 rounded-full border border-gray-300 bg-white hover:bg-gray-100 hover:scale-110 transition-transform cursor-pointer flex items-center justify-center text-gray-500 shadow-3xs"
                      title="Reset ke Otomatis"
                      aria-label="Reset ke Otomatis"
                    >
                      <span className="material-symbols-outlined text-[10px]">sync</span>
                    </button>
                  </div>
                )}

                {/* Tombol Laporan Khusus Masalah Jig */}
                <button
                  type="button"
                  onClick={() => handleOpenReportForJig(selectedMachineDetail)}
                  className="mt-1.5 w-full py-1.5 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border border-blue-200/80 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                  title="Buat Laporan Masalah / Ketidaksesuaian Jig"
                >
                  <span className="material-symbols-outlined text-[14px]">report_problem</span>
                  <span>Buat Laporan Kondisi Jig</span>
                </button>
              </div>

              {/* Garis pemisah tipis */}
              <div className="border-t border-gray-200/60" />

              {/* Bulatan Bawah: Jadwal TPM */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-10 h-10 shrink-0 rounded-full shadow-sm transition-transform hover:scale-105 ${getCircleColor(
                      selectedMachineDetail.tpmSchedule
                    )}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800">Jadwal TPM</span>
                      <span
                        className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${
                          selectedMachineDetail.tpmSchedule === 'OVERDUE'
                            ? 'bg-rose-100 text-rose-700'
                            : selectedMachineDetail.tpmSchedule === 'WARNING'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {selectedMachineDetail.tpmSchedule === 'OVERDUE' ? 'Merah' : selectedMachineDetail.tpmSchedule === 'WARNING' ? 'Kuning' : 'Hijau'}
                      </span>
                    </div>
                    <span className="text-[9px] text-gray-400">Bulatan Bawah</span>
                  </div>
                </div>

                {/* Dot Warna Ubah Manual Jadwal TPM */}
                {isPic && (
                  <div className="flex items-center gap-1.5 mt-1 pt-1.5 border-t border-gray-200/50">
                    <button
                      type="button"
                      disabled={updatingMachineStatus}
                      onClick={() => handleManualStatusChange('tpmSchedule', 'SAFE')}
                      className={`w-4 h-4 rounded-full bg-emerald-500 hover:scale-110 transition-transform cursor-pointer shadow-3xs ${
                        selectedMachineDetail.tpmSchedule === 'SAFE'
                          ? 'ring-2 ring-emerald-600 ring-offset-1 scale-105'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      title="Set Hijau (Safe)"
                      aria-label="Set Hijau"
                    />
                    <button
                      type="button"
                      disabled={updatingMachineStatus}
                      onClick={() => handleManualStatusChange('tpmSchedule', 'WARNING')}
                      className={`w-4 h-4 rounded-full bg-amber-400 hover:scale-110 transition-transform cursor-pointer shadow-3xs ${
                        selectedMachineDetail.tpmSchedule === 'WARNING'
                          ? 'ring-2 ring-amber-500 ring-offset-1 scale-105'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      title="Set Kuning (Warning)"
                      aria-label="Set Kuning"
                    />
                    <button
                      type="button"
                      disabled={updatingMachineStatus}
                      onClick={() => handleManualStatusChange('tpmSchedule', 'OVERDUE')}
                      className={`w-4 h-4 rounded-full bg-rose-500 hover:scale-110 transition-transform cursor-pointer shadow-3xs ${
                        selectedMachineDetail.tpmSchedule === 'OVERDUE'
                          ? 'ring-2 ring-rose-600 ring-offset-1 scale-105'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      title="Set Merah (Overdue)"
                      aria-label="Set Merah"
                    />
                    <button
                      type="button"
                      disabled={updatingMachineStatus}
                      onClick={() => handleManualStatusChange('tpmSchedule', 'AUTO')}
                      className="ml-auto w-4 h-4 rounded-full border border-gray-300 bg-white hover:bg-gray-100 hover:scale-110 transition-transform cursor-pointer flex items-center justify-center text-gray-500 shadow-3xs"
                      title="Reset ke Otomatis"
                      aria-label="Reset ke Otomatis"
                    >
                      <span className="material-symbols-outlined text-[10px]">sync</span>
                    </button>
                  </div>
                )}

                {/* Tombol Laporan Khusus Jadwal TPM */}
                <button
                  type="button"
                  onClick={() => handleOpenReportForTpm(selectedMachineDetail)}
                  className="mt-1.5 w-full py-1.5 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-amber-200/80 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                  title="Buat Laporan Jadwal Preventif / TPM"
                >
                  <span className="material-symbols-outlined text-[14px]">event_busy</span>
                  <span>Buat Laporan Jadwal TPM</span>
                </button>
              </div>
            </div>

            {/* Teks Inti Singkat */}
            <div className="space-y-1.5 text-xs text-gray-600 mb-4 pb-3 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-[11px]">Jig Reg:</span>
                <span className="font-semibold text-gray-800 truncate max-w-[170px]">
                  {selectedMachineDetail.designNoReg || '—'}
                </span>
              </div>
              {selectedMachineDetail.location && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-[11px]">Lokasi:</span>
                  <span className="font-semibold text-gray-800 truncate max-w-[170px]">
                    {selectedMachineDetail.location}
                  </span>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-1">
              {isPic ? (
                <button
                  type="button"
                  onClick={() =>
                    handleDeleteMachine(selectedMachineDetail.id, selectedMachineDetail.name)
                  }
                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-xs">delete</span>
                  Hapus Mesin
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setSelectedMachineDetail(null)}
                className="px-3 py-1.5 border border-gray-200 hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-lg text-xs font-semibold cursor-pointer ml-auto transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
