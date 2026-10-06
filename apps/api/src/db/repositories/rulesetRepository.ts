import type { Kysely } from 'kysely';
import { Ruleset, RulesetVersion } from '@truelinks/shared';
import type { Database, RulesetsTable } from '../schema.ts';

export interface RulesetRepository {
  getLatest(): Promise<Ruleset | null>;
  get(version: string): Promise<Ruleset | null>;
  // Every saved version, newest first
  listVersions(): Promise<RulesetVersion[]>;
  create(ruleset: Ruleset, changeNote: string): Promise<Ruleset>;
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

    async listVersions(): Promise<RulesetVersion[]> {
      const rows = await db
        .selectFrom('rulesets')
        .selectAll()
        .orderBy('created_at', 'desc')
        .orderBy('version', 'desc')
        .execute();
      return rows.map((row) =>
        RulesetVersion.parse({ ...toDomain(row), createdAt: row.created_at, changeNote: row.change_note })
      );
    },

    async create(ruleset: Ruleset, changeNote: string): Promise<Ruleset> {
      await db
        .insertInto('rulesets')
        .values({
          version: ruleset.version,
          name: ruleset.name,
          rules_json: JSON.stringify(ruleset.rules),
          created_at: new Date().toISOString(),
          change_note: changeNote,
        })
        .execute();

      return ruleset;
    },
  };
}
