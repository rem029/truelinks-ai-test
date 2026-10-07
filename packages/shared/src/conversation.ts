import { z } from 'zod';
import { Card } from './cards.ts';
import { RuleResult } from './rules.ts';
import { Lease, LeaseStatus, LeaseAnalysisStatus, LeaseTiming } from './lease.ts';
import { LeaseDocument } from './leaseDocument.ts';
import { Issue, WorkOrder } from './issue.ts';

export const ConversationKind = z.enum(['lease', 'issue']);
export type ConversationKind = z.infer<typeof ConversationKind>;

export const ConversationStatus = z.enum(['open', 'confirmed', 'abandoned']);
export type ConversationStatus = z.infer<typeof ConversationStatus>;

export const Conversation = z.object({
  id: z.string(),
  kind: ConversationKind,
  unitId: z.string().nullable(),
  status: ConversationStatus,
  // Set while the review is archived: hidden from the unit's lists, read-only, deletable
  archivedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Conversation = z.infer<typeof Conversation>;

export const MessageRole = z.enum(['user', 'assistant', 'tool']);
export type MessageRole = z.infer<typeof MessageRole>;

export const Attachment = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
});
export type Attachment = z.infer<typeof Attachment>;

export const AgentToolCallRecord = z.object({
  name: z.string(),
  args: z.unknown(),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  ms: z.number(),
});
export type AgentToolCallRecord = z.infer<typeof AgentToolCallRecord>;

export const AgentRun = z.object({
  model: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  ms: z.number(),
  toolCalls: z.array(AgentToolCallRecord),
});
export type AgentRun = z.infer<typeof AgentRun>;

export const Message = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: MessageRole,
  text: z.string(),
  cards: z.array(Card),
  attachments: z.array(Attachment),
  agentRun: AgentRun.nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Message = z.infer<typeof Message>;

export const ConversationReview = z.object({
  pending: z.array(z.string()),
  highSeverityFailures: z.array(RuleResult),
});
export type ConversationReview = z.infer<typeof ConversationReview>;

export const ConversationDetails = z.object({
  conversation: Conversation,
  messages: z.array(Message),
  documents: z.array(LeaseDocument),
  lease: Lease.nullable(),
  review: ConversationReview.nullable(),
  issue: Issue.nullable(),
  workOrder: WorkOrder.nullable(),
  // Why it can't be archived (the unit's current or next lease), or null
  archiveBlockedReason: z.string().nullable(),
});
export type ConversationDetails = z.infer<typeof ConversationDetails>;

export const IngestLeaseResponse = z.object({
  document: LeaseDocument,
  message: Message,
  lease: Lease,
  messages: z.array(Message),
});
export type IngestLeaseResponse = z.infer<typeof IngestLeaseResponse>;

export const ConversationActionResponse = z.object({
  lease: Lease,
  messages: z.array(Message),
});
export type ConversationActionResponse = z.infer<typeof ConversationActionResponse>;

export const ReportIssueResponse = z.object({
  issue: Issue,
  workOrder: WorkOrder.nullable(),
  messages: z.array(Message),
});
export type ReportIssueResponse = z.infer<typeof ReportIssueResponse>;

export const WorkOrderTurnResponse = z.object({
  workOrder: WorkOrder.nullable(),
  messages: z.array(Message),
});
export type WorkOrderTurnResponse = z.infer<typeof WorkOrderTurnResponse>;

// What a unit's issue list shows about the report's work order
export const WorkOrderSummary = WorkOrder.pick({ title: true, status: true, severity: true, urgent: true });
export type WorkOrderSummary = z.infer<typeof WorkOrderSummary>;

export const ConversationSummary = z.object({
  id: z.string(),
  kind: ConversationKind,
  status: ConversationStatus,
  unitId: z.string().nullable(),
  filename: z.string().nullable(),
  leaseStatus: LeaseStatus.nullable(),
  leaseTiming: LeaseTiming.nullable(),
  analysisStatus: LeaseAnalysisStatus.nullable(),
  openItems: z.number().int().nonnegative().nullable(),
  photoCount: z.number().int().nonnegative().nullable(),
  workOrder: WorkOrderSummary.nullable(),
  archivedAt: z.iso.datetime({ offset: true }).nullable(),
  archiveBlockedReason: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type ConversationSummary = z.infer<typeof ConversationSummary>;


