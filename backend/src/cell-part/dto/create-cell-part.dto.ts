export class CreateCellPartDto {
  designId!: string;
  partNumber!: string;
  name!: string;
  description?: string;
  lifetimeDays?: number;
  installDate?: string;
  minimumStock?: number;
  actualStock?: number;
  pdfPageIndex?: number;
}
