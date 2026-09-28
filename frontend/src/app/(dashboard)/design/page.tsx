'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { fetchMasterList, fetchVendors, fetchLinesAndProcesses, createDesignItem, submitDesignUpdate, fetchDashboardAlerts, uploadFile, getFileUrl, deleteDesignItem, fetchCellParts, createCellPart, updateCellPart, renewCellPart, renewDesign, recordUsage, deleteCellPart, parseDrawingPdf, ParsedJigMetadata, ParsedCellPartItem, downloadDesignPdfPage, fetchDesignPdfBlob } from '@/lib/api/phase3';
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
  path2D: string | null;
  loc2D: string | null;
  path3D: string | null;
  loc3D: string | null;
}

interface AbnormalityInfo {
  id: string;
  type: string;
  description: string;
  status: string;
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

interface CellPartInfo {
  id: string;
  partNumber: string;
  name: string;
  description: string | null;
  lifetimeDays: number;
  lifetimeType?: 'DUAL' | 'USAGE' | 'DAYS';
  maxUsage?: number;
  currentUsage?: number;
  usageRemaining?: number;
  usagePercent?: number;
  dayStatus?: 'OVERDUE' | 'WARNING' | 'SAFE';
  usageStatus?: 'OVERDUE' | 'WARNING' | 'SAFE';
  triggerReason?: 'DAYS' | 'USAGE' | 'BOTH' | 'NONE';
  installDate: string;
  lastRenewalDate: string | null;
  dueDate: string;
  daysRemaining: number;
  lifetimeStatus: 'OVERDUE' | 'WARNING' | 'SAFE';
  minimumStock: number;
  actualStock: number;
  pdfPageIndex: number | null;
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
  lifetimeDays?: number;
  lifetimeType?: 'DUAL' | 'USAGE' | 'DAYS';
  maxUsage?: number;
  currentUsage?: number;
  usageRemaining?: number;
  usagePercent?: number;
  daysRemaining?: number;
  dueDate?: string;
  dayStatus?: 'OVERDUE' | 'WARNING' | 'SAFE';
  usageStatus?: 'OVERDUE' | 'WARNING' | 'SAFE';
  lifetimeStatus?: 'OVERDUE' | 'WARNING' | 'SAFE';
  triggerReason?: 'DAYS' | 'USAGE' | 'BOTH' | 'NONE';
  lineProduct: string;
  process: string;
  vendor: { id: string; name: string } | null;
  documents: DocumentInfo[];
  revisionHistories: RevHistoryInfo[];
  abnormalities: AbnormalityInfo[];
  cellParts: CellPartInfo[];
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

