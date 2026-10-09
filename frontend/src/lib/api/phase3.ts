import Cookies from 'js-cookie';

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
import { getApiHost } from './config';

const BASE = getApiHost();

function getToken(): string {
  return Cookies.get('auth_token') || '';
}

/** Fetch all items for the design/abnormality dropdown */
export async function fetchDesignItems() {
  const res = await fetch(`${BASE}/api/design/items`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new HttpError('Failed to fetch design items', res.status);
  return res.json();
}

/** Fetch lines and processes lists */
export async function fetchLinesAndProcesses() {
  const res = await fetch(`${BASE}/api/design/lines-processes`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new HttpError('Failed to fetch lines and processes', res.status);
  return res.json();
}

/** Create a new design item directly */
export async function createDesignItem(data: any) {
  const res = await fetch(`${BASE}/api/design`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to create design item');
  }
  return res.json();
}

/** Submit a design revision update */
export async function submitDesignUpdate(itemId: string, data: {
  revStatus: string;
  designDateNew?: string;
  docLocation2D?: string;
  docLocation3D?: string;
  revisionNote?: string;
  vendorId?: string;
  poNumber?: string;
  leadTime?: number;
  lifetimeDays?: number;
  lifetimeType?: string;
  maxUsage?: number;
  currentUsage?: number;
}) {
  const res = await fetch(`${BASE}/api/design/${itemId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to submit design revision');
  }
  return res.json();
}

/** Fetch all abnormality reports */
export async function fetchAbnormalities() {
  const res = await fetch(`${BASE}/api/abnormality`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch abnormalities');
  return res.json();
}

/** Submit a new abnormality report */
export async function createAbnormality(data: {
  itemId: string;
  type: string;
  description: string;
  dateFound?: string;
  foundBy: string;
  rootCause: string;
  tempAction: string;
  correctiveAction: string;
  actionPic: string;
  status?: 'OPEN' | 'MONITORING' | 'CLOSED';
  linkToRevision?: boolean;
  linkToSpare?: boolean;
}) {
  const res = await fetch(`${BASE}/api/abnormality`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to create abnormality report');
  }
  return res.json();
}

/** Update abnormality status */
export async function updateAbnormalityStatus(id: string, status: 'OPEN' | 'MONITORING' | 'CLOSED') {
  const res = await fetch(`${BASE}/api/abnormality/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update abnormality status');
  return res.json();
}

export interface MachineDashboardItem {
  id: string;
  name: string;
  code: string;
  lineId: string;
  lineName: string;
  lineCode?: string;
  location?: string;
  description?: string;
  status: string;
  designId?: string;
  designNoReg?: string;
  designName?: string;
  jigCondition: 'SAFE' | 'WARNING' | 'OVERDUE';
  tpmSchedule: 'SAFE' | 'WARNING' | 'OVERDUE';
  manualJigStatus?: 'SAFE' | 'WARNING' | 'OVERDUE' | null;
  manualTpmStatus?: 'SAFE' | 'WARNING' | 'OVERDUE' | null;
}

/** Fetch machines dashboard list with 2-circle status */
export async function fetchMachinesDashboard(lineFilter?: string): Promise<MachineDashboardItem[]> {
  const url = lineFilter && lineFilter !== 'All' 
    ? `${BASE}/api/abnormality/machines?line=${encodeURIComponent(lineFilter)}`
    : `${BASE}/api/abnormality/machines`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch machines dashboard');
  return res.json();
}

/** Update machine manual status (Jig Condition / TPM Schedule) */
export async function updateMachineStatus(
  id: string,
  data: {
    jigCondition?: 'SAFE' | 'WARNING' | 'OVERDUE' | 'AUTO';
    tpmSchedule?: 'SAFE' | 'WARNING' | 'OVERDUE' | 'AUTO';
  },
) {
  const res = await fetch(`${BASE}/api/abnormality/machines/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal mengubah status mesin');
  }
  return res.json();
}

/** Register new machine */
export async function registerMachine(data: {
  name: string;
  code: string;
  lineId: string;
  designId?: string;
  location?: string;
  description?: string;
}) {
  const res = await fetch(`${BASE}/api/abnormality/machines`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal mendaftarkan mesin');
  }
  return res.json();
}

/** Delete machine */
export async function deleteMachine(id: string) {
  const res = await fetch(`${BASE}/api/abnormality/machines/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Gagal menghapus mesin');
  return res.json();
}

/** Fetch dashboard high-priority alerts */
export async function fetchDashboardAlerts() {
  const res = await fetch(`${BASE}/api/inventory/alerts`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch dashboard alerts');
  return res.json();
}

/** Fetch all vendors list */
export async function fetchVendors() {
  const res = await fetch(`${BASE}/api/design/vendors`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new HttpError('Failed to fetch vendors list', res.status);
  return res.json();
}

/** Fetch full detailed master list */
export async function fetchMasterList() {
  const res = await fetch(`${BASE}/api/design/master-list`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new HttpError('Failed to fetch master list', res.status);
  return res.json();
}

/**
 * Upload a PDF or 3D file to the backend.
 * Returns { url, filename } where url is e.g. /uploads/myfile.pdf
 */
export async function uploadFile(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/api/upload/pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Gagal upload file', res.status);
  }
  return res.json();
}

/** Build a full URL for a stored file path like MinIO url or /uploads/foo.pdf */
export function getFileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  const finalPath = clean.startsWith('/uploads/') ? clean : `/uploads${clean}`;
  return `${getApiHost()}${finalPath}`;
}

/** Delete a design item and all related records */
export async function deleteDesignItem(id: string) {
  const res = await fetch(`${BASE}/api/design/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to delete design item');
  }
  return res.json();
}

// ==========================================
// CELL PART API
// ==========================================

/** Fetch CellParts for a parent Design/Jig */
export async function fetchCellParts(designId: string) {
  const res = await fetch(`${BASE}/api/cell-part/by-design/${designId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new HttpError('Failed to fetch cell parts', res.status);
  return res.json();
}

/** Fetch CellPart reminders (approaching or past due date) */
export async function fetchCellPartReminders() {
  const res = await fetch(`${BASE}/api/cell-part/reminders`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new HttpError('Failed to fetch cell part reminders', res.status);
  return res.json();
}

/** Create a new CellPart under a parent Design */
export async function createCellPart(data: {
  designId: string;
  partNumber: string;
  name: string;
  description?: string;
  lifetimeDays?: number;
  lifetimeType?: string;
  maxUsage?: number;
  currentUsage?: number;
  installDate?: string;
  minimumStock?: number;
  actualStock?: number;
  pdfPageIndex?: number;
}) {
  const res = await fetch(`${BASE}/api/cell-part`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Failed to create cell part', res.status);
  }
  return res.json();
}

/** Update an existing CellPart */
export async function updateCellPart(id: string, data: {
  partNumber?: string;
  name?: string;
  description?: string;
  lifetimeDays?: number;
  lifetimeType?: string;
  maxUsage?: number;
  currentUsage?: number;
  installDate?: string;
  minimumStock?: number;
  actualStock?: number;
  pdfPageIndex?: number;
}) {
  const res = await fetch(`${BASE}/api/cell-part/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Failed to update cell part', res.status);
  }
  return res.json();
}

/** Renew a CellPart's lifetime (reset install date and/or reset currentUsage) */
export async function renewCellPart(id: string, options: { resetDays?: boolean; resetUsage?: boolean } = {}) {
  const res = await fetch(`${BASE}/api/cell-part/${id}/renew`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Failed to renew cell part', res.status);
  }
  return res.json();
}

/** Renew a Design item's lifetime */
export async function renewDesign(id: string, options: { resetDays?: boolean; resetUsage?: boolean } = {}) {
  const res = await fetch(`${BASE}/api/design/${id}/renew`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Failed to renew design item', res.status);
  }
  return res.json();
}

/** Record or log usage count for a Design item or CellPart */
export async function recordUsage(
  target: 'design' | 'cell-part',
  id: string,
  amount: number,
  mode: 'ADD' | 'SET' = 'ADD',
) {
  const endpoint = target === 'design' ? `${BASE}/api/design/${id}/usage` : `${BASE}/api/cell-part/${id}/usage`;
  const res = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ amount, mode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Failed to record usage', res.status);
  }
  return res.json();
}

/** Delete a CellPart */
export async function deleteCellPart(id: string) {
  const res = await fetch(`${BASE}/api/cell-part/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Failed to delete cell part', res.status);
  }
  return res.json();
}

export interface PartReplacementRecord {
  id: string;
  designId: string;
  cellPartId?: string | null;
  partNumber: string;
  partName: string;
  replacedAt: string;
  replacedBy: string;
  reason: string;
  notes?: string | null;
  usageAtReplace?: number | null;
  daysUsed?: number | null;
  createdAt: string;
  design: {
    id: string;
    noReg: string;
    assyPartName: string;
    line?: { lineName: string };
    process?: { name: string };
  };
  cellPart?: {
    id: string;
    partNumber: string;
    name: string;
  } | null;
}

/** Record a part replacement with historical tracking */
export async function recordCellPartReplacement(
  id: string,
  data: {
    replacedAt?: string;
    replacedBy: string;
    reason: string;
    notes?: string;
    resetUsage?: boolean;
  },
) {
  const res = await fetch(`${BASE}/api/cell-part/${id}/replace`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Gagal mencatat penggantian komponen', res.status);
  }
  return res.json();
}

/** Fetch part replacement historical log */
export async function fetchReplacementHistory(query?: {
  designId?: string;
  cellPartId?: string;
  search?: string;
}): Promise<PartReplacementRecord[]> {
  const params = new URLSearchParams();
  if (query?.designId) params.append('designId', query.designId);
  if (query?.cellPartId) params.append('cellPartId', query.cellPartId);
  if (query?.search) params.append('search', query.search);

  const res = await fetch(`${BASE}/api/cell-part/replacement-history?${params.toString()}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new HttpError('Failed to fetch replacement history', res.status);
  return res.json();
}

/** Delete a replacement log entry */
export async function deleteReplacementLog(id: string) {
  const res = await fetch(`${BASE}/api/cell-part/replacement-history/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new HttpError('Failed to delete replacement log', res.status);
  return res.json();
}

// ==========================================
// DRAWING PARSER & DIGITAL SIGNATURE API
// ==========================================

export interface ParsedJigMetadata {
  partName: string;
  partNumber: string;
  title: string;
  model: string;
  qty: string;
  drawnBy?: string;
  checkedBy?: string;
  approvedBy?: string;
  scale?: string;
  format?: string;
  weight?: string;
}

export interface ParsedCellPartItem {
  itemNo: number;
  name: string;
  partNumber: string;
  material?: string;
  heatTreatment?: string;
  hardness?: string;
  qty: string;
  pdfPageIndex?: number;
  isStandardPart: boolean;
  description?: string;
}

export interface ParseDrawingResponse {
  url: string;
  filename: string;
  size: number;
  parsed: {
    jig: ParsedJigMetadata;
    cellParts: ParsedCellPartItem[];
    totalPages: number;
    extractedTextSummary?: string;
  };
}

/** Upload and analyze 2D Drawing PDF to extract E-Tiket and BOM table */
export async function parseDrawingPdf(file: File): Promise<ParseDrawingResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}/api/upload/parse-drawing`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Gagal menganalisis PDF drawing', res.status);
  }
  return res.json();
}

/** Section Head or Dept Head approves an item revision */
export async function approveRevision(approvalId: string, data?: { comment?: string }) {
  const res = await fetch(`${BASE}/api/approvals/${approvalId}/approve`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Gagal menyetujui approval', res.status);
  }
  return res.json();
}

/** Section Head or Dept Head returns for revision */
export async function rejectRevision(approvalId: string, data: { comment: string; markupData?: string }) {
  const res = await fetch(`${BASE}/api/approvals/${approvalId}/reject`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Gagal mengirim permintaan revisi', res.status);
  }
  return res.json();
}

/** Fetch single approval detail with full relations (design, documents, histories, markup) */
export async function fetchApprovalDetail(approvalId: string) {
  const res = await fetch(`${BASE}/api/approvals/${approvalId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Gagal memuat detail approval', res.status);
  }
  return res.json();
}

/** Drawer (PIC) resubmits a revised drawing */
export async function resubmitRevision(
  approvalId: string,
  data: {
    docLocation2D: string;
    docLocation3D?: string;
    revStatus?: string;
    revisionNote: string;
  },
) {
  const res = await fetch(`${BASE}/api/approvals/${approvalId}/resubmit-revision`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Gagal mengunggah revisian drawing', res.status);
  }
  return res.json();
}

/** Download a single 1-page PDF for a design (Hal 1: Induk, Hal N: CellPart) */
export async function downloadDesignPdfPage(designId: string, pageNumber: number, customFilename?: string) {
  const res = await fetch(`${BASE}/api/design/${designId}/pdf-page/${pageNumber}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || `Gagal mengunduh Halaman ${pageNumber}`, res.status);
  }

  const disposition = res.headers.get('content-disposition');
  let filename = customFilename || `Drawing_Hal_${pageNumber}.pdf`;
  if (!customFilename && disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match?.[1]) filename = decodeURIComponent(match[1]);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/** Download full multi-page PDF with official legal stamp on every page */
export async function downloadDesignPdfFull(designId: string, customFilename?: string) {
  const res = await fetch(`${BASE}/api/design/${designId}/pdf-full`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Gagal mengunduh Dokumen PDF Resmi', res.status);
  }

  const disposition = res.headers.get('content-disposition');
  let filename = customFilename || `Drawing_Resmi.pdf`;
  if (!customFilename && disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match?.[1]) filename = decodeURIComponent(match[1]);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/** Fetch full PDF blob for batch ZIP download */
export async function fetchDesignPdfBlob(designId: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${BASE}/api/design/${designId}/pdf-full`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Gagal mengunduh Dokumen PDF Resmi', res.status);
  }

  const disposition = res.headers.get('content-disposition');
  let filename = `Drawing_Resmi_${designId}.pdf`;
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match?.[1]) filename = decodeURIComponent(match[1]);
  }

  const blob = await res.blob();
  return { blob, filename };
}

/** Download multiple designs / pages merged into a single PDF file */
export async function downloadMergedDesignPdf(
  targets: Array<{ designId: string; pageNumber?: number }>,
  customFilename?: string,
) {
  const res = await fetch(`${BASE}/api/design/pdf-merge`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targets }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Gagal menggabungkan dokumen PDF Resmi', res.status);
  }

  const disposition = res.headers.get('content-disposition');
  let filename = customFilename || `Drawing_Gabungan_Resmi.pdf`;
  if (!customFilename && disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match?.[1]) filename = decodeURIComponent(match[1]);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}


