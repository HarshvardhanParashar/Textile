import express from 'express';
import User from '../models/User.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await User.findOne({
      username: String(username).trim().toLowerCase()
    }).lean();

    if (!user || user.password !== String(password)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const safeUser = {
      id: user._id,
      name: user.name,
      username: user.username,
      role: user.role
    };

    return res.json(safeUser);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    return res.json(users.map(user => ({
      id: user._id,
      name: user.name,
      username: user.username,
      role: user.role
    })));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, username, password, role } = req.body || {};
    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Name, username, and password are required.' });
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    const exists = await User.findOne({ username: normalizedUsername });
    if (exists) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const user = await User.create({
      name: String(name).trim(),
      username: normalizedUsername,
      password: String(password),
      role: role === 'super_admin' ? 'super_admin' : 'user'
    });

    return res.status(201).json({
      id: user._id,
      name: user.name,
      username: user.username,
      role: user.role
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
