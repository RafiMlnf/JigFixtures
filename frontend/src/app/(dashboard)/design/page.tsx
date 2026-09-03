'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { fetchMasterList, fetchVendors, fetchLinesAndProcesses, createDesignItem, submitDesignUpdate, fetchDashboardAlerts, uploadFile, getFileUrl, deleteDesignItem } from '@/lib/api/phase3';
import { canEdit } from '@/lib/rbac';

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

function SearchableDropdown({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: Array<{ id: string; name: string }>;
  value: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredOptions = options.filter((opt) => {
    const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return terms.every((term) => opt.name.toLowerCase().includes(term));
  });

  const showCustomOption = search.trim() !== '' && !options.some(opt => opt.name.toLowerCase() === search.toLowerCase().trim());

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-gray-300 bg-white rounded-lg px-3 py-1.5 text-xs text-left outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-green-500 flex justify-between items-center cursor-pointer"
      >
        <span className="truncate">{value || placeholder}</span>
        <span className="material-symbols-outlined text-[14px] text-gray-400">arrow_drop_down</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-full rounded-lg bg-white border border-gray-250 shadow-lg p-2 z-50 text-xs">
          <div className="relative mb-2">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]" style={{ fontSize: '10px' }}>search</span>
            <input
              type="text"
              className="w-full pl-6 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-[10px] focus:ring-1 focus:ring-green-500 outline-none text-gray-700 font-medium"
              placeholder="Cari..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-36 overflow-y-auto no-scrollbar space-y-0.5">
            {filteredOptions.length === 0 && !showCustomOption ? (
              <p className="text-[10px] text-gray-400 text-center py-2">Tidak ditemukan.</p>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.name);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded hover:bg-green-50 hover:text-green-800 transition-colors block text-[10px] ${value.toLowerCase() === opt.name.toLowerCase() ? 'bg-green-50 text-green-700 font-bold' : 'text-gray-700 font-medium'}`}
                >
                  {opt.name}
                </button>
              ))
            )}

            {showCustomOption && (
              <button
                type="button"
                onClick={() => {
                  onChange(search.trim());
                  setIsOpen(false);
                  setSearch('');
                }}
                className="w-full text-left px-2 py-1.5 rounded bg-green-50 border border-dashed border-green-200 text-green-700 hover:bg-green-100 transition-colors block text-[10px] font-bold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs">add</span>
                Buat baru: "{search.trim()}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getUniqueOptions(opts: Array<{ id: string; name: string }>) {
  const seen = new Set<string>();
  return opts.filter((opt) => {
    const lower = opt.name.toLowerCase().trim();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

export function DesignPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get('action');
  const { user, logout, approvals } = useApp();
  const isPic = canEdit(user?.role);
  const [items, setItems] = useState<MasterItem[]>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(true);

  // System warning alerts states
  const [alerts, setAlerts] = useState<any>({
    redItems: [],
    delayedAbnormalities: [],
    waitingApprovalsCount: 0,
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const waitingApprovalsCount = approvals.filter((a) => a.status === 'WAITING').length;
  const hasAlerts = alerts.redItems.length > 0 || alerts.delayedAbnormalities.length > 0 || waitingApprovalsCount > 0;

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [lineFilter, setLineFilter] = useState('All');
  const [processFilter, setProcessFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [vendorFilter, setVendorFilter] = useState('All');
  const [lifecycleFilter, setLifecycleFilter] = useState('All');
  const [revFilter, setRevFilter] = useState('All');
  const [inventoryFilter, setInventoryFilter] = useState('All');
  const [abnormalityFilter, setAbnormalityFilter] = useState('All');

  // Column export selector checklist
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCols, setExportCols] = useState({
    noReg: true,
    assyPartName: true,
    lineProduct: true,
    process: true,
    type: true,
    lifecycleStatus: true,
    revStatus: true,
    cost: true,
    stock: true,
  });

  // Modal toggles
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
  const [showGlobalRevisionModal, setShowGlobalRevisionModal] = useState(false);
  const [globalRevisionItemId, setGlobalRevisionItemId] = useState('');
  const [globalRevisionItemSearch, setGlobalRevisionItemSearch] = useState('');
  const [isGlobalRevisionDropdownOpen, setIsGlobalRevisionDropdownOpen] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MasterItem | null>(null);

  // Lists for dropdown
  const [lines, setLines] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);

  // Create Mode Form Fields
  const [noReg, setNoReg] = useState('');
  const [assyPartName, setAssyPartName] = useState('');
  const [noItem, setNoItem] = useState('');
  const [qty, setQty] = useState('1');
  const [type, setType] = useState<'JF' | 'EQ'>('JF');
  const [minimumStock, setMinimumStock] = useState<number>(0);
  const [actualStock, setActualStock] = useState<number>(0);
  const [lineInput, setLineInput] = useState('');
  const [processInput, setProcessInput] = useState('');

  // Shared / Edit Form Fields
  const [revStatus, setRevStatus] = useState('1');
  const [designDateNew, setDesignDateNew] = useState(new Date().toISOString().split('T')[0]);
  const [docLocation2D, setDocLocation2D] = useState('');
  const [docLocation3D, setDocLocation3D] = useState('');
  const [revisionNote, setRevisionNote] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [cost, setCost] = useState<number>(0);
  const [leadTime, setLeadTime] = useState<number>(1);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, vList, meta, alertData] = await Promise.all([
        fetchMasterList(),
        fetchVendors(),
        fetchLinesAndProcesses(),
        fetchDashboardAlerts().catch(() => ({ redItems: [], delayedAbnormalities: [], waitingApprovalsCount: 0 })),
      ]);
      setItems(list);
      setVendors(vList);
      setLines(meta.lines || []);
      setProcesses(meta.processes || []);
      setAlerts(alertData);
    } catch (e: any) {
      console.error(e);
      if (e.status === 401 || e.status === 403) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDeleteConfirm = (item: MasterItem) => {
    setItemToDelete(item);
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDesignItem(itemToDelete.id);
      setToast({ type: 'success', msg: `Desain ${itemToDelete.noReg} berhasil dihapus!` });
      setShowDeleteConfirmModal(false);
      setItemToDelete(null);
      await loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal menghapus desain' });
    }
  };

  // Warning protection helpers
  const isCreateDirty = () => {
    return (
      noReg !== '' ||
      assyPartName !== '' ||
      noItem !== '' ||
      docLocation2D !== '' ||
      docLocation3D !== '' ||
      (revisionNote !== '' && revisionNote !== 'Initial Release') ||
      selectedVendorId !== '' ||
      poNumber !== '' ||
      cost !== 0 ||
      leadTime !== 1 ||
      lineInput !== '' ||
      processInput !== ''
    );
  };

  const isEditDirty = () => {
    if (!editingItem) return false;
    return (
      docLocation2D !== (editingItem.documents?.find(d => d.approvalStatus === 'APPROVED')?.loc2D || '') ||
      docLocation3D !== '' ||
      revisionNote !== '' ||
      selectedVendorId !== '' ||
      poNumber !== '' ||
      cost !== 0 ||
      leadTime !== 1
    );
  };

  const handleOpenCreateModal = () => {
    setNoReg('');
    setAssyPartName('');
    setNoItem('');
    setQty('1');
    setType('JF');
    setMinimumStock(0);
    setActualStock(0);
    setLineInput('');
    setProcessInput('');
    setRevStatus('0');
    setDesignDateNew(new Date().toISOString().split('T')[0]);
    setDocLocation2D('');
    setDocLocation3D('');
    setRevisionNote('Initial Release');
    setSelectedVendorId('');
    setPoNumber('');
    setCost(0);
    setLeadTime(1);
    setToast(null);
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    if (isCreateDirty()) {
      const confirmLeave = window.confirm('Formulir sedang diisi. Perubahan Anda akan hilang jika Anda menutup modal. Yakin?');
      if (!confirmLeave) return;
    }
    setShowCreateModal(false);
  };

  const handleOpenEditModal = (item: MasterItem) => {
    setEditingItem(item);

    // Auto-calculate next revision status
    const currentRev = parseInt(item.revStatus || '0', 10);
    const nextRev = isNaN(currentRev) ? '1' : String(currentRev + 1);
    setRevStatus(nextRev);

    const approvedDoc = item.documents?.find(d => d.approvalStatus === 'APPROVED');
    setDocLocation2D(approvedDoc?.loc2D || '');
    setDocLocation3D('');
    setDesignDateNew(new Date().toISOString().split('T')[0]);
    setRevisionNote('');
    setSelectedVendorId('');
    setPoNumber('');
    setCost(0);
    setLeadTime(1);
    setToast(null);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    if (isEditDirty()) {
      const confirmLeave = window.confirm('Formulir sedang diisi. Perubahan Anda akan hilang jika Anda menutup modal. Yakin?');
      if (!confirmLeave) return;
    }
    setShowEditModal(false);
  };

  useEffect(() => {
    if (action === 'revision') {
      setShowGlobalRevisionModal(true);
    } else {
      setShowGlobalRevisionModal(false);
    }
  }, [action]);

  const handleSelectGlobalRevisionItem = (itemId: string) => {
    setGlobalRevisionItemId(itemId);
    const selectedItem = items.find((i) => i.id === itemId);
    if (selectedItem) {
      const curRev = parseInt(selectedItem.revStatus || '0', 10);
      const nextRev = isNaN(curRev) ? '1' : String(curRev + 1);
      setRevStatus(nextRev);

      const approvedDoc = selectedItem.documents?.find(d => d.approvalStatus === 'APPROVED');
      setDocLocation2D(approvedDoc?.loc2D || '');
      setDocLocation3D('');
      setSelectedVendorId(selectedItem.vendor?.id || '');
    }
  };

  const handleCloseGlobalRevisionModal = () => {
    setShowGlobalRevisionModal(false);
    setGlobalRevisionItemId('');
    setGlobalRevisionItemSearch('');
    setIsGlobalRevisionDropdownOpen(false);
    setRevStatus('1');
    setDesignDateNew(new Date().toISOString().split('T')[0]);
    setDocLocation2D('');
    setDocLocation3D('');
    setRevisionNote('');
    setSelectedVendorId('');
    setPoNumber('');
    setCost(0);
    setLeadTime(1);
    router.push('/design');
  };

  const handleGlobalRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalRevisionItemId) return;
    setSubmitting(true);
    try {
      const selectedItem = items.find((i) => i.id === globalRevisionItemId);
      await submitDesignUpdate(globalRevisionItemId, {
        revStatus,
        designDateNew: designDateNew || undefined,
        docLocation2D: docLocation2D || undefined,
        docLocation3D: docLocation3D || undefined,
        revisionNote: revisionNote || undefined,
        vendorId: selectedVendorId || undefined,
        poNumber: poNumber || undefined,
        cost: cost ? parseFloat(String(cost)) : undefined,
        leadTime: leadTime ? parseInt(String(leadTime), 10) : undefined,
      });

      setToast({ type: 'success', msg: `Revisi ${selectedItem?.noReg} (Rev ${revStatus}) berhasil diajukan ke Approval Center!` });
      handleCloseGlobalRevisionModal();
      loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal mengajukan revisi.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const matchedLine = lines.find((l) => l.lineName.toLowerCase().trim() === lineInput.toLowerCase().trim());
      const lineId = matchedLine ? matchedLine.id : undefined;
      const lineName = matchedLine ? undefined : lineInput.trim();

      const matchedProcess = processes.find((p) => p.name.toLowerCase().trim() === processInput.toLowerCase().trim());
      const processId = matchedProcess ? matchedProcess.id : undefined;
      const processName = matchedProcess ? undefined : processInput.trim();

      await createDesignItem({
        noReg,
        assyPartName,
        noItem,
        qty,
        type,
        lineId,
        lineName,
        processId,
        processName,
        minimumStock,
        actualStock,
        revStatus,
        designDateNew,
        docLocation2D: docLocation2D || undefined,
        docLocation3D: docLocation3D || undefined,
        revisionNote: revisionNote || undefined,
        vendorId: selectedVendorId || undefined,
        poNumber: poNumber || undefined,
        cost: cost ? parseFloat(String(cost)) : undefined,
        leadTime: leadTime ? parseInt(String(leadTime), 10) : undefined,
      });

      setToast({ type: 'success', msg: `Desain baru ${noReg} (${assyPartName}) berhasil dibuat!` });
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal membuat desain.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSubmitting(true);
    try {
      await submitDesignUpdate(editingItem.id, {
        revStatus,
        designDateNew: designDateNew || undefined,
        docLocation2D: docLocation2D || undefined,
        docLocation3D: docLocation3D || undefined,
        revisionNote: revisionNote || undefined,
        vendorId: selectedVendorId || undefined,
        poNumber: poNumber || undefined,
        cost: cost ? parseFloat(String(cost)) : undefined,
        leadTime: leadTime ? parseInt(String(leadTime), 10) : undefined,
      });

      setToast({ type: 'success', msg: `Revisi ${editingItem.noReg} (Rev ${revStatus}) berhasil diajukan ke Approval Center!` });
      setShowEditModal(false);
      loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal mengajukan revisi.' });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter data logic
  const filteredItems = items.filter((item) => {
    const searchTerms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matchesSearch = searchTerms.every((term) => {
      return (
        item.noReg.toLowerCase().includes(term) ||
        item.assyPartName.toLowerCase().includes(term) ||
        item.noItem.toLowerCase().includes(term) ||
        item.lineProduct.toLowerCase().includes(term) ||
        item.process.toLowerCase().includes(term)
      );
    });

    const matchesLine = lineFilter === 'All' || item.lineProduct === lineFilter;
    const matchesProcess = processFilter === 'All' || item.process === processFilter;
    const matchesType = typeFilter === 'All' || item.type === typeFilter;
    const matchesVendor = vendorFilter === 'All' || item.vendor?.id === vendorFilter;
    const matchesLifecycle = lifecycleFilter === 'All' || item.lifecycleStatus === lifecycleFilter;
    const matchesRev = revFilter === 'All' || item.revStatus === revFilter;
    const matchesInv = inventoryFilter === 'All' || item.inventoryStatus === inventoryFilter;

    const matchesAbn =
      abnormalityFilter === 'All' ||
      (abnormalityFilter === 'OPEN' && item.abnormalityStatus !== 'RESOLVED') ||
      (abnormalityFilter === 'CLOSED' && item.abnormalityStatus === 'RESOLVED');

    return matchesSearch && matchesLine && matchesProcess && matchesType && matchesVendor && matchesLifecycle && matchesRev && matchesInv && matchesAbn;
  });

  // Unique list derivations for select inputs
  const uniqueLines = Array.from(new Set(items.map((i) => i.lineProduct).filter(Boolean)));
  const uniqueProcesses = Array.from(new Set(items.map((i) => i.process).filter(Boolean)));
  const uniqueRevs = Array.from(new Set(items.map((i) => i.revStatus).filter(Boolean)));

  const handleExport = async () => {
    if (filteredItems.length === 0) {
      alert('Tidak ada data untuk diunduh.');
      return;
    }

    // Dynamic import ExcelJS to keep bundle lean
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JigFixture System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Master List', {
      pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    });

    // ─── Build columns list ───────────────────────────────────────────────────
    const columns: { header: string; key: string; width: number }[] = [];
    columns.push({ header: 'No', key: 'no', width: 6 });
    if (exportCols.noReg) columns.push({ header: 'No. Registrasi', key: 'noReg', width: 18 });
    if (exportCols.assyPartName) columns.push({ header: 'Nama Part (Assy)', key: 'assyPartName', width: 36 });
    if (exportCols.lineProduct) columns.push({ header: 'Lini Produksi', key: 'lineProduct', width: 16 });
    if (exportCols.process) columns.push({ header: 'Proses (OP)', key: 'process', width: 16 });
    if (exportCols.type) columns.push({ header: 'Tipe', key: 'type', width: 14 });
    if (exportCols.lifecycleStatus) columns.push({ header: 'Lifecycle', key: 'lifecycleStatus', width: 18 });
    if (exportCols.revStatus) columns.push({ header: 'Revisi Terakhir', key: 'revStatus', width: 14 });
    if (exportCols.cost) columns.push({ header: 'Biaya Terakhir (Rp)', key: 'cost', width: 22 });
    if (exportCols.stock) {
      columns.push({ header: 'Stok Aktual', key: 'actualStock', width: 14 });
      columns.push({ header: 'Stok Minimum', key: 'minimumStock', width: 14 });
      columns.push({ header: 'Status Stok', key: 'stockStatus', width: 14 });
    }
    sheet.columns = columns;

    // ─── Title row ─────────────────────────────────────────────────────────────
    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    sheet.insertRow(1, [`PE-Machining — Jig & Fixture Master List (${today})`]);
    const titleRow = sheet.getRow(1);
    titleRow.getCell(1).font = { name: 'Calibri', bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0063FF' } };
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.mergeCells(1, 1, 1, columns.length);
    titleRow.height = 28;

    // ─── Header row (row 2 after insert) ────────────────────────────────────
    const headerRow = sheet.getRow(2);
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF4A90D9' } },
        bottom: { style: 'thin', color: { argb: 'FF4A90D9' } },
        left: { style: 'thin', color: { argb: 'FF4A90D9' } },
        right: { style: 'thin', color: { argb: 'FF4A90D9' } },
      };
    });
    headerRow.height = 22;

    // ─── AutoFilter on header row ────────────────────────────────────────────
    // Convert last column index to Excel letter (e.g. 3 → C)
    const colLetter = (n: number): string => {
      let s = '';
      while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s;
    };
    sheet.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: 2, column: columns.length },
    };
    // Also set the ref string so Excel shows the filter controls on row 2
    (sheet as any).autoFilter = `A2:${colLetter(columns.length)}2`;

    // ─── Data rows ───────────────────────────────────────────────────────────
    filteredItems.forEach((item, idx) => {
      const stockStatus =
        item.actualStock === 0 ? 'EMPTY'
          : item.actualStock < item.minimumStock * 0.5 ? 'CRITICAL'
            : item.actualStock < item.minimumStock ? 'WARNING'
              : 'AMAN';

      const rowData: any = { no: idx + 1 };
      if (exportCols.noReg) rowData.noReg = item.noReg;
      if (exportCols.assyPartName) rowData.assyPartName = item.assyPartName;
      if (exportCols.lineProduct) rowData.lineProduct = item.lineProduct;
      if (exportCols.process) rowData.process = item.process;
      if (exportCols.type) rowData.type = item.type === 'JF' ? 'Jig Fixture' : 'Equipment';
      if (exportCols.lifecycleStatus) rowData.lifecycleStatus = item.lifecycleStatus;
      if (exportCols.revStatus) rowData.revStatus = `Rev ${item.revStatus}`;
      if (exportCols.cost) rowData.cost = item.revisionHistories[0]?.cost || 0;
      if (exportCols.stock) {
        rowData.actualStock = item.actualStock;
        rowData.minimumStock = item.minimumStock;
        rowData.stockStatus = stockStatus;
      }

      const row = sheet.addRow(rowData);
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? 'FFF0F4FF' : 'FFFFFFFF';

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : 'left' };
        cell.border = {
          top: { style: 'hair', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'hair', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };

        // Color Stock Status cell
        if (exportCols.stock) {
          const stockColIdx = columns.findIndex(c => c.key === 'stockStatus') + 1;
          if (colNumber === stockColIdx) {
            const val = cell.value as string;
            const bgMap: Record<string, string> = {
              EMPTY: 'FFFEF2F2', CRITICAL: 'FFFEE2E2', WARNING: 'FFFEFCE8', AMAN: 'FFF0FDF4'
            };
            const fgMap: Record<string, string> = {
              EMPTY: 'FF991B1B', CRITICAL: 'FFDC2626', WARNING: 'FFCA8A04', AMAN: 'FF16A34A'
            };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgMap[val] || rowBg } };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: fgMap[val] || 'FF000000' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        }

        // Format cost as number
        if (exportCols.cost) {
          const costColIdx = columns.findIndex(c => c.key === 'cost') + 1;
          if (colNumber === costColIdx) {
            cell.numFmt = '#,##0';
          }
        }
      });
      row.height = 18;
    });

    // ─── Download ─────────────────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `JigFixture_MasterList_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 pt-2 bg-white h-full overflow-hidden">
      {/* Header */}
      <header className="h-12 flex justify-between items-center border-b border-gray-150 mb-3 shrink-0">
        <div className="flex items-center gap-4 flex-1">
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-1.5 shrink-0">
            <span className="material-symbols-outlined text-blue-600 text-lg">database</span>
            View Master Data Design
          </h2>
          {/* Search bar inside header */}
          <div className="relative w-80">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]" style={{ fontSize: '11px' }}>search</span>
            <input
              className="pl-7 pr-2.5 py-1.5 bg-gray-50 hover:bg-gray-100/70 border border-gray-300 rounded-lg w-full text-[10px] outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-medium transition-all"
              placeholder="Cari Reg ID / Part Name / Assy No..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Actions header group */}
        <div className="flex items-center gap-2 shrink-0">
          {isPic && (
            <button
              onClick={handleOpenCreateModal}
              className="bg-[#0063ff] text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#0052d4] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-xs">add</span> Desain
            </button>
          )}

          {/* Download feature trigger */}
          <button
            onClick={() => setShowExportModal(true)}
            className="bg-[#0063ff] text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#0052d4] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-xs">download</span> Master List
          </button>

          {/* System Warnings Notifications */}
          {hasAlerts && (
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="bg-red-600 hover:bg-red-700 text-white w-8 h-8 rounded-full flex items-center justify-center relative cursor-pointer shadow-sm transition-all shrink-0 animate-vibrate"
                title="Pemberitahuan Sistem"
              >
                <span className="material-symbols-outlined text-[16px]">notifications</span>
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-950 text-[7px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
                  {alerts.redItems.length + alerts.delayedAbnormalities.length + (waitingApprovalsCount > 0 ? 1 : 0)}
                </span>
              </button>

              {/* Notification Popover Dropdown */}
              {showNotifications && (
                <div className="absolute top-full right-0 mt-2 w-56 rounded-xl bg-white border border-gray-200 shadow-lg p-2.5 text-xs z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-gray-800">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-1.5 mb-1.5">
                    <span className="font-bold text-[9px] uppercase tracking-wider text-gray-400">Pemberitahuan</span>
                    <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-650 flex">
                      <span className="material-symbols-outlined text-[10px] font-bold">close</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                    {/* Red Items */}
                    {alerts.redItems.length > 0 && (
                      <Link
                        href="/inventory"
                        onClick={() => setShowNotifications(false)}
                        className="block p-1.5 rounded bg-red-600 hover:bg-red-700 transition-colors text-[9px] text-white"
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                          </span>
                          <span className="font-bold">Kritis: Stok 0 Unit</span>
                        </div>
                        <p className="text-[8.5px] text-red-100 leading-tight">
                          {alerts.redItems.length} Jig habis stok.
                        </p>
                      </Link>
                    )}

                    {/* Delayed Abnormalities */}
                    {alerts.delayedAbnormalities.length > 0 && (
                      <Link
                        href="/update-abnormality"
                        onClick={() => setShowNotifications(false)}
                        className="block p-1.5 rounded bg-amber-50 hover:bg-amber-100/50 transition-colors text-[9px]"
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="material-symbols-outlined text-[10px] text-amber-600 font-bold">report_problem</span>
                          <span className="font-bold text-amber-700">Anomali &gt; 2 Hari</span>
                        </div>
                        <p className="text-[8.5px] text-amber-650 leading-tight">
                          {alerts.delayedAbnormalities.length} anomali belum ditindak.
                        </p>
                      </Link>
                    )}

                    {/* Approvals */}
                    {waitingApprovalsCount > 0 && (
                      <Link
                        href="/approval-center"
                        onClick={() => setShowNotifications(false)}
                        className="block p-1.5 rounded bg-blue-600 hover:bg-blue-700 transition-colors text-[9px] text-white"
                      >
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[10px] text-white font-bold">pending</span>
                          <span className="font-bold">{waitingApprovalsCount} pengajuan butuh review</span>
                        </div>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Grid of filters */}
      <div className="grid grid-cols-8 gap-2 bg-gray-50 p-2.5 rounded-xl mb-3 border border-gray-150 text-[9px] font-semibold text-gray-600">
        {/* Production Line */}
        <div>
          <label className="block text-[8px] text-gray-400 mb-0.5 uppercase">Line</label>
          <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value)} className="w-full border border-gray-350 bg-white rounded p-1 text-[9px] outline-none">
            <option value="All">All Lines</option>
            {uniqueLines.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {/* OP Number / Process */}
        <div>
          <label className="block text-[8px] text-gray-400 mb-0.5 uppercase">OP Number</label>
          <select value={processFilter} onChange={(e) => setProcessFilter(e.target.value)} className="w-full border border-gray-350 bg-white rounded p-1 text-[9px] outline-none">
            <option value="All">All OP</option>
            {uniqueProcesses.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className="block text-[8px] text-gray-400 mb-0.5 uppercase">Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full border border-gray-350 bg-white rounded p-1 text-[9px] outline-none">
            <option value="All">All Types</option>
            <option value="JF">JF (Jig Fixture)</option>
            <option value="EQ">EQ (Equipment)</option>
          </select>
        </div>

        {/* Vendor */}
        <div>
          <label className="block text-[8px] text-gray-400 mb-0.5 uppercase">Vendor</label>
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="w-full border border-gray-350 bg-white rounded p-1 text-[9px] outline-none">
            <option value="All">All Vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        {/* Lifecycle Status */}
        <div>
          <label className="block text-[8px] text-gray-400 mb-0.5 uppercase">Lifecycle</label>
          <select value={lifecycleFilter} onChange={(e) => setLifecycleFilter(e.target.value)} className="w-full border border-gray-350 bg-white rounded p-1 text-[9px] outline-none">
            <option value="All">All Lifecycle</option>
            <option value="ACTIVE">Active</option>
            <option value="UNDER_REPAIR">Under Repair</option>
            <option value="UNDER_IMPROVEMENT">Under Improvement</option>
            <option value="OBSOLETE">Obsolete</option>
            <option value="SCRAP">Scrap</option>
          </select>
        </div>

        {/* Revision Status */}
        <div>
          <label className="block text-[8px] text-gray-400 mb-0.5 uppercase">Revision</label>
          <select value={revFilter} onChange={(e) => setRevFilter(e.target.value)} className="w-full border border-gray-350 bg-white rounded p-1 text-[9px] outline-none">
            <option value="All">All Rev</option>
            {uniqueRevs.map((r) => (
              <option key={r} value={r}>Rev {r}</option>
            ))}
          </select>
        </div>

        {/* Inventory Indicator Status */}
        <div>
          <label className="block text-[8px] text-gray-400 mb-0.5 uppercase">Stock Status</label>
          <select value={inventoryFilter} onChange={(e) => setInventoryFilter(e.target.value)} className="w-full border border-gray-350 bg-white rounded p-1 text-[9px] outline-none">
            <option value="All">All Stock Status</option>
            <option value="GREEN">Green (Aman)</option>
            <option value="YELLOW">Yellow (Warning)</option>
            <option value="RED">Red (Stok 0)</option>
          </select>
        </div>

        {/* Abnormality Status */}
        <div>
          <label className="block text-[8px] text-gray-400 mb-0.5 uppercase">Abnormality</label>
          <select value={abnormalityFilter} onChange={(e) => setAbnormalityFilter(e.target.value)} className="w-full border border-gray-350 bg-white rounded p-1 text-[9px] outline-none">
            <option value="All">All Abnormality</option>
            <option value="OPEN">Open (Problematic)</option>
            <option value="CLOSED">Closed (Selesai)</option>
          </select>
        </div>
      </div>

      {/* Main Datatable */}
      <div className="flex-1 overflow-y-auto no-scrollbar rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <div className="h-full flex flex-col justify-center items-center text-gray-400 text-xs">
            <span className="material-symbols-outlined animate-spin text-2xl mb-1 text-blue-600">sync</span>
            <span>Memuat data master...</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 sticky top-0 z-10">
                <th className="px-3 py-2 text-center w-8">No</th>
                <th className="px-2 py-2">No. Reg</th>
                <th className="px-2 py-2">Assy Part Name</th>
                <th className="px-2 py-2">Line</th>
                <th className="px-2 py-2">OP (Process)</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2 text-center">Lifecycle</th>
                <th className="px-2 py-2 text-center w-[85px]">Stock</th>
                <th className="px-2 py-2 text-center w-[85px]">Abn</th>
                {isPic && <th className="px-2 py-2 text-center w-20">Aksi</th>}
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {filteredItems.map((item, index) => {
                const isRed = item.actualStock < item.minimumStock * 0.5;
                const isYellow = item.actualStock < item.minimumStock && item.actualStock >= item.minimumStock * 0.5;

                return (
                  <tr
                    key={item.id}
                    onClick={() => {
                      router.push(`/design/${item.id}`);
                    }}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2 text-center font-bold text-gray-400">
                      {index + 1}
                    </td>
                    <td className="px-2 py-2 font-mono font-bold text-gray-900">{item.noReg}</td>
                    <td className="px-2 py-2 font-medium">{item.assyPartName}</td>
                    <td className="px-2 py-2 text-gray-550">{item.lineProduct}</td>
                    <td className="px-2 py-2 text-gray-550">{item.process}</td>
                    <td className="px-2 py-2 font-bold text-gray-500">{item.type}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${item.lifecycleStatus === 'UNDER_REPAIR' ? 'bg-orange-100 text-orange-700' :
                        item.lifecycleStatus === 'UNDER_IMPROVEMENT' ? 'bg-blue-100 text-blue-700' :
                          item.lifecycleStatus === 'OBSOLETE' ? 'bg-gray-100 text-gray-700' :
                            item.lifecycleStatus === 'SCRAP' ? 'bg-red-100 text-red-700' :
                              'bg-green-100 text-green-700'
                        }`}>
                        {item.lifecycleStatus || 'ACTIVE'}
                      </span>
                    </td>
                    <td className={`px-2 py-2 text-center font-bold text-[9px] uppercase tracking-wider border-r-2 border-white ${isRed ? 'bg-red-500 text-white' : isYellow ? 'bg-yellow-400 text-yellow-950' : 'bg-green-500 text-white'
                      }`}>
                      {isRed ? 'Critical' : isYellow ? 'Warning' : 'Aman'}
                    </td>
                    <td className={`px-2 py-2 text-center font-bold text-[9px] uppercase tracking-wider border-r-2 border-white ${item.abnormalityStatus === 'RESOLVED' ? 'bg-green-500 text-white' :
                      item.abnormalityStatus === 'IN_PROGRESS' ? 'bg-yellow-400 text-yellow-950' :
                        'bg-red-500 text-white animate-pulse'
                      }`}>
                      {item.abnormalityStatus === 'RESOLVED' ? 'Aman' :
                        item.abnormalityStatus === 'IN_PROGRESS' ? 'Monitoring' :
                          'Anomali'}
                    </td>
                    {isPic && (
                      <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(item);
                            }}
                            className="text-gray-650 hover:text-gray-900 transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Update Desain"
                          >
                            <span className="material-symbols-outlined text-[11px]">edit</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDeleteConfirm(item);
                            }}
                            className="text-gray-655 hover:text-red-650 transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Hapus Desain"
                          >
                            <span className="material-symbols-outlined text-[11px]">delete</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={isPic ? 10 : 9} className="text-center py-12 text-gray-400">
                    Tidak ada data master Jig &amp; Fixture yang cocok dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>


      {/* CREATE DESIGN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[90]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            {/* Header */}
            <div className="p-4 border-b border-gray-150 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-green-600 text-sm">add_box</span>
                Tambah Desain Baru — Formulir Master
              </h3>
              <button onClick={handleCloseCreateModal} className="text-gray-400 hover:text-gray-600 font-bold text-sm">✕</button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              <div className="grid grid-cols-2 gap-3.5">


                {/* Assembly Part Name */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Assembly Part Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-green-500"
                    value={assyPartName}
                    onChange={(e) => setAssyPartName(e.target.value)}
                    placeholder="Masukkan nama part..."
                  />
                </div>

                {/* Item / Assy Number */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Item / Assy No</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-green-500"
                    value={noItem}
                    onChange={(e) => setNoItem(e.target.value)}
                    placeholder="Contoh: ITEM-XXX"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Tipe *</label>
                  <select
                    className="w-full border border-gray-300 bg-white rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-green-500"
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                  >
                    <option value="JF">Jig Fixture (JF)</option>
                    <option value="EQ">Equipment (EQ)</option>
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Quantity *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-green-500"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="1"
                  />
                </div>

                {/* Design Date New */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Tanggal Desain Baru *</label>
                  <input
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-green-500 outline-none text-gray-700"
                    value={designDateNew}
                    onChange={(e) => setDesignDateNew(e.target.value)}
                  />
                </div>

                {/* Line Selector */}
                <div className="col-span-2 border-t border-gray-150 pt-3">
                  <SearchableDropdown
                    label="Line Produksi *"
                    placeholder="-- Pilih atau Buat Line Baru --"
                    options={getUniqueOptions(lines.map((l) => ({ id: l.id, name: l.lineName })))}
                    value={lineInput}
                    onChange={setLineInput}
                  />
                </div>

                {/* Process Selector */}
                <div className="col-span-2 border-b border-gray-150 pb-3">
                  <SearchableDropdown
                    label="OP / Proses *"
                    placeholder="-- Pilih atau Buat OP Baru --"
                    options={getUniqueOptions(processes.map((p) => ({ id: p.id, name: p.name })))}
                    value={processInput}
                    onChange={setProcessInput}
                  />
                </div>

                {/* Stock levels */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Stok Minimum *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-green-500"
                    value={minimumStock}
                    onChange={(e) => setMinimumStock(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Stok Aktual *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-green-500"
                    value={actualStock}
                    onChange={(e) => setActualStock(parseInt(e.target.value) || 0)}
                  />
                </div>

                {/* 2D drawing upload */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Drawing 2D (PDF) *</label>
                  <label className="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-xl p-2 cursor-pointer hover:bg-blue-50/50 hover:border-[#0063ff] transition-all h-20 bg-white text-center shadow-3xs">
                    <input
                      type="file"
                      accept=".pdf"
                      required={!docLocation2D}
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const result = await uploadFile(file);
                          setDocLocation2D(result.url);
                        } catch {
                          alert('Gagal upload file 2D. Coba lagi.');
                        }
                      }}
                    />
                    <span className="material-symbols-outlined text-red-500 text-xl mb-0.5">picture_as_pdf</span>
                    <span className="text-[9px] font-bold text-gray-700">Upload 2D PDF</span>
                    <span className="text-[8px] text-gray-400 truncate max-w-[150px] mt-0.5 font-semibold">
                      {docLocation2D ? docLocation2D.replace('/uploads/', '') : 'Pilih file PDF...'}
                    </span>
                  </label>
                </div>

                {/* 3D upload */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Model 3D (STEP/IGS/PDF)</label>
                  <label className="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-xl p-2 cursor-pointer hover:bg-blue-50/50 hover:border-[#0063ff] transition-all h-20 bg-white text-center shadow-3xs">
                    <input
                      type="file"
                      accept=".step,.stp,.pdf,.igs,.iges"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const result = await uploadFile(file);
                          setDocLocation3D(result.url);
                        } catch {
                          alert('Gagal upload file 3D. Coba lagi.');
                        }
                      }}
                    />
                    <span className="material-symbols-outlined text-blue-500 text-xl mb-0.5">picture_as_pdf</span>
                    <span className="text-[9px] font-bold text-gray-700">Upload 3D File</span>
                    <span className="text-[8px] text-gray-400 truncate max-w-[150px] mt-0.5 font-semibold">
                      {docLocation3D ? docLocation3D.replace('/uploads/', '') : 'Pilih file 3D...'}
                    </span>
                  </label>
                </div>

                {/* Vendor select */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Vendor Pembuat</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-green-500 outline-none text-gray-700 font-semibold"
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                  >
                    <option value="">-- Pilih Vendor --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                    ))}
                  </select>
                </div>

                {/* PO Number */}
                <div className="col-span-2 grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">PO Number</label>
                    <input
                      type="text"
                      placeholder="PO/2026/XYZ/0123"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-green-500 outline-none text-gray-700"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Lead Time (Hari)</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-green-500 outline-none text-gray-700"
                      value={leadTime}
                      onChange={(e) => setLeadTime(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>

                {/* Cost */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Biaya Pembuatan (Cost IDR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Contoh: 15000000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-green-500 outline-none text-gray-700 font-bold"
                    value={cost}
                    onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Initial release note */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Deskripsi Awal (Initial Note) *</label>
                <textarea
                  placeholder="Jelaskan status rilis awal Jig ini..."
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  required
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-green-500 outline-none resize-none text-gray-700"
                />
              </div>

              {/* Footer Actions */}
              <div className="flex gap-2 border-t border-gray-150 pt-4 pb-2">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                >
                  {submitting ? (
                    <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">check</span>
                      <span>Buat Desain Baru</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirmModal && itemToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[90]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl relative p-6 text-gray-800">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-650 text-2xl">delete_forever</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-gray-900">Hapus Item Desain</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus item <span className="font-mono font-semibold text-gray-800">{itemToDelete.noReg}</span>? Tindakan ini tidak dapat dibatalkan dan semua data riwayat revisi terkait akan dihapus.
                </p>
              </div>
              <div className="flex items-center gap-3 w-full pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirmModal(false);
                    setItemToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 bg-red-650 hover:bg-red-700 rounded-xl text-xs font-bold text-white transition-colors"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT / UPDATE DESIGN REVISION MODAL */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[90]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            {/* Header */}
            <div className="p-4 border-b border-gray-150 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-sm">edit_square</span>
                <span>Edit Revisi — <span className="font-mono text-blue-600">{editingItem.noReg}</span></span>
              </h3>
              <button onClick={handleCloseEditModal} className="text-gray-400 hover:text-gray-600 font-bold text-sm">✕</button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              <div className="grid grid-cols-2 gap-3.5">
                {/* No Reg (Locked) */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Nomor Registrasi (Locked)</label>
                  <input
                    type="text"
                    disabled
                    readOnly
                    className="w-full border border-gray-250 bg-gray-100 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-500 font-mono font-semibold"
                    value={editingItem.noReg}
                  />
                </div>

                {/* Rev Status (Locked Next Rev) */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Target Revisi (Auto)</label>
                  <input
                    type="text"
                    disabled
                    readOnly
                    className="w-full border border-gray-250 bg-gray-100 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-500 font-bold"
                    value={`Rev ${editingItem.revStatus || '0'} → Rev ${revStatus}`}
                  />
                </div>

                {/* Design Date New */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Tanggal Desain Baru *</label>
                  <input
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0063ff] outline-none text-gray-700"
                    value={designDateNew}
                    onChange={(e) => setDesignDateNew(e.target.value)}
                  />
                </div>

                {/* Drawing upload 2D */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Drawing 2D (PDF) *</label>
                  <label className="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-xl p-2 cursor-pointer hover:bg-blue-50/50 hover:border-[#0063ff] transition-all h-20 bg-white text-center shadow-3xs">
                    <input
                      type="file"
                      accept=".pdf"
                      required={!docLocation2D}
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const result = await uploadFile(file);
                          setDocLocation2D(result.url);
                        } catch {
                          alert('Gagal upload file 2D. Coba lagi.');
                        }
                      }}
                    />
                    <span className="material-symbols-outlined text-red-500 text-xl mb-0.5">picture_as_pdf</span>
                    <span className="text-[9px] font-bold text-gray-700">Upload 2D PDF</span>
                    <span className="text-[8px] text-gray-400 truncate max-w-[150px] mt-0.5 font-semibold">
                      {docLocation2D ? docLocation2D.replace('/uploads/', '') : 'Pilih file PDF...'}
                    </span>
                  </label>
                </div>

                {/* 3D upload */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Model 3D (STEP/IGS/PDF)</label>
                  <label className="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-xl p-2 cursor-pointer hover:bg-blue-50/50 hover:border-[#0063ff] transition-all h-20 bg-white text-center shadow-3xs">
                    <input
                      type="file"
                      accept=".step,.stp,.pdf,.igs,.iges"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const result = await uploadFile(file);
                          setDocLocation3D(result.url);
                        } catch {
                          alert('Gagal upload file 3D. Coba lagi.');
                        }
                      }}
                    />
                    <span className="material-symbols-outlined text-blue-500 text-xl mb-0.5">picture_as_pdf</span>
                    <span className="text-[9px] font-bold text-gray-700">Upload 3D File</span>
                    <span className="text-[8px] text-gray-400 truncate max-w-[150px] mt-0.5 font-semibold">
                      {docLocation3D ? docLocation3D.replace('/uploads/', '') : 'Pilih file 3D...'}
                    </span>
                  </label>
                </div>

                {/* Vendor select */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Vendor Pembuat</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-green-500 outline-none text-gray-700 font-semibold"
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                  >
                    <option value="">-- Pilih Vendor --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                    ))}
                  </select>
                </div>

                {/* PO Number */}
                <div className="col-span-2 grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">PO Number</label>
                    <input
                      type="text"
                      placeholder="PO/2026/XYZ/0123"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-green-500 outline-none text-gray-700"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Lead Time (Hari)</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-green-500 outline-none text-gray-700"
                      value={leadTime}
                      onChange={(e) => setLeadTime(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>

                {/* Cost */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Biaya Pembuatan (Cost IDR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Contoh: 15000000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0063ff] outline-none text-gray-700 font-bold"
                    value={cost}
                    onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Change Reason */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Change Reason (Alasan Perubahan) *</label>
                <textarea
                  placeholder="Jelaskan secara terperinci alasan modifikasi atau revisi desain Jig ini..."
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  required
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0063ff] outline-none resize-none text-gray-700"
                />
              </div>

              {/* Footer Actions */}
              <div className="flex gap-2 border-t border-gray-150 pt-4 pb-2">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                >
                  {submitting ? (
                    <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">send</span>
                      <span>Ajukan ke Approval</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Export Columns Selector Checklist Modal */}
      {showExportModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="max-w-xs w-full bg-white border border-gray-300 rounded-2xl p-4 text-gray-800 shadow-2xl relative">
            <h3 className="font-bold text-xs text-gray-800 mb-2 border-b border-gray-100 pb-1.5">
              Pilih Kolom Ekspor (Select Columns)
            </h3>
            <p className="text-[9px] text-gray-500 mb-3 leading-tight">
              Centang kolom data spesifikasi Jig &amp; Fixture yang ingin Anda sertakan di dalam file unduhan CSV/Excel.
            </p>

            <div className="flex flex-col gap-2 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportCols.noReg}
                  onChange={(e) => setExportCols({ ...exportCols, noReg: e.target.checked })}
                />
                <span>Registration Number</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportCols.assyPartName}
                  onChange={(e) => setExportCols({ ...exportCols, assyPartName: e.target.checked })}
                />
                <span>Assembly Part Name</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportCols.lineProduct}
                  onChange={(e) => setExportCols({ ...exportCols, lineProduct: e.target.checked })}
                />
                <span>Production Line</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportCols.process}
                  onChange={(e) => setExportCols({ ...exportCols, process: e.target.checked })}
                />
                <span>Process (OP)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportCols.type}
                  onChange={(e) => setExportCols({ ...exportCols, type: e.target.checked })}
                />
                <span>Type (JF/EQ)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportCols.lifecycleStatus}
                  onChange={(e) => setExportCols({ ...exportCols, lifecycleStatus: e.target.checked })}
                />
                <span>Lifecycle Status</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportCols.revStatus}
                  onChange={(e) => setExportCols({ ...exportCols, revStatus: e.target.checked })}
                />
                <span>Revision Status</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportCols.cost}
                  onChange={(e) => setExportCols({ ...exportCols, cost: e.target.checked })}
                />
                <span>Vendor Cost (Biaya)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportCols.stock}
                  onChange={(e) => setExportCols({ ...exportCols, stock: e.target.checked })}
                />
                <span>Stock Levels (Min/Act)</span>
              </label>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-[10px] font-bold hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExport}
                className="flex-1 py-1.5 bg-[#0063ff] text-white rounded-lg text-[10px] font-bold hover:bg-[#0052d4] transition-colors cursor-pointer"
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}
      {/* GLOBAL SUBMIT REVISION MODAL */}
      {showGlobalRevisionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[90]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-xl min-h-[460px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            {/* Header */}
            <div className="p-4 border-b border-gray-150 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-sm">history</span>
                <span>Submit Revision Request</span>
              </h3>
              <button onClick={handleCloseGlobalRevisionModal} className="text-gray-400 hover:text-gray-600 font-bold text-sm">✕</button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleGlobalRevisionSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {/* Item Selector Dropdown */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Pilih Item Jig/Fixture *</label>
                {(() => {
                  const selectedItem = items.find((item) => item.id === globalRevisionItemId);
                  const filteredItems = items.filter((item) => {
                    const query = globalRevisionItemSearch.toLowerCase();
                    return (
                      item.noReg.toLowerCase().includes(query) ||
                      item.assyPartName.toLowerCase().includes(query) ||
                      item.lineProduct.toLowerCase().includes(query)
                    );
                  });

                  return (
                    <div className="relative">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="-- Cari berdasarkan No. Reg / Part Name / Line --"
                          value={isGlobalRevisionDropdownOpen ? globalRevisionItemSearch : (selectedItem ? `${selectedItem.noReg} — ${selectedItem.assyPartName} [${selectedItem.lineProduct}]` : '')}
                          onChange={(e) => {
                            setGlobalRevisionItemSearch(e.target.value);
                            if (!isGlobalRevisionDropdownOpen) setIsGlobalRevisionDropdownOpen(true);
                          }}
                          onFocus={() => {
                            setIsGlobalRevisionDropdownOpen(true);
                            setGlobalRevisionItemSearch('');
                          }}
                          className="w-full border border-gray-300 rounded-lg pl-3 pr-12 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0063ff] outline-none text-gray-700 font-medium"
                        />
                        <input type="hidden" required value={globalRevisionItemId} />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          {globalRevisionItemId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGlobalRevisionItemId('');
                                setGlobalRevisionItemSearch('');
                              }}
                              className="text-gray-400 hover:text-gray-650 cursor-pointer flex"
                            >
                              <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsGlobalRevisionDropdownOpen(!isGlobalRevisionDropdownOpen)}
                            className="text-gray-400 hover:text-gray-650 cursor-pointer flex"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {isGlobalRevisionDropdownOpen ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Dropdown Options */}
                      {isGlobalRevisionDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsGlobalRevisionDropdownOpen(false)}
                          ></div>

                          <ul className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg z-50 text-xs no-scrollbar py-1">
                            {filteredItems.length > 0 ? (
                              filteredItems.map((item) => {
                                const isSelected = item.id === globalRevisionItemId;
                                return (
                                  <li
                                    key={item.id}
                                    onClick={() => {
                                      handleSelectGlobalRevisionItem(item.id);
                                      setIsGlobalRevisionDropdownOpen(false);
                                      setGlobalRevisionItemSearch('');
                                    }}
                                    className={`px-3 py-2 cursor-pointer transition-colors flex flex-col gap-0.5 ${isSelected
                                      ? 'bg-blue-50 text-blue-700 font-bold'
                                      : 'text-gray-700 hover:bg-gray-50'
                                      }`}
                                  >
                                    <div className="flex justify-between items-center">
                                      <span className="font-semibold text-gray-800">{item.noReg}</span>
                                      <span className="text-[8px] uppercase font-bold bg-gray-150 text-gray-600 px-1.5 py-0.25 rounded font-mono">
                                        {item.lineProduct}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-gray-500 font-medium truncate">{item.assyPartName}</span>
                                  </li>
                                );
                              })
                            ) : (
                              <li className="px-3 py-2 text-gray-400 italic text-center">Item tidak ditemukan</li>
                            )}
                          </ul>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {globalRevisionItemId ? (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-3.5">
                    {/* Rev Status (Locked Next Rev) */}
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Target Revisi (Auto)</label>
                      <input
                        type="text"
                        disabled
                        readOnly
                        className="w-full border border-gray-250 bg-gray-100 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-500 font-mono font-semibold"
                        value={`Rev ${revStatus}`}
                      />
                    </div>

                    {/* New Design Date */}
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Tanggal Desain Baru *</label>
                      <input
                        type="date"
                        required
                        className="w-full border border-gray-250 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-medium"
                        value={designDateNew}
                        onChange={(e) => setDesignDateNew(e.target.value)}
                      />
                    </div>

                    {/* 2D drawing upload */}
                    <div className="col-span-2">
                      <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Drawing 2D (PDF) *</label>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg cursor-pointer transition-colors text-xs font-semibold">
                          <span className="material-symbols-outlined text-sm text-gray-600">upload_file</span>
                          <span className="text-[9px] font-bold text-gray-700">Upload 2D PDF</span>
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const result = await uploadFile(file);
                                setDocLocation2D(result.url);
                              } catch (err) {
                                alert('Gagal upload file 2D. Coba lagi.');
                              }
                            }}
                          />
                        </label>
                        <input
                          type="text"
                          readOnly
                          className="flex-1 border border-gray-250 bg-gray-50 rounded-lg px-3 py-1.5 text-xs text-gray-500 outline-none truncate font-mono"
                          value={docLocation2D ? docLocation2D.replace('/uploads/', '') : 'Pilih file PDF...'}
                        />
                      </div>
                    </div>

                    {/* 3D model upload */}
                    <div className="col-span-2">
                      <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Model 3D (Zip / File) *</label>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg cursor-pointer transition-colors text-xs font-semibold">
                          <span className="material-symbols-outlined text-sm text-gray-600">upload_file</span>
                          <span className="text-[9px] font-bold text-gray-700">Upload 3D Model</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const result = await uploadFile(file);
                                setDocLocation3D(result.url);
                              } catch (err) {
                                alert('Gagal upload file 3D. Coba lagi.');
                              }
                            }}
                          />
                        </label>
                        <input
                          type="text"
                          readOnly
                          className="flex-1 border border-gray-250 bg-gray-50 rounded-lg px-3 py-1.5 text-xs text-gray-500 outline-none truncate font-mono"
                          value={docLocation3D ? docLocation3D.replace('/uploads/', '') : 'Pilih file 3D...'}
                        />
                      </div>
                    </div>

                    {/* Vendor Select */}
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Pilih Vendor Fabrikasi</label>
                      <select
                        className="w-full border border-gray-250 rounded-lg px-3 py-1.5 text-xs outline-none bg-white text-gray-700 font-medium"
                        value={selectedVendorId}
                        onChange={(e) => setSelectedVendorId(e.target.value)}
                      >
                        <option value="">-- Pilih vendor --</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* PO Number */}
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Nomor PO (Purchase Order)</label>
                      <input
                        type="text"
                        placeholder="Ketik No PO..."
                        className="w-full border border-gray-250 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700"
                        value={poNumber}
                        onChange={(e) => setPoNumber(e.target.value)}
                      />
                    </div>

                    {/* Cost / Biaya */}
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Estimasi Biaya (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Rp..."
                        className="w-full border border-gray-250 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-705 font-bold"
                        value={cost || ''}
                        onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Lead Time */}
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Lead Time (Hari)</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Hari..."
                        className="w-full border border-gray-250 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-705 font-bold"
                        value={leadTime || ''}
                        onChange={(e) => setLeadTime(parseInt(e.target.value, 10) || 1)}
                      />
                    </div>

                    {/* Revision Note */}
                    <div className="col-span-2">
                      <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Catatan / Alasan Revisi *</label>
                      <textarea
                        required
                        rows={2}
                        placeholder="Uraikan detail revisi desain..."
                        className="w-full border border-gray-250 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 resize-none"
                        value={revisionNote}
                        onChange={(e) => setRevisionNote(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleCloseGlobalRevisionModal}
                      className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                    >
                      {submitting ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                          Mengirim...
                        </>
                      ) : (
                        'Ajukan Revisi'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 text-xs italic">
                  Silakan pilih item Jig/Fixture untuk memulai revisi.
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DesignPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-2xl text-primary">sync</span>
          <p className="text-xs text-gray-500 mt-2 font-medium">Memuat data desain...</p>
        </div>
      </div>
    }>
      <DesignPageContent />
    </Suspense>
  );
}
