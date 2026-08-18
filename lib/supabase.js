function normalizeSupabaseUrl(value = '') {
  return value.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
}

module.exports = { normalizeSupabaseUrl };
