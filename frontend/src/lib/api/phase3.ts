import Cookies from 'js-cookie';

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const BASE = 'http://localhost:3002';

function getToken(): string {
  return Cookies.get('auth_token') || '';
}

/** Fetch all items for the design/abnormality dropdown */
export async function fetchDesignItems() {
  const res = await fetch(`${BASE}/api/design/items`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch design items');
  return res.json();
}

/** Fetch lines and processes lists */
export async function fetchLinesAndProcesses() {
  const res = await fetch(`${BASE}/api/design/lines-processes`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch lines and processes');
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
  cost?: number;
  leadTime?: number;
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

/** Build a full URL for a stored file path like /uploads/foo.pdf */
export function getFileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  const finalPath = clean.startsWith('/uploads/') ? clean : `/uploads${clean}`;
  return `http://localhost:3002${finalPath}`;
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

/** Renew a CellPart's lifetime (reset install date to now) */
export async function renewCellPart(id: string) {
  const res = await fetch(`${BASE}/api/cell-part/${id}/renew`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Failed to renew cell part', res.status);
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
  const res = await fetch(`${BASE}/api/upload/parse-drawing`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Gagal menganalisis PDF drawing', res.status);
  }
  return res.json();
}

/** Drafter/PIC digitally signs the DRAWN slot of a released design document */
export async function signDesignDrawn(
  designId: string,
  signatureData: string,
  placement?: {
    pageIndex?: number;
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  },
) {
  const res = await fetch(`${BASE}/api/design/${designId}/sign-drawn`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ signatureData, placement }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Gagal menandatangani drawing', res.status);
  }
  return res.json();
}

/** Drafter/PIC digitally signs the DRAWN slot of an approval revision */
export async function signApprovalDrawn(approvalId: string, signatureData: string) {
  const res = await fetch(`${BASE}/api/approvals/${approvalId}/sign-drawn`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ signatureData }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Gagal menandatangani approval', res.status);
  }
  return res.json();
}

/** Section Head or Dept Head approves with digital signature */
export async function approveWithSignature(approvalId: string, data: {
  comment?: string;
  signatureData?: string;
  signatureType?: 'DRAW' | 'STAMP' | 'UPLOAD';
  placement?: {
    pageIndex?: number;
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  };
}) {
  const res = await fetch(`${BASE}/api/approvals/${approvalId}/approve`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new HttpError(err.message || 'Gagal menyetujui approval', res.status);
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
