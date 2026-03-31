import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../../../.env.local') })

import express from 'express'
import {
  createScrapeJob, updateScrapeJob, getScrapeJobs, upsertLead,
  getLeadById, createResearchJob, updateResearchJob, upsertContact,
  createLeadSource, updateLeadSourceCount,
  ScrapeJobStatus, LeadStatus, AttioSyncStatus, LeadSourceType,
  ResearchJobStatus, ContactSource,
  getUnscoredLeads, updateLeadScoring, updateLeadStatus,
} from '@agency-os/db'
import { scrapeGoogleMaps, closeBrowser } from './scraper'
import { enrichBusiness } from './enricher'
import { searchDecisionMakers } from './researcher'
import { analyzeWebsite, isValidUrl } from './analyzer'
import { scoreLead } from './scorer'
import { ScoringLogType } from './types/scoring'

const app = express()
app.use(express.json())

// ── Auth middleware ──────────────────────────────────────────────
const SCRAPER_SECRET = process.env.SCRAPER_SECRET

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!SCRAPER_SECRET) return next() // No secret configured = open (dev mode)
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token !== SCRAPER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// ── Health check ────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({
  service: 'agency-os-scraper',
  status: 'ok',
  endpoints: {
    'GET /health': 'Health check',
    'GET /jobs': 'List recent scrape jobs',
    'GET /scrape': 'Web UI — fill form, watch live logs, download CSV',
    'POST /scrape': 'Start a new scrape job — body: { niches: string[], location: string, maxPerNiche?: number, withEmails?: boolean }',
    'POST /scrape/stream': 'SSE stream — same body as POST /scrape, returns real-time events',
    'POST /research': 'Start decision-maker research — body: { leadIds: string[] }',
    'POST /score/stream': 'SSE stream — score leads with AI, returns real-time events',
    'POST /analyze': 'Analyze a website for 13 signals — body: { url: string }',
  },
}))
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// ── POST /scrape ────────────────────────────────────────────────
// Starts a scraping job. Returns immediately with the job ID.
// Scraping runs in the background and updates Supabase in real time.
app.post('/scrape', authMiddleware, async (req, res) => {
  const { niches, location, city, maxPerNiche = 20, withEmails = false } = req.body

  if (!niches?.length || !location) {
    return res.status(400).json({ error: 'niches (array) and location (string) are required' })
  }

  // Create job in Supabase
  const { data: job, error } = await createScrapeJob({
    niches,
    location,
    city: city || location,
    max_per_niche: maxPerNiche,
    with_emails: withEmails,
  })

  if (error || !job) {
    return res.status(500).json({ error: 'Failed to create scrape job', detail: error?.message })
  }

  // Return job ID immediately
  res.json({ jobId: job.id, status: 'queued' })

  // Run scraping in background
  runScrapeJob(job.id, niches, location, city || location, maxPerNiche, withEmails)
})

// ── GET /jobs ───────────────────────────────────────────────────
app.get('/jobs', authMiddleware, async (_req, res) => {
  const { data, error } = await getScrapeJobs()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ── GET /scrape — Web UI ────────────────────────────────────────
app.get('/scrape', (_req, res) => {
  res.type('html').send(/* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agency OS — Scraper</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0a;color:#e5e5e5;padding:24px;max-width:800px;margin:0 auto}
  h1{font-size:1.5rem;margin-bottom:4px}
  .sub{color:#888;font-size:.85rem;margin-bottom:24px}
  label{display:block;font-size:.8rem;color:#aaa;margin-bottom:4px;margin-top:14px}
  input[type=text],input[type=number]{width:100%;padding:10px 12px;border:1px solid #333;border-radius:6px;background:#141414;color:#e5e5e5;font-size:.9rem}
  input:focus{outline:none;border-color:#3b82f6}
  .row{display:flex;gap:14px}
  .row>div{flex:1}
  .check{display:flex;align-items:center;gap:8px;margin-top:14px}
  .check input{width:18px;height:18px;accent-color:#3b82f6}
  .check label{margin:0}
  button{padding:10px 20px;border:none;border-radius:6px;font-size:.9rem;font-weight:600;cursor:pointer;transition:opacity .15s}
  button:disabled{opacity:.4;cursor:not-allowed}
  #startBtn{background:#3b82f6;color:#fff;margin-top:20px;width:100%}
  #startBtn:hover:not(:disabled){background:#2563eb}
  .bar{display:flex;align-items:center;justify-content:space-between;margin-top:24px;margin-bottom:8px}
  .badge{background:#22c55e;color:#000;font-weight:700;font-size:.8rem;padding:2px 10px;border-radius:999px}
  #console{background:#111;border:1px solid #222;border-radius:8px;padding:14px;height:340px;overflow-y:auto;font-family:"SF Mono",Menlo,Consolas,monospace;font-size:.78rem;line-height:1.55;white-space:pre-wrap;word-break:break-word}
  .log-info{color:#d4d4d4}.log-warn{color:#facc15}.log-error{color:#f87171}.log-lead{color:#4ade80}.log-done{color:#38bdf8;font-weight:700}
  #csvBtn{background:#22c55e;color:#000;margin-top:12px;width:100%;display:none}
  #csvBtn:hover{background:#16a34a}
  .err-inline{color:#f87171;font-size:.8rem;margin-top:6px}
</style>
</head>
<body>
<h1>Scraper</h1>
<p class="sub">Agency OS — Lead Generation Engine</p>

<form id="form" autocomplete="off">
  <label for="niches">Niches (comma-separated)</label>
  <input type="text" id="niches" placeholder="dentist, plumber, hvac" required>

  <label for="location">Location</label>
  <input type="text" id="location" placeholder="Austin, TX" required>

  <div class="row">
    <div>
      <label for="max">Max per niche</label>
      <input type="number" id="max" value="20" min="1" max="100">
    </div>
    <div class="check">
      <input type="checkbox" id="emails">
      <label for="emails">Extract emails</label>
    </div>
  </div>

  <div id="formErr" class="err-inline"></div>
  <button type="submit" id="startBtn">Start Scrape</button>
</form>

<div class="bar">
  <span style="font-weight:600;font-size:.9rem">Live Logs</span>
  <span>Leads: <span class="badge" id="leadCount">0</span></span>
</div>
<div id="console"></div>
<button id="csvBtn">Download CSV</button>

<script>
const form=document.getElementById('form'),con=document.getElementById('console'),startBtn=document.getElementById('startBtn'),csvBtn=document.getElementById('csvBtn'),leadCountEl=document.getElementById('leadCount'),formErr=document.getElementById('formErr');
let leads=[],leadCount=0,controller=null;

function appendLog(text,cls='log-info'){
  const span=document.createElement('span');
  span.className=cls;
  span.textContent=text+'\\n';
  con.appendChild(span);
  con.scrollTop=con.scrollHeight;
}

function setRunning(v){
  startBtn.disabled=v;
  startBtn.textContent=v?'Scraping…':'Start Scrape';
  document.getElementById('niches').disabled=v;
  document.getElementById('location').disabled=v;
  document.getElementById('max').disabled=v;
  document.getElementById('emails').disabled=v;
}

function generateCSV(data){
  if(!data.length)return '';
  const keys=Object.keys(data[0]);
  const escape=v=>{
    if(v==null)return '';
    const s=String(v);
    return s.includes(',')||s.includes('"')||s.includes('\\n')?'"'+s.replace(/"/g,'""')+'"':s;
  };
  return [keys.join(','),...data.map(r=>keys.map(k=>escape(r[k])).join(','))].join('\\n');
}

form.addEventListener('submit',async e=>{
  e.preventDefault();
  formErr.textContent='';
  const niches=document.getElementById('niches').value.split(',').map(s=>s.trim()).filter(Boolean);
  const location=document.getElementById('location').value.trim();
  if(!niches.length||!location){formErr.textContent='Niches and location are required.';return;}

  leads=[];leadCount=0;leadCountEl.textContent='0';
  con.innerHTML='';csvBtn.style.display='none';
  setRunning(true);
  appendLog('Starting scrape…','log-info');

  try{
    controller=new AbortController();
    const resp=await fetch('/scrape/stream',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({niches,location,maxPerNiche:parseInt(document.getElementById('max').value)||20,withEmails:document.getElementById('emails').checked}),
      signal:controller.signal
    });

    if(!resp.ok){
      const err=await resp.json().catch(()=>({error:'Request failed'}));
      appendLog('ERROR: '+(err.error||resp.statusText),'log-error');
      setRunning(false);return;
    }

    const reader=resp.body.getReader();
    const decoder=new TextDecoder();
    let buf='';

    while(true){
      const{done,value}=await reader.read();
      if(done)break;
      buf+=decoder.decode(value,{stream:true});
      const lines=buf.split('\\n');
      buf=lines.pop()||'';
      for(const line of lines){
        if(!line.startsWith('data: '))continue;
        try{
          const evt=JSON.parse(line.slice(6));
          if(evt.type==='log')appendLog(evt.message,'log-info');
          else if(evt.type==='warn')appendLog('WARN: '+evt.message,'log-warn');
          else if(evt.type==='error'){appendLog('ERROR: '+evt.message,'log-error');setRunning(false);}
          else if(evt.type==='lead'){
            leadCount++;leadCountEl.textContent=leadCount;
            if(evt.data)leads.push(evt.data);
            appendLog('+ '+evt.message,'log-lead');
          }else if(evt.type==='done'){
            appendLog(evt.message,'log-done');
            if(evt.data&&evt.data.leads)leads=evt.data.leads;
            if(leads.length)csvBtn.style.display='block';
            setRunning(false);
          }
        }catch{}
      }
    }
    setRunning(false);
    if(leads.length)csvBtn.style.display='block';
  }catch(err){
    if(err.name!=='AbortError'){appendLog('ERROR: '+err.message,'log-error');}
    setRunning(false);
  }
});

csvBtn.addEventListener('click',()=>{
  if(!leads.length)return;
  const csv=generateCSV(leads);
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='leads-'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});
</script>
</body>
</html>`)
})

// ── POST /scrape/stream — SSE endpoint ─────────────────────────
app.post('/scrape/stream', async (req, res) => {
  const { niches, location, city, maxPerNiche = 20, withEmails = false } = req.body

  if (!niches?.length || !location) {
    return res.status(400).json({ error: 'niches (array) and location (string) are required' })
  }

  // Create job in Supabase
  const { data: job, error } = await createScrapeJob({
    niches,
    location,
    city: city || location,
    max_per_niche: maxPerNiche,
    with_emails: withEmails,
  })

  if (error || !job) {
    return res.status(500).json({ error: 'Failed to create scrape job', detail: error?.message })
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()

  const send = (type: string, message: string, data?: any) => {
    const payload = JSON.stringify({ type, message, ...(data !== undefined ? { data } : {}) })
    res.write(`data: ${payload}\n\n`)
  }

  // Handle client disconnect
  let disconnected = false
  req.on('close', () => { disconnected = true })

  const onLog = (type: string, message: string, data?: any) => {
    if (!disconnected) send(type, message, data)
  }

  // Run the job with SSE streaming
  await runScrapeJob(job.id, niches, location, city || location, maxPerNiche, withEmails, onLog)

  if (!disconnected) res.end()
})

// ── Background scrape runner ────────────────────────────────────
async function runScrapeJob(
  jobId: string,
  niches: string[],
  location: string,
  city: string,
  maxPerNiche: number,
  withEmails: boolean,
  onLog?: (type: string, message: string, data?: any) => void
) {
  let totalLeads = 0
  const collectedLeads: any[] = []

  const emit = (type: string, message: string, data?: any) => {
    if (onLog) onLog(type, message, data)
  }

  try {
    await updateScrapeJob(jobId, {
      status: ScrapeJobStatus.Running,
      started_at: new Date().toISOString(),
    })

    // Create a lead_source to track this scrape batch
    const sourceLabel = `${niches.join(', ')} — ${city}`
    const { data: leadSource } = await createLeadSource({
      type: LeadSourceType.Scrape,
      label: sourceLabel,
      scrape_job_id: jobId,
    })
    const sourceId = leadSource?.id ?? null

    emit('log', `Job ${jobId} started`)

    for (const niche of niches) {
      const msg = `Scraping "${niche}" in "${location}"...`
      console.log(`[Job ${jobId}] ${msg}`)
      emit('log', msg)

      const scraperLog = (message: string) => emit('log', message)
      const businesses = await scrapeGoogleMaps(niche, location, maxPerNiche, async (business) => {
        // Real-time: enrich and upsert each lead as it's found
        try {
          const enriched = await enrichBusiness(business, withEmails)
          const leadData = { ...enriched, niche, city }

          // Always collect the lead for CSV/stream regardless of DB outcome
          totalLeads++
          collectedLeads.push(leadData)
          emit('lead', `Found: ${enriched.name}`, leadData)

          // Persist to DB (non-blocking for the lead stream)
          const { error } = await upsertLead({
            ...enriched,
            niche,
            city,
            has_booking: false,
            has_chat_widget: false,
            has_contact_form: false,
            pain_score: null,
            pain_points: null,
            suggested_angle: null,
            message_draft: null,
            follow_up_date: null,
            page_load_ms: null,
            mobile_friendly: null,
            has_ssl: null,
            seo_issues: null,
            has_cta: null,
            phone_on_site: null,
            hours_on_site: null,
            has_social_proof: null,
            tech_stack: null,
            analyze: null,
            status: LeadStatus.New,
            notes: null,
            attio_sync_status: AttioSyncStatus.NotSynced,
            attio_synced_at: null,
            source_id: sourceId,
          })
          if (!error) {
            await updateScrapeJob(jobId, { leads_found: totalLeads })
          } else {
            const warnMsg = `DB: Failed to save "${business.name}": ${error.message}`
            console.warn(`  ${warnMsg}`)
            emit('warn', warnMsg)
          }
        } catch (err) {
          const warnMsg = `Failed to enrich lead "${business.name}": ${err}`
          console.warn(`  ${warnMsg}`)
          emit('warn', warnMsg)
        }
      }, scraperLog)

      const foundMsg = `Found ${businesses.length} businesses for "${niche}"`
      console.log(`  [Job ${jobId}] ${foundMsg}`)
      emit('log', foundMsg)
    }

    // Update lead_source count
    if (sourceId) {
      await updateLeadSourceCount(sourceId, totalLeads)
    }

    await updateScrapeJob(jobId, {
      status: ScrapeJobStatus.Done,
      leads_found: totalLeads,
      finished_at: new Date().toISOString(),
    })
    const doneMsg = `Complete — ${totalLeads} leads found`
    console.log(`[Job ${jobId}] ${doneMsg}`)
    emit('done', doneMsg, { totalLeads, leads: collectedLeads })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Job ${jobId}] Failed:`, message)
    await updateScrapeJob(jobId, {
      status: ScrapeJobStatus.Failed,
      error_message: message,
      finished_at: new Date().toISOString(),
    })
    emit('error', message)
  } finally {
    await closeBrowser()
  }
}

// ── POST /research ──────────────────────────────────────────────
// Starts a decision-maker research job. Returns immediately with the job ID.
app.post('/research', authMiddleware, async (req, res) => {
  const { leadIds } = req.body

  if (!leadIds?.length) {
    return res.status(400).json({ error: 'leadIds (array) is required' })
  }

  const { data: job, error } = await createResearchJob(leadIds)

  if (error || !job) {
    return res.status(500).json({ error: 'Failed to create research job', detail: error?.message })
  }

  res.json({ jobId: job.id, status: 'queued' })

  // Run research in background
  runResearchJob(job.id, leadIds)
})

// ── POST /research/stream — SSE endpoint ─────────────────────────
app.post('/research/stream', authMiddleware, async (req, res) => {
  const { leadIds } = req.body

  if (!leadIds?.length) {
    return res.status(400).json({ error: 'leadIds (array) is required' })
  }

  const { data: job, error } = await createResearchJob(leadIds)

  if (error || !job) {
    return res.status(500).json({ error: 'Failed to create research job', detail: error?.message })
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()

  const send = (type: string, message: string, data?: any) => {
    const payload = JSON.stringify({ type, message, ...(data !== undefined ? { data } : {}) })
    res.write(`data: ${payload}\n\n`)
  }

  let disconnected = false
  req.on('close', () => { disconnected = true })

  const onLog = (type: string, message: string, data?: any) => {
    if (!disconnected) send(type, message, data)
  }

  await runResearchJob(job.id, leadIds, onLog)

  if (!disconnected) res.end()
})

// ── POST /score/stream — SSE endpoint ─────────────────────────
app.post('/score/stream', authMiddleware, async (req, res) => {
  const { leadIds } = req.body

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()

  const send = (type: string, message: string, data?: unknown) => {
    const payload = JSON.stringify({ type, message, ...(data !== undefined ? { data } : {}) })
    res.write(`data: ${payload}\n\n`)
  }

  let disconnected = false
  req.on('close', () => { disconnected = true })

  const onLog = (type: string, message: string, data?: unknown) => {
    if (!disconnected) send(type, message, data)
  }

  await runScoringJob(leadIds ?? null, onLog)

  if (!disconnected) res.end()
})

async function runScoringJob(
  leadIds: string[] | null,
  onLog: (type: string, message: string, data?: unknown) => void,
) {
  let scored = 0
  let skipped = 0
  let failed = 0
  let totalProducts = 0

  const emit = (type: string, message: string, data?: unknown) => {
    onLog(type, message, data)
  }

  try {
    let leads: Awaited<ReturnType<typeof getUnscoredLeads>>['data']

    if (leadIds && leadIds.length > 0) {
      const results: NonNullable<typeof leads> = []
      for (const id of leadIds) {
        const { data } = await getLeadById(id)
        if (data) results.push(data)
      }
      leads = results
    } else {
      const { data } = await getUnscoredLeads()
      leads = data
    }

    if (!leads || leads.length === 0) {
      emit(ScoringLogType.Done, 'No unscored leads found', { scored: 0, skipped: 0, failed: 0, totalProducts: 0 })
      return
    }

    const total = leads.length
    emit(ScoringLogType.Info, `Starting scoring for ${total} lead(s)...`)

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]
      const progress = `[${i + 1}/${total}]`

      try {
        if (lead.pain_score != null) {
          emit(ScoringLogType.Warn, `${progress} Skipped "${lead.name}": already scored (${lead.pain_score}/9)`)
          skipped++
          continue
        }

        if (!lead.website) {
          emit(ScoringLogType.Warn, `${progress} Skipped "${lead.name}": no website found`)
          await updateLeadStatus(lead.id, LeadStatus.Skip)
          skipped++
          continue
        }

        emit(ScoringLogType.Info, `${progress} Analyzing website for "${lead.name}" (${lead.website})...`)
        const signals = await analyzeWebsite(lead.website)

        if (!signals.reachable) {
          const url = lead.website.startsWith('http') ? lead.website : `https://${lead.website}`
          let reason = 'website unreachable'
          try {
            const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) }).catch(() => null)
            if (resp) {
              if (resp.status === 403 || resp.status === 401) {
                reason = `website blocked access (HTTP ${resp.status})`
              } else if (resp.status === 404) {
                reason = `website not found (HTTP ${resp.status})`
              } else if (resp.status >= 500) {
                reason = `website server error (HTTP ${resp.status})`
              } else {
                reason = `website returned HTTP ${resp.status}`
              }
            } else {
              reason = 'website timed out or unreachable'
            }
          } catch {
            reason = 'website timed out or unreachable'
          }

          emit(ScoringLogType.Warn, `${progress} Skipped "${lead.name}": ${reason} (${lead.website})`)
          await updateLeadStatus(lead.id, LeadStatus.Skip)
          skipped++
          continue
        }

        emit(ScoringLogType.Info, `${progress} Website analyzed. Scoring with AI...`)

        const scoreResult = await scoreLead({
          name: lead.name,
          niche: lead.niche,
          city: lead.city,
          website: lead.website,
          rating: lead.rating,
          review_count: lead.review_count,
          signals,
        })

        let newStatus: typeof LeadStatus.NeedsReview | typeof LeadStatus.Scoring | typeof LeadStatus.Skip
        if (scoreResult.pain_score >= 6) {
          newStatus = LeadStatus.NeedsReview
        } else if (scoreResult.pain_score >= 4) {
          newStatus = LeadStatus.Scoring
        } else {
          newStatus = LeadStatus.Skip
        }

        const analyzeJson = JSON.stringify({
          signals,
          scoring: {
            pain_score: scoreResult.pain_score,
            pain_points: scoreResult.pain_points,
            revenue_leaks: scoreResult.revenue_leaks,
            recommended_products: scoreResult.recommended_products,
            suggested_angle: scoreResult.suggested_angle,
            message_draft: scoreResult.message_draft,
          },
        })

        await updateLeadScoring(lead.id, {
          pain_score: scoreResult.pain_score,
          pain_points: scoreResult.pain_points,
          suggested_angle: scoreResult.suggested_angle,
          message_draft: scoreResult.message_draft,
          analyze: analyzeJson,
          status: newStatus,
          has_booking: signals.has_booking,
          has_chat_widget: signals.has_chat_widget,
          has_contact_form: signals.has_contact_form,
          page_load_ms: signals.page_load_ms,
          mobile_friendly: signals.mobile_friendly,
          has_ssl: signals.has_ssl,
          seo_issues: signals.seo_issues,
          has_cta: signals.has_cta,
          phone_on_site: signals.phone_on_site,
          hours_on_site: signals.hours_on_site,
          has_social_proof: signals.has_social_proof,
          tech_stack: signals.tech_stack,
        })

        totalProducts += scoreResult.recommended_products.length
        scored++

        emit(ScoringLogType.Scored, `${progress} "${lead.name}" — Score: ${scoreResult.pain_score}/9 | ${scoreResult.recommended_products.length} products | Status: ${newStatus}`, {
          name: lead.name,
          pain_score: scoreResult.pain_score,
          suggested_angle: scoreResult.suggested_angle,
          products: scoreResult.recommended_products.length,
        })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        emit(ScoringLogType.Error, `${progress} Failed "${lead.name}": ${errMsg}`)
        failed++
      }
    }

    emit(ScoringLogType.Done, `Scoring complete — ${scored} scored, ${skipped} skipped, ${failed} failed, ${totalProducts} products recommended`, {
      scored,
      skipped,
      failed,
      totalProducts,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    emit(ScoringLogType.Error, `Fatal error: ${message}`)
  }
}

async function runResearchJob(
  jobId: string,
  leadIds: string[],
  onLog?: (type: string, message: string, data?: any) => void,
) {
  let processed = 0
  let contactsFound = 0

  const emit = (type: string, message: string, data?: any) => {
    if (onLog) onLog(type, message, data)
  }

  try {
    await updateResearchJob(jobId, {
      status: ResearchJobStatus.Running,
      started_at: new Date().toISOString(),
    })

    emit('log', `Research job ${jobId} started — ${leadIds.length} lead(s) to process`)

    for (const leadId of leadIds) {
      try {
        const { data: lead } = await getLeadById(leadId)
        if (!lead) {
          emit('warn', `[${processed + 1}/${leadIds.length}] Lead ${leadId} not found, skipping`)
          processed++
          await updateResearchJob(jobId, { processed })
          continue
        }

        emit('log', `[${processed + 1}/${leadIds.length}] Researching "${lead.name}"...`)
        console.log(`[Research ${jobId}] Searching for decision makers: ${lead.name}`)

        const contacts = await searchDecisionMakers({
          name: lead.name,
          city: lead.city,
          website: lead.website,
        })

        emit('log', `  Found ${contacts.length} contact(s) for "${lead.name}"`)

        for (const contact of contacts) {
          const { error } = await upsertContact({
            lead_id: leadId,
            name: contact.name,
            title: contact.title,
            email: contact.email,
            phone: null,
            linkedin_url: contact.linkedin_url,
            source: contact.source as ContactSource,
            confidence: contact.confidence,
            notes: null,
            tags: [],
          })
          if (!error) {
            contactsFound++
            emit('contact', `  + ${contact.name} (${contact.title ?? 'no title'}) — ${contact.email ?? 'no email'}`, contact)
          } else {
            emit('warn', `  Failed to save contact "${contact.name}": ${error.message}`)
          }
        }

        processed++
        await updateResearchJob(jobId, { processed, contacts_found: contactsFound })
        emit('log', `  Done — ${contacts.length} contacts (${processed}/${leadIds.length} leads processed)`)
        console.log(`[Research ${jobId}] ${lead.name}: found ${contacts.length} contacts (${processed}/${leadIds.length})`)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        emit('error', `[${processed + 1}/${leadIds.length}] Failed for "${leadId}": ${errMsg}`)
        console.warn(`[Research ${jobId}] Failed for lead ${leadId}:`, err)
        processed++
        await updateResearchJob(jobId, { processed })
      }
    }

    await updateResearchJob(jobId, {
      status: ResearchJobStatus.Done,
      processed,
      contacts_found: contactsFound,
      finished_at: new Date().toISOString(),
    })
    const doneMsg = `Research complete — ${contactsFound} contacts found across ${processed} leads`
    console.log(`[Research ${jobId}] ${doneMsg}`)
    emit('done', doneMsg, { processed, contactsFound })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Research ${jobId}] Failed:`, message)
    await updateResearchJob(jobId, {
      status: ResearchJobStatus.Failed,
      error_message: message,
      finished_at: new Date().toISOString(),
    })
    emit('error', `Fatal error: ${message}`)
  }
}

// ── POST /analyze ──────────────────────────────────────────────
app.post('/analyze', authMiddleware, async (req, res) => {
  const { url } = req.body

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url (string) is required' })
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  try {
    const result = await analyzeWebsite(url)
    res.json({ ok: true, result })
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
})

// ── Start server ────────────────────────────────────────────────
const PORT = process.env.PORT || 3001

// Validate env on startup
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const optional = ['OPENAI_API_KEY']
for (const key of optional) {
  if (!process.env[key]) {
    console.warn(`Warning: ${key} not set — /score/stream will not work`)
  }
}
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

app.listen(PORT, () => {
  console.log(`Scraper service running on port ${PORT}`)
  console.log(`Auth: ${SCRAPER_SECRET ? 'enabled' : 'disabled (dev mode)'}`)
})