  // Pagination & Multi-Page Selection States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'All'>(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportScope, setExportScope] = useState<'selected' | 'all'>('selected');
  const [isZippingPdf, setIsZippingPdf] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);
  const selectDropdownRef = React.useRef<HTMLDivElement>(null);
  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);

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

  // CellPart expand and modal state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showCellPartModal, setShowCellPartModal] = useState(false);
  const [cellPartParentId, setCellPartParentId] = useState('');
  const [cpPartNumber, setCpPartNumber] = useState('');
  const [cpName, setCpName] = useState('');
  const [cpDescription, setCpDescription] = useState('');
  const [cpLifetimeDays, setCpLifetimeDays] = useState(180);
  const [cpInstallDate, setCpInstallDate] = useState(new Date().toISOString().split('T')[0]);
  const [cpMinStock, setCpMinStock] = useState(0);
  const [cpActStock, setCpActStock] = useState(0);

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
  const [lifetimeDaysInput, setLifetimeDaysInput] = useState(180);
  const [lifetimeTypeInput, setLifetimeTypeInput] = useState<'DUAL' | 'USAGE' | 'DAYS'>('DUAL');
  const [maxUsageInput, setMaxUsageInput] = useState<number>(500);
  const [currentUsageInput, setCurrentUsageInput] = useState<number>(0);

  // 2-Way Lifetime states for CellPart Modal
  const [cpLifetimeType, setCpLifetimeType] = useState<'DUAL' | 'USAGE' | 'DAYS'>('DUAL');
  const [cpMaxUsage, setCpMaxUsage] = useState<number>(500);
  const [cpCurrentUsage, setCpCurrentUsage] = useState<number>(0);

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

  // Drawing PDF Extraction & BOM states
  const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
  const [extractedJig, setExtractedJig] = useState<ParsedJigMetadata | null>(null);
  const [extractedCellParts, setExtractedCellParts] = useState<ParsedCellPartItem[]>([]);
  const [selectedCpKeys, setSelectedCpKeys] = useState<Set<number>>(new Set());
  const [showExtractedBOM, setShowExtractedBOM] = useState(true);

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
        fetchMasterList().catch((err) => {
          if (err?.status === 401 || err?.status === 403) throw err;
          console.warn('Failed to fetch master list, fallback empty:', err);
          return [];
        }),
        fetchVendors().catch((err) => {
          if (err?.status === 401 || err?.status === 403) throw err;
          console.warn('Failed to fetch vendors, fallback empty:', err);
          return [];
        }),
        fetchLinesAndProcesses().catch((err) => {
          if (err?.status === 401 || err?.status === 403) throw err;
          console.warn('Failed to fetch lines/processes, fallback empty:', err);
          return { lines: [], processes: [] };
        }),
        fetchDashboardAlerts().catch(() => ({ redItems: [], delayedAbnormalities: [], waitingApprovalsCount: 0 })),
      ]);
      setItems(list || []);
      setVendors(vList || []);
      setLines(meta?.lines || []);
      setProcesses(meta?.processes || []);
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
    setExtractedJig(null);
    setExtractedCellParts([]);
    setSelectedCpKeys(new Set());
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
    if (!lineInput.trim()) {
      setToast({ type: 'error', msg: 'Harap pilih atau isi Line Produksi sebelum menyimpan.' });
      return;
    }
    if (!processInput.trim()) {
      setToast({ type: 'error', msg: 'Harap pilih atau isi OP / Proses sebelum menyimpan.' });
      return;
    }
    setSubmitting(true);
    try {
      const matchedLine = lines.find((l) => l.lineName.toLowerCase().trim() === lineInput.toLowerCase().trim());
      const lineId = matchedLine ? matchedLine.id : undefined;
      const lineName = matchedLine ? undefined : lineInput.trim();

      const matchedProcess = processes.find((p) => p.name.toLowerCase().trim() === processInput.toLowerCase().trim());
      const processId = matchedProcess ? matchedProcess.id : undefined;
      const processName = matchedProcess ? undefined : processInput.trim();

      const cellPartsToCreate = extractedCellParts
        .filter((cp) => selectedCpKeys.has(cp.itemNo))
        .map((cp) => ({
          partNumber: cp.partNumber,
          name: cp.name,
          description: cp.description,
          material: cp.material,
          qty: cp.qty,
          pdfPageIndex: cp.pdfPageIndex,
          lifetimeDays: 180,
          lifetimeType: 'DUAL',
          maxUsage: 500,
          currentUsage: 0,
          minimumStock: 0,
          actualStock: parseInt(String(cp.qty), 10) || 1,
        }));

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
        lifetimeDays: lifetimeDaysInput,
        lifetimeType: lifetimeTypeInput,
        maxUsage: maxUsageInput,
        currentUsage: currentUsageInput,
        revStatus,
        designDateNew,
        docLocation2D: docLocation2D || undefined,
        docLocation3D: docLocation3D || undefined,
        revisionNote: revisionNote || undefined,
        vendorId: selectedVendorId || undefined,
        poNumber: poNumber || undefined,
        cost: cost ? parseFloat(String(cost)) : undefined,
        leadTime: leadTime ? parseInt(String(leadTime), 10) : undefined,
        cellParts: cellPartsToCreate.length > 0 ? cellPartsToCreate : undefined,
      });

      setToast({ type: 'success', msg: `Desain baru ${noReg} (${assyPartName}) beserta ${cellPartsToCreate.length} CellPart berhasil dibuat!` });
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

  // CellPart Handlers
  const toggleExpandRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenCellPartModal = (designId: string) => {
    setCellPartParentId(designId);
    setCpPartNumber('');
    setCpName('');
    setCpDescription('');
    setCpLifetimeDays(180);
    setCpLifetimeType('DUAL');
    setCpMaxUsage(500);
    setCpCurrentUsage(0);
    setCpInstallDate(new Date().toISOString().split('T')[0]);
    setCpMinStock(0);
    setCpActStock(0);
    setShowCellPartModal(true);
  };

  const handleCellPartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createCellPart({
        designId: cellPartParentId,
        partNumber: cpPartNumber,
        name: cpName,
        description: cpDescription || undefined,
        lifetimeDays: cpLifetimeDays,
        lifetimeType: cpLifetimeType,
        maxUsage: cpMaxUsage,
        currentUsage: cpCurrentUsage,
        installDate: cpInstallDate,
        minimumStock: cpMinStock,
        actualStock: cpActStock,
      });
      setToast({ type: 'success', msg: `CellPart "${cpName}" berhasil ditambahkan!` });
      setShowCellPartModal(false);
      await loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal menambah CellPart.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Usage Logging Handler
  const handleOpenUsageModal = (
    target: 'design' | 'cell-part',
    id: string,
    noRegOrPart: string,
    name: string,
    currentUsage: number = 0,
    maxUsage: number = 500,
  ) => {
    setUsageTarget({ target, id, noRegOrPart, name, currentUsage, maxUsage });
    setUsageAmountInput(50);
    setUsageMode('ADD');
    setShowUsageModal(true);
  };

  const handleSaveUsage = async () => {
    if (!usageTarget) return;
    setSubmitting(true);
    try {
      await recordUsage(usageTarget.target, usageTarget.id, usageAmountInput, usageMode);
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

  // Quick Lifetime Renewal Handler
  const handleOpenRenewModal = (
    target: 'design' | 'cell-part',
    id: string,
    noRegOrPart: string,
    name: string,
  ) => {
    setRenewTarget({ target, id, noRegOrPart, name });
    setRenewResetDays(true);
    setRenewResetUsage(true);
    setShowRenewModal(true);
  };

  const handleConfirmRenew = async () => {
    if (!renewTarget) return;
    setSubmitting(true);
    try {
      if (renewTarget.target === 'design') {
        await renewDesign(renewTarget.id, { resetDays: renewResetDays, resetUsage: renewResetUsage });
      } else {
        await renewCellPart(renewTarget.id, { resetDays: renewResetDays, resetUsage: renewResetUsage });
      }
      setToast({
        type: 'success',
        msg: `Lifetime "${renewTarget.name}" berhasil di-renew!`,
      });
      setShowRenewModal(false);
      setRenewTarget(null);
      await loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal me-renew lifetime.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCellPart = async (cpId: string, cpName: string) => {
    if (!window.confirm(`Hapus CellPart "${cpName}"? Data tidak bisa dikembalikan.`)) return;
    try {
      await deleteCellPart(cpId);
      setToast({ type: 'success', msg: `CellPart "${cpName}" berhasil dihapus!` });
      await loadData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal menghapus CellPart.' });
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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    lineFilter,
    processFilter,
    typeFilter,
    vendorFilter,
    lifecycleFilter,
    revFilter,
    inventoryFilter,
    abnormalityFilter,
    pageSize,
  ]);

  // Click outside listener for table selection dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (selectDropdownRef.current && !selectDropdownRef.current.contains(e.target as Node)) {
        setShowSelectDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ─── Pagination Calculations ────────────────────────────────────────────────
  const totalItems = filteredItems.length;
  const totalPages = pageSize === 'All' ? 1 : Math.max(1, Math.ceil(totalItems / (pageSize as number)));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = React.useMemo(() => {
    if (pageSize === 'All') return filteredItems;
    const start = (validCurrentPage - 1) * (pageSize as number);
    return filteredItems.slice(start, start + (pageSize as number));
  }, [filteredItems, validCurrentPage, pageSize]);

  // Checkbox helpers
  const allCurrentPageSelected =
    paginatedItems.length > 0 && paginatedItems.every((item) => selectedIds.has(item.id));

  const isSomeCurrentPageSelected =
    paginatedItems.some((item) => selectedIds.has(item.id)) && !allCurrentPageSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeCurrentPageSelected;
    }
  }, [isSomeCurrentPageSelected]);

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectCurrentPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allCurrentPageSelected) {
        paginatedItems.forEach((item) => next.delete(item.id));
      } else {
        paginatedItems.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredItems.map((item) => item.id)));
    setShowSelectDropdown(false);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setShowSelectDropdown(false);
  };

  // ─── Batch Download PDF Drawings (.zip) ───────────────────────────────────
  const handleBatchDownloadPdfZip = async () => {
    const selectedItemsList = items.filter((item) => selectedIds.has(item.id));
    const itemsWithApprovedPdf = selectedItemsList.filter((item) => {
      const doc = item.documents?.[item.documents.length - 1] || item.documents?.[0];
      return doc && doc.approvalStatus === 'APPROVED';
    });

    if (itemsWithApprovedPdf.length === 0) {
      alert('Tidak ada item terpilih yang memiliki Drawing PDF Resmi (Approved).');
      return;
    }

    setIsZippingPdf(true);
    setZipProgress({ current: 0, total: itemsWithApprovedPdf.length });

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const folderName = `Drawing_Resmi_${new Date().toISOString().split('T')[0]}`;
      const folder = zip.folder(folderName);

      for (let i = 0; i < itemsWithApprovedPdf.length; i++) {
        const item = itemsWithApprovedPdf[i];
        setZipProgress({ current: i + 1, total: itemsWithApprovedPdf.length });
        try {
          const { blob, filename } = await fetchDesignPdfBlob(item.id);
          const safeNoReg = item.noReg.replace(/[/\\?%*:|"<>]/g, '_');
          const saveName = `${safeNoReg}_${filename}`;
          folder?.file(saveName, blob);
        } catch (err) {
          console.error(`Gagal mengunduh PDF untuk ${item.noReg}`, err);
        }
      }

      const zipContent = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipContent);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Batch_Drawing_JigFixture_${selectedIds.size}_Items_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setToast({
        type: 'success',
        msg: `Berhasil mengunduh ${itemsWithApprovedPdf.length} Drawing PDF dalam format ZIP!`,
      });
    } catch (err: any) {
      console.error('Failed to generate ZIP:', err);
      alert('Gagal mengemas file PDF ke dalam ZIP. Silakan coba lagi.');
    } finally {
      setIsZippingPdf(false);
      setZipProgress(null);
    }
  };

  // Unique list derivations for select inputs
  const uniqueLines = Array.from(new Set(items.map((i) => i.lineProduct).filter(Boolean)));
  const uniqueProcesses = Array.from(new Set(items.map((i) => i.process).filter(Boolean)));
  const uniqueRevs = Array.from(new Set(items.map((i) => i.revStatus).filter(Boolean)));

  // ─── Export Excel Handler ──────────────────────────────────────────────────
  const handleExport = async () => {
    const itemsToExport =
      exportScope === 'selected' && selectedIds.size > 0
        ? items.filter((item) => selectedIds.has(item.id))
        : filteredItems;

    if (itemsToExport.length === 0) {
      alert('Tidak ada data yang dipilih atau tersedia untuk diunduh.');
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
    const isSelectionExport = exportScope === 'selected' && selectedIds.size > 0;
    sheet.insertRow(1, [`PE-Machining — Jig & Fixture Master List ${isSelectionExport ? `(Pilihan ${itemsToExport.length} Item - ${today})` : `(${today})`}`]);
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
    (sheet as any).autoFilter = `A2:${colLetter(columns.length)}2`;

    // ─── Data rows ───────────────────────────────────────────────────────────
    itemsToExport.forEach((item, idx) => {
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
    const prefix = isSelectionExport ? `Selected_${itemsToExport.length}_Items_` : '';
    link.download = `JigFixture_MasterList_${prefix}${new Date().toISOString().split('T')[0]}.xlsx`;
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
            Master Data
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
            onClick={() => {
              if (selectedIds.size > 0) {
                setExportScope('selected');
              } else {
                setExportScope('all');
              }
              setShowExportModal(true);
            }}
            className="bg-[#0063ff] text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#0052d4] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm relative"
          >
            <span className="material-symbols-outlined text-xs">download</span>
            <span>Master List</span>
            {selectedIds.size > 0 && (
              <span className="bg-yellow-400 text-yellow-950 font-black px-1.5 py-0.2 rounded-full text-[8px] animate-pulse">
                {selectedIds.size}
              </span>
            )}
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
      <div className="flex-1 overflow-x-auto overflow-y-auto no-scrollbar rounded-lg border border-gray-200 bg-white shadow-3xs">
        {loading ? (
          <div className="h-full flex flex-col justify-center items-center text-gray-400 text-xs py-12">
            <span className="material-symbols-outlined animate-spin text-2xl mb-1 text-blue-600">sync</span>
            <span>Memuat data master...</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-[10px] table-fixed">
            <thead>
              <tr className="bg-slate-50/90 text-gray-500 font-semibold border-b border-gray-200 sticky top-0 z-10 text-[9px] uppercase tracking-wider whitespace-nowrap select-none">
                {/* Multi-select checkbox column */}
                <th className="px-1 py-1 text-center w-[40px] relative">
                  <div className="flex items-center justify-center gap-0.5" ref={selectDropdownRef}>
                    <input
                      type="checkbox"
                      ref={headerCheckboxRef}
                      checked={allCurrentPageSelected && paginatedItems.length > 0}
                      onChange={toggleSelectCurrentPage}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title={allCurrentPageSelected ? 'Batal pilih halaman ini' : 'Pilih semua di halaman ini'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSelectDropdown(!showSelectDropdown)}
                      className="p-0.5 hover:bg-gray-200 rounded text-gray-500 transition-colors cursor-pointer"
                      title="Opsi Pilihan Multi-Halaman"
                    >
                      <span className="material-symbols-outlined text-[10px]">arrow_drop_down</span>
                    </button>

                    {/* Dropdown Menu for Selection */}
                    {showSelectDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-xl p-1.5 text-[10px] z-30 font-medium normal-case text-left">
                        <button
                          type="button"
                          onClick={() => {
                            toggleSelectCurrentPage();
                            setShowSelectDropdown(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 hover:text-blue-700 rounded-lg flex items-center justify-between cursor-pointer"
                        >
                          <span>{allCurrentPageSelected ? 'Batal Pilih Halaman Ini' : 'Pilih Halaman Ini'}</span>
                          <span className="text-[9px] font-bold text-gray-400">({paginatedItems.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={selectAllFiltered}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 hover:text-blue-700 rounded-lg flex items-center justify-between cursor-pointer"
                        >
                          <span>Pilih Semua Data Filtered</span>
                          <span className="text-[9px] font-bold text-blue-600">({filteredItems.length})</span>
                        </button>

                        {selectedIds.size > 0 && (
                          <button
                            type="button"
                            onClick={clearSelection}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-red-50 text-red-600 rounded-lg flex items-center justify-between cursor-pointer mt-0.5 border-t border-gray-100 pt-1.5"
                          >
                            <span>Hapus Semua Pilihan</span>
                            <span className="text-[9px] font-bold">({selectedIds.size})</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </th>
                <th className="px-1.5 py-1 text-center w-[38px]">No</th>
                <th className="px-2 py-1 w-[115px]">No. Reg</th>
                <th className="px-2 py-1 w-[140px]">Assy Part Name</th>
                <th className="px-2 py-1 w-[85px]">Line</th>
                <th className="px-2 py-1 w-[85px]">OP (Process)</th>
                <th className="px-1 py-1 text-center w-[45px]">Type</th>
                <th className="px-1 py-1 text-center w-[75px]">Lifecycle</th>
                <th className="px-1 py-1 text-center w-[45px]">Stock</th>
                <th className="px-1 py-1 text-center w-[40px]">Abn</th>
                <th className="px-1.5 py-1 text-center w-[125px]">Lifetime (2-Way)</th>
                <th className="px-1.5 py-1 text-center w-[65px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 divide-y divide-gray-100">
              {paginatedItems.map((item, index) => {
                const globalIndex = pageSize === 'All' ? index : (validCurrentPage - 1) * (pageSize as number) + index;
                const isSelected = selectedIds.has(item.id);
                const isRed = item.actualStock < item.minimumStock * 0.5;
                const isYellow = item.actualStock < item.minimumStock && item.actualStock >= item.minimumStock * 0.5;
                const isExpanded = expandedRows.has(item.id);
                const cellParts = item.cellParts || [];
                const doc = item.documents?.[item.documents.length - 1] || item.documents?.[0];
                const isApproved = doc?.approvalStatus === 'APPROVED';
                const isWaiting = doc?.approvalStatus === 'WAITING';
                const statusBorderClass = isSelected
                  ? 'border-l-[4px] border-l-blue-600'
                  : isApproved
                  ? 'border-l-[3.5px] border-l-emerald-500'
                  : isWaiting
                  ? 'border-l-[3.5px] border-l-amber-500'
                  : 'border-l-[3.5px] border-l-gray-300';
                const statusLabel = isApproved
                  ? 'Desain Resmi (Approved)'
                  : isWaiting
                  ? 'Menunggu Persetujuan (Waiting)'
                  : 'Draft';

                return (
                  <React.Fragment key={item.id}>
                    <tr
                      onClick={() => router.push(`/design/${item.id}`)}
                      className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50/80 font-medium' : isExpanded ? 'bg-blue-50/25' : ''
                      }`}
                    >
                      {/* Checkbox cell */}
                      <td
                        className={`px-1 py-0.5 text-center ${statusBorderClass}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(item.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      <td
                        className="px-1 py-0.5 text-center font-semibold text-gray-400"
                        onClick={(e) => e.stopPropagation()}
                        title={`Status: ${statusLabel}`}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          {cellParts.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandRow(item.id);
                              }}
                              className="p-0.5 hover:bg-blue-100 rounded text-blue-500 hover:text-blue-700 transition-colors cursor-pointer flex items-center justify-center"
                              title={isExpanded ? 'Tutup daftar CellPart' : 'Buka daftar CellPart'}
                            >
                              <span className={`material-symbols-outlined text-[11px] font-light transition-transform ${isExpanded ? 'rotate-90 text-blue-600' : ''}`}>
                                chevron_right
                              </span>
                            </button>
                          ) : (
                            <span className="w-2.5 inline-block text-gray-300 text-[8px]">•</span>
                          )}
                          <span className="text-[9px]">{globalIndex + 1}</span>
                        </div>
                      </td>
                      <td className="px-2 py-0.5 font-mono font-bold text-blue-600 truncate">
                        <Link
                          href={`/design/${item.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline inline-flex items-center gap-0.5 truncate text-[9.5px] group"
                          title={item.noReg}
                        >
                          <span className="truncate">{item.noReg}</span>
                          <span className="material-symbols-outlined text-[8px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">open_in_new</span>
                        </Link>
                      </td>
                      <td className="px-2 py-0.5 font-medium text-gray-900 truncate" title={item.assyPartName}>
                        <Link
                          href={`/design/${item.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-blue-600 hover:underline truncate block text-[9.5px]"
                        >
                          {item.assyPartName}
                        </Link>
                      </td>
                      <td className="px-2 py-0.5 text-gray-600 truncate text-[9px]" title={item.lineProduct}>
                        {item.lineProduct || '-'}
                      </td>
                      <td className="px-2 py-0.5 text-gray-600 truncate text-[9px]" title={item.process}>
                        {item.process || '-'}
                      </td>
                      <td className="px-1 py-0.5 font-bold text-[9px] text-gray-500 text-center truncate">
                        {item.type}
                      </td>
                      <td className="px-1 py-0.5 text-center truncate">
                        <span className={`text-[7.5px] font-bold px-1.5 py-0.2 rounded inline-block ${
                          item.lifecycleStatus === 'UNDER_REPAIR' ? 'bg-orange-100 text-orange-700' :
                          item.lifecycleStatus === 'UNDER_IMPROVEMENT' ? 'bg-blue-100 text-blue-700' :
                          item.lifecycleStatus === 'OBSOLETE' ? 'bg-gray-100 text-gray-700' :
                          item.lifecycleStatus === 'SCRAP' ? 'bg-red-100 text-red-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {item.lifecycleStatus || 'ACTIVE'}
                        </span>
                      </td>

                      {/* Stock */}
                      <td className="px-1 py-0.5 text-center truncate">
                        <span
                          className={`inline-flex items-center justify-center ${
                            isRed
                              ? 'text-rose-500'
                              : isYellow
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                          }`}
                          title={`Stok: ${isRed ? 'Critical' : isYellow ? 'Warning' : 'Aman'} (${item.actualStock}/${item.minimumStock})`}
                        >
                          <span className="material-symbols-outlined text-[13px] font-light leading-none">
                            {isRed ? 'error' : isYellow ? 'warning' : 'inventory_2'}
                          </span>
                        </span>
                      </td>

                      {/* Abnormality */}
                      <td className="px-1 py-0.5 text-center truncate">
                        <span
                          className={`inline-flex items-center justify-center ${
                            item.abnormalityStatus === 'RESOLVED'
                              ? 'text-emerald-500'
                              : item.abnormalityStatus === 'IN_PROGRESS'
                              ? 'text-amber-500'
                              : 'text-rose-500'
                          }`}
                          title={`Abnormality: ${item.abnormalityStatus === 'RESOLVED' ? 'Aman / Nihil' : item.abnormalityStatus === 'IN_PROGRESS' ? 'Dalam Monitoring' : 'Ada Anomali Terbuka'}`}
                        >
                          <span className="material-symbols-outlined text-[13px] font-light leading-none">
                            {item.abnormalityStatus === 'RESOLVED'
                              ? 'check_circle'
                              : item.abnormalityStatus === 'IN_PROGRESS'
                              ? 'pending'
                              : 'report_problem'}
                          </span>
                        </span>
                      </td>

                      {/* Lifetime 2-Way (Hari & Pemakaian) */}
                      <td className="px-1.5 py-0.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1">
                            <span
                              className={`inline-flex items-center gap-0.5 text-[8.5px] font-medium ${
                                item.lifetimeStatus === 'OVERDUE'
                                  ? 'text-rose-600'
                                  : item.lifetimeStatus === 'WARNING'
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              }`}
                              title={
                                item.lifetimeStatus === 'OVERDUE'
                                  ? `AUS / OVERDUE! (${item.currentUsage ?? 0}/${item.maxUsage ?? 500}x | ${item.daysRemaining ?? 0}d)`
                                  : item.lifetimeStatus === 'WARNING'
                                  ? `PERINGATAN MENDEKATI AUS (${item.currentUsage ?? 0}/${item.maxUsage ?? 500}x | ${item.daysRemaining ?? 0}d)`
                                  : `LIFETIME AMAN (${item.currentUsage ?? 0}/${item.maxUsage ?? 500}x | ${item.daysRemaining ?? 0}d)`
                              }
                            >
                              <span className="material-symbols-outlined text-[11px] font-light leading-none">
                                {item.lifetimeStatus === 'OVERDUE' ? 'error' : item.lifetimeStatus === 'WARNING' ? 'warning' : 'check_circle'}
                              </span>
                              <span>
                                {item.lifetimeType === 'DAYS'
                                  ? `${item.daysRemaining ?? 0}d`
                                  : item.lifetimeType === 'USAGE'
                                  ? `${item.currentUsage ?? 0}/${item.maxUsage ?? 500}x`
                                  : `${item.currentUsage ?? 0}/${item.maxUsage ?? 500}x · ${item.daysRemaining ?? 0}d`}
                              </span>
                            </span>
                          </div>

                          {/* Quick Action Button to Record Usage or Renew */}
                          {isPic && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <button
                                type="button"
                                onClick={() => handleOpenUsageModal('design', item.id, item.noReg, item.assyPartName, item.currentUsage ?? 0, item.maxUsage ?? 500)}
                                className="text-[7.5px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-1 py-0.2 rounded transition-colors"
                                title="Catat Pemakaian Harian/Batch (+X)"
                              >
                                + Catat
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenRenewModal('design', item.id, item.noReg, item.assyPartName)}
                                className="text-[7.5px] font-bold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-1 py-0.2 rounded transition-colors"
                                title="Renew / Reset Lifetime"
                              >
                                Renew
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-1 py-0.5 text-center truncate" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-0.5">
                          {isPic && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditModal(item);
                                }}
                                className="text-gray-400 hover:text-gray-700 p-0.5 hover:bg-gray-100 rounded transition-colors cursor-pointer inline-flex items-center justify-center"
                                title="Update Desain"
                              >
                                <span className="material-symbols-outlined text-[12px] font-light">edit</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDeleteConfirm(item);
                                }}
                                className="text-gray-400 hover:text-rose-600 p-0.5 hover:bg-rose-50 rounded transition-colors cursor-pointer inline-flex items-center justify-center"
                                title="Hapus Desain"
                              >
                                <span className="material-symbols-outlined text-[12px] font-light">delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* CellPart Expanded Sub-Row */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={12} className="px-4 py-3">
                          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Sub-header */}
                            <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-150">
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-blue-600 text-sm">account_tree</span>
                                <span className="text-[10px] font-bold text-gray-700">Cell Parts — {item.noReg}</span>
                                <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">{cellParts.length} items</span>
                              </div>
                              {isPic && (
                                <button
                                  onClick={() => handleOpenCellPartModal(item.id)}
                                  className="flex items-center gap-1 text-[9px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-xs">add</span>
                                  Tambah CellPart
                                </button>
                              )}
                            </div>

                              {cellParts.length === 0 ? (
                                <div className="text-center py-6 text-gray-400 text-[10px]">
                                  <span className="material-symbols-outlined text-lg mb-1 block">widgets</span>
                                  Belum ada CellPart. Klik "Tambah CellPart" untuk menambahkan.
                                </div>
                              ) : (
                                <table className="w-full text-[10px]">
                                  <thead>
                                    <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-150">
                                      <th className="px-3 py-1.5 text-left">Part Number</th>
                                      <th className="px-2 py-1.5 text-left">Nama</th>
                                      <th className="px-2 py-1.5 text-center">Hal Drawing</th>
                                      <th className="px-2 py-1.5 text-center">Lifetime</th>
                                      <th className="px-2 py-1.5 text-center">Due Date</th>
                                      <th className="px-2 py-1.5 text-center">Stock</th>
                                      <th className="px-2 py-1.5 text-center w-20">Aksi</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {cellParts.map((cp) => {
                                      const cpStockRed = cp.actualStock === 0;
                                      const cpStockYellow = cp.actualStock > 0 && cp.actualStock < cp.minimumStock;
                                      return (
                                        <tr key={cp.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                                          <td className="px-3 py-1.5 font-mono font-bold text-gray-800">
                                            <Link href={`/design/${item.id}`} className="hover:text-blue-600 hover:underline">
                                              {cp.partNumber}
                                            </Link>
                                          </td>
                                          <td className="px-2 py-1.5 text-gray-700 font-medium">{cp.name}</td>
                                          <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                                            {cp.pdfPageIndex ? (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (!isApproved) {
                                                    alert('Drawing belum disetujui (Approved) secara resmi oleh Section Head dan Dept Head.');
                                                    return;
                                                  }
                                                  downloadDesignPdfPage(item.id, cp.pdfPageIndex!, `${item.noReg}_CP_${cp.partNumber}_Hal_${cp.pdfPageIndex}.pdf`);
                                                }}
                                                disabled={!isApproved}
                                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold border transition-colors ${
                                                  isApproved
                                                    ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 cursor-pointer'
                                                    : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                                                }`}
                                                title={isApproved ? `Unduh 1 Halaman Drawing PDF (${cp.partNumber})` : 'Drawing belum disetujui resmi'}
                                              >
                                                <span className="material-symbols-outlined text-[9px] font-light">
                                                  {isApproved ? 'download' : 'lock'}
                                                </span>
                                                <span>Hal {cp.pdfPageIndex}</span>
                                              </button>
                                            ) : (
                                              <span className="text-[8px] text-gray-400 italic">Standar</span>
                                            )}
                                          </td>
                                          <td className="px-2 py-1.5 text-center">
                                            <span
                                              className={`inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                                                cp.lifetimeStatus === 'OVERDUE'
                                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                  : cp.lifetimeStatus === 'WARNING'
                                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                              }`}
                                              title={
                                                cp.lifetimeStatus === 'OVERDUE'
                                                  ? `AUS / OVERDUE! (${cp.currentUsage ?? 0}/${cp.maxUsage ?? 500}x | ${cp.daysRemaining ?? 0}d)`
                                                  : cp.lifetimeStatus === 'WARNING'
                                                  ? `PERINGATAN MENDEKATI AUS (${cp.currentUsage ?? 0}/${cp.maxUsage ?? 500}x | ${cp.daysRemaining ?? 0}d)`
                                                  : `LIFETIME AMAN (${cp.currentUsage ?? 0}/${cp.maxUsage ?? 500}x | ${cp.daysRemaining ?? 0}d)`
                                              }
                                            >
                                              <span className="material-symbols-outlined text-[8px]">
                                                {cp.lifetimeStatus === 'OVERDUE' ? 'error' : cp.lifetimeStatus === 'WARNING' ? 'warning' : 'check_circle'}
                                              </span>
                                              <span>
                                                {cp.lifetimeType === 'DAYS'
                                                  ? `${cp.daysRemaining}d`
                                                  : cp.lifetimeType === 'USAGE'
                                                  ? `${cp.currentUsage ?? 0}/${cp.maxUsage ?? 500}x`
                                                  : `${cp.currentUsage ?? 0}/${cp.maxUsage ?? 500}x · ${cp.daysRemaining}d`}
                                              </span>
                                            </span>
                                          </td>
                                          <td className="px-2 py-1.5 text-center text-gray-500 text-[9px]">
                                            {new Date(cp.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                          </td>
                                          <td className="px-2 py-1.5 text-center">
                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                                              cpStockRed ? 'bg-red-100 text-red-700' : cpStockYellow ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                            }`}>
                                              {cp.actualStock}/{cp.minimumStock}
                                            </span>
                                          </td>
                                          <td className="px-2 py-1.5 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                              <Link
                                                href={`/design/${item.id}`}
                                                className="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-blue-50 transition-colors inline-flex items-center justify-center"
                                                title="Buka Halaman Detail Desain"
                                              >
                                                <span className="material-symbols-outlined text-[13px]">visibility</span>
                                              </Link>
                                              {isPic && (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenUsageModal('cell-part', cp.id, cp.partNumber, cp.name, cp.currentUsage ?? 0, cp.maxUsage ?? 500)}
                                                    className="text-blue-600 hover:text-blue-800 transition-colors cursor-pointer p-0.5 rounded hover:bg-blue-50"
                                                    title="Catat Pemakaian CellPart (+X)"
                                                  >
                                                    <span className="material-symbols-outlined text-[12px]">speed</span>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenRenewModal('cell-part', cp.id, cp.partNumber, cp.name)}
                                                    className="text-amber-600 hover:text-amber-800 transition-colors cursor-pointer p-0.5 rounded hover:bg-amber-50"
                                                    title="Renew Lifetime CellPart"
                                                  >
                                                    <span className="material-symbols-outlined text-[12px]">autorenew</span>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteCellPart(cp.id, cp.name)}
                                                    className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer p-0.5 rounded hover:bg-red-50"
                                                    title="Hapus CellPart"
                                                  >
                                                    <span className="material-symbols-outlined text-[12px]">delete</span>
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-gray-400">
                    Tidak ada data master Jig &amp; Fixture yang cocok dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Datatable Footer / Pagination Controls */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-gray-200 pt-2.5 px-1 shrink-0">
        {/* Left: Info & Items per page */}
        <div className="flex items-center gap-4 text-gray-600 text-[11px]">
          <div>
            Showing{' '}
            <span className="font-bold text-gray-900">
              {filteredItems.length === 0 ? 0 : (validCurrentPage - 1) * (pageSize === 'All' ? filteredItems.length : (pageSize as number)) + 1}
            </span>{' '}
            -{' '}
            <span className="font-bold text-gray-900">
              {pageSize === 'All' ? filteredItems.length : Math.min(validCurrentPage * (pageSize as number), filteredItems.length)}
            </span>{' '}
            of <span className="font-bold text-gray-900">{filteredItems.length}</span> entries
          </div>

          {/* Per Page Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value === 'All' ? 'All' : Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-0.5 bg-white text-[11px] font-semibold text-gray-700 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="All">Semua (All)</option>
            </select>
          </div>

          {/* Selection indicator pill */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200 text-[10px] font-bold">
              <span className="material-symbols-outlined text-xs">check_circle</span>
              <span>{selectedIds.size} terpilih dari {filteredItems.length} data</span>
              <button
                type="button"
                onClick={clearSelection}
                className="hover:text-blue-900 text-blue-500 font-bold ml-1 cursor-pointer"
                title="Batal pilih"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Right: Pagination Buttons */}
        {pageSize !== 'All' && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={validCurrentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white text-[10px] font-bold cursor-pointer transition-colors"
              title="Halaman Pertama"
            >
              «
            </button>
            <button
              type="button"
              disabled={validCurrentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white text-[10px] font-bold cursor-pointer transition-colors"
              title="Halaman Sebelumnya"
            >
              ‹ Prev
            </button>

            {/* Page Number Pills */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - validCurrentPage) <= 2)
                .reduce<(number | string)[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                    acc.push('...');
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...' ? (
                    <span key={`dots-${idx}`} className="px-1 text-gray-400 text-[10px]">
                      ...
                    </span>
                  ) : (
                    <button
                      key={`page-${p}`}
                      type="button"
                      onClick={() => setCurrentPage(p as number)}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                        validCurrentPage === p
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'border border-gray-200 text-gray-700 hover:bg-gray-100 bg-white'
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
            </div>

            <button
              type="button"
              disabled={validCurrentPage === totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white text-[10px] font-bold cursor-pointer transition-colors"
              title="Halaman Berikutnya"
            >
              Next ›
            </button>
            <button
              type="button"
              disabled={validCurrentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white text-[10px] font-bold cursor-pointer transition-colors"
              title="Halaman Terakhir"
            >
              »
            </button>
          </div>
        )}
      </div>

      {/* ─── FLOATING MULTI-PAGE BATCH ACTION BAR ───────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-5 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-3 border-r border-slate-700 pr-4">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-black text-xs text-white shadow-inner">
              {selectedIds.size}
            </div>
            <div>
              <div className="text-xs font-bold leading-tight">
                {selectedIds.size} Data Master Terpilih
              </div>
              <div className="text-[9px] text-slate-400">
                Pilihan tersimpan di {totalPages > 1 ? 'semua halaman' : 'tabel'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Action: Select All Filtered */}
            {selectedIds.size < filteredItems.length && (
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-[10px] font-semibold text-blue-300 hover:text-white underline cursor-pointer px-1"
              >
                Pilih Semua ({filteredItems.length})
              </button>
            )}

            {/* Action 1: Export Selected to Excel */}
            <button
              type="button"
              onClick={() => {
                setExportScope('selected');
                setShowExportModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">table_chart</span>
              <span>Ekspor Excel ({selectedIds.size})</span>
            </button>

            {/* Action 2: Download Batch PDF Drawing (.zip) */}
            <button
              type="button"
              disabled={isZippingPdf}
              onClick={handleBatchDownloadPdfZip}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isZippingPdf ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  <span>
                    Proses ZIP ({zipProgress?.current}/{zipProgress?.total})...
                  </span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">folder_zip</span>
                  <span>Unduh Drawing PDF (.zip)</span>
                </>
              )}
            </button>

            {/* Clear selection button */}
            <button
              type="button"
              onClick={clearSelection}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
              title="Batal Pilih Semua"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}


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

                {/* Lifetime System Configuration */}
                <div className="col-span-2 bg-slate-50/80 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] font-bold text-gray-700 uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-blue-600">published_with_changes</span>
                      Konfigurasi Lifetime
                    </label>
                  </div>

                  {/* Mode Selector */}
                  <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                    <button
                      type="button"
                      onClick={() => setLifetimeTypeInput('DUAL')}
                      className={`py-1.5 px-2 rounded-lg text-[9px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                        lifetimeTypeInput === 'DUAL'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-gray-600 border-gray-250 hover:bg-gray-100'
                      }`}
                    >
                      <span>2-Way</span>
                      <span className="text-[7.5px] opacity-80 font-normal">Hari &amp; Pemakaian</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLifetimeTypeInput('USAGE')}
                      className={`py-1.5 px-2 rounded-lg text-[9px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                        lifetimeTypeInput === 'USAGE'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-gray-600 border-gray-250 hover:bg-gray-100'
                      }`}
                    >
                      <span>By Pemakaian</span>
                      <span className="text-[7.5px] opacity-80 font-normal">Siklus / Counter</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLifetimeTypeInput('DAYS')}
                      className={`py-1.5 px-2 rounded-lg text-[9px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                        lifetimeTypeInput === 'DAYS'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-gray-600 border-gray-250 hover:bg-gray-100'
                      }`}
                    >
                      <span>By Hari</span>
                      <span className="text-[7.5px] opacity-80 font-normal">Kalender</span>
                    </button>
                  </div>

                  {/* Dynamic Inputs based on Mode */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {(lifetimeTypeInput === 'DUAL' || lifetimeTypeInput === 'USAGE') && (
                      <div className={lifetimeTypeInput === 'USAGE' ? 'col-span-2' : ''}>
                        <label className="block text-[8.5px] font-bold text-gray-600 uppercase mb-0.5">
                          Batas Aus Pemakaian (Siklus) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            required
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none text-gray-800 font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                            value={maxUsageInput}
                            onChange={(e) => setMaxUsageInput(parseInt(e.target.value) || 500)}
                            placeholder="500"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">kali</span>
                        </div>
                      </div>
                    )}

                    {(lifetimeTypeInput === 'DUAL' || lifetimeTypeInput === 'DAYS') && (
                      <div className={lifetimeTypeInput === 'DAYS' ? 'col-span-2' : ''}>
                        <label className="block text-[8.5px] font-bold text-gray-600 uppercase mb-0.5">
                          Lifetime Hari (Kalender) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            required
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none text-gray-800 font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                            value={lifetimeDaysInput}
                            onChange={(e) => setLifetimeDaysInput(parseInt(e.target.value) || 180)}
                            placeholder="180"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">hari</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2D PDF & 3D Model Upload Side by Side */}
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  {/* 2D drawing upload with AI / PDF extraction */}
                  <div>
                    <div className="flex items-center justify-between mb-1 min-h-[14px]">
                      <label className="block text-[9px] font-bold text-gray-500 uppercase truncate">Drawing 2D (PDF) *</label>
                      {isAnalyzingPdf && (
                        <span className="text-[8px] font-bold text-blue-600 flex items-center gap-1 animate-pulse">
                          <span className="material-symbols-outlined text-[11px] animate-spin">sync</span>
                          Analisis...
                        </span>
                      )}
                    </div>
                    <label
                      title={docLocation2D ? docLocation2D.replace('/uploads/', '') : 'Upload Jig (PDF)'}
                      className="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-xl h-20 cursor-pointer hover:bg-blue-50/50 hover:border-[#0063ff] transition-all bg-white text-center shadow-3xs relative group"
                    >
                      <input
                        type="file"
                        accept=".pdf"
                        required={!docLocation2D}
                        className="hidden"
                        disabled={isAnalyzingPdf}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsAnalyzingPdf(true);
                          try {
                            const result = await parseDrawingPdf(file);
                            setDocLocation2D(result.url);
                            if (result.parsed) {
                              const { jig, cellParts } = result.parsed;
                              setExtractedJig(jig);
                              setExtractedCellParts(cellParts);
                              setSelectedCpKeys(new Set(cellParts.map((c) => c.itemNo)));
                              setShowExtractedBOM(true);

                              // Auto-fill Jig Form
                              if (jig.partName) setAssyPartName(jig.partName);
                              if (jig.partNumber) {
                                setNoItem(jig.partNumber);
                                if (!noReg) setNoReg(jig.partNumber);
                              }
                              if (jig.model) {
                                const matchedLine = lines.find(
                                  (l) =>
                                    l.lineName.toLowerCase().includes(jig.model.toLowerCase()) ||
                                    jig.model.toLowerCase().includes(l.lineName.toLowerCase()),
                                );
                                setLineInput(matchedLine ? matchedLine.lineName : jig.model);
                              }
                              if (jig.qty) setQty(jig.qty);

                              // Auto-detect OP / Process from filename and drawing title
                              const fn = file.name;
                              const opMatch =
                                fn.match(/OP\s*[-_#]?\s*(\d+[A-Za-z]?)/i) ||
                                (jig.title || '').match(/OP\s*[-_#]?\s*(\d+[A-Za-z]?)/i);
                              if (opMatch) {
                                const opNum = opMatch[1];
                                const matchedProc = processes.find(
                                  (p) =>
                                    p.name.toUpperCase().includes(`OP#${opNum}`) ||
                                    p.name.toUpperCase().includes(`OP ${opNum}`) ||
                                    p.name.toUpperCase().includes(`OP${opNum}`),
                                );
                                setProcessInput(matchedProc ? matchedProc.name : `OP#${opNum}`);
                              } else if (
                                fn.toLowerCase().includes('drill') ||
                                (jig.title || '').toLowerCase().includes('drill')
                              ) {
                                const drillProc = processes.find((p) => p.name.toLowerCase().includes('drill'));
                                if (drillProc) setProcessInput(drillProc.name);
                              }
                            }
                          } catch (err: any) {
                            console.error('Extraction error, falling back to simple upload:', err);
                            try {
                              const result = await uploadFile(file);
                              setDocLocation2D(result.url);
                            } catch {
                              alert('Gagal upload file 2D. Coba lagi.');
                            }
                          } finally {
                            setIsAnalyzingPdf(false);
                          }
                        }}
                      />
                      <span className={`material-symbols-outlined text-3xl transition-transform group-hover:scale-110 ${docLocation2D ? 'text-green-600' : 'text-red-500'}`}>
                        picture_as_pdf
                      </span>
                    </label>
                  </div>

                  {/* 3D upload */}
                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1 min-h-[14px] truncate">Model 3D (Opsional)</label>
                    <label
                      title={docLocation3D ? docLocation3D.replace('/uploads/', '') : 'Upload File 3D'}
                      className="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-xl h-20 cursor-pointer hover:bg-blue-50/50 hover:border-[#0063ff] transition-all bg-white text-center shadow-3xs relative group"
                    >
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
                      <span className={`material-symbols-outlined text-3xl transition-transform group-hover:scale-110 ${docLocation3D ? 'text-green-600' : 'text-blue-500'}`}>
                        view_in_ar
                      </span>
                    </label>
                  </div>
                </div>

                {/* DAFTAR CELLPART / BOM DARI DRAWING - HANYA MUNCUL JIKA SUDAH UPLOAD PDF */}
                {docLocation2D && (
                  <div className="col-span-2 border border-blue-200 bg-blue-50/30 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-blue-600 text-sm">widgets</span>
                        <span className="text-[10px] font-bold text-gray-800 uppercase">
                          Daftar CellPart ({extractedCellParts.filter((cp) => selectedCpKeys.has(cp.itemNo)).length}/{extractedCellParts.length} Dipilih)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {extractedCellParts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedCpKeys.size === extractedCellParts.length) {
                                setSelectedCpKeys(new Set());
                              } else {
                                setSelectedCpKeys(new Set(extractedCellParts.map((c) => c.itemNo)));
                              }
                            }}
                            className="text-[9px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {selectedCpKeys.size === extractedCellParts.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const nextItemNo = extractedCellParts.length > 0 ? Math.max(...extractedCellParts.map((c) => c.itemNo)) + 1 : 1;
                            const newCp: ParsedCellPartItem = {
                              itemNo: nextItemNo,
                              name: `Part #${nextItemNo}`,
                              partNumber: `CP-${nextItemNo}`,
                              qty: '1',
                              material: 'SS400',
                              isStandardPart: false,
                            };
                            setExtractedCellParts((prev) => [...prev, newCp]);
                            setSelectedCpKeys((prev) => new Set(prev).add(nextItemNo));
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[11px]">add</span>
                          Tambah Manual
                        </button>
                      </div>
                    </div>

                    {extractedCellParts.length === 0 ? (
                      <div className="text-center py-4 bg-white/60 border border-dashed border-gray-300 rounded-lg text-gray-400 text-[10px]">
                        <span className="material-symbols-outlined text-lg mb-0.5 block text-gray-400">format_list_bulleted</span>
                        Tidak ada etiket CellPart terdeteksi otomatis dari sheet PDF ini. Klik <strong>"Tambah Manual"</strong> jika ingin mendaftarkan CellPart.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto no-scrollbar border border-gray-200 rounded-lg bg-white">
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 sticky top-0 z-10">
                              <th className="px-2 py-1 w-6 text-center">✓</th>
                              <th className="px-2 py-1">No</th>
                              <th className="px-2 py-1">Part Number</th>
                              <th className="px-2 py-1">Nama Part</th>
                              <th className="px-2 py-1 text-center">Qty</th>
                              <th className="px-2 py-1">Material</th>
                              <th className="px-2 py-1 text-center w-8">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {extractedCellParts.map((cp, idx) => {
                              const isChecked = selectedCpKeys.has(cp.itemNo);
                              return (
                                <tr
                                  key={cp.itemNo || idx}
                                  className={`border-b border-gray-100 hover:bg-blue-50/40 transition-colors ${isChecked ? 'bg-blue-50/20' : 'opacity-60'}`}
                                >
                                  <td className="px-2 py-1 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const next = new Set(selectedCpKeys);
                                        if (e.target.checked) next.add(cp.itemNo);
                                        else next.delete(cp.itemNo);
                                        setSelectedCpKeys(next);
                                      }}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-0 cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-2 py-1 font-mono font-semibold text-gray-500">{cp.itemNo}</td>
                                  <td className="px-2 py-1">
                                    <input
                                      type="text"
                                      value={cp.partNumber}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setExtractedCellParts((prev) =>
                                          prev.map((c) => (c.itemNo === cp.itemNo ? { ...c, partNumber: val } : c)),
                                        );
                                      }}
                                      className="w-full border border-gray-250 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold text-gray-800 bg-white"
                                    />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      type="text"
                                      value={cp.name}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setExtractedCellParts((prev) =>
                                          prev.map((c) => (c.itemNo === cp.itemNo ? { ...c, name: val } : c)),
                                        );
                                      }}
                                      className="w-full border border-gray-250 rounded px-1.5 py-0.5 text-[9px] text-gray-700 bg-white font-medium"
                                    />
                                  </td>
                                  <td className="px-2 py-1 text-center">
                                    <input
                                      type="text"
                                      value={cp.qty}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setExtractedCellParts((prev) =>
                                          prev.map((c) => (c.itemNo === cp.itemNo ? { ...c, qty: val } : c)),
                                        );
                                      }}
                                      className="w-10 border border-gray-250 rounded px-1 py-0.5 text-[9px] text-center font-bold text-gray-800 bg-white"
                                    />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      type="text"
                                      value={cp.material || ''}
                                      placeholder="SS400..."
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setExtractedCellParts((prev) =>
                                          prev.map((c) => (c.itemNo === cp.itemNo ? { ...c, material: val } : c)),
                                        );
                                      }}
                                      className="w-full border border-gray-250 rounded px-1.5 py-0.5 text-[9px] text-gray-600 bg-white"
                                    />
                                  </td>
                                  <td className="px-2 py-1 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExtractedCellParts((prev) => prev.filter((c) => c.itemNo !== cp.itemNo));
                                        setSelectedCpKeys((prev) => {
                                          const next = new Set(prev);
                                          next.delete(cp.itemNo);
                                          return next;
                                        });
                                      }}
                                      className="text-gray-400 hover:text-red-600 transition-colors p-0.5 cursor-pointer"
                                      title="Hapus baris CellPart"
                                    >
                                      <span className="material-symbols-outlined text-[12px]">delete</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

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
                  <label
                    title={docLocation2D ? docLocation2D.replace('/uploads/', '') : 'Upload Jig (PDF)'}
                    className="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-xl h-20 cursor-pointer hover:bg-blue-50/50 hover:border-[#0063ff] transition-all bg-white text-center shadow-3xs group"
                  >
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
                    <span className={`material-symbols-outlined text-3xl transition-transform group-hover:scale-110 ${docLocation2D ? 'text-green-600' : 'text-red-500'}`}>
                      picture_as_pdf
                    </span>
                  </label>
                </div>

                {/* 3D upload */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Model 3D (Opsional)</label>
                  <label
                    title={docLocation3D ? docLocation3D.replace('/uploads/', '') : 'Upload File 3D'}
                    className="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-xl h-20 cursor-pointer hover:bg-blue-50/50 hover:border-[#0063ff] transition-all bg-white text-center shadow-3xs group"
                  >
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
                    <span className={`material-symbols-outlined text-3xl transition-transform group-hover:scale-110 ${docLocation3D ? 'text-green-600' : 'text-blue-500'}`}>
                      view_in_ar
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-[95]">
          <div className="max-w-sm w-full bg-white border border-gray-300 rounded-2xl p-5 text-gray-800 shadow-2xl relative">
            <h3 className="font-bold text-xs text-gray-800 mb-1 border-b border-gray-100 pb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-sm">download</span>
                Opsi Ekspor Master List (Excel)
              </span>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xs cursor-pointer">✕</button>
            </h3>

            {/* Scope Selection */}
            <div className="my-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1.5">Scope Data yang Diunduh</label>
              <div className="space-y-1.5 text-xs">
                <label className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${exportScope === 'selected' && selectedIds.size > 0 ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold' : selectedIds.size === 0 ? 'opacity-40 border-gray-200 cursor-not-allowed' : 'border-gray-200 cursor-pointer bg-white'}`}>
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportScope === 'selected' && selectedIds.size > 0}
                    disabled={selectedIds.size === 0}
                    onChange={() => setExportScope('selected')}
                    className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <div>Hanya Item Terpilih ({selectedIds.size} Data)</div>
                    {selectedIds.size === 0 && <div className="text-[8.5px] text-gray-400">Pilih item di tabel terlebih dahulu</div>}
                  </div>
                </label>

                <label className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${exportScope === 'all' || selectedIds.size === 0 ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold' : 'border-gray-200 cursor-pointer bg-white'}`}>
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportScope === 'all' || selectedIds.size === 0}
                    onChange={() => setExportScope('all')}
                    className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <div>Semua Data Filtered ({filteredItems.length} Data)</div>
                    <div className="text-[8.5px] text-gray-400 font-normal">Termasuk seluruh halaman yang sesuai filter</div>
                  </div>
                </label>
              </div>
            </div>

            <p className="text-[9px] text-gray-500 mb-2 font-bold uppercase tracking-wider">
              Pilih Kolom Data Spesifikasi:
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
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

              <label className="flex items-center gap-1.5 col-span-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportCols.stock}
                  onChange={(e) => setExportCols({ ...exportCols, stock: e.target.checked })}
                />
                <span>Stock Levels & Status (Min/Act)</span>
              </label>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Unduh Excel (.xlsx)</span>
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

      {/* CELLPART CREATE MODAL */}
      {showCellPartModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[90]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            {/* Header */}
            <div className="p-4 border-b border-gray-150 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
              <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-sm">account_tree</span>
                Tambah CellPart
              </h3>
              <button onClick={() => setShowCellPartModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleCellPartSubmit} className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                {/* Part Number */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Part Number *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500"
                    value={cpPartNumber}
                    onChange={(e) => setCpPartNumber(e.target.value)}
                    placeholder="Contoh: CP-001"
                  />
                </div>

                {/* Name */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Nama CellPart *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500"
                    value={cpName}
                    onChange={(e) => setCpName(e.target.value)}
                    placeholder="Contoh: Pin Locator"
                  />
                </div>

                {/* Lifetime System Configuration */}
                <div className="col-span-2 bg-slate-50/80 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] font-bold text-gray-700 uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-blue-600">published_with_changes</span>
                      Konfigurasi Lifetime
                    </label>
                  </div>

                  {/* Mode Selector */}
                  <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                    <button
                      type="button"
                      onClick={() => setCpLifetimeType('DUAL')}
                      className={`py-1.5 px-2 rounded-lg text-[9px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                        cpLifetimeType === 'DUAL'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-gray-600 border-gray-250 hover:bg-gray-100'
                      }`}
                    >
                      <span>2-Way</span>
                      <span className="text-[7.5px] opacity-80 font-normal">Hari &amp; Pemakaian</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCpLifetimeType('USAGE')}
                      className={`py-1.5 px-2 rounded-lg text-[9px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                        cpLifetimeType === 'USAGE'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-gray-600 border-gray-250 hover:bg-gray-100'
                      }`}
                    >
                      <span>By Pemakaian</span>
                      <span className="text-[7.5px] opacity-80 font-normal">Siklus / Counter</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCpLifetimeType('DAYS')}
                      className={`py-1.5 px-2 rounded-lg text-[9px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                        cpLifetimeType === 'DAYS'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-gray-600 border-gray-250 hover:bg-gray-100'
                      }`}
                    >
                      <span>By Hari</span>
                      <span className="text-[7.5px] opacity-80 font-normal">Kalender</span>
                    </button>
                  </div>

                  {/* Dynamic Inputs based on Mode */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {(cpLifetimeType === 'DUAL' || cpLifetimeType === 'USAGE') && (
                      <div className={cpLifetimeType === 'USAGE' ? 'col-span-2' : ''}>
                        <label className="block text-[8.5px] font-bold text-gray-600 uppercase mb-0.5">
                          Batas Aus Pemakaian (Siklus) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            required
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none text-gray-800 font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                            value={cpMaxUsage}
                            onChange={(e) => setCpMaxUsage(parseInt(e.target.value) || 500)}
                            placeholder="500"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">kali</span>
                        </div>
                      </div>
                    )}

                    {(cpLifetimeType === 'DUAL' || cpLifetimeType === 'DAYS') && (
                      <div className={cpLifetimeType === 'DAYS' ? 'col-span-2' : ''}>
                        <label className="block text-[8.5px] font-bold text-gray-600 uppercase mb-0.5">
                          Lifetime Hari (Kalender) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            required
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none text-gray-800 font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                            value={cpLifetimeDays}
                            onChange={(e) => setCpLifetimeDays(parseInt(e.target.value) || 180)}
                            placeholder="180"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">hari</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Install Date */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Tanggal Install / Pasang *</label>
                  <input
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white outline-none text-gray-700 focus:ring-1 focus:ring-blue-500"
                    value={cpInstallDate}
                    onChange={(e) => setCpInstallDate(e.target.value)}
                  />
                </div>

                {/* Stock */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Stok Minimum</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500"
                    value={cpMinStock}
                    onChange={(e) => setCpMinStock(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Stok Aktual</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500"
                    value={cpActStock}
                    onChange={(e) => setCpActStock(parseInt(e.target.value) || 0)}
                  />
                </div>

                {/* Description */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Deskripsi (opsional)</label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500 resize-none"
                    rows={2}
                    value={cpDescription}
                    onChange={(e) => setCpDescription(e.target.value)}
                    placeholder="Keterangan tambahan..."
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCellPartModal(false)}
                  className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan CellPart'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK MODAL: CATAT PEMAKAIAN (LOG USAGE) */}
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
                  <p className="text-[9px] text-gray-500">Log siklus kerja / stroke count harian atau batch</p>
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

            {/* Target Card & Progress */}
            <div className="p-4 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
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

                {/* Current Counter Status */}
                <div className="pt-1">
                  <div className="flex justify-between items-center text-[9px] font-semibold text-gray-600 mb-1">
                    <span>Counter Saat Ini:</span>
                    <span className="font-mono font-bold text-gray-900">
                      {usageTarget.currentUsage} / {usageTarget.maxUsage}x
                      <span className="text-gray-500 font-normal ml-1">
                        ({Math.round(((usageTarget.currentUsage || 0) / (usageTarget.maxUsage || 500)) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        usageTarget.currentUsage >= usageTarget.maxUsage
                          ? 'bg-rose-500'
                          : usageTarget.currentUsage >= usageTarget.maxUsage * 0.85
                          ? 'bg-amber-500'
                          : 'bg-blue-600'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.round(((usageTarget.currentUsage || 0) / (usageTarget.maxUsage || 500)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Mode Toggle: ADD (+X) vs SET (=X) */}
              <div>
                <label className="block text-[9px] font-bold text-gray-600 uppercase mb-1.5">
                  Metode Input Counter
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUsageMode('ADD')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      usageMode === 'ADD'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-gray-600 border-gray-250 hover:bg-gray-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    <span>Tambah Pemakaian (+X)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUsageMode('SET');
                      setUsageAmountInput(usageTarget.currentUsage);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      usageMode === 'SET'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-gray-600 border-gray-250 hover:bg-gray-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">tune</span>
                    <span>Set Langsung Counter (=X)</span>
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons (if ADD mode) */}
              {usageMode === 'ADD' && (
                <div>
                  <label className="block text-[8.5px] font-bold text-gray-400 uppercase mb-1">
                    Preset Cepat
                  </label>
                  <div className="flex gap-1.5">
                    {[10, 25, 50, 100, 200].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setUsageAmountInput(preset)}
                        className={`flex-1 py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                          usageAmountInput === preset
                            ? 'bg-blue-50 border-blue-400 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Value */}
              <div>
                <label className="block text-[9px] font-bold text-gray-600 uppercase mb-1">
                  {usageMode === 'ADD' ? 'Jumlah Pemakaian yang Ditambahkan (siklus) *' : 'Nilai Total Counter Pemakaian (siklus) *'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
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

              {/* Explanation */}
              <p className="text-[10px] text-gray-600 leading-relaxed">
                Pilih opsi parameter yang ingin di-reset ke kondisi awal:
              </p>

              {/* Checkboxes */}
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
