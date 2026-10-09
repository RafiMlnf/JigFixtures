import { ApprovalItem } from '@/context/AppContext';
import Cookies from 'js-cookie';
import { getApiBaseUrl } from './config';

const API_BASE_URL = getApiBaseUrl();

// Helper to construct headers with JWT token
function getAuthHeaders() {
  const token = Cookies.get('auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

const APPROVALS_STORAGE_KEY = 'jigfixture_approvals';

function getLocalApprovals(): ApprovalItem[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(APPROVALS_STORAGE_KEY);
  if (!stored) return [];
  return JSON.parse(stored);
}

function saveLocalApprovals(approvals: ApprovalItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(APPROVALS_STORAGE_KEY, JSON.stringify(approvals));
}

// Maps rich backend Approval relational model to flat front-end ApprovalItem structure
function mapBackendApproval(backend: any): ApprovalItem {
  const dateObj = new Date(backend.submittedAt);
  const formattedDate = dateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + `, ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

  return {
    id: backend.id,
    noReg: backend.item?.noReg || 'N/A',
    designId: backend.item?.id || backend.designId || undefined,  // UUID of design item
    itemName: backend.item?.assyPartName || 'N/A',
    date: formattedDate,
    author: backend.submittedBy?.name || 'PIC Submitter',
    authorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD0K5uMa_eyzsLMfQnbYnlDlbL0hBNbMgB43eKGSSrulPd8R9KaBD-eOVIRnjge_lre88wQy32ZMQbO5pKvKoJdf7atqBmlbiSVEQIAF1Wf7obS1uwccX8H_uNfR8SZ6-SE-1fv1hDVDh_g8Jp0I7dS5FLdPtJ_RtVTHs-mnlA6p4X_ZzB-516cPH-NL6fxEyDNf7v4FLZ2X5nqNvfLo15Em1bnYhl46iz08ZtBfbLW2c17XuJTiElB',
    note: backend.revisionNote || backend.finalComment || backend.sectionComment || backend.deptComment || '',
    type: backend.type === 'DESIGN_REVISION' ? 'Design Rev' : 'Inventory Update',
    status: backend.status,
    color: backend.type === 'DESIGN_REVISION' ? 'bg-accent-orange border-orange-200/50' : 'bg-[#d8b4fe] border-purple-300/50',
    has3DRender: backend.item?.type === 'JF',
    sectionStatus: backend.sectionStatus,
    deptStatus: backend.deptStatus,
    markupData: backend.markupData || undefined,
    annotatedDocPath: backend.annotatedDocPath || undefined,
  };
}

export async function fetchApprovals(filters?: {
  status?: string;
  type?: string;
}): Promise<ApprovalItem[]> {
  try {
    const queryParams = new URLSearchParams();
    if (filters?.status && filters.status !== 'ALL') queryParams.append('status', filters.status);
    if (filters?.type && filters.type !== 'ALL') queryParams.append('type', filters.type);

    const res = await fetch(`${API_BASE_URL}/approvals?${queryParams.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('API server returned error');
    const result = await res.json();
    
    // Map raw backend elements
    return (Array.isArray(result) ? result : result.data || []).map(mapBackendApproval);
  } catch (error) {
    console.warn('[API] NestJS backend offline. Using fallback local storage for approvals.', error);
    let approvals = getLocalApprovals();
    if (filters?.status && filters.status !== 'ALL') {
      approvals = approvals.filter(a => a.status === filters.status);
    }
    if (filters?.type && filters.type !== 'ALL') {
      approvals = approvals.filter(a => a.type === filters.type);
    }
    return approvals;
  }
}

export async function submitDecision(
  id: string,
  action: 'APPROVE' | 'REJECT',
  comment?: string
): Promise<ApprovalItem> {
  const endpoint = action === 'APPROVE' ? 'approve' : 'reject';
  const res = await fetch(`${API_BASE_URL}/approvals/${id}/${endpoint}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ comment: comment || '' }),
  });
  if (res.ok) {
    const result = await res.json();
    return mapBackendApproval(result);
  }

  // If server returned an error (e.g. 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found)
  let errMsg = 'Failed to submit decision on server';
  try {
    const errData = await res.json();
    if (errData?.message) {
      errMsg = Array.isArray(errData.message) ? errData.message.join(', ') : errData.message;
    }
  } catch {}

  // If it's a real HTTP error from server, throw it directly with the server's explanation
  if (res.status >= 400 && res.status < 500) {
    throw new Error(errMsg);
  }

  // Only fall back to local storage if server is truly unreachable (network failure / 502 / 503)
  console.warn(`[API] Server unavailable (${res.status}). Processing approval decision in fallback storage.`);
  const approvals = getLocalApprovals();
  const index = approvals.findIndex((a) => a.id === id);
  if (index === -1) throw new Error(errMsg || 'Approval request not found');

  const updated = {
    ...approvals[index],
    status: action === 'APPROVE' ? ('APPROVED' as const) : ('REJECTED' as const),
  };
  approvals[index] = updated;
  saveLocalApprovals(approvals);
  return updated;
}

// Submits a new approval request for an item (PIC role)
export async function submitApprovalRequest(
  itemId: string,
  type: 'DESIGN_REVISION' | 'INVENTORY_UPDATE',
  revisionNote?: string
): Promise<ApprovalItem> {
  const res = await fetch(`${API_BASE_URL}/approvals`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ itemId, type, revisionNote }),
  });
  if (!res.ok) throw new Error('Failed to submit approval request');
  const result = await res.json();
  return mapBackendApproval(result);
}
