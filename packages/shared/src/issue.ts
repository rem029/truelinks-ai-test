import { z } from 'zod';
import { Severity } from './severity.js';

export const ReporterRole = z.enum(['tenant', 'inspector']);
export type ReporterRole = z.infer<typeof ReporterRole>;

export const IssueCondition = z.enum(['new', 'worn', 'damaged', 'undeterminable']);
export type IssueCondition = z.infer<typeof IssueCondition>;

export const IssuePhoto = z.object({
  id: z.string(),
  filename: z.string(),
  condition: IssueCondition,
  damages: z.array(z.string()),
  equipment: z.array(z.string()),
});
export type IssuePhoto = z.infer<typeof IssuePhoto>;

export const Issue = z.object({
  id: z.string(),
  unitId: z.string(),
  conversationId: z.string(),
  reporterRole: ReporterRole,
  note: z.string().optional(),
  photos: z.array(IssuePhoto),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Issue = z.infer<typeof Issue>;

export const WorkOrderStatus = z.enum(['draft', 'accepted', 'rejected']);
export type WorkOrderStatus = z.infer<typeof WorkOrderStatus>;

export const WorkOrder = z.object({
  id: z.string(),
  issueId: z.string(),
  unitId: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  severity: Severity,
  urgent: z.boolean(),
  // Suggested party responsible according to the lease clauses; advisory only
  responsibility: z.string(),
  status: WorkOrderStatus,
  createdAt: z.iso.datetime({ offset: true }),
});
export type WorkOrder = z.infer<typeof WorkOrder>;
