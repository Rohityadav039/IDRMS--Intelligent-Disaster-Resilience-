const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getCollectionAsync, insertRecordAsync, findByFieldAsync } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'idrms_secret';

// Middleware for JWT verification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Middleware for Admin role
const requireAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'Admin' || req.user.role === 'FirstResponder')) {
    next();
  } else {
    res.status(403).json({ error: 'Administrative permission required' });
  }
};

// Registration API
// Persists to the Supabase `users` table when SUPABASE_URL/SUPABASE_ANON_KEY
// (or SUPABASE_SERVICE_ROLE_KEY) are set in .env; otherwise falls back to the
// local idrms_data.json file automatically (see server/db.js).
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, password, role, phone, address, skills, location_lat, location_lng } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required' });
    }

    // Check if email already exists (Supabase-first, local-fallback lookup)
    const existing = await findByFieldAsync('users', 'email', email);
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);
    const userId = `USR-${Date.now().toString().slice(-6)}`;
    const userRole = role || 'Citizen';

    const newUser = {
      id: userId,
      full_name,
      email,
      password_hash,
      role: userRole,
      phone: phone || '',
      address: address || '',
      location_lat: parseFloat(location_lat) || 28.6139,
      location_lng: parseFloat(location_lng) || 77.2090,
      created_at: new Date().toISOString(),
      status: 'ACTIVE'
    };

    const insertedUser = await insertRecordAsync('users', newUser);

    // If role is Volunteer, automatically add to volunteer list
    if (userRole === 'Volunteer') {
      const volSkills = Array.isArray(skills) ? skills : (skills ? skills.split(',').map(s => s.trim()) : ['General Assistance']);
      await insertRecordAsync('volunteers', {
        id: `VOL-${Date.now().toString().slice(-4)}`,
        user_id: userId,
        full_name,
        phone: phone || '',
        skills: volSkills,
        lat: parseFloat(location_lat) || 28.6139,
        lng: parseFloat(location_lng) || 77.2090,
        location_name: address || 'Local Sector',
        status: 'AVAILABLE',
        deployed_disaster_id: null,
        last_active: new Date().toISOString()
      });
    }

    // Generate Token
    const token = jwt.sign({ id: insertedUser.id, email: insertedUser.email, role: insertedUser.role, name: insertedUser.full_name }, JWT_SECRET, { expiresIn: '24h' });

    const { password_hash: _, ...userWithoutPass } = insertedUser;
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: userWithoutPass
    });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login API
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await findByFieldAsync('users', 'email', email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.full_name }, JWT_SECRET, { expiresIn: '24h' });

    const { password_hash: _, ...userWithoutPass } = user;
    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPass
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get Current User Profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const users = await getCollectionAsync('users');
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { password_hash: _, ...userWithoutPass } = user;
    res.json(userWithoutPass);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// Get List of All Logged In / Registered Users (For Backend & Admin View)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const users = await getCollectionAsync('users');
    const usersList = users.map(u => {
      const { password_hash: _, ...userClean } = u;
      return userClean;
    });
    res.json({
      total_users: usersList.length,
      users: usersList
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load users' });
  }
});

module.exports = {
  router,
  authenticateToken,
  requireAdmin
};
