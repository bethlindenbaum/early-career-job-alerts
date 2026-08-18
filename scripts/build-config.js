const fs = require('node:fs');
const path = require('node:path');

const config = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
};
fs.writeFileSync(path.join(__dirname, '..', 'public', 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
console.log(`Cloud target sync ${config.supabaseUrl && config.supabaseAnonKey ? 'enabled' : 'not configured'}`);
