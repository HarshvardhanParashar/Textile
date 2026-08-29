import express from 'express';
import Outlet from '../models/Outlet.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const outlets = await Outlet.find().sort({ createdAt: -1 });
    res.json(outlets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, code, location } = req.body || {};
    const cleanedName = String(name || '').trim();
    if (!cleanedName) {
      return res.status(400).json({ error: 'Outlet name is required.' });
    }

    const outlet = await Outlet.create({
      name: cleanedName,
      code: String(code || '').trim(),
      location: String(location || '').trim(),
      isActive: true
    });

    res.status(201).json(outlet);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const outlet = await Outlet.findById(req.params.id);
    if (!outlet) return res.status(404).json({ error: 'Outlet not found.' });
    res.json(outlet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
