import { z } from 'zod';
import {
  Conversation,
  type ConversationKind,
  ConversationDetails,
  IngestLeaseResponse,
  ConversationActionResponse,
  type Action,
  HealthResponse,
  Unit,
  ConversationSummary,
  type ReporterRole,
  ReportIssueResponse,
  WorkOrderTurnResponse,
} from '@truelinks/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  url: string,
  options?: RequestInit,
  schema?: { parse: (val: unknown) => T }
): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    let details: unknown = undefined;
    try {
      const data = await res.json();
      if (data && typeof data === 'object') {
        if ('error' in data && typeof data.error === 'string') {
          message = data.error;
        }
        if ('details' in data) {
          details = data.details;
        }
      }
    } catch {
      // Non-JSON response
    }
    throw new ApiError(message, res.status, details);
  }
  const json = await res.json();
  return schema ? schema.parse(json) : (json as T);
}

export async function getHealth(): Promise<HealthResponse> {
  return request('/api/health', undefined, HealthResponse);
}

export async function createConversation(
  kind: ConversationKind = 'lease',
  unitId?: string | null
): Promise<Conversation> {
  return request(
    '/api/conversations',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, unitId: unitId ?? null }),
    },
    Conversation
  );
}

export async function getConversation(id: string): Promise<ConversationDetails> {
  return request(`/api/conversations/${encodeURIComponent(id)}`, undefined, ConversationDetails);
}

export async function uploadLeaseDocument(
  conversationId: string,
  file: File
): Promise<IngestLeaseResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return request(
    `/api/conversations/${encodeURIComponent(conversationId)}/lease-document`,
    {
      method: 'POST',
      body: formData,
    },
    IngestLeaseResponse
  );
}

export async function postCardAction(
  conversationId: string,
  action: Action
): Promise<ConversationActionResponse> {
  return request(
    `/api/conversations/${encodeURIComponent(conversationId)}/actions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    },
    ConversationActionResponse
  );
}

export async function postMessage(
  conversationId: string,
  text: string
): Promise<ConversationActionResponse> {
  return request(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    },
    ConversationActionResponse
  );
}

export function getDocumentFileUrl(documentId: string, page?: number | null): string {
  const base = `/api/documents/${encodeURIComponent(documentId)}/file`;
  return page ? `${base}#page=${page}` : base;
}

export async function getUnits(): Promise<Unit[]> {
  return request('/api/units', undefined, z.array(Unit));
}

export async function listConversations(kind?: ConversationKind): Promise<ConversationSummary[]> {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return request(`/api/conversations${query}`, undefined, z.array(ConversationSummary));
}

export async function reportIssue(
  conversationId: string,
  data: { reporterRole: ReporterRole; note?: string; photos: File[] }
): Promise<ReportIssueResponse> {
  const formData = new FormData();
  formData.append('reporterRole', data.reporterRole);
  if (data.note) {
    formData.append('note', data.note);
  }
  for (const photo of data.photos) {
    formData.append('photos', photo);
  }
  return request(
    `/api/conversations/${encodeURIComponent(conversationId)}/issue-report`,
    {
      method: 'POST',
      body: formData,
    },
    ReportIssueResponse
  );
}

// Issue reports use the same thread endpoints as lease reviews; the reply carries the work order instead of a lease
export async function postWorkOrderAction(
  conversationId: string,
  action: Action
): Promise<WorkOrderTurnResponse> {
  return request(
    `/api/conversations/${encodeURIComponent(conversationId)}/actions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    },
    WorkOrderTurnResponse
  );
}

export async function postIssueMessage(
  conversationId: string,
  text: string
): Promise<WorkOrderTurnResponse> {
  return request(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    },
    WorkOrderTurnResponse
  );
}

export function getIssuePhotoUrl(conversationId: string, photoId: string): string {
  return `/api/conversations/${encodeURIComponent(conversationId)}/photos/${encodeURIComponent(photoId)}`;
}



