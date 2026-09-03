export class CreateAbnormalityDto {
  itemId!: string;
  type!: string; // RUSAK | AUS | DEFORMASI | LAINNYA
  description!: string;
  
  dateFound?: string;
  foundBy!: string;
  rootCause!: string;
  tempAction!: string;
  correctiveAction!: string;
  actionPic!: string;
  status?: 'OPEN' | 'MONITORING' | 'CLOSED';
  linkToRevision?: boolean;
  linkToSpare?: boolean;
}
