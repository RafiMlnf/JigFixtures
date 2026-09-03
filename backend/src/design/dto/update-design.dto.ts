export class UpdateDesignDto {
  revStatus!: string; // '0' | '1' | '2' | 'N/A'
  designDateNew?: string;
  docLocation2D?: string;
  docLocation3D?: string;
  revisionNote?: string;
  
  vendorId?: string;
  poNumber?: string;
  cost?: number;
  leadTime?: number;
}
