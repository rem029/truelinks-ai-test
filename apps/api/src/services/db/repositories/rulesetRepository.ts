import type { Kysely } from 'kysely';
import { Ruleset } from '@truelinks/shared';
import type { Database, RulesetsTable } from '../schema.js';

export interface RulesetRepository {
  getLatest(): Promise<Ruleset | null>;
  get(version: string): Promise<Ruleset | null>;
  create(ruleset: Ruleset): Promise<Ruleset>;
}

function toDomain(row: RulesetsTable): Ruleset {
  return Ruleset.parse({
    name: row.name,
    version: row.version,
    rules: JSON.parse(row.rules_json),
  });
}

export function createRulesetRepository(db: Kysely<Database>): RulesetRepository {
  return {
    async getLatest(): Promise<Ruleset | null> {
      const row = await db
        .selectFrom('rulesets')
        .selectAll()
        .orderBy('created_at', 'desc')
        .orderBy('version', 'desc')
        .executeTakeFirst();

      return row ? toDomain(row) : null;
    },

    async get(version: string): Promise<Ruleset | null> {
      const row = await db
        .selectFrom('rulesets')
        .selectAll()
        .where('version', '=', version)
        .executeTakeFirst();

      return row ? toDomain(row) : null;
    },

    async create(ruleset: Ruleset): Promise<Ruleset> {
      await db
        .insertInto('rulesets')
        .values({
          version: ruleset.version,
          name: ruleset.name,
          rules_json: JSON.stringify(ruleset.rules),
          created_at: new Date().toISOString(),
        })
        .execute();

      return ruleset;
    },
  };
}
