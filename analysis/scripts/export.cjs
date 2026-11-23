// Read-only export of chats, anonymized. Usage: DATABASE_URL=... node analysis/scripts/export.cjs
const { Client } = require('pg'); const fs = require('fs'); const crypto = require('crypto');
const salt = crypto.randomBytes(16).toString('hex'); // per-export salt, not stored
const h = (v) => v ? crypto.createHash('sha256').update(salt + v).digest('hex').slice(0, 12) : null;
const out = 'analysis/data';
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  await c.connect();
  await c.query('SET default_transaction_read_only = on');
  const stats = {};
  for (const q of ['select count(*)::int n from study_sessions', 'select count(*)::int n from qa_pairs', 'select count(*)::int n from users',
    'select min(created_at) a, max(updated_at) b from study_sessions', 'select min(created_at) a, max(created_at) b from qa_pairs',
    'select status, count(*)::int n from qa_pairs group by 1', 'select language, count(*)::int n from qa_pairs group by 1'])
    stats[q] = (await c.query(q)).rows;
  const ss = (await c.query('select id, user_id, title, messages, created_at, updated_at from study_sessions order by created_at')).rows;
  fs.writeFileSync(`${out}/study_sessions.jsonl`, ss.map(r => { let m; try { m = JSON.parse(r.messages) } catch { m = r.messages }
    return JSON.stringify({ id: r.id, user: h(r.user_id), title: r.title, messages: m, created_at: r.created_at, updated_at: r.updated_at }) }).join('\n'));
  const qa = (await c.query('select id, question, answer_markdown, source_refs, topics, categories, language, status, view_count, created_at from qa_pairs order by created_at')).rows;
  fs.writeFileSync(`${out}/qa_pairs.jsonl`, qa.map(r => JSON.stringify(r)).join('\n'));
  fs.writeFileSync(`${out}/stats.json`, JSON.stringify(stats, null, 2));
  console.log(JSON.stringify(stats, null, 1)); console.log('exported', ss.length, 'sessions,', qa.length, 'qa_pairs');
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1) });
