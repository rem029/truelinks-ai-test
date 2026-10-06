import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { Kysely } from 'kysely';
import { Rule, Ruleset, Unit, UnitStatus } from '@truelinks/shared';
import { REPO_ROOT } from '../env.ts';
import type { Database, UnitsTable } from './schema.ts';

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

export function loadUnits(): Unit[] {
  const unitsPath = resolve(REPO_ROOT, 'data/units.json');
  const unitsContent = JSON.parse(readFileSync(unitsPath, 'utf-8'));
  const parsedUnitsFile = rawUnitsFileSchema.parse(unitsContent);

  const units: Unit[] = [];
  for (const property of parsedUnitsFile.properties) {
    for (const building of property.buildings) {
      for (const unit of building.units) {
        units.push(
          Unit.parse({
            unitId: unit.unit_id,
            label: unit.label,
            type: unit.type,
            areaSqm: unit.area_sqm,
            parkingBay: unit.parking_bay,
            status: unit.status,
            buildingId: building.building_id,
            buildingName: building.name,
            propertyId: property.property_id,
            propertyName: property.name,
          })
        );
      }
    }
  }
  return units;
}

export function loadRuleset(): Ruleset {
  const rulesetPath = resolve(REPO_ROOT, 'data/owner_ruleset.json');
  const rulesetContent = JSON.parse(readFileSync(rulesetPath, 'utf-8'));
  const parsedRulesetFile = rawRulesetFileSchema.parse(rulesetContent);

  return Ruleset.parse({
    name: parsedRulesetFile.ruleset_name,
    version: parsedRulesetFile.version,
    rules: parsedRulesetFile.rules,
  });
}

export interface SeedResult {
  unitsInserted: number;
  rulesetInserted: number;
}

export async function seed(db: Kysely<Database>): Promise<SeedResult> {
  const domainUnits = loadUnits();
  const domainRuleset = loadRuleset();

  const flattenedUnits: UnitsTable[] = domainUnits.map((unit) => ({
    unit_id: unit.unitId,
    label: unit.label,
    type: unit.type,
    area_sqm: unit.areaSqm,
    parking_bay: unit.parkingBay,
    status: unit.status,
    building_id: unit.buildingId,
    building_name: unit.buildingName,
    property_id: unit.propertyId,
    property_name: unit.propertyName,
  }));

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
      version: domainRuleset.version,
      name: domainRuleset.name,
      rules_json: JSON.stringify(domainRuleset.rules),
      created_at: new Date().toISOString(),
      change_note: '',
    })
    .onConflict((oc) => oc.column('version').doNothing())
    .executeTakeFirst();
  const rulesetInserted = Number(rulesetResult?.numInsertedOrUpdatedRows ?? 0n);

  console.log(`Seeded ${unitsInserted} units, ${rulesetInserted} rulesets`);

  return { unitsInserted, rulesetInserted };
}
