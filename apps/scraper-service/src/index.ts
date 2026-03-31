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
  getUnscoredLeads, resetUnscoredLeadsToNew, updateLeadScoring, updateLeadStatus,
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

// ── API Docs UI ────────────────────────────────────────────────
app.get('/docs', (_req, res) => {
  res.type('html').send(/* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Scraper API — Docs</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0a;color:#e5e5e5;padding:24px 24px 80px;max-width:960px;margin:0 auto}
  h1{font-size:1.6rem;margin-bottom:4px}
  .sub{color:#888;font-size:.85rem;margin-bottom:28px}
  .endpoint{background:#111;border:1px solid #222;border-radius:10px;margin-bottom:16px;overflow:hidden}
  .ep-header{display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;user-select:none}
  .ep-header:hover{background:#181818}
  .method{font-weight:700;font-size:.75rem;padding:4px 10px;border-radius:4px;font-family:monospace;min-width:56px;text-align:center}
  .method-get{background:#22c55e22;color:#4ade80;border:1px solid #22c55e44}
  .method-post{background:#3b82f622;color:#60a5fa;border:1px solid #3b82f644}
  .ep-path{font-family:"SF Mono",Menlo,Consolas,monospace;font-size:.9rem;color:#e5e5e5}
  .ep-desc{color:#888;font-size:.82rem;margin-left:auto}
  .ep-body{display:none;border-top:1px solid #222;padding:18px}
  .ep-body.open{display:block}
  .ep-section{margin-bottom:14px}
  .ep-section h3{font-size:.78rem;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
  textarea{width:100%;min-height:100px;padding:12px;border:1px solid #333;border-radius:6px;background:#0a0a0a;color:#e5e5e5;font-family:"SF Mono",Menlo,Consolas,monospace;font-size:.82rem;resize:vertical}
  textarea:focus{outline:none;border-color:#3b82f6}
  .btn-row{display:flex;gap:10px;align-items:center}
  button{padding:8px 18px;border:none;border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer}
  .btn-send{background:#3b82f6;color:#fff}
  .btn-send:hover{background:#2563eb}
  .btn-send:disabled{opacity:.4;cursor:not-allowed}
  .btn-clear{background:#333;color:#ccc}
  .btn-clear:hover{background:#444}
  .btn-stop{background:#ef4444;color:#fff}
  .btn-stop:hover{background:#dc2626}
  .status-badge{font-size:.78rem;padding:2px 8px;border-radius:4px;font-weight:600}
  .s-idle{color:#888}
  .s-loading{color:#fbbf24;background:#fbbf2420}
  .s-ok{color:#4ade80;background:#4ade8020}
  .s-err{color:#f87171;background:#f8717120}
  .s-stream{color:#60a5fa;background:#60a5fa20}
  .response-box{background:#0a0a0a;border:1px solid #222;border-radius:6px;padding:14px;margin-top:12px;max-height:400px;overflow-y:auto;font-family:"SF Mono",Menlo,Consolas,monospace;font-size:.78rem;line-height:1.6;white-space:pre-wrap;word-break:break-word;display:none}
  .response-box.visible{display:block}
  .log-info{color:#d4d4d4}.log-warn{color:#facc15}.log-error{color:#f87171}.log-lead{color:#4ade80}.log-done{color:#38bdf8;font-weight:700}.log-scored{color:#a78bfa}.log-contact{color:#f0abfc}
  .tag{font-size:.7rem;padding:2px 6px;border-radius:3px;font-weight:600}
  .tag-sse{background:#8b5cf620;color:#a78bfa;border:1px solid #8b5cf640}
  .tag-auth{background:#f59e0b20;color:#fbbf24;border:1px solid #f59e0b40}
  .auth-bar{background:#1a1a2e;border:1px solid #333;border-radius:8px;padding:14px 18px;margin-bottom:24px;display:flex;align-items:center;gap:12px}
  .auth-bar label{font-size:.82rem;color:#aaa;white-space:nowrap}
  .auth-bar input{flex:1;padding:8px 12px;border:1px solid #333;border-radius:6px;background:#0a0a0a;color:#e5e5e5;font-family:monospace;font-size:.82rem}
  .auth-bar input:focus{outline:none;border-color:#3b82f6}
  .chevron{color:#555;transition:transform .2s;font-size:.8rem}
  .chevron.open{transform:rotate(90deg)}
</style>
</head>
<body>
<h1>Scraper API</h1>
<p class="sub">Agency OS — Interactive API Explorer</p>

<div class="auth-bar">
  <label for="authToken">Bearer Token</label>
  <input type="text" id="authToken" placeholder="Leave empty for dev mode (no auth)">
</div>

<div id="endpoints"></div>

<script>
const ENDPOINTS = [
  { method:'GET', path:'/', desc:'Service info & endpoint list', body:null, tags:[] },
  { method:'GET', path:'/health', desc:'Health check', body:null, tags:[] },
  { method:'GET', path:'/jobs', desc:'List recent scrape jobs', body:null, tags:['auth'] },
  { method:'POST', path:'/scrape', desc:'Start a scrape job (returns job ID)',
    body:JSON.stringify({niches:["dentist","plumber"],location:"Austin, TX",maxPerNiche:20,withEmails:false},null,2), tags:['auth'] },
  { method:'POST', path:'/scrape/stream', desc:'Start scrape with SSE live logs',
    body:JSON.stringify({niches:["dentist"],location:"Austin, TX",maxPerNiche:5,withEmails:false},null,2), tags:['auth','sse'] },
  { method:'POST', path:'/research', desc:'Start decision-maker research',
    body:JSON.stringify({leadIds:["lead-uuid-1","lead-uuid-2"]},null,2), tags:['auth'] },
  { method:'POST', path:'/research/stream', desc:'Research with SSE live logs',
    body:JSON.stringify({leadIds:["lead-uuid-1"]},null,2), tags:['auth','sse'] },
  { method:'POST', path:'/score/stream', desc:'Score leads with AI (SSE)',
    body:JSON.stringify({leadIds:["lead-uuid-1"]},null,2), tags:['auth','sse'],
    note:'Pass empty leadIds or omit to score all unscored leads.' },
  { method:'POST', path:'/analyze', desc:'Analyze a website (13 signals)',
    body:JSON.stringify({url:"https://example.com"},null,2), tags:['auth'] },
];

const container = document.getElementById('endpoints');
const controllers = {};

function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k,v]) => {
    if (k === 'className') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'textContent') e.textContent = v;
    else e.setAttribute(k, v);
  });
  if (children) children.forEach(c => { if (c) e.appendChild(c); });
  return e;
}

function getAuthHeaders() {
  const token = document.getElementById('authToken').value.trim();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

ENDPOINTS.forEach((ep, i) => {
  const isSSE = ep.tags.includes('sse');
  const id = 'ep-' + i;

  const tagEls = ep.tags.map(t => {
    const cls = t === 'sse' ? 'tag tag-sse' : 'tag tag-auth';
    return el('span', { className: cls, textContent: t.toUpperCase() });
  });

  const chev = el('span', { className: 'chevron', id: id+'-chev', textContent: '\\u25B6' });
  const methodBadge = el('span', { className: 'method method-'+ep.method.toLowerCase(), textContent: ep.method });
  const pathEl = el('span', { className: 'ep-path', textContent: ep.path });
  const descEl = el('span', { className: 'ep-desc', textContent: ep.desc });

  const headerChildren = [chev, methodBadge, pathEl, ...tagEls, descEl];
  const header = el('div', { className: 'ep-header' }, headerChildren);
  header.addEventListener('click', () => {
    body.classList.toggle('open');
    chev.classList.toggle('open');
  });

  const bodyChildren = [];

  if (ep.body) {
    const ta = el('textarea', { id: id+'-body' });
    ta.value = ep.body;
    const sectionTitle = el('h3', { textContent: 'Request Body' });
    const section = el('div', { className: 'ep-section' }, [sectionTitle, ta]);
    if (ep.note) {
      const noteEl = el('div', { textContent: ep.note });
      noteEl.style.cssText = 'color:#888;font-size:.78rem;margin-top:4px';
      section.appendChild(noteEl);
    }
    bodyChildren.push(section);
  }

  const sendBtn = el('button', { className: 'btn-send', id: id+'-send', textContent: 'Send Request' });
  const clearBtn = el('button', { className: 'btn-clear', textContent: 'Clear' });
  const statusEl = el('span', { className: 'status-badge s-idle', id: id+'-status', textContent: 'idle' });
  const respBox = el('div', { className: 'response-box', id: id+'-resp' });

  const btnRowChildren = [sendBtn];
  let stopBtn = null;
  if (isSSE) {
    stopBtn = el('button', { className: 'btn-stop', id: id+'-stop', textContent: 'Stop Stream' });
    stopBtn.style.display = 'none';
    stopBtn.addEventListener('click', () => stopStream(id));
    btnRowChildren.push(stopBtn);
  }
  btnRowChildren.push(clearBtn, statusEl);
  const btnRow = el('div', { className: 'btn-row' }, btnRowChildren);
  bodyChildren.push(btnRow, respBox);

  const body = el('div', { className: 'ep-body', id: id }, bodyChildren);
  const endpoint = el('div', { className: 'endpoint' }, [header, body]);
  container.appendChild(endpoint);

  clearBtn.addEventListener('click', () => {
    while (respBox.firstChild) respBox.removeChild(respBox.firstChild);
    respBox.classList.remove('visible');
    setStatus(id, 's-idle', 'idle');
  });

  sendBtn.addEventListener('click', () => sendRequest(id, i));
});

function setStatus(id, cls, text) {
  const el = document.getElementById(id + '-status');
  el.className = 'status-badge ' + cls;
  el.textContent = text;
}

function appendLine(id, text, cls) {
  const resp = document.getElementById(id + '-resp');
  resp.classList.add('visible');
  const span = document.createElement('span');
  span.className = cls || 'log-info';
  span.textContent = text + '\\n';
  resp.appendChild(span);
  resp.scrollTop = resp.scrollHeight;
}

function stopStream(id) {
  if (controllers[id]) { controllers[id].abort(); delete controllers[id]; }
  const stopBtn = document.getElementById(id + '-stop');
  if (stopBtn) stopBtn.style.display = 'none';
  document.getElementById(id + '-send').disabled = false;
  setStatus(id, 's-idle', 'stopped');
}

async function sendRequest(id, idx) {
  const ep = ENDPOINTS[idx];
  const isSSE = ep.tags.includes('sse');
  const resp = document.getElementById(id + '-resp');
  while (resp.firstChild) resp.removeChild(resp.firstChild);
  resp.classList.add('visible');

  const sendBtn = document.getElementById(id + '-send');
  const stopBtn = document.getElementById(id + '-stop');
  sendBtn.disabled = true;

  const opts = { method: ep.method, headers: getAuthHeaders() };

  if (ep.body) {
    const bodyEl = document.getElementById(id + '-body');
    try { JSON.parse(bodyEl.value); opts.body = bodyEl.value; }
    catch (e) {
      appendLine(id, 'Invalid JSON: ' + e.message, 'log-error');
      sendBtn.disabled = false;
      setStatus(id, 's-err', 'invalid json');
      return;
    }
  }

  if (isSSE) {
    setStatus(id, 's-stream', 'streaming');
    const ctrl = new AbortController();
    controllers[id] = ctrl;
    opts.signal = ctrl.signal;
    if (stopBtn) stopBtn.style.display = '';

    try {
      const response = await fetch(ep.path, opts);
      if (!response.ok) {
        const errText = await response.text();
        appendLine(id, 'HTTP ' + response.status + ': ' + errText, 'log-error');
        setStatus(id, 's-err', String(response.status));
        sendBtn.disabled = false;
        if (stopBtn) stopBtn.style.display = 'none';
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith(':') || !line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            const cls = { log:'log-info', info:'log-info', warn:'log-warn', error:'log-error',
              lead:'log-lead', done:'log-done', scored:'log-scored', contact:'log-contact' }[evt.type] || 'log-info';
            appendLine(id, '[' + evt.type + '] ' + evt.message, cls);
            if (evt.type === 'done') setStatus(id, 's-ok', 'done');
            if (evt.type === 'error') setStatus(id, 's-err', 'error');
          } catch {}
        }
      }
      if (document.getElementById(id+'-status').textContent === 'streaming') setStatus(id, 's-ok', 'done');
    } catch (err) {
      if (err.name !== 'AbortError') { appendLine(id, 'Error: ' + err.message, 'log-error'); setStatus(id, 's-err', 'error'); }
    }
    sendBtn.disabled = false;
    if (stopBtn) stopBtn.style.display = 'none';
    delete controllers[id];
  } else {
    setStatus(id, 's-loading', 'loading');
    try {
      const response = await fetch(ep.path, opts);
      const text = await response.text();
      let display; try { display = JSON.stringify(JSON.parse(text), null, 2); } catch { display = text; }
      appendLine(id, 'HTTP ' + response.status, response.ok ? 'log-done' : 'log-error');
      appendLine(id, display, response.ok ? 'log-info' : 'log-error');
      setStatus(id, response.ok ? 's-ok' : 's-err', String(response.status));
    } catch (err) {
      appendLine(id, 'Error: ' + err.message, 'log-error');
      setStatus(id, 's-err', 'error');
    }
    sendBtn.disabled = false;
  }
}
</script>
</body>
</html>`);
});

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
    if (typeof (res as any).flush === 'function') (res as any).flush()
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
    if (typeof (res as any).flush === 'function') (res as any).flush()
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
  console.log('[score/stream] Endpoint hit, body:', JSON.stringify(req.body))
  const { leadIds } = req.body

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()
  // Send initial comment to confirm stream is open
  res.write(':ok\n\n')
  if (typeof (res as any).flush === 'function') (res as any).flush()

  const send = (type: string, message: string, data?: unknown) => {
    const payload = JSON.stringify({ type, message, ...(data !== undefined ? { data } : {}) })
    res.write(`data: ${payload}\n\n`)
    if (typeof (res as any).flush === 'function') (res as any).flush()
  }

  let disconnected = false
  req.on('close', () => { disconnected = true })

  // Heartbeat every 30s to prevent upstream proxy body-timeout
  const heartbeat = setInterval(() => {
    if (!disconnected) {
      res.write(':heartbeat\n\n')
      if (typeof (res as any).flush === 'function') (res as any).flush()
    }
  }, 30_000)

  const onLog = (type: string, message: string, data?: unknown) => {
    if (!disconnected) send(type, message, data)
  }

  console.log('[score/stream] Starting runScoringJob, leadIds:', leadIds)
  try {
    await runScoringJob(leadIds ?? null, onLog)
    console.log('[score/stream] runScoringJob completed')
  } catch (err) {
    console.error('[score/stream] runScoringJob crashed:', err)
    const errMsg = err instanceof Error ? err.message : String(err)
    if (!disconnected) {
      const payload = JSON.stringify({ type: 'error', message: `Fatal: ${errMsg}` })
      res.write(`data: ${payload}\n\n`)
      if (typeof (res as any).flush === 'function') (res as any).flush()
    }
  }

  clearInterval(heartbeat)
  if (!disconnected) res.end()
  console.log('[score/stream] Response ended')
})

async function runScoringJob(
  leadIds: string[] | null,
  onLog: (type: string, message: string, data?: unknown) => void,
) {
  console.log('[runScoringJob] Starting, leadIds:', leadIds)
  let scored = 0
  let skipped = 0
  let failed = 0
  let totalProducts = 0

  const emit = (type: string, message: string, data?: unknown) => {
    console.log(`[runScoringJob] emit(${type}): ${message}`)
    onLog(type, message, data)
  }

  try {
    // Reset any leads with null pain_score back to 'new' so they get picked up
    console.log('[runScoringJob] Resetting unscored leads to new...')
    const { count: resetCount, error: resetError } = await resetUnscoredLeadsToNew()
    if (resetError) {
      console.error('[runScoringJob] Reset failed:', resetError.message)
      emit(ScoringLogType.Error, `Failed to reset unscored leads: ${resetError.message}`)
    } else {
      console.log(`[runScoringJob] Reset ${resetCount ?? 0} leads`)
      if (resetCount && resetCount > 0) {
        emit(ScoringLogType.Info, `Reset ${resetCount} unscored lead(s) to "new" status`)
      }
    }

    let leads: Awaited<ReturnType<typeof getUnscoredLeads>>['data']

    if (leadIds && leadIds.length > 0) {
      console.log(`[runScoringJob] Fetching ${leadIds.length} specific leads`)
      const results: NonNullable<typeof leads> = []
      for (const id of leadIds) {
        const { data, error } = await getLeadById(id)
        if (error) console.error(`[runScoringJob] Failed to fetch lead ${id}:`, error.message)
        if (data) results.push(data)
      }
      leads = results
    } else {
      console.log('[runScoringJob] Fetching all unscored leads')
      const { data, error } = await getUnscoredLeads()
      if (error) {
        console.error('[runScoringJob] Failed to fetch unscored leads:', error.message)
        emit(ScoringLogType.Error, `Failed to fetch leads: ${error.message}`)
      }
      leads = data
      console.log(`[runScoringJob] Got ${leads?.length ?? 0} unscored leads`)
    }

    if (!leads || leads.length === 0) {
      console.log('[runScoringJob] No leads to score, emitting done')
      emit(ScoringLogType.Done, 'No unscored leads found', { scored: 0, skipped: 0, failed: 0, totalProducts: 0 })
      return
    }

    const total = leads.length
    emit(ScoringLogType.Info, `Starting scoring for ${total} lead(s)...`)

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]
      const progress = `[${i + 1}/${total}]`
      console.log(`[runScoringJob] ${progress} Processing "${lead.name}" (pain_score=${lead.pain_score}, website=${lead.website})`)

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
    const stack = err instanceof Error ? err.stack : ''
    console.error('[runScoringJob] FATAL ERROR:', message)
    console.error('[runScoringJob] Stack:', stack)
    emit(ScoringLogType.Error, `Fatal error: ${message}`)
  }
  console.log('[runScoringJob] Function exiting')
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

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err.message)
  console.error(err.stack)
})

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason)
})

app.listen(PORT, () => {
  console.log(`Scraper service running on port ${PORT}`)
  console.log(`Auth: ${SCRAPER_SECRET ? 'enabled' : 'disabled (dev mode)'}`)
  console.log(`OpenAI: ${process.env.OPENAI_API_KEY ? 'configured' : 'NOT SET'}`)
})
