const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.gxqfrwmlgqivtdkndvdj:Basuraman77%21@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;