import type { Kysely } from 'kysely';
import type { Database } from '../schema.js';
import { createUnitRepository, type UnitRepository } from './unitRepository.js';
import { createRulesetRepository, type RulesetRepository } from './rulesetRepository.js';
import { createLeaseRepository, type LeaseRepository } from './leaseRepository.js';
import { createConversationRepository, type ConversationRepository } from './conversationRepository.js';
import { createIssueRepository, type IssueRepository } from './issueRepository.js';

export * from './unitRepository.js';
export * from './rulesetRepository.js';
export * from './leaseRepository.js';
export * from './conversationRepository.js';
export * from './issueRepository.js';

export interface Repositories {
  units: UnitRepository;
  rulesets: RulesetRepository;
  leases: LeaseRepository;
  conversations: ConversationRepository;
  issues: IssueRepository;
}

export function createRepositories(db: Kysely<Database>): Repositories {
  return {
    units: createUnitRepository(db),
    rulesets: createRulesetRepository(db),
    leases: createLeaseRepository(db),
    conversations: createConversationRepository(db),
    issues: createIssueRepository(db),
  };
}
