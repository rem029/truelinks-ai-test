import type { Kysely } from 'kysely';
import {
  Conversation,
  type ConversationStatus,
  Message,
} from '@truelinks/shared';
import type { Database, ConversationsTable, MessagesTable } from '../schema.js';

export interface ConversationRepository {
  create(conversation: Conversation): Promise<Conversation>;
  get(id: string): Promise<Conversation | null>;
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
          created_at: message.createdAt,
        })
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
