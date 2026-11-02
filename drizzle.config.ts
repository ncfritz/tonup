import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/services/db/schema.ts',
  out: './src/services/db/migrations',
});
