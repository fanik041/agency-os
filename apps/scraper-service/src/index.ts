import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../../../.env.local') })

import express from 'express'
import {
  createScrapeJob, updateScrapeJob, getScrapeJobs, upsertLead,
  getLeadById, createResearchJob, updateResearchJob, upsertContact,
  createLeadSource, updateLeadSourceCount,
} from '@agency-os/db'
import { scrapeGoogleMaps, closeBrowser } from './scraper'
import { enrichBusiness } from './enricher'
import { searchDecisionMakers } from './researcher'

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
  })

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
      status: 'running',
      started_at: new Date().toISOString(),
    })

    // Create a lead_source to track this scrape batch
    const sourceLabel = `${niches.join(', ')} — ${city}`
    const { data: leadSource } = await createLeadSource({
      type: 'scrape',
      label: sourceLabel,
      scrape_job_id: jobId,
    })
    const sourceId = leadSource?.id ?? null

    emit('log', `Job ${jobId} started`)

    for (const niche of niches) {
      const msg = `Scraping "${niche}" in "${location}"...`
      console.log(`[Job ${jobId}] ${msg}`)
      emit('log', msg)

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
            call_status: 'pending',
            call_notes: null,
            called_at: null,
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
      })

      const foundMsg = `Found ${businesses.length} businesses for "${niche}"`
      console.log(`  [Job ${jobId}] ${foundMsg}`)
      emit('log', foundMsg)
    }

    // Update lead_source count
    if (sourceId) {
      await updateLeadSourceCount(sourceId, totalLeads)
    }

    await updateScrapeJob(jobId, {
      status: 'done',
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
      status: 'failed',
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

async function runResearchJob(jobId: string, leadIds: string[]) {
  let processed = 0
  let contactsFound = 0

  try {
    await updateResearchJob(jobId, {
      status: 'running',
      started_at: new Date().toISOString(),
    })

    for (const leadId of leadIds) {
      try {
        const { data: lead } = await getLeadById(leadId)
        if (!lead) {
          processed++
          await updateResearchJob(jobId, { processed })
          continue
        }

        console.log(`[Research ${jobId}] Searching for decision makers: ${lead.name}`)

        const contacts = await searchDecisionMakers({
          name: lead.name,
          city: lead.city,
          website: lead.website,
        })

        for (const contact of contacts) {
          const { error } = await upsertContact({
            lead_id: leadId,
            name: contact.name,
            title: contact.title,
            email: contact.email,
            phone: null,
            linkedin_url: contact.linkedin_url,
            source: contact.source,
            confidence: contact.confidence,
            notes: null,
          })
          if (!error) contactsFound++
        }

        processed++
        await updateResearchJob(jobId, { processed, contacts_found: contactsFound })
        console.log(`[Research ${jobId}] ${lead.name}: found ${contacts.length} contacts (${processed}/${leadIds.length})`)
      } catch (err) {
        console.warn(`[Research ${jobId}] Failed for lead ${leadId}:`, err)
        processed++
        await updateResearchJob(jobId, { processed })
      }
    }

    await updateResearchJob(jobId, {
      status: 'done',
      processed,
      contacts_found: contactsFound,
      finished_at: new Date().toISOString(),
    })
    console.log(`[Research ${jobId}] Complete — ${contactsFound} contacts found`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Research ${jobId}] Failed:`, message)
    await updateResearchJob(jobId, {
      status: 'failed',
      error_message: message,
      finished_at: new Date().toISOString(),
    })
  }
}

// ── Start server ────────────────────────────────────────────────
const PORT = process.env.PORT || 3001

// Validate env on startup
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
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
