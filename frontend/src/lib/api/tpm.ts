import Cookies from 'js-cookie';

const BASE = 'http://localhost:3002';

function getToken(): string {
  return Cookies.get('auth_token') || '';
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface TpmSummary {
  totalItems: number;
  totalDesigns: number;
  totalCellParts: number;
  pendingApprovalCount?: number;
  safeCount: number;
  warningCount: number;
  overdueCount: number;
  unscheduledCount: number;
  healthScore: number;
  checklistTodayCount: number;
  checklistTodayOk: number;
  checklistTodayNg: number;
  maintenanceThisMonth: number;
}

export interface TpmScheduleItem {
  id: string;
  parentId?: string;
  parentNoReg?: string;
  parentName?: string;
  isCellPart: boolean;
  noReg: string;
  partNumber: string;
  name: string;
  type: string;
  lineName: string;
  processName: string;
  lineId: string;
  processId: string;
  lifetimeDays: number;
  lifetimeType: 'DUAL' | 'USAGE' | 'DAYS';
  maxUsage: number;
  currentUsage: number;
  daysRemaining: number;
  dueDate: string;
  lifetimeStatus: 'OVERDUE' | 'WARNING' | 'SAFE';
  triggerReason: 'DAYS' | 'USAGE' | 'BOTH' | 'NONE';
  tpmScheduleStart?: string | null;
  tpmScheduleDeadline?: string | null;
  tpmLifetimeSetAt?: string | null;
  cellPartsCount: number;
}

export interface TpmChecklistItem {
  id: string;
  designId: string;
  cellPartId?: string | null;
  inspectorName: string;
  shift: string;
  checkDate: string;
  overallResult: 'OK' | 'NG';
  cleaningStatus: 'OK' | 'NG' | 'NA';
  locatorPinStatus: 'OK' | 'NG' | 'NA';
  clampingStatus: 'OK' | 'NG' | 'NA';
  sensorStatus: 'OK' | 'NG' | 'NA';
  boltsStatus: 'OK' | 'NG' | 'NA';
  lubricationStatus: 'OK' | 'NG' | 'NA';
  notes?: string | null;
  linkToAbnormality: boolean;
  abnormalityId?: string | null;
  createdAt: string;
  design?: {
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
  };
}

export interface TpmMaintenanceLogItem {
  id: string;
  designId: string;
  cellPartId?: string | null;
  actionType: 'PREVENTIVE' | 'CORRECTIVE' | 'RENEWAL' | 'CALIBRATION' | 'OVERHAUL';
  title: string;
  description: string;
  performedBy: string;
  performedAt: string;
  durationMinutes: number;
  partsReplaced?: string | null;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'SCHEDULED';
  cost: number;
  resetLifetime: boolean;
  createdAt: string;
  design?: {
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
  };
}

export interface CreateTpmChecklistPayload {
  designId: string;
  cellPartId?: string;
  inspectorName: string;
  shift?: string;
  checkDate?: string;
  overallResult: 'OK' | 'NG';
  cleaningStatus?: 'OK' | 'NG' | 'NA';
  locatorPinStatus?: 'OK' | 'NG' | 'NA';
  clampingStatus?: 'OK' | 'NG' | 'NA';
  sensorStatus?: 'OK' | 'NG' | 'NA';
  boltsStatus?: 'OK' | 'NG' | 'NA';
  lubricationStatus?: 'OK' | 'NG' | 'NA';
  notes?: string;
  linkToAbnormality?: boolean;
}

export interface CreateTpmLogPayload {
  designId: string;
  cellPartId?: string;
  actionType: 'PREVENTIVE' | 'CORRECTIVE' | 'RENEWAL' | 'CALIBRATION' | 'OVERHAUL';
  title: string;
  description: string;
  performedBy: string;
  performedAt?: string;
  durationMinutes?: number;
  partsReplaced?: string;
  status?: 'COMPLETED' | 'IN_PROGRESS' | 'SCHEDULED';
  cost?: number;
  resetLifetime?: boolean;
}

export interface UpdateTpmSchedulePayload {
  isCellPart?: boolean;
  tpmScheduleStart?: string;
  tpmScheduleDeadline?: string;
  lifetimeDays?: number;
  lifetimeType?: 'DUAL' | 'USAGE' | 'DAYS';
  maxUsage?: number;
  currentUsage?: number;
}

/** Fetch Summary KPI stats for TPM */
export async function fetchTpmSummary(): Promise<TpmSummary> {
  const res = await fetch(`${BASE}/api/tpm/summary`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new HttpError('Failed to fetch TPM summary', res.status);
  return res.json();
}

/** Fetch Schedules with status and 2-way lifetime */
export async function fetchTpmSchedules(params?: {
  search?: string;
  lineId?: string;
  processId?: string;
  status?: string;
  type?: 'ALL' | 'DESIGN' | 'CELL_PART';
}): Promise<TpmScheduleItem[]> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.lineId) query.append('lineId', params.lineId);
  if (params?.processId) query.append('processId', params.processId);
  if (params?.status) query.append('status', params.status);
  if (params?.type) query.append('type', params.type);

  const res = await fetch(`${BASE}/api/tpm/schedules?${query.toString()}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new HttpError('Failed to fetch TPM schedules', res.status);
  return res.json();
}

/** Update Schedule & Lifetime for Design or CellPart */
export async function updateTpmSchedule(
  id: string,
  payload: UpdateTpmSchedulePayload,
): Promise<any> {
  const res = await fetch(`${BASE}/api/tpm/schedule/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update TPM schedule');
  }
  return res.json();
}

