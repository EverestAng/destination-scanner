const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false 
        }
      }
    : {
        user: 'postgres',
        host: 'localhost',
        database: 'geoverify_db',
        password: 'admin123', 
        port: 5432,
      }
);

module.exports = pool;