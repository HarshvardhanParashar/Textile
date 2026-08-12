import express from 'express';
import Challan from '../models/Challan.js';

const router = express.Router();

// GET all issued challans
router.get('/', async (req, res) => {
  try {
    const challans = await Challan.find().sort({ createdAt: -1 });
    res.json(challans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate new challan
router.post('/', async (req, res) => {
  try {
    const { partyName, address, gstOrMobile, transport, deliveryDate, remarks, items } = req.body;

    if (!partyName || !items || !items.length) {
      return res.status(400).json({ error: 'Party Name and at least 1 item are required' });
    }

    // Auto-generate Challan Number (e.g. CH-1001, CH-1002)
    const count = await Challan.countDocuments();
    const challanNo = `CH-${1001 + count}`;

    const totalMeters = items.reduce((acc, item) => acc + (Number(item.meters) || 0), 0);

    const challan = new Challan({
      challanNo,
      partyName,
      address,
      gstOrMobile,
      transport,
      deliveryDate: deliveryDate || new Date(),
      remarks,
      items,
      totalItems: items.length,
      totalMeters
    });

    await challan.save();
    res.status(201).json(challan);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;