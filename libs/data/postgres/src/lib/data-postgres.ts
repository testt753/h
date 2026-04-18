import { Pool } from 'pg';

export function createPgPool(databaseUrl?: string): Pool | undefined {
  if (!databaseUrl) {
    return undefined;
  }

  return new Pool({ connectionString: databaseUrl });
}
