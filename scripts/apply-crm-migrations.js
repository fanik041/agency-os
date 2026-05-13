#!/usr/bin/env node
/**
 * One-shot: applies the two CRM-tab migrations against the Postgres at DATABASE_URL.
 *  - 20260513000000_add_leads_deleted_at.sql  (additive)
 *  - 20260513000001_drop_attio_columns.sql    (destructive)
 *
 * Reads DATABASE_URL from .env.local. Each migration runs in its own transaction.
 * Pre/post checks print column state so you can verify what changed.
 */

const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('ERROR: DATABASE_URL not set in .env.local')
  process.exit(1)
}

const { Client } = require('pg')

const m1Path = path.join(__dirname, '../supabase/migrations/20260513000000_add_leads_deleted_at.sql')
const m2Path = path.join(__dirname, '../supabase/migrations/20260513000001_drop_attio_columns.sql')

async function leadsColumns(client) {
  const r = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'leads' AND table_schema = 'public'
    ORDER BY ordinal_position
  `)
  return r.rows.map(r => r.column_name)
}

async function rowCount(client) {
  const r = await client.query(`SELECT count(*)::int AS n FROM leads`)
  return r.rows[0].n
}

async function applyInTx(client, sql, label) {
  console.log(`\n--- ${label} ---`)
  await client.query('BEGIN')
  try {
    await client.query(sql)
    await client.query('COMMIT')
    console.log(`✓ ${label} applied`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

async function main() {
  // Supabase pooler requires SSL.
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected.')

  const beforeCols = await leadsColumns(client)
  const beforeCount = await rowCount(client)
  console.log(`leads row count: ${beforeCount}`)
  console.log(`leads has deleted_at?      ${beforeCols.includes('deleted_at')}`)
  console.log(`leads has attio_id?        ${beforeCols.includes('attio_id')}`)
  console.log(`leads has attio_sync_status? ${beforeCols.includes('attio_sync_status')}`)
  console.log(`leads has attio_synced_at?   ${beforeCols.includes('attio_synced_at')}`)

  const m1 = fs.readFileSync(m1Path, 'utf8')
  const m2 = fs.readFileSync(m2Path, 'utf8')

  await applyInTx(client, m1, 'Migration 1: add deleted_at')
  await applyInTx(client, m2, 'Migration 2: drop attio columns')

  const afterCols = await leadsColumns(client)
  const afterCount = await rowCount(client)
  console.log(`\nleads row count after: ${afterCount} (delta ${afterCount - beforeCount})`)
  console.log(`leads has deleted_at?      ${afterCols.includes('deleted_at')}  ${afterCols.includes('deleted_at') ? '✓' : '✗ EXPECTED true'}`)
  console.log(`leads has attio_id?        ${afterCols.includes('attio_id')}  ${!afterCols.includes('attio_id') ? '✓' : '✗ EXPECTED false'}`)
  console.log(`leads has attio_sync_status? ${afterCols.includes('attio_sync_status')}  ${!afterCols.includes('attio_sync_status') ? '✓' : '✗ EXPECTED false'}`)
  console.log(`leads has attio_synced_at?   ${afterCols.includes('attio_synced_at')}  ${!afterCols.includes('attio_synced_at') ? '✓' : '✗ EXPECTED false'}`)

  await client.end()
}

main().catch(err => {
  console.error('FAILED:', err.message)
  console.error(err)
  process.exit(1)
})
