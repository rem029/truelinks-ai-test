import type { Kysely } from 'kysely';
import { Unit, type UnitStatus } from '@truelinks/shared';
import type { Database, UnitsTable } from '../schema.js';

export interface UnitRepository {
  list(): Promise<Unit[]>;
  get(unitId: string): Promise<Unit | null>;
  setStatus(unitId: string, status: UnitStatus): Promise<Unit>;
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
