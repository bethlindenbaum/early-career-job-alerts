const fs = require('node:fs');
const path = require('node:path');
const { match } = require('./matcher');
const { event } = require('./store');
const { fetchSource } = require('./source-connectors');
function cleanPage(value = '') { return value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&amp;|&#39;|&quot;/g, ' ').replace(/\s+/g, ' ').trim(); }
async function loadDescription(job) {
  try { const response=await fetch(job.url,{signal:AbortSignal.timeout(10000),headers:{'User-Agent':'First-Look-Job-Monitor/1.0'}});if(!response.ok)return job;return {...job,description:cleanPage(await response.text()),experienceCheckedAt:new Date().toISOString()}; } catch { return job; }
}
async function mapLimit(values,limit,task){const output=new Array(values.length);let next=0;async function worker(){while(next<values.length){const index=next++;output[index]=await task(values[index]);}}await Promise.all(Array.from({length:Math.min(limit,values.length)},worker));return output;}
async function scan(state) {
  const sources = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sources.json'), 'utf8'));
  const settled = await Promise.allSettled(sources.map(fetchSource));
  const successful = settled.filter(x => x.status === 'fulfilled').map(x => x.value);
  const candidates = successful.flatMap(x => x.jobs);
  const known = new Set(state.jobs.map(job => job.externalId));
  const knownSignatures = new Set(state.jobs.map(job => `${job.company}|${job.title}|${job.location}`.toLowerCase()));
  const pendingChecks = [...state.jobs, ...candidates.filter(job => !known.has(job.externalId))].filter(job => job.experienceCheck && !job.experienceCheckedAt);
  const checked = new Map((await mapLimit(pendingChecks, 8, loadDescription)).map(job => [job.externalId, job]));
  state.jobs = state.jobs.map(job => checked.get(job.externalId) || job).filter(job => match(job, state.preferences));
  const added = [];
  for (const original of candidates) {
    const job = checked.get(original.externalId) || original;
    const preference = match(job, state.preferences);
    const signature = `${job.company}|${job.title}|${job.location}`.toLowerCase();
    if (!preference || known.has(job.externalId) || knownSignatures.has(signature)) continue;
    const result = { ...job, id: crypto.randomUUID(), preferenceId: preference.id, status: 'review', discoveredAt: new Date().toISOString() };
    state.jobs.unshift(result); added.push(result); known.add(job.externalId); knownSignatures.add(signature);
  }
  state.lastScanAt = new Date().toISOString();
  event(state, 'scan', `Scan complete: ${added.length} new match${added.length === 1 ? '' : 'es'}`);
  const failures=settled.flatMap((result,index)=>result.status==='rejected'?[{company:sources[index].company||sources[index].name,type:sources[index].type,status:'error',message:result.reason.message,checkedAt:new Date().toISOString(),jobCount:0}]:[]);
  return { added, errors: failures.map(x=>x.message), health: [...successful.map(x=>x.health),...failures] };
}
module.exports = { scan };
