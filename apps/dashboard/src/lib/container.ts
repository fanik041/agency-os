import {
  LeadRepository, LeadSourceRepository, CallLogRepository,
  ScrapeJobRepository, ClientRepository, ContactRepository,
  ResearchJobRepository, RevenueEventRepository,
} from '@agency-os/db'
import { LeadService } from '@/services/lead-service'
import { ScraperService } from '@/services/scraper-service'

interface Container {
  // Repositories
  leadRepo: LeadRepository
  callLogRepo: CallLogRepository
  clientRepo: ClientRepository
  contactRepo: ContactRepository
  researchJobRepo: ResearchJobRepository
  revenueRepo: RevenueEventRepository
  // Services
  leadService: LeadService
  scraperService: ScraperService
}

let _container: Container | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function createContainer(): Container {
  const leadRepo = new LeadRepository()
  const sourceRepo = new LeadSourceRepository()
  const callLogRepo = new CallLogRepository()
  const jobRepo = new ScrapeJobRepository()
  const clientRepo = new ClientRepository()
  const contactRepo = new ContactRepository()
  const researchJobRepo = new ResearchJobRepository()
  const revenueRepo = new RevenueEventRepository()

  const leadService = new LeadService(leadRepo, sourceRepo)
  const scraperService = new ScraperService(jobRepo, requireEnv('SCRAPER_SERVICE_URL'), process.env.SCRAPER_SECRET)

  return {
    leadRepo, callLogRepo, clientRepo, contactRepo, researchJobRepo, revenueRepo,
    leadService, scraperService,
  }
}

export const container = new Proxy({} as Container, {
  get(_, prop: string) {
    if (!_container) _container = createContainer()
    return (_container as unknown as Record<string, unknown>)[prop]
  },
})
