'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { container } from '@/lib/container'
import { triggerScrapeSchema, updateJobStatusSchema, ScrapeJobStatus } from '@agency-os/db'

export async function triggerScrape(formData: FormData) {
  await requireAuth()

  const parsed = triggerScrapeSchema.parse({
    niches: (formData.get('niches') as string).split(',').map(n => n.trim()).filter(Boolean),
    location: formData.get('location') as string,
    maxPerNiche: parseInt(formData.get('maxPerNiche') as string, 10) || 20,
    withEmails: formData.get('withEmails') === 'on',
  })

  const job = await container.scraperService.createJob({ ...parsed, city: parsed.location })

  try {
    const result = await container.scraperService.triggerScrape(parsed)
    revalidatePath('/scraper')
    return result
  } catch (err) {
    await container.scraperService.updateJobStatus(job.id, ScrapeJobStatus.Failed)
    revalidatePath('/scraper')
    throw err
  }
}

export async function updateJobStatusAction(jobId: string, status: 'done' | 'failed') {
  await requireAuth()
  const parsed = updateJobStatusSchema.parse({ jobId, status })
  await container.scraperService.updateJobStatus(parsed.jobId, parsed.status as ScrapeJobStatus)
  revalidatePath('/scraper')
}
