import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!

// Transaction pool mode (port 6543) — prepare must be false
// Pool size 10 balances local dev (Next.js + Inngest steps) with Supavisor limits
const client = postgres(connectionString, {
  prepare: false,
  max: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 5,
})

export const db = drizzle(client, { schema })
