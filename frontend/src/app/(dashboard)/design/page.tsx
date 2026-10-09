'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { fetchMasterList, fetchVendors, fetchLinesAndProcesses, createDesignItem, submitDesignUpdate, uploadFile, getFileUrl, deleteDesignItem, fetchCellParts, createCellPart, deleteCellPart, parseDrawingPdf, ParsedJigMetadata, ParsedCellPartItem, downloadDesignPdfPage, downloadDesignPdfFull, downloadMergedDesignPdf, fetchDesignPdfBlob } from '@/lib/api/phase3';
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
  itemNo?: number;
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
  minimumStock?: number;
  actualStock?: number;
  pdfPageIndex: number | null;
  material?: string | null;
  qty?: string | number;
  tpmScheduleStart?: string | null;
  tpmScheduleDeadline?: string | null;
  tpmLifetimeSetAt?: string | null;
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
  tpmScheduleStart?: string | null;
  tpmScheduleDeadline?: string | null;
  tpmLifetimeSetAt?: string | null;
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

  const [showNotifications, setShowNotifications] = useState(false);
  const waitingApprovalsCount = approvals.filter((a) => a.status === 'WAITING').length;
  const hasAlerts = waitingApprovalsCount > 0;

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [lineFilter, setLineFilter] = useState('All');
  const [processFilter, setProcessFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [vendorFilter, setVendorFilter] = useState('All');
  const [revFilter, setRevFilter] = useState('All');
  const [approvalFilter, setApprovalFilter] = useState('All');

  // Pagination & Multi-Page Selection States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'All'>(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedCpIds, setSelectedCpIds] = useState<Set<string>>(new Set()); // set of cp.id
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfDownloadProgress, setPdfDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [exportScope, setExportScope] = useState<'selected' | 'all'>('selected');
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
  const [cpQty, setCpQty] = useState<string>('1');
  const [cpMaterial, setCpMaterial] = useState<string>('');

  // Lists for dropdown
  const [lines, setLines] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);

  // Create Mode Form Fields
  const [noReg, setNoReg] = useState('');
  const [assyPartName, setAssyPartName] = useState('');
  const [noItem, setNoItem] = useState('');
  const [qty, setQty] = useState('1');
  const [type, setType] = useState<'JF' | 'EQ'>('JF');
  const [lineInput, setLineInput] = useState('');
  const [processInput, setProcessInput] = useState('');

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
  const [leadTime, setLeadTime] = useState<number>(1);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, vList, meta] = await Promise.all([
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
      ]);
      setItems(list || []);
      setVendors(vList || []);
      setLines(meta?.lines || []);
      setProcesses(meta?.processes || []);
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
      leadTime !== 1
    );
  };

  const handleOpenCreateModal = () => {
    setNoReg('');
    setAssyPartName('');
    setNoItem('');
    setQty('1');
    setType('JF');
    setLineInput('');
    setProcessInput('');
    setRevStatus('0');
    setDesignDateNew(new Date().toISOString().split('T')[0]);
    setDocLocation2D('');
    setDocLocation3D('');
    setRevisionNote('Initial Release');
    setSelectedVendorId('');
    setPoNumber('');
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
        revStatus,
        designDateNew,
        docLocation2D: docLocation2D || undefined,
        docLocation3D: docLocation3D || undefined,
        revisionNote: revisionNote || undefined,
        vendorId: selectedVendorId || undefined,
        poNumber: poNumber || undefined,
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
    setCpMaterial('');
    setCpQty('1');
    setCpDescription('');
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
        description: cpMaterial ? `${cpMaterial}${cpDescription ? ` | ${cpDescription}` : ''}` : (cpDescription || undefined),
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
    const matchesRev = revFilter === 'All' || item.revStatus === revFilter;

    const doc = item.documents?.[item.documents.length - 1] || item.documents?.[0];
    const approvalStatus = doc?.approvalStatus || 'DRAFT';
    const matchesApproval =
      approvalFilter === 'All' ||
      (approvalFilter === 'APPROVED' && approvalStatus === 'APPROVED') ||
      (approvalFilter === 'WAITING' && approvalStatus === 'WAITING') ||
      (approvalFilter === 'DRAFT' && approvalStatus !== 'APPROVED' && approvalStatus !== 'WAITING');

    return matchesSearch && matchesLine && matchesProcess && matchesType && matchesVendor && matchesRev && matchesApproval;
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
    revFilter,
    approvalFilter,
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

  const toggleSelectCpItem = (cpId: string) => {
    setSelectedCpIds((prev) => {
      const next = new Set(prev);
      if (next.has(cpId)) next.delete(cpId);
      else next.add(cpId);
      return next;
    });
  };

  const toggleSelectAllCellPartsOfItem = (itemCellParts: any[]) => {
    setSelectedCpIds((prev) => {
      const next = new Set(prev);
      const allSelected = itemCellParts.every((cp) => next.has(cp.id));
      if (allSelected) {
        itemCellParts.forEach((cp) => next.delete(cp.id));
      } else {
        itemCellParts.forEach((cp) => next.add(cp.id));
      }
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
    setSelectedCpIds(new Set());
    setShowSelectDropdown(false);
  };

  // ─── Direct Batch Download PDF (Merged into 1 file) ──────────────────────────
  const handleBatchDownloadPdfDirect = async () => {
    // Collect all items to download
    const selectedItemsList = items.filter((item) => selectedIds.has(item.id));
    const itemsWithApprovedPdf = selectedItemsList.filter((item) => {
      const doc = item.documents?.[item.documents.length - 1] || item.documents?.[0];
      return doc && doc.approvalStatus === 'APPROVED';
    });

    // Collect all selected cell parts
    const selectedCpList: { item: MasterItem; cp: any }[] = [];
    for (const item of items) {
      if (item.cellParts && item.cellParts.length > 0) {
        for (const cp of item.cellParts) {
          if (selectedCpIds.has(cp.id)) {
            selectedCpList.push({ item, cp });
          }
        }
      }
    }

    const totalDownloadCount = itemsWithApprovedPdf.length + selectedCpList.length;

    if (totalDownloadCount === 0) {
      alert('Tidak ada item atau CellPart terpilih yang memiliki dokumen PDF drawing resmi.');
      return;
    }

    setIsDownloadingPdf(true);
    setPdfDownloadProgress({ current: 1, total: totalDownloadCount });

    try {
      // Build targets for backend merging: full designs and/or specific CellPart pages
      const targets: Array<{ designId: string; pageNumber?: number }> = [];

      for (const item of itemsWithApprovedPdf) {
        targets.push({ designId: item.id });
      }

      for (const { item, cp } of selectedCpList) {
        targets.push({ designId: item.id, pageNumber: cp.pdfPageIndex || 1 });
      }

      // Generate a clean filename for the merged PDF
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const mergedFilename =
        itemsWithApprovedPdf.length === 1 && selectedCpList.length === 0
          ? `${itemsWithApprovedPdf[0].noReg.replace(/[/\\?%*:|"<>]/g, '_')}_Drawing_Resmi.pdf`
          : `Drawing_Gabungan_${totalDownloadCount}_Item_${timestamp}.pdf`;

      await downloadMergedDesignPdf(targets, mergedFilename);

      setToast({
        type: 'success',
        msg: `Berhasil mengunduh dokumen gabungan PDF (${totalDownloadCount} item menjadi 1 file PDF)!`,
      });
    } catch (err: any) {
      console.error('Error saat unduh file PDF:', err);
      alert(err?.message || 'Terjadi kesalahan saat menggabungkan berkas PDF.');
    } finally {
      setIsDownloadingPdf(false);
      setPdfDownloadProgress(null);
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
      const rowData: any = { no: idx + 1 };
      if (exportCols.noReg) rowData.noReg = item.noReg;
      if (exportCols.assyPartName) rowData.assyPartName = item.assyPartName;
      if (exportCols.lineProduct) rowData.lineProduct = item.lineProduct;
      if (exportCols.process) rowData.process = item.process;
      if (exportCols.type) rowData.type = item.type === 'JF' ? 'Jig Fixture' : 'Equipment';
      if (exportCols.lifecycleStatus) rowData.lifecycleStatus = item.lifecycleStatus;
      if (exportCols.revStatus) rowData.revStatus = `Rev ${item.revStatus}`;

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
            <span className="material-symbols-outlined text-blue-600 text-lg">draft</span>
            Master Drawing
          </h2>
          {/* Search bar inside header */}
          <div className="relative flex items-center w-80">
            <span className="material-symbols-outlined absolute left-2.5 text-gray-400 pointer-events-none select-none flex items-center justify-center leading-none" style={{ fontSize: '11px', width: '11px', height: '11px' }}>search</span>
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
                className="bg-blue-600 hover:bg-blue-700 text-white w-8 h-8 rounded-full flex items-center justify-center relative cursor-pointer shadow-sm transition-all shrink-0 animate-vibrate"
                title="Pemberitahuan Sistem"
              >
                <span className="material-symbols-outlined text-[16px]">notifications</span>
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-950 text-[7px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
                  {waitingApprovalsCount}
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
      <div className="grid grid-cols-6 gap-2 bg-gray-50 p-2.5 rounded-xl mb-3 border border-gray-150 text-[9px] font-semibold text-gray-600">
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

        {/* Approval Status Filter */}
        <div>
          <label className="block text-[8px] text-gray-400 mb-0.5 uppercase">Status Approval</label>
          <select value={approvalFilter} onChange={(e) => setApprovalFilter(e.target.value)} className="w-full border border-gray-350 bg-white rounded p-1 text-[9px] outline-none">
            <option value="All">All Status</option>
            <option value="APPROVED">Approved</option>
            <option value="WAITING">Waiting</option>
            <option value="DRAFT">Draft</option>
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
                <th className="px-1 py-1 text-center w-[34px]">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      ref={headerCheckboxRef}
                      checked={allCurrentPageSelected && paginatedItems.length > 0}
                      onChange={toggleSelectCurrentPage}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title={allCurrentPageSelected ? 'Batal pilih halaman ini' : 'Pilih semua di halaman ini'}
                    />
                  </div>
                </th>
                <th className="px-1.5 py-1 text-center w-[38px]">No</th>
                <th className="px-2 py-1 w-[115px]">No. Reg</th>
                <th className="px-2 py-1 w-[140px]">Assy Part Name</th>
                <th className="px-2 py-1 w-[85px]">Line</th>
                <th className="px-2 py-1 w-[85px]">OP (Process)</th>
                <th className="px-1 py-1 text-center w-[45px]">Type</th>
                <th className="px-1 py-1 text-center w-[75px]">
                  Approval
                </th>
                <th className="px-1.5 py-1 text-center w-[65px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 divide-y divide-gray-100">
              {paginatedItems.map((item, index) => {
                const globalIndex = pageSize === 'All' ? index : (validCurrentPage - 1) * (pageSize as number) + index;
                const isSelected = selectedIds.has(item.id);
                const isExpanded = expandedRows.has(item.id);
                const cellParts = [...(item.cellParts || [])].sort((a, b) => {
                  const pageA = a.pdfPageIndex ?? 999999;
                  const pageB = b.pdfPageIndex ?? 999999;
                  if (pageA !== pageB) return pageA - pageB;
                  return (a.itemNo ?? 0) - (b.itemNo ?? 0);
                });
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
                      onClick={() => toggleExpandRow(item.id)}
                      className={`border-b border-gray-200 hover:bg-blue-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/80 font-medium' : isExpanded ? 'bg-blue-50/25' : ''
                        }`}
                      title={cellParts.length > 0 ? (isExpanded ? 'Klik untuk menutup daftar CellPart' : 'Klik untuk melihat daftar CellPart') : undefined}
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
                        title={`Status: ${statusLabel}`}
                      >
                        <div className="flex items-center justify-center">
                          <span className="text-[9px]">{globalIndex + 1}</span>
                        </div>
                      </td>
                      <td className="px-2 py-0.5 font-mono font-bold text-blue-600 truncate">
                        <Link
                          href={`/design/${item.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline inline-flex items-center gap-0.5 truncate text-[9.5px] group"
                          title={`Buka Dokumen / Desain PDF (${item.noReg})`}
                        >
                          <span className="truncate">{item.noReg}</span>
                          <span className="material-symbols-outlined text-[8px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">open_in_new</span>
                        </Link>
                      </td>
                      <td className="px-2 py-0.5 font-medium text-gray-900 truncate" title={item.assyPartName}>
                        <span className="truncate block text-[9.5px]">
                          {item.assyPartName}
                        </span>
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
                      {/* Approval Status Only */}
                      <td className="px-1.5 py-0.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[8.5px] font-bold tracking-tight shadow-3xs cursor-help ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : isWaiting
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-gray-100 text-gray-700 border border-gray-300'
                          }`}
                          title={`Approval: ${statusLabel}`}
                        >
                          {isApproved ? 'Approved' : isWaiting ? 'Waiting' : 'Draft'}
                        </span>
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
                        <td colSpan={10} className="px-4 py-3">
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
                                    <th className="px-2 py-1.5 text-center w-8">
                                      <input
                                        type="checkbox"
                                        checked={cellParts.length > 0 && cellParts.every((cp) => selectedCpIds.has(cp.id))}
                                        onChange={() => toggleSelectAllCellPartsOfItem(cellParts)}
                                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        title="Pilih semua CellPart untuk Jig ini"
                                      />
                                    </th>
                                    <th className="px-3 py-1.5 text-left">Part Number</th>
                                    <th className="px-2 py-1.5 text-left">Nama</th>
                                    <th className="px-2 py-1.5 text-center">Hal Drawing</th>
                                    <th className="px-2 py-1.5 text-center">Qty</th>
                                    <th className="px-2 py-1.5 text-left">Material / Deskripsi</th>
                                    <th className="px-2 py-1.5 text-center w-16">Aksi</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cellParts.map((cp) => {
                                    const isCpSelected = selectedCpIds.has(cp.id);
                                    return (
                                      <tr key={cp.id} className={`border-b border-gray-100 hover:bg-gray-50/50 ${isCpSelected ? 'bg-blue-50/60' : ''}`}>
                                        <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                                          <input
                                            type="checkbox"
                                            checked={isCpSelected}
                                            onChange={() => toggleSelectCpItem(cp.id)}
                                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            title={`Pilih CellPart ${cp.partNumber}`}
                                          />
                                        </td>
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
                                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold border transition-colors ${isApproved
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
                                        <td className="px-2 py-1.5 text-center font-mono font-medium text-gray-700">
                                          {cp.qty || '1'}
                                        </td>
                                        <td className="px-2 py-1.5 text-gray-600 text-[9px] truncate max-w-[140px]" title={cp.material || cp.description || '-'}>
                                          {cp.material || cp.description || '—'}
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
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteCellPart(cp.id, cp.name)}
                                                className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer p-0.5 rounded hover:bg-red-50"
                                                title="Hapus CellPart"
                                              >
                                                <span className="material-symbols-outlined text-[12px]">delete</span>
                                              </button>
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
                  <td colSpan={10} className="text-center py-12 text-gray-400">
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
                      className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${validCurrentPage === p
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

      {/* ─── FLOATING MULTI-PAGE BATCH ACTION BAR (DIRECT PDF DOWNLOAD ONLY) ───────────────────────────── */}
      {(selectedIds.size > 0 || selectedCpIds.size > 0) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-5 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-3 border-r border-slate-700 pr-4">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-black text-xs text-white shadow-inner">
              {selectedIds.size + selectedCpIds.size}
            </div>
            <div>
              <div className="text-xs font-bold leading-tight">
                {selectedIds.size > 0 && <span>{selectedIds.size} Jig</span>}
                {selectedIds.size > 0 && selectedCpIds.size > 0 && <span> + </span>}
                {selectedCpIds.size > 0 && <span>{selectedCpIds.size} CellPart</span>} Terpilih
              </div>
              <div className="text-[9px] text-slate-400">
                Gabungkan & unduh jadi 1 berkas PDF drawing resmi
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Action: Select All Filtered Jigs */}
            {selectedIds.size < filteredItems.length && (
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-[10px] font-semibold text-blue-300 hover:text-white underline cursor-pointer px-1"
              >
                Pilih Semua Jig ({filteredItems.length})
              </button>
            )}

            {/* Direct Merged PDF Download Button */}
            <button
              type="button"
              disabled={isDownloadingPdf}
              onClick={handleBatchDownloadPdfDirect}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isDownloadingPdf ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  <span>
                    Menggabungkan PDF ({pdfDownloadProgress?.total} Dokumen)...
                  </span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                  <span>Unduh 1 PDF Gabungan ({selectedIds.size + selectedCpIds.size})</span>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-3 sm:p-4 z-[90]">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl relative text-gray-800">
            {/* Header */}
            <div className="p-3.5 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-green-600 text-sm">add_box</span>
                Tambah Desain Baru
              </h3>
              <button
                type="button"
                onClick={handleCloseCreateModal}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleCreateSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
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
                              if (cellParts.length > 0 || jig.partName || jig.partNumber) {
                                setShowExtractedBOM(true);
                              }

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
                            console.warn('Extraction unavailable or failed, falling back to simple upload:', err);
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
            </div>

            {/* Footer Actions (Sticky at bottom, never cut off) */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2 shrink-0">
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
                className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer shadow-sm"
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
            <div className="p-3.5 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#0063ff] text-sm">account_tree</span>
                Tambah CellPart
              </h3>
              <button
                type="button"
                onClick={() => setShowCellPartModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
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
                {/* Material */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Material</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500"
                    value={cpMaterial}
                    onChange={(e) => setCpMaterial(e.target.value)}
                    placeholder="Contoh: S45C / SS400"
                  />
                </div>

                {/* Qty */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Jumlah (Qty)</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500"
                    value={cpQty}
                    onChange={(e) => setCpQty(e.target.value)}
                    placeholder="Contoh: 1"
                  />
                </div>

                {/* Description */}
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Deskripsi / Catatan (opsional)</label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none text-gray-700 font-semibold focus:ring-1 focus:ring-blue-500 resize-none"
                    rows={2}
                    value={cpDescription}
                    onChange={(e) => setCpDescription(e.target.value)}
                    placeholder="Keterangan dimensi atau toleransi..."
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
