import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/** Applies ./drizzle/*.sql. Run before the API starts on a fresh database. */
const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = postgres(url, { max: 1 })
await migrate(drizzle(sql), { migrationsFolder: 'drizzle' })
await sql.end()
console.log('migrations applied')
