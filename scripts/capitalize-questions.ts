import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const client = await pool.connect()
  try {
    const result = await client.query(`
      UPDATE qa_pairs
      SET question = UPPER(LEFT(question, 1)) || SUBSTRING(question FROM 2),
          meta_title = UPPER(LEFT(question, 1)) || SUBSTRING(question FROM 2) || ' — AI Torah'
      WHERE LEFT(question, 1) <> UPPER(LEFT(question, 1))
      RETURNING id, question
    `)

    console.log(`Updated ${result.rowCount} questions:`)
    for (const row of result.rows) {
      console.log(`  ${row.id}: ${row.question}`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
