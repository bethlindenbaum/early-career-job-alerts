const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSupabaseUrl } = require('../lib/supabase');

test('normalizes Supabase project and REST endpoint URLs', () => {
  assert.equal(normalizeSupabaseUrl('https://example.supabase.co/'), 'https://example.supabase.co');
  assert.equal(normalizeSupabaseUrl('https://example.supabase.co/rest/v1/'), 'https://example.supabase.co');
});
