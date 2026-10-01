const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:Basuraman77%21@db.gxqfrwmlgqivtdkndvdj.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;