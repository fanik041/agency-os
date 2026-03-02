const fs = require('fs')
const path = require('path')

// Load .env.local
const envPath = path.join(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}

async function pushSchema() {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/schema.sql'), 'utf8')

  // Split into individual statements and execute each
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements to execute`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const firstLine = stmt.split('\n').find((l) => l.trim().length > 0 && !l.trim().startsWith('--'))
    console.log(`[${i + 1}/${statements.length}] Executing: ${firstLine?.trim().substring(0, 60)}...`)

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ query: stmt }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.warn(`  Warning: ${res.status} - ${text}`)
    }
  }

  console.log('Schema push complete!')
}

pushSchema().catch(console.error)
