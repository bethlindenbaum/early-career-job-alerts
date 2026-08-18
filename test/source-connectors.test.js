const test = require('node:test');
const assert = require('node:assert/strict');
const { endpoint, markdownJobs } = require('../lib/source-connectors');

test('builds structured recruiting platform endpoints', () => {
  assert.equal(endpoint({ type: 'greenhouse', token: 'example' }), 'https://boards-api.greenhouse.io/v1/boards/example/jobs?content=true');
  assert.equal(endpoint({ type: 'lever', token: 'example' }), 'https://api.lever.co/v0/postings/example?mode=json');
  assert.equal(endpoint({ type: 'ashby', token: 'example' }), 'https://api.ashbyhq.com/posting-api/job-board/example?includeCompensation=true');
  assert.equal(endpoint({ type: 'workday', host: 'example.wd1.myworkdayjobs.com', tenant: 'example', site: 'Careers' }), 'https://example.wd1.myworkdayjobs.com/wday/cxs/example/Careers/jobs');
});

test('parses supported Markdown fallback table rows', () => {
  const vansh='| **Example Co** | New Grad: Software Engineer | New York, NY</br>Remote | <a href="https://example.com/job/1"><img alt="Apply"></a> | Aug 18 |';
  const zapply='<summary><h3>⚙️ <strong>Hardware & Systems Engineering</strong></h3></summary>\n| Company | Role | Location | Posted | Visa | **Apply** |\n| **Chip Co** | Entry Level Hardware Engineer | Austin, TX | 10m | | [Apply](https://example.com/job/2) |\n</details>';
  assert.equal(markdownJobs({name:'Vansh',format:'vansh',earlyCareer:true},vansh)[0].company,'Example Co');
  assert.equal(markdownJobs({name:'Zapply',format:'zapply',section:'Hardware & Systems Engineering'},zapply)[0].title,'Entry Level Hardware Engineer');
});
