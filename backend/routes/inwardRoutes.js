import express from 'express';
import Inward from '../models/Inward.js';
const router = express.Router();

// 📋 GET: Fetch all Inward entries
router.get('/', async (req, res) => {
    try {
        const items = await Inward.find().sort({ createdAt: -1 });
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📥 POST: Create new entry
router.post('/', async (req, res) => {
    try {
        const newEntry = new Inward(req.body);
        await newEntry.save();
        res.status(201).json(newEntry);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ✏️ PUT: Update existing entry by ID
router.put('/:id', async (req, res) => {
    try {
        const updatedEntry = await Inward.findOneAndUpdate(
            { id: req.params.id },
            req.body,
            { returnDocument: 'after', runValidators: true }
        );
        if (!updatedEntry) return res.status(404).json({ error: 'Record not found.' });
        res.json(updatedEntry);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// GET yarn details by beam number from Inward Stock
router.get('/beam/:beamNo', async (req, res) => {
  try {
    const inwardData = await Inward.findOne({
      $or: [
        { beamNo: req.params.beamNo },
        { id: req.params.beamNo },
        { itemCode: req.params.beamNo }
      ]
    });

    if (!inwardData) {
      return res.status(404).json({ error: 'Beam Number not found in Inward Stock' });
    }

    res.json(inwardData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🗑️ DELETE: Remove entry by ID
router.delete('/:id', async (req, res) => {
    try {
        await Inward.findOneAndDelete({ id: req.params.id });
        res.json({ message: 'Asset removed successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
