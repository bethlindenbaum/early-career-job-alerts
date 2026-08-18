const test = require('node:test');
const assert = require('node:assert/strict');
const { endpoint } = require('../lib/source-connectors');

test('builds structured recruiting platform endpoints', () => {
  assert.equal(endpoint({ type: 'greenhouse', token: 'example' }), 'https://boards-api.greenhouse.io/v1/boards/example/jobs?content=true');
  assert.equal(endpoint({ type: 'lever', token: 'example' }), 'https://api.lever.co/v0/postings/example?mode=json');
  assert.equal(endpoint({ type: 'ashby', token: 'example' }), 'https://api.ashbyhq.com/posting-api/job-board/example?includeCompensation=true');
  assert.equal(endpoint({ type: 'workday', host: 'example.wd1.myworkdayjobs.com', tenant: 'example', site: 'Careers' }), 'https://example.wd1.myworkdayjobs.com/wday/cxs/example/Careers/jobs');
});
