import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Falta la variable de entorno DATABASE_URL');
}

export const sql = neon(databaseUrl);
