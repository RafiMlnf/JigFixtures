export class ProcessApprovalDto {
  action!: 'APPROVE' | 'REJECT';
  comment?: string;
  signatureData?: string;
  signatureType?: 'DRAW' | 'STAMP' | 'UPLOAD';
  placement?: {
    pageIndex?: number;
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  };
}
