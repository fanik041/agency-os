#!/usr/bin/env npx tsx
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { updateClient, getClient } from '@agency-os/db'
import type { GenerateSiteInput, NicheContent, DeployResult } from './types'
import { mergeConfig } from './merge-config'
import { deployToVercel } from './deploy-vercel'

const TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates')

function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue
      copyDirSync(srcPath, destPath)
    } else if (entry.name !== '.gitkeep') {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

export async function generateSite(input: GenerateSiteInput): Promise<DeployResult> {
  // 1. Load niche content
  const nicheDir = path.join(TEMPLATES_DIR, input.niche)
  const contentPath = path.join(nicheDir, 'content.json')
  if (!fs.existsSync(contentPath)) {
    throw new Error(`No template found for niche: ${input.niche}`)
  }
  const nicheContent: NicheContent = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))

  // 2. Merge config
  const siteConfig = mergeConfig(nicheContent, input)

  // 3. Copy _base to temp dir
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-gen-'))
  const baseDir = path.join(TEMPLATES_DIR, '_base')
  copyDirSync(baseDir, tmpDir)

  try {
    // 4. Write site-config.json
    fs.writeFileSync(path.join(tmpDir, 'site-config.json'), JSON.stringify(siteConfig, null, 2))

    // 5. Deploy to Vercel
    const projectName = input.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    const envVars: Record<string, string> = {}
    if (process.env.RESEND_API_KEY) {
      envVars.RESEND_API_KEY = process.env.RESEND_API_KEY
    }

    const result = await deployToVercel(tmpDir, projectName, envVars)

    // 6. Update client in Supabase
    if (result.status === 'READY') {
      await updateClient(input.clientId, {
        site_url: result.url,
        vercel_project_id: result.projectId,
        site_status: 'live',
      })
    }

    return result
  } finally {
    // 7. Cleanup temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

// 8. CLI entry point
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help')) {
    console.log(`Usage: generate-site --client-id <id> --niche <niche> --business-name <name> --phone <phone> --email <email> --contact-email <email> --city <city> --state <state> --address <address> [options]

Options:
  --google-review-url <url>    Google review URL
  --services <s1,s2,...>       Comma-separated services
  --areas <a1,a2,...>          Comma-separated service areas
  --primary-color <hex>        Primary brand color (hex)
  --help                       Show this help
`)
    process.exit(0)
  }

  function getArg(name: string): string | undefined {
    const idx = args.indexOf(`--${name}`)
    return idx !== -1 ? args[idx + 1] : undefined
  }

  const clientId = getArg('client-id')
  const niche = getArg('niche')
  const businessName = getArg('business-name')
  const phone = getArg('phone')
  const email = getArg('email')
  const contactEmail = getArg('contact-email')
  const city = getArg('city')
  const state = getArg('state')
  const address = getArg('address')

  if (!clientId || !niche || !businessName || !phone || !email || !contactEmail || !city || !state || !address) {
    console.error('Missing required arguments. Run with --help for usage.')
    process.exit(1)
  }

  const input: GenerateSiteInput = {
    clientId,
    niche,
    businessName,
    phone,
    email,
    contactEmail,
    city,
    state,
    address,
    googleReviewUrl: getArg('google-review-url'),
    services: getArg('services')?.split(',').map((s) => s.trim()),
    areas: getArg('areas')?.split(',').map((a) => a.trim()),
    primaryColor: getArg('primary-color'),
  }

  console.log(`Generating site for "${businessName}" (${niche})...`)
  const result = await generateSite(input)
  console.log(`\nDeployment ${result.status}!`)
  console.log(`URL: ${result.url}`)
  console.log(`Project ID: ${result.projectId}`)
  console.log(`Deployment ID: ${result.deploymentId}`)
}

// Run CLI when executed directly
const isDirectRun = process.argv[1]?.includes('generate')
if (isDirectRun) {
  main().catch((err) => {
    console.error('Error:', err.message)
    process.exit(1)
  })
}
