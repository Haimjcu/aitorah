import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

async function main() {
  const result = await db.execute(sql`
    UPDATE qa_pairs
    SET question = UPPER(LEFT(question, 1)) || SUBSTRING(question FROM 2),
        meta_title = UPPER(LEFT(question, 1)) || SUBSTRING(question FROM 2) || ' — AI Torah'
    WHERE LEFT(question, 1) <> UPPER(LEFT(question, 1))
    RETURNING id, question
  `)

  console.log(`Updated ${result.length} questions:`)
  for (const row of result) {
    console.log(`  ${(row as Record<string, string>).id}: ${(row as Record<string, string>).question}`)
  }

  await pool.end()
}

main().catch((err) => { console.error(err); process.exit(1) })
