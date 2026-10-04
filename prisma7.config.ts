import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// The CLI (migrate/studio) needs the DIRECT connection (Supabase port 5432):
// migrations can't run through the transaction pooler. The running server uses
// the pooled DATABASE_URL instead (see src/database/prisma.service.ts).
// process.env, not env(), so `prisma generate` works without any URL set.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DIRECT_URL'],
  },
});
