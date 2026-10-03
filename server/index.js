const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// --- ROUTES ---

// 1. User Login Route (With bcrypt comparison)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('--- LOGIN ATTEMPT ---');
  console.log('Received Payload:', { email });

  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    // Check password (supports hashed or plain text fallback)
    let isMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = user.password === password;
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    console.log('Status: Login Successful');
    res.json(user);
  } catch (err) {
    console.error('DATABASE ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2. Get All Field Agents
app.get('/api/agents', async (req, res) => {
  try {
    const agents = await pool.query("SELECT id, name, email FROM users WHERE role = 'agent' ORDER BY id DESC");
    res.json(agents.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Create New Agent (Auto Email: firstname@agent.com / Default Password: 123)
app.post('/api/agents', async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Agent Full Name is required.' });
  }

  try {
    const trimmedName = name.trim();
    const firstName = trimmedName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!firstName) {
      return res.status(400).json({ error: 'Invalid name provided.' });
    }

    const existingEmailsRes = await pool.query(
      "SELECT email FROM users WHERE email LIKE $1",
      [`${firstName}%@agent.com`]
    );

    const existingEmails = existingEmailsRes.rows.map(row => row.email);

    let generatedEmail = `${firstName}@agent.com`;
    let counter = 1;

    while (existingEmails.includes(generatedEmail)) {
      generatedEmail = `${firstName}${counter}@agent.com`;
      counter++;
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('123', saltRounds);

    const newAgent = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'agent') RETURNING id, name, email, role",
      [trimmedName, generatedEmail, hashedPassword]
    );

    res.status(201).json({
      message: 'Agent created successfully!',
      agent: newAgent.rows[0],
      defaultPassword: '123'
    });
  } catch (err) {
    console.error('CREATE AGENT ERROR:', err.message);
    res.status(500).json({ error: 'Server error while creating agent.' });
  }
});

// Update Field Agent Name
app.put('/api/agents/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Agent Full Name is required.' });
  }

  try {
    const updatedAgent = await pool.query(
      "UPDATE users SET name = $1 WHERE id = $2 AND role = 'agent' RETURNING id, name, email, role",
      [name.trim(), id]
    );

    if (updatedAgent.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found.' });
    }

    res.json({
      message: 'Agent updated successfully!',
      agent: updatedAgent.rows[0]
    });
  } catch (err) {
    console.error('UPDATE AGENT ERROR:', err.message);
    res.status(500).json({ error: 'Server error while updating agent.' });
  }
});

// Delete Field Agent
app.delete('/api/agents/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE customers SET agent_id = NULL WHERE agent_id = $1', [id]);
    const result = await client.query("DELETE FROM users WHERE id = $1 AND role = 'agent' RETURNING *", [id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Agent not found.' });
    }
    await client.query('COMMIT');
    res.json({ message: 'Agent deleted successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DELETE AGENT ERROR:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- UNIVERSAL CHANGE PASSWORD ROUTE (Para sa Admin at Agents) ---
app.put('/api/agents/:id/change-password', async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = userResult.rows[0];

    let isMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(currentPassword, user.password);
    } else {
      isMatch = user.password === currentPassword;
    }

    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedNewPassword, id]);

    res.json({ message: 'Password successfully updated!' });
  } catch (err) {
    console.error('CHANGE PASSWORD ERROR:', err.message);
    res.status(500).json({ error: 'Server error while updating password.' });
  }
});

// --- AGENT STORE ASSIGNMENTS ROUTES ---

app.get('/api/agents/:id/stores', async (req, res) => {
  const { id } = req.params;
  try {
    const assigned = await pool.query(
      'SELECT id FROM customers WHERE agent_id = $1',
      [id]
    );
    res.json(assigned.rows.map(r => r.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agents/:id/stores', async (req, res) => {
  const { id } = req.params;
  const { storeIds } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query('UPDATE customers SET agent_id = NULL WHERE agent_id = $1', [id]);

    if (storeIds && storeIds.length > 0) {
      const parsedStoreIds = storeIds.map(sId => parseInt(sId, 10));
      const updateQuery = 'UPDATE customers SET agent_id = $1 WHERE id = ANY($2::int[])';
      await client.query(updateQuery, [id, parsedStoreIds]);
    }

    await client.query('COMMIT');
    res.json({ message: 'Store assignments updated successfully!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ASSIGN STORES ERROR:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/agents/:id/assigned-stores', async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT * FROM customers 
      WHERE agent_id = $1 
      ORDER BY id DESC
    `;
    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get All Store Locations
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await pool.query('SELECT * FROM customers ORDER BY id DESC');
    res.json(customers.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Add New Store Location
app.post('/api/customers', async (req, res) => {
  const { name, address, lat, lng } = req.body;

  if (!name || !name.trim() || !address || !address.trim() || !lat || !lng) {
    return res.status(400).json({ error: 'Store Name, Address, Latitude, and Longitude are all required.' });
  }

  try {
    const existingStore = await pool.query(
      'SELECT * FROM customers WHERE LOWER(name) = LOWER($1) OR (latitude = $2 AND longitude = $3)',
      [name.trim(), parseFloat(lat), parseFloat(lng)]
    );

    if (existingStore.rows.length > 0) {
      const match = existingStore.rows[0];
      if (match.name.toLowerCase() === name.trim().toLowerCase()) {
        return res.status(400).json({ error: `A store named "${name.trim()}" already exists in the database.` });
      } else {
        return res.status(400).json({ error: 'A store is already registered at these exact GPS coordinates.' });
      }
    }

    const qrToken = `QR-CUST-${Date.now().toString().slice(-4)}`;
    const newCustomer = await pool.query(
      'INSERT INTO customers (name, address, latitude, longitude, qr_token) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name.trim(), address.trim(), parseFloat(lat), parseFloat(lng), qrToken]
    );

    res.status(201).json({
      message: 'Store location saved successfully',
      customer: newCustomer.rows[0]
    });
  } catch (err) {
    console.error('ADD STORE LOCATION ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 6. Delete Store Location
app.delete('/api/customers/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM visits WHERE customer_id = $1', [id]);
    const result = await client.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Store not found' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Store location deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DELETE STORE ERROR:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 7. Get All Visits Logs
app.get('/api/visits', async (req, res) => {
  try {
    const query = `
      SELECT v.*, c.name AS store_name, u.name AS agent_name 
      FROM visits v
      LEFT JOIN customers c ON v.customer_id = c.id
      LEFT JOIN users u ON v.agent_id = u.id
      ORDER BY v.timestamp DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('FETCH VISITS ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 8. Record Visit Log
app.post('/api/visits', async (req, res) => {
  const { agent_id, customer_id, agent_lat, agent_lng, distance_meters, status } = req.body;
  
  try {
    const visitCountQuery = await pool.query(
      `SELECT COUNT(*) AS total_visits FROM visits 
       WHERE agent_id = $1 
         AND customer_id = $2 
         AND status = 'verified' 
         AND DATE(timestamp) = CURRENT_DATE`,
      [agent_id, customer_id]
    );

    const totalVisits = parseInt(visitCountQuery.rows[0].total_visits, 10);

    if (totalVisits >= 3) {
      return res.status(400).json({ 
        error: 'You reached the maximum of 3 scans a day!' 
      });
    }

    const newVisit = await pool.query(
      'INSERT INTO visits (agent_id, customer_id, agent_lat, agent_lng, distance_meters, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [agent_id, customer_id, agent_lat, agent_lng, distance_meters, status]
    );

    res.json(newVisit.rows[0]);
  } catch (err) {
    console.error('VISIT LOG ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});