import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!

// Use transaction pool mode on Neon (port 6543) — prepare must be false
// Limit connections to avoid exhausting the pooler
const client = postgres(connectionString, {
  prepare: false,
  max: 3,
  idle_timeout: 20,
  max_lifetime: 60 * 5,
})

export const db = drizzle(client, { schema })
