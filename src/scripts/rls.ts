import 'dotenv/config';

import * as fs from 'fs/promises';
import { cwd } from 'node:process';
import * as path from 'path';
import { Client } from 'pg';

async function main() {
    const rootDir = cwd();
    const rlsFilePath = path.join(rootDir, 'scripts', 'rls.sql');
    const rlsSql = await fs.readFile(rlsFilePath, 'utf-8');

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        await client.query(rlsSql);
        console.log('RLS policies applied successfully.');
    } catch (error) {
        console.error('Error applying RLS policies:', error);
    } finally {
        await client.end();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
