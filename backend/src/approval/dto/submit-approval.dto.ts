import { ApprovalType } from '@prisma/client';

export class SubmitApprovalDto {
  itemId!: string;
  type!: ApprovalType;
  revisionNote?: string;
}
