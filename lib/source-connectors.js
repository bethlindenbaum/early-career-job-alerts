const crypto = require('node:crypto');
const { skillsFrom } = require('./matcher');

function cleanHtml(value = '') { return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ').trim(); }
function salaryFrom(description = '') { return description.match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)/)?.[0] || ''; }
function greenhouseJob(company, raw) { const description = cleanHtml(raw.content); return { externalId:`gh-${company}-${raw.id}`,company,title:raw.title,location:raw.location?.name||'Location not listed',url:raw.absolute_url,description,salary:salaryFrom(description),skills:skillsFrom(description),postedAt:raw.updated_at||new Date().toISOString(),source:'Greenhouse' }; }
function leverJob(company, raw) { const description=cleanHtml(`${raw.descriptionPlain||''} ${raw.additionalPlain||''}`); return { externalId:`lever-${company}-${raw.id}`,company,title:raw.text,location:raw.categories?.location||'Location not listed',url:raw.hostedUrl,description,salary:salaryFrom(description),skills:skillsFrom(description),postedAt:new Date(raw.createdAt||Date.now()).toISOString(),source:'Lever' }; }
function ashbyJob(company, raw) { const description=cleanHtml(raw.descriptionPlain||raw.descriptionHtml||''); return { externalId:`ashby-${company}-${raw.id||raw.jobUrl}`,company,title:raw.title,location:raw.location||'Location not listed',url:raw.applyUrl||raw.jobUrl,description,salary:raw.compensation?.scrapeableCompensationSalarySummary||raw.compensation?.compensationTierSummary||salaryFrom(description),skills:skillsFrom(description),postedAt:raw.publishedAt||new Date().toISOString(),source:'Ashby' }; }
function smartRecruitersJob(company, raw) { const location=raw.location?.fullLocation||[raw.location?.city,raw.location?.region,raw.location?.country].filter(Boolean).join(', ')||'Location not listed';const slug=raw.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');return {externalId:`smartrecruiters-${company}-${raw.id}`,company,title:raw.name,location,url:`https://jobs.smartrecruiters.com/${raw.company?.identifier||company}/${raw.id}-${slug}`,description:'',salary:'',skills:[],postedAt:raw.releasedDate||new Date().toISOString(),source:'SmartRecruiters'}; }
function applyGuyJob(raw) { return {externalId:`applyguy-${raw.id}`,company:raw.company,title:raw.title,location:raw.location||'Location not listed',url:raw.listingUrl||raw.url,description:`${raw.eligibility||''} ${raw.matchKind||''}`,salary:'',skills:[],postedAt:raw.posted||new Date().toISOString(),source:'ApplyGuy 2027 feed',earlyCareer:true}; }
function workdayJob(source, raw) { return {externalId:`workday-${source.company}-${raw.bulletFields?.[0]||raw.externalPath}`,company:source.company,title:raw.title,location:raw.locationsText||'Location not listed',url:`https://${source.host}${raw.externalPath}`,description:'',salary:'',skills:[],postedAt:new Date().toISOString(),source:'Workday'}; }
function markdownText(value = '') { return cleanHtml(value.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/<br\s*\/?\s*>/gi, ', ').replace(/[*_`]/g, '').replace(/&[^;]+;/g, ' ')); }
function markdownUrl(value = '') { return value.match(/href=["'](https?:\/\/[^"']+)/i)?.[1] || [...value.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].at(-1)?.[1] || ''; }
function markdownJobs(source, markdown) {
  let content = markdown;
  if (source.section) {
    const start = content.search(new RegExp(`<summary><h3>[^\n]*${source.section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\n]*`, 'i'));
    if (start < 0) return [];
    const end = content.indexOf('</details>', start); content = content.slice(start, end < 0 ? undefined : end);
  }
  const jobs=[];
  for (const line of content.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*(?:Company|-)/i.test(line)) continue;
    const cells=line.split('|').slice(1,-1).map(cell=>cell.trim()); if(cells.length<5)continue;
    const company=markdownText(cells[0]),title=markdownText(cells[1]),location=markdownText(cells[2]),url=markdownUrl(source.format==='vansh'?cells[3]:cells.at(-1));
    if(!company||!title||!url)continue;
    jobs.push({externalId:`markdown-${crypto.createHash('sha1').update(url).digest('hex')}`,company,title,location:location||'Location not listed',url,description:'',salary:'',skills:[],postedAt:new Date().toISOString(),source:source.name,earlyCareer:source.earlyCareer===true,experienceCheck:source.experienceCheck===true});
  }
  return jobs;
}
function jsonLdJobs(company, html, pageUrl) { const rows=[];for(const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const parsed=JSON.parse(match[1]);const values=Array.isArray(parsed)?parsed:parsed['@graph']||[parsed];for(const raw of values.filter(item=>item?.['@type']==='JobPosting')){const description=cleanHtml(raw.description);const location=raw.jobLocation?.address||raw.jobLocation?.[0]?.address||{};rows.push({externalId:`jsonld-${company}-${raw.identifier?.value||raw.url||raw.title}`,company,title:raw.title,location:[location.addressLocality,location.addressRegion,location.addressCountry].filter(Boolean).join(', ')||raw.jobLocationType||'Location not listed',url:raw.url||pageUrl,description,salary:salaryFrom(description),skills:skillsFrom(description),postedAt:raw.datePosted||new Date().toISOString(),source:'Official careers page'});}}catch{}}
  return rows;
}
function endpoint(source) {
  if(source.type==='greenhouse')return `https://boards-api.greenhouse.io/v1/boards/${source.token}/jobs?content=true`;
  if(source.type==='lever')return `https://api.lever.co/v0/postings/${source.token}?mode=json`;
  if(source.type==='ashby')return `https://api.ashbyhq.com/posting-api/job-board/${source.token}?includeCompensation=true`;
  if(source.type==='smartrecruiters')return `https://api.smartrecruiters.com/v1/companies/${source.token}/postings?limit=100`;
  if(source.type==='workday')return `https://${source.host}/wday/cxs/${source.tenant}/${source.site}/jobs`;
  if(source.type==='applyguy'||source.type==='jsonld'||source.type==='markdown')return source.url;
  throw new Error(`${source.company||source.type}: unsupported source type`);
}
async function fetchSource(source) {
  const started=Date.now(),options={signal:AbortSignal.timeout(source.timeoutMs||20000),headers:{'User-Agent':'First-Look-Job-Monitor/1.0'}};
  if(source.type==='workday'){options.method='POST';options.headers['Content-Type']='application/json';options.body=JSON.stringify({appliedFacets:{},limit:20,offset:0,searchText:''});}
  const response=await fetch(endpoint(source),options);
  if(!response.ok)throw new Error(`${source.company||source.name||source.type}: ${response.status}`);
  let jobs;
  if(source.type==='jsonld')jobs=jsonLdJobs(source.company,await response.text(),source.url);
  else if(source.type==='markdown')jobs=markdownJobs(source,await response.text());
  else { const payload=await response.json();if(source.type==='greenhouse')jobs=payload.jobs.map(row=>greenhouseJob(source.company,row));else if(source.type==='lever')jobs=payload.map(row=>leverJob(source.company,row));else if(source.type==='ashby')jobs=payload.jobs.filter(row=>row.isListed!==false).map(row=>ashbyJob(source.company,row));else if(source.type==='smartrecruiters')jobs=payload.content.map(row=>smartRecruitersJob(source.company,row));else if(source.type==='workday')jobs=payload.jobPostings.map(row=>workdayJob(source,row));else jobs=payload.jobs.map(applyGuyJob); }
  return {source,jobs,health:{company:source.company||source.name,type:source.type,status:'healthy',jobCount:jobs.length,checkedAt:new Date().toISOString(),durationMs:Date.now()-started}};
}
module.exports={fetchSource,endpoint,markdownJobs};
