import type { Kysely } from 'kysely';
import type { Database } from '../schema.ts';
import { createUnitRepository, type UnitRepository } from './unitRepository.ts';
import { createRulesetRepository, type RulesetRepository } from './rulesetRepository.ts';
import { createLeaseRepository, type LeaseRepository } from './leaseRepository.ts';
import { createConversationRepository, type ConversationRepository } from './conversationRepository.ts';
import { createIssueRepository, type IssueRepository } from './issueRepository.ts';
import { createDocumentRepository, type DocumentRepository } from './documentRepository.ts';

export * from './unitRepository.ts';
export * from './rulesetRepository.ts';
export * from './leaseRepository.ts';
export * from './conversationRepository.ts';
export * from './issueRepository.ts';
export * from './documentRepository.ts';

export interface Repositories {
  units: UnitRepository;
  rulesets: RulesetRepository;
  leases: LeaseRepository;
  conversations: ConversationRepository;
  issues: IssueRepository;
  documents: DocumentRepository;
}

export function createRepositories(db: Kysely<Database>): Repositories {
  return {
    units: createUnitRepository(db),
    rulesets: createRulesetRepository(db),
    leases: createLeaseRepository(db),
    conversations: createConversationRepository(db),
    issues: createIssueRepository(db),
    documents: createDocumentRepository(db),
  };
}

