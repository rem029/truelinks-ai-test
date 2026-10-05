import type { Kysely } from 'kysely';
import {
  Conversation,
  type ConversationStatus,
  type ConversationKind,
  Message,
} from '@truelinks/shared';
import type { Database, ConversationsTable, MessagesTable } from '../schema.ts';

export interface ConversationRepository {
  create(conversation: Conversation): Promise<Conversation>;
  get(id: string): Promise<Conversation | null>;
  list(filter?: { kind?: ConversationKind }): Promise<Conversation[]>;
  listMessages(conversationId: string): Promise<Message[]>;
  addMessage(message: Message): Promise<Message>;
  setStatus(id: string, status: ConversationStatus): Promise<Conversation>;
}

function conversationToDomain(row: ConversationsTable): Conversation {
  return Conversation.parse({
    id: row.id,
    kind: row.kind,
    unitId: row.unit_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function messageToDomain(row: MessagesTable): Message {
  return Message.parse({
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    text: row.text,
    cards: JSON.parse(row.cards_json),
    attachments: JSON.parse(row.attachments_json),
    agentRun: row.tool_calls_json ? JSON.parse(row.tool_calls_json) : null,
    createdAt: row.created_at,
  });
}

export function createConversationRepository(db: Kysely<Database>): ConversationRepository {
  return {
    async create(conversation: Conversation): Promise<Conversation> {
      await db
        .insertInto('conversations')
        .values({
          id: conversation.id,
          kind: conversation.kind,
          unit_id: conversation.unitId,
          status: conversation.status,
          created_at: conversation.createdAt,
          updated_at: conversation.updatedAt,
        })
        .execute();
      return conversation;
    },

    async get(id: string): Promise<Conversation | null> {
      const row = await db.selectFrom('conversations').selectAll().where('id', '=', id).executeTakeFirst();
      return row ? conversationToDomain(row) : null;
    },

    async list(filter?: { kind?: ConversationKind }): Promise<Conversation[]> {
      let query = db.selectFrom('conversations').selectAll().orderBy('updated_at', 'desc');
      if (filter?.kind) {
        query = query.where('kind', '=', filter.kind);
      }
      const rows = await query.execute();
      return rows.map(conversationToDomain);
    },

    async listMessages(conversationId: string): Promise<Message[]> {
      const rows = await db
        .selectFrom('messages')
        .selectAll()
        .where('conversation_id', '=', conversationId)
        .orderBy('created_at', 'asc')
        .execute();
      return rows.map(messageToDomain);
    },

    async addMessage(message: Message): Promise<Message> {
      await db
        .insertInto('messages')
        .values({
          id: message.id,
          conversation_id: message.conversationId,
          role: message.role,
          text: message.text,
          cards_json: JSON.stringify(message.cards),
          attachments_json: JSON.stringify(message.attachments),
          tool_calls_json: message.agentRun ? JSON.stringify(message.agentRun) : null,
          created_at: message.createdAt,
        })
        .execute();

      await db
        .updateTable('conversations')
        .set({ updated_at: message.createdAt })
        .where('id', '=', message.conversationId)
        .execute();

      return message;
    },

    async setStatus(id: string, status: ConversationStatus): Promise<Conversation> {
      const now = new Date().toISOString();
      const updated = await db
        .updateTable('conversations')
        .set({
          status,
          updated_at: now,
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        throw new Error(`Conversation ${id} not found`);
      }

      return conversationToDomain(updated);
    },
  };
}
