const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

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

app.post('/api/forgot-password', async (req, res) => {
  const { email, newPassword, masterKey } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email address not found in the system.' });
    }

    const user = userResult.rows[0];

    // Kung Admin ang nag-reset, kailangan ng Master Key at newPassword
    if (user.role === 'admin') {
      if (!newPassword) {
        return res.status(400).json({ error: 'New password is required for admin reset.' });
      }
      const validMasterKey = process.env.ADMIN_MASTER_KEY || 'GEO-MASTER-2026';
      if (!masterKey || masterKey !== validMasterKey) {
        return res.status(403).json({ error: 'Invalid Admin Master Recovery Key.' });
      }

      if (newPassword.length < 3) {
        return res.status(400).json({ error: 'New password must be at least 3 characters long.' });
      }

      const saltRounds = 10;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
      await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hashedNewPassword, email]);

      return res.json({ message: 'Admin password successfully reset! You can now log in.' });
    }

    // Kung Agent ang nag-forgot password, gumawa ng In-App Reset Request
    if (user.role === 'agent') {
      // Check kung may existing pending request na para hindi ma-flood
      const existingReq = await pool.query(
        "SELECT * FROM password_reset_requests WHERE user_id = $1 AND status = 'pending'",
        [user.id]
      );

      if (existingReq.rows.length > 0) {
        return res.status(400).json({ error: 'You already have a pending password reset request sent to the Admin.' });
      }

      await pool.query(
        "INSERT INTO password_reset_requests (user_id, status) VALUES ($1, 'pending')",
        [user.id]
      );

      return res.json({ message: 'Password reset request sent to Admin successfully! Please wait for approval.' });
    }

    res.status(400).json({ error: 'Invalid user role.' });
  } catch (err) {
    console.error('FORGOT PASSWORD ERROR:', err.message);
    res.status(500).json({ error: 'Server error while processing password reset.' });
  }
});

// GET Pending Reset Requests para kay Admin
app.get('/api/admin/reset-requests', async (req, res) => {
  try {
    const query = `
      SELECT r.id, r.user_id, u.name, u.email, r.status, r.created_at 
      FROM password_reset_requests r
      JOIN users u ON r.user_id = u.id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('FETCH RESET REQUESTS ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// APPROVE Reset Request (I-reset ang password ng agent sa 123 at i-update ang status)
app.put('/api/admin/reset-requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const reqResult = await client.query('SELECT * FROM password_reset_requests WHERE id = $1', [id]);
    if (reqResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reset request not found.' });
    }

    const resetReq = reqResult.rows[0];
    const userId = resetReq.user_id;

    const saltRounds = 10;
    const defaultHashedPassword = await bcrypt.hash('123', saltRounds);

    await client.query('UPDATE users SET password = $1 WHERE id = $2', [defaultHashedPassword, userId]);
    await client.query("UPDATE password_reset_requests SET status = 'approved' WHERE id = $1", [id]);

    await client.query('COMMIT');
    res.json({ message: 'Reset request approved! Agent password has been reset to default (123).' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('APPROVE RESET REQUEST ERROR:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// REJECT / DISMISS Reset Request
app.put('/api/admin/reset-requests/:id/reject', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "UPDATE password_reset_requests SET status = 'rejected' WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reset request not found.' });
    }

    res.json({ message: 'Reset request rejected.' });
  } catch (err) {
    console.error('REJECT RESET REQUEST ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/agents', async (req, res) => {
  try {
    const agents = await pool.query("SELECT id, name, email FROM users WHERE role = 'agent' ORDER BY id DESC");
    res.json(agents.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

app.put('/api/agents/:id/reset-password', async (req, res) => {
  const { id } = req.params;

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE id = $1 AND role = 'agent'", [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found.' });
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash('123', saltRounds);

    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedNewPassword, id]);

    res.json({ message: 'Agent password successfully reset to default (123).' });
  } catch (err) {
    console.error('RESET AGENT PASSWORD ERROR:', err.message);
    res.status(500).json({ error: 'Server error while resetting agent password.' });
  }
});

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

app.get('/api/customers', async (req, res) => {
  try {
    const customers = await pool.query('SELECT * FROM customers ORDER BY id DESC');
    res.json(customers.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

app.put('/api/customers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, address, lat, lng } = req.body;

  if (!name || !name.trim() || !address || !address.trim() || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Store Name, Address, Latitude, and Longitude are all required.' });
  }

  try {
    const updatedCustomer = await pool.query(
      'UPDATE customers SET name = $1, address = $2, latitude = $3, longitude = $4 WHERE id = $5 RETURNING *',
      [name.trim(), address.trim(), parseFloat(lat), parseFloat(lng), id]
    );

    if (updatedCustomer.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    res.json({
      message: 'Store location updated successfully',
      customer: updatedCustomer.rows[0]
    });
  } catch (err) {
    console.error('UPDATE STORE ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM visits WHERE customer_id = $1',