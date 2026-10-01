import { openD1, type D1Binding } from '../../src/lib/server/database/d1.ts';
import { storageContract } from './storage-contract.ts';

export default {
  async fetch(_request: Request, env: { DB: D1Binding }) {
    const database = openD1(env.DB);
    try { return Response.json({ passed: await storageContract(database) }); }
    finally { await database.close(); }
  }
};
