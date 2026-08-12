import express from 'express';
import GreyRoll from '../models/GreyRoll.js';
const router = express.Router();

// 📋 GET: Fetch all Grey Rolls
router.get('/', async (req, res) => {
    try {
        const rolls = await GreyRoll.find().sort({ createdAt: -1 });
        res.json(rolls);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📥 POST: Create single roll
router.post('/', async (req, res) => {
    try {
        const newRoll = new GreyRoll(req.body);
        await newRoll.save();
        res.status(201).json(newRoll);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ✏️ PUT: Update roll by Roll Number
router.put('/:no', async (req, res) => {
    try {
        const updated = await GreyRoll.findOneAndUpdate(
            { no: req.params.no },
            req.body,
            { returnDocument: 'after', runValidators: true }
        );
        if (!updated) return res.status(404).json({ error: 'Roll not found.' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 🗑️ DELETE: Remove a roll
router.delete('/:no', async (req, res) => {
    try {
        await GreyRoll.findOneAndDelete({ no: req.params.no });
        res.json({ message: 'Grey Roll deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;