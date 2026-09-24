export class CreateTpmLogDto {
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
