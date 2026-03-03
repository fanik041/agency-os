import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import type { DeployResult } from './types'

interface FileEntry {
  file: string
  sha: string
  size: number
  data: string // base64
}

const VERCEL_API = 'https://api.vercel.com'

function collectFiles(dir: string, base: string = dir): FileEntry[] {
  const entries: FileEntry[] = []
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name)
    if (item.isDirectory()) {
      if (item.name === 'node_modules' || item.name === '.next' || item.name === '.git') continue
      entries.push(...collectFiles(fullPath, base))
    } else {
      const content = fs.readFileSync(fullPath)
      const sha = crypto.createHash('sha1').update(content).digest('hex')
      entries.push({
        file: path.relative(base, fullPath),
        sha,
        size: content.length,
        data: content.toString('base64'),
      })
    }
  }
  return entries
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function vercelFetch(endpoint: string, options: RequestInit & { token: string; teamId?: string }): Promise<any> {
  const { token, teamId, ...fetchOpts } = options
  const url = new URL(endpoint, VERCEL_API)
  if (teamId) url.searchParams.set('teamId', teamId)

  const res = await fetch(url.toString(), {
    ...fetchOpts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...fetchOpts.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Vercel API error ${res.status}: ${body}`)
  }

  return res.json()
}

async function pollDeployment(deploymentId: string, token: string, teamId?: string): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const data = await vercelFetch(`/v13/deployments/${deploymentId}`, {
      method: 'GET',
      token,
      teamId,
    })

    if (data.readyState === 'READY') return 'READY'
    if (data.readyState === 'ERROR') return 'ERROR'

    await new Promise((r) => setTimeout(r, 5000))
  }

  throw new Error('Deployment timed out after 5 minutes')
}

export async function deployToVercel(
  projectDir: string,
  projectName: string,
  envVars?: Record<string, string>
): Promise<DeployResult> {
  const token = process.env.VERCEL_TOKEN
  const teamId = process.env.VERCEL_TEAM_ID
  if (!token) throw new Error('VERCEL_TOKEN env var is required')

  const files = collectFiles(projectDir)

  const deployPayload: Record<string, unknown> = {
    name: projectName,
    files: files.map((f) => ({
      file: f.file,
      sha: f.sha,
      size: f.size,
      data: f.data,
      encoding: 'base64',
    })),
    projectSettings: {
      framework: 'nextjs',
      installCommand: 'npm install',
      buildCommand: 'npm run build',
      outputDirectory: '.next',
    },
    target: 'production',
  }

  if (envVars && Object.keys(envVars).length > 0) {
    deployPayload.env = envVars
  }

  const deployment = await vercelFetch('/v13/deployments', {
    method: 'POST',
    token,
    teamId,
    body: JSON.stringify(deployPayload),
  })

  const status = await pollDeployment(deployment.id, token, teamId)

  return {
    url: `https://${deployment.url}`,
    projectId: deployment.projectId,
    deploymentId: deployment.id,
    status: status as DeployResult['status'],
  }
}