/** Fetch Checklists history */
export async function fetchTpmChecklists(params?: {
  designId?: string;
  result?: string;
  search?: string;
}): Promise<TpmChecklistItem[]> {
  const query = new URLSearchParams();
  if (params?.designId) query.append('designId', params.designId);
  if (params?.result) query.append('result', params.result);
  if (params?.search) query.append('search', params.search);

  const res = await fetch(`${BASE}/api/tpm/checklists?${query.toString()}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new HttpError('Failed to fetch TPM checklists', res.status);
  return res.json();
}

/** Submit a new TPM Checklist report */
export async function createTpmChecklist(
  payload: CreateTpmChecklistPayload,
): Promise<TpmChecklistItem> {
  const res = await fetch(`${BASE}/api/tpm/checklists`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to submit TPM checklist');
  }
  return res.json();
}

/** Delete a checklist report */
export async function deleteTpmChecklist(id: string): Promise<any> {
  const res = await fetch(`${BASE}/api/tpm/checklists/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to delete checklist');
  return res.json();
}

/** Fetch Maintenance Logs */
export async function fetchTpmLogs(params?: {
  designId?: string;
  actionType?: string;
  status?: string;
  search?: string;
}): Promise<TpmMaintenanceLogItem[]> {
  const query = new URLSearchParams();
  if (params?.designId) query.append('designId', params.designId);
  if (params?.actionType) query.append('actionType', params.actionType);
  if (params?.status) query.append('status', params.status);
  if (params?.search) query.append('search', params.search);

  const res = await fetch(`${BASE}/api/tpm/logs?${query.toString()}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new HttpError('Failed to fetch maintenance logs', res.status);
  return res.json();
}

/** Create a new Maintenance Log */
export async function createTpmLog(payload: CreateTpmLogPayload): Promise<TpmMaintenanceLogItem> {
  const res = await fetch(`${BASE}/api/tpm/logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to save maintenance log');
  }
  return res.json();
}

/** Delete a maintenance log */
export async function deleteTpmLog(id: string): Promise<any> {
  const res = await fetch(`${BASE}/api/tpm/logs/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to delete maintenance log');
  return res.json();
}
