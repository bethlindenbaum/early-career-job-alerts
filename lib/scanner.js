const fs = require('node:fs');
const path = require('node:path');
const { match } = require('./matcher');
const { event } = require('./store');
const { fetchSource } = require('./source-connectors');
async function scan(state) {
  const sources = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sources.json'), 'utf8'));
  const settled = await Promise.allSettled(sources.map(fetchSource));
  const successful = settled.filter(x => x.status === 'fulfilled').map(x => x.value);
  const candidates = successful.flatMap(x => x.jobs);
  const known = new Set(state.jobs.map(job => job.externalId));
  const knownSignatures = new Set(state.jobs.map(job => `${job.company}|${job.title}|${job.location}`.toLowerCase()));
  const added = [];
  for (const job of candidates) {
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
