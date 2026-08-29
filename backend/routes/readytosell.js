import express from 'express';
import ReadyToSell from '../models/ReadyToSell.js';
import GreyRoll from '../models/GreyRoll.js';

const router = express.Router();

const getOutletFilter = (req) => {
  const outletId = String(req.query.outletId || req.body?.outletId || '').trim();
  return outletId ? { outletId } : {};
};

router.get('/', async (req, res) => {
  try {
    const items = await ReadyToSell.find(getOutletFilter(req)).sort({ createdAt: -1 });
    return res.status(200).json(items);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// CHANGE THIS LINE:
export default router;