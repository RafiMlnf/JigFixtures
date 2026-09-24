export class UpdateDesignDto {
  revStatus?: string; // '0' | '1' | '2' | 'N/A' — optional, only required for design revision
  designDateNew?: string;
  docLocation2D?: string;
  docLocation3D?: string;
  revisionNote?: string;
  
  vendorId?: string;
  poNumber?: string;
  cost?: number;
  leadTime?: number;

  lifetimeDays?: number;
  lifetimeType?: string;
  maxUsage?: number;
  currentUsage?: number;
}
