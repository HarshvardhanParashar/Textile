import express from 'express';
import SparePart from '../models/SparePart.js';

const router = express.Router();

// GET all spare parts
router.get('/', async (req, res) => {
  try {
    const spares = await SparePart.find().sort({ createdAt: -1 });
    res.json(spares);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add a new spare part
router.post('/', async (req, res) => {
  try {
    const newSpare = new SparePart(req.body);
    await newSpare.save();
    res.status(201).json(newSpare);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST issue stock to a machine
router.post('/:id/issue', async (req, res) => {
  try {
    const { machineNo, qtyIssued, dateIssued, issuedTo, remarks } = req.body;
    const qty = Number(qtyIssued);

    const spare = await SparePart.findById(req.params.id);
    if (!spare) return res.status(404).json({ error: 'Part not found' });

    if (spare.quantity < qty) {
      return res.status(400).json({ error: `Insufficient stock! Current stock: ${spare.quantity}` });
    }

    spare.quantity -= qty;
    spare.issuances.push({ machineNo, qtyIssued: qty, dateIssued, issuedTo, remarks });
    await spare.save();

    res.json(spare);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE an issuance record (and restore inventory)
router.delete('/:id/issue/:issueId', async (req, res) => {
  try {
    const spare = await SparePart.findById(req.params.id);
    if (!spare) return res.status(404).json({ error: 'Part not found' });

    const issuance = spare.issuances.id(req.params.issueId);
    if (issuance) {
      spare.quantity += issuance.qtyIssued;
      issuance.deleteOne();
      await spare.save();
    }
    res.json(spare);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a spare part
router.delete('/:id', async (req, res) => {
  try {
    await SparePart.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted spare part' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;