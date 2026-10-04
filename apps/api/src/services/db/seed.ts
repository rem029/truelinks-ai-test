import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { Kysely } from 'kysely';
import { Rule, UnitStatus } from '@truelinks/shared';
import { REPO_ROOT } from '../../env.js';
import type { Database, UnitsTable } from './schema.js';

const rawUnitSchema = z.object({
  unit_id: z.string(),
  label: z.string(),
  type: z.string(),
  area_sqm: z.number(),
  parking_bay: z.string(),
  status: UnitStatus,
});

const rawBuildingSchema = z.object({
  building_id: z.string(),
  name: z.string(),
  units: z.array(rawUnitSchema),
});

const rawPropertySchema = z.object({
  property_id: z.string(),
  name: z.string(),
  buildings: z.array(rawBuildingSchema),
});

const rawUnitsFileSchema = z.object({
  properties: z.array(rawPropertySchema),
});

const rawRulesetFileSchema = z.object({
  ruleset_name: z.string(),
  version: z.string(),
  rules: z.array(Rule),
});

export interface SeedResult {
  unitsInserted: number;
  rulesetInserted: number;
}

export async function seed(db: Kysely<Database>): Promise<SeedResult> {
  const unitsPath = resolve(REPO_ROOT, 'data/units.json');
  const rulesetPath = resolve(REPO_ROOT, 'data/owner_ruleset.json');

  const unitsContent = JSON.parse(readFileSync(unitsPath, 'utf-8'));
  const rulesetContent = JSON.parse(readFileSync(rulesetPath, 'utf-8'));

  const parsedUnitsFile = rawUnitsFileSchema.parse(unitsContent);
  const parsedRulesetFile = rawRulesetFileSchema.parse(rulesetContent);

  const flattenedUnits: UnitsTable[] = [];
  for (const property of parsedUnitsFile.properties) {
    for (const building of property.buildings) {
      for (const unit of building.units) {
        flattenedUnits.push({
          unit_id: unit.unit_id,
          label: unit.label,
          type: unit.type,
          area_sqm: unit.area_sqm,
          parking_bay: unit.parking_bay,
          status: unit.status,
          building_id: building.building_id,
          building_name: building.name,
          property_id: property.property_id,
          property_name: property.name,
        });
      }
    }
  }

  let unitsInserted = 0;
  if (flattenedUnits.length > 0) {
    const result = await db
      .insertInto('units')
      .values(flattenedUnits)
      .onConflict((oc) => oc.column('unit_id').doNothing())
      .executeTakeFirst();
    unitsInserted = Number(result?.numInsertedOrUpdatedRows ?? 0n);
  }

  const rulesetResult = await db
    .insertInto('rulesets')
    .values({
      version: parsedRulesetFile.version,
      name: parsedRulesetFile.ruleset_name,
      rules_json: JSON.stringify(parsedRulesetFile.rules),
      created_at: new Date().toISOString(),
    })
    .onConflict((oc) => oc.column('version').doNothing())
    .executeTakeFirst();
  const rulesetInserted = Number(rulesetResult?.numInsertedOrUpdatedRows ?? 0n);

  console.log(`Seeded ${unitsInserted} units, ${rulesetInserted} rulesets`);

  return { unitsInserted, rulesetInserted };
}
