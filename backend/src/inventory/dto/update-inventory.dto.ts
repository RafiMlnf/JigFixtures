export class UpdateInventoryDto {
  minimumStock!: number;
  actualStock!: number;
  lifecycleStatus?: 'ACTIVE' | 'UNDER_REPAIR' | 'UNDER_IMPROVEMENT' | 'OBSOLETE' | 'SCRAP';
}
