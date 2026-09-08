export class ProcessApprovalDto {
  action!: 'APPROVE' | 'REJECT';
  comment?: string;
  signatureData?: string;
  signatureType?: 'DRAW' | 'STAMP' | 'UPLOAD';
}
