export class UpdateChildPartDto {
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
}
