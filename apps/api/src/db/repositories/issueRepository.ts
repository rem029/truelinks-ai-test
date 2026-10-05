import type { Kysely } from 'kysely';
import { Issue, type IssuePhoto, WorkOrder } from '@truelinks/shared';
import type { Database, IssuesTable, WorkOrdersTable } from '../schema.ts';

export interface IssueRepository {
  createIssue(issue: Issue): Promise<Issue>;
  getIssue(id: string): Promise<Issue | null>;
  getByConversation(conversationId: string): Promise<Issue | null>;
  updatePhotos(issueId: string, photos: IssuePhoto[]): Promise<void>;
  listByUnit(unitId: string): Promise<Issue[]>;
  createWorkOrder(workOrder: WorkOrder): Promise<WorkOrder>;
  getWorkOrder(id: string): Promise<WorkOrder | null>;
  getWorkOrderByIssue(issueId: string): Promise<WorkOrder | null>;
  updateWorkOrder(workOrder: WorkOrder): Promise<WorkOrder>;
  listWorkOrdersByUnit(unitId: string): Promise<WorkOrder[]>;
}

function issueToDomain(row: IssuesTable): Issue {
  return Issue.parse({
    id: row.id,
    unitId: row.unit_id,
    conversationId: row.conversation_id,
    reporterRole: row.reporter_role,
    note: row.note ?? undefined,
    photos: JSON.parse(row.photos_json),
    createdAt: row.created_at,
  });
}

function workOrderToDomain(row: WorkOrdersTable): WorkOrder {
  return WorkOrder.parse({
    id: row.id,
    issueId: row.issue_id,
    unitId: row.unit_id,
    title: row.title,
    description: row.description,
    category: row.category,
    severity: row.severity,
    urgent: row.urgent === 1,
    responsibility: row.responsibility,
    responsibilityReason: row.responsibility_reason,
    responsibilityClause: row.responsibility_clause_json
      ? JSON.parse(row.responsibility_clause_json)
      : null,
    leaseId: row.lease_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function createIssueRepository(db: Kysely<Database>): IssueRepository {
  return {
    async createIssue(issue: Issue): Promise<Issue> {
      await db
        .insertInto('issues')
        .values({
          id: issue.id,
          unit_id: issue.unitId,
          conversation_id: issue.conversationId,
          reporter_role: issue.reporterRole,
          note: issue.note ?? null,
          photos_json: JSON.stringify(issue.photos),
          created_at: issue.createdAt,
        })
        .execute();
      return issue;
    },

    async getIssue(id: string): Promise<Issue | null> {
      const row = await db.selectFrom('issues').selectAll().where('id', '=', id).executeTakeFirst();
      return row ? issueToDomain(row) : null;
    },

    async getByConversation(conversationId: string): Promise<Issue | null> {
      const row = await db
        .selectFrom('issues')
        .selectAll()
        .where('conversation_id', '=', conversationId)
        .executeTakeFirst();
      return row ? issueToDomain(row) : null;
    },

    async updatePhotos(issueId: string, photos: IssuePhoto[]): Promise<void> {
      const result = await db
        .updateTable('issues')
        .set({ photos_json: JSON.stringify(photos) })
        .where('id', '=', issueId)
        .executeTakeFirst();
      if (result.numUpdatedRows === 0n) {
        throw new Error(`Issue ${issueId} not found`);
      }
    },

    async listByUnit(unitId: string): Promise<Issue[]> {
      const rows = await db
        .selectFrom('issues')
        .selectAll()
        .where('unit_id', '=', unitId)
        .orderBy('created_at', 'desc')
        .execute();
      return rows.map(issueToDomain);
    },

    async createWorkOrder(workOrder: WorkOrder): Promise<WorkOrder> {
      await db
        .insertInto('work_orders')
        .values({
          id: workOrder.id,
          issue_id: workOrder.issueId,
          unit_id: workOrder.unitId,
          title: workOrder.title,
          description: workOrder.description,
          category: workOrder.category,
          severity: workOrder.severity,
          urgent: workOrder.urgent ? 1 : 0,
          responsibility: workOrder.responsibility,
          responsibility_reason: workOrder.responsibilityReason,
          responsibility_clause_json: workOrder.responsibilityClause
            ? JSON.stringify(workOrder.responsibilityClause)
            : null,
          lease_id: workOrder.leaseId,
          status: workOrder.status,
          created_at: workOrder.createdAt,
          updated_at: workOrder.updatedAt,
        })
        .execute();
      return workOrder;
    },

    async getWorkOrder(id: string): Promise<WorkOrder | null> {
      const row = await db.selectFrom('work_orders').selectAll().where('id', '=', id).executeTakeFirst();
      return row ? workOrderToDomain(row) : null;
    },

    async getWorkOrderByIssue(issueId: string): Promise<WorkOrder | null> {
      const row = await db
        .selectFrom('work_orders')
        .selectAll()
        .where('issue_id', '=', issueId)
        .orderBy('created_at', 'desc')
        .executeTakeFirst();
      return row ? workOrderToDomain(row) : null;
    },

    async updateWorkOrder(workOrder: WorkOrder): Promise<WorkOrder> {
      const updated = await db
        .updateTable('work_orders')
        .set({
          title: workOrder.title,
          description: workOrder.description,
          category: workOrder.category,
          severity: workOrder.severity,
          urgent: workOrder.urgent ? 1 : 0,
          responsibility: workOrder.responsibility,
          responsibility_reason: workOrder.responsibilityReason,
          responsibility_clause_json: workOrder.responsibilityClause
            ? JSON.stringify(workOrder.responsibilityClause)
            : null,
          lease_id: workOrder.leaseId,
          status: workOrder.status,
          updated_at: workOrder.updatedAt,
        })
        .where('id', '=', workOrder.id)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        throw new Error(`WorkOrder ${workOrder.id} not found`);
      }

      return workOrderToDomain(updated);
    },

    async listWorkOrdersByUnit(unitId: string): Promise<WorkOrder[]> {
      const rows = await db
        .selectFrom('work_orders')
        .selectAll()
        .where('unit_id', '=', unitId)
        .orderBy('created_at', 'desc')
        .execute();
      return rows.map(workOrderToDomain);
    },
  };
}
