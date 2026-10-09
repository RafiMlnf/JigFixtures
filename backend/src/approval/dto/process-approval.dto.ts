export class ProcessApprovalDto {
  action!: 'APPROVE' | 'REJECT';
  comment?: string;
  markupData?: string;
}
