export class UpdateTpmScheduleDto {
  isChildPart?: boolean;
  tpmScheduleStart?: string;
  tpmScheduleDeadline?: string;
  lifetimeDays?: number;
  lifetimeType?: 'DUAL' | 'USAGE' | 'DAYS';
  maxUsage?: number;
  currentUsage?: number;
}
