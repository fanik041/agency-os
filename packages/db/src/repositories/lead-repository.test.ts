import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase client before importing the repo
vi.mock('../client', () => {
  const builder: any = {}
  const chain = (val: unknown) => {
    builder.from = vi.fn(() => builder)
    builder.update = vi.fn(() => builder)
    builder.in = vi.fn(() => builder)
    builder.select = vi.fn(() => builder)
    builder.order = vi.fn(() => builder)
    builder.range = vi.fn(() => Promise.resolve(val))
    builder.is = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.ilike = vi.fn(() => builder)
    builder.or = vi.fn(() => builder)
    builder.lte = vi.fn(() => builder)
    builder.gte = vi.fn(() => builder)
    return builder
  }
  return { supabaseAdmin: chain({ data: [], count: 0, error: null }) }
})

import { LeadRepository } from './lead-repository'
import { supabaseAdmin } from '../client'

describe('LeadRepository.softDelete', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls update with deleted_at timestamp and in(id, ids)', async () => {
    const repo = new LeadRepository()
    await repo.softDelete(['id-1', 'id-2'])
    expect((supabaseAdmin as any).from).toHaveBeenCalledWith('leads')
    const updateCall = (supabaseAdmin as any).update.mock.calls[0][0]
    expect(updateCall.deleted_at).toBeTruthy()
    expect((supabaseAdmin as any).in).toHaveBeenCalledWith('id', ['id-1', 'id-2'])
  })
})

describe('LeadRepository.restore', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls update with deleted_at: null and in(id, ids)', async () => {
    const repo = new LeadRepository()
    await repo.restore(['id-1'])
    const updateCall = (supabaseAdmin as any).update.mock.calls[0][0]
    expect(updateCall.deleted_at).toBeNull()
    expect((supabaseAdmin as any).in).toHaveBeenCalledWith('id', ['id-1'])
  })
})

describe('LeadRepository.listForCrm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters deleted_at IS NULL by default', async () => {
    const repo = new LeadRepository()
    await repo.listForCrm({ page: 1, pageSize: 100, includeDeleted: false })
    expect((supabaseAdmin as any).is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('does NOT filter deleted_at when includeDeleted=true', async () => {
    const repo = new LeadRepository()
    await repo.listForCrm({ page: 1, pageSize: 100, includeDeleted: true })
    expect((supabaseAdmin as any).is).not.toHaveBeenCalledWith('deleted_at', null)
  })
})
