import type { Kysely } from 'kysely';
import { Unit, type UnitStatus } from '@truelinks/shared';
import type { Database, UnitsTable } from '../schema.ts';

export interface UnitRepository {
  list(): Promise<Unit[]>;
  get(unitId: string): Promise<Unit | null>;
  setStatus(unitId: string, status: UnitStatus): Promise<Unit>;
  create(unit: Unit): Promise<Unit>;
}

function toDomain(row: UnitsTable): Unit {
  return Unit.parse({
    unitId: row.unit_id,
    label: row.label,
    type: row.type,
    areaSqm: row.area_sqm,
    parkingBay: row.parking_bay,
    status: row.status,
    buildingId: row.building_id,
    buildingName: row.building_name,
    propertyId: row.property_id,
    propertyName: row.property_name,
  });
}

export function createUnitRepository(db: Kysely<Database>): UnitRepository {
  return {
    async list(): Promise<Unit[]> {
      const rows = await db.selectFrom('units').selectAll().orderBy('unit_id', 'asc').execute();
      return rows.map(toDomain);
    },

    async get(unitId: string): Promise<Unit | null> {
      const row = await db.selectFrom('units').selectAll().where('unit_id', '=', unitId).executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async create(unit: Unit): Promise<Unit> {
      const row = await db
        .insertInto('units')
        .values({
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
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return toDomain(row);
    },

    async setStatus(unitId: string, status: UnitStatus): Promise<Unit> {
      const updated = await db
        .updateTable('units')
        .set({ status })
        .where('unit_id', '=', unitId)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        throw new Error(`Unit ${unitId} not found`);
      }

      return toDomain(updated);
    },
  };
}
