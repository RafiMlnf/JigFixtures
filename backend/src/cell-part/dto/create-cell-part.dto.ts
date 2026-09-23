export class CreateCellPartDto {
  designId!: string;
  partNumber!: string;
  name!: string;
  description?: string;
  lifetimeDays?: number;
  lifetimeType?: string; // DUAL | USAGE | DAYS
  maxUsage?: number;
  currentUsage?: number;
  installDate?: string;
  minimumStock?: number;
  actualStock?: number;
  pdfPageIndex?: number;
}
