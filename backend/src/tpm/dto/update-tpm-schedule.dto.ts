export class UpdateTpmScheduleDto {
  isCellPart?: boolean;
  tpmScheduleStart?: string;
  tpmScheduleDeadline?: string;
  lifetimeDays?: number;
  lifetimeType?: 'DUAL' | 'USAGE' | 'DAYS';
  maxUsage?: number;
  currentUsage?: number;
}
