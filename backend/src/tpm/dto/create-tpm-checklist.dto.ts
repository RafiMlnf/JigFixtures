export class CreateTpmChecklistDto {
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
