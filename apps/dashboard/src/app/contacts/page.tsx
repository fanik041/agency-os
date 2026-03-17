export const dynamic = 'force-dynamic'

import { getAllContacts, getResearchJobs, getAllLeadsMinimal } from '@agency-os/db'
import type { ResearchJob } from '@agency-os/db'
import { ContactsTable } from '@/components/contacts/contacts-table'
import { ResearchProgress } from '@/components/contacts/research-progress'

export default async function ContactsPage() {
  const [{ data: contacts }, { data: researchJobs }, { data: leads }] = await Promise.all([
    getAllContacts(),
    getResearchJobs(),
    getAllLeadsMinimal(),
  ])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Contacts</h1>
      <ResearchProgress initialJobs={(researchJobs as ResearchJob[]) ?? []} />
      <ContactsTable
        contacts={contacts ?? []}
        leads={leads ?? []}
      />
    </div>
  )
}
