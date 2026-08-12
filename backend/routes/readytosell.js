import express from 'express';
import ReadyToSell from '../models/ReadyToSell.js';
import GreyRoll from '../models/GreyRoll.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const items = await ReadyToSell.find().sort({ createdAt: -1 });
    return res.status(200).json(items);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// CHANGE THIS LINE:
export default router;