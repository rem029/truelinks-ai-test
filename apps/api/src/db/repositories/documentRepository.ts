import type { Kysely } from 'kysely';
import { LeaseDocument } from '@truelinks/shared';
import type { Database, DocumentsTable } from '../schema.ts';

export interface StoredDocument {
  document: LeaseDocument;
  filePath: string;
}

export interface DocumentRepository {
  create(document: LeaseDocument, filePath: string): Promise<LeaseDocument>;
  get(id: string): Promise<StoredDocument | null>;
  listByConversation(conversationId: string): Promise<LeaseDocument[]>;
  // Returns the stored file paths, so the caller can remove the files once the delete commits
  deleteByConversation(conversationId: string): Promise<string[]>;
}

function toDomain(row: DocumentsTable): LeaseDocument {
  return LeaseDocument.parse({
    id: row.id,
    conversationId: row.conversation_id,
    filename: row.filename,
    mimeType: row.mime_type,
    textSource: row.text_source,
    clauseSplit: row.clause_split,
    pageCount: row.page_count,
    clauses: JSON.parse(row.clauses_json),
    createdAt: row.created_at,
  });
}

function toRow(doc: LeaseDocument, filePath: string): DocumentsTable {
  return {
    id: doc.id,
    conversation_id: doc.conversationId,
    filename: doc.filename,
    mime_type: doc.mimeType,
    file_path: filePath,
    text_source: doc.textSource,
    clause_split: doc.clauseSplit,
    page_count: doc.pageCount,
    clauses_json: JSON.stringify(doc.clauses),
    created_at: doc.createdAt,
  };
}

export function createDocumentRepository(db: Kysely<Database>): DocumentRepository {
  return {
    async create(document: LeaseDocument, filePath: string): Promise<LeaseDocument> {
      await db.insertInto('documents').values(toRow(document, filePath)).execute();
      return document;
    },

    async get(id: string): Promise<StoredDocument | null> {
      const row = await db.selectFrom('documents').selectAll().where('id', '=', id).executeTakeFirst();
      if (!row) {
        return null;
      }
      return {
        document: toDomain(row),
        filePath: row.file_path,
      };
    },

    async listByConversation(conversationId: string): Promise<LeaseDocument[]> {
      const rows = await db
        .selectFrom('documents')
        .selectAll()
        .where('conversation_id', '=', conversationId)
        .orderBy('created_at', 'asc')
        .execute();
      return rows.map(toDomain);
    },

    async deleteByConversation(conversationId: string): Promise<string[]> {
      const rows = await db
        .deleteFrom('documents')
        .where('conversation_id', '=', conversationId)
        .returning('file_path')
        .execute();
      return rows.map((row) => row.file_path);
    },
  };
}
