import express from 'express';
import SparePart from '../models/SparePart.js';

const router = express.Router();

const normalizeSpareName = (value = '') => String(value || '').trim();
const getOutletFilter = (req) => {
  const outletId = String(req.query.outletId || req.body?.outletId || '').trim();
  return outletId ? { outletId } : {};
};

const findExistingSpare = async (payload, req) => {
  const name = normalizeSpareName(payload.name);

  if (!name) return null;

  const query = {
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    ...getOutletFilter(req)
  };

  return SparePart.findOne(query).sort({ updatedAt: -1 });
};

// GET all spare parts
router.get('/', async (req, res) => {
  try {
    const spares = await SparePart.find(getOutletFilter(req)).sort({ createdAt: -1 });
    res.json(spares);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add a new spare part or update existing stock if it already exists
router.post('/', async (req, res) => {
  try {
    const payload = { ...req.body };
    const name = normalizeSpareName(payload.name);
    const qty = Number(payload.quantity ?? 0);

    if (!name || Number.isNaN(qty)) {
      return res.status(400).json({ error: 'Part name and valid quantity are required' });
    }

    const existing = await findExistingSpare(payload, req);

    if (existing) {
      existing.name = name;
      existing.quantity = Number(existing.quantity || 0) + qty;

      existing.code = '';
      existing.machineType = '';
      existing.cost = 0;

      if (payload.unit) existing.unit = payload.unit;
      if (payload.supplier !== undefined && payload.supplier !== null) existing.supplier = payload.supplier;
      if (payload.minStock !== undefined && payload.minStock !== null) existing.minStock = Number(payload.minStock) || 0;
      if (payload.remarks !== undefined && payload.remarks !== null) existing.remarks = payload.remarks;
      if (payload.dateAdded) existing.dateAdded = payload.dateAdded;

      await existing.save();
      return res.status(200).json({ ...existing.toObject(), merged: true });
    }

    const newSpare = new SparePart({
      ...payload,
      outletId: String(payload.outletId || req.query.outletId || '').trim() || null,
      name,
      code: '',
      machineType: '',
      cost: 0,
      quantity: qty
    });
    await newSpare.save();
    res.status(201).json({ ...newSpare.toObject(), merged: false });
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
    await SparePart.findOneAndDelete({ _id: req.params.id, ...getOutletFilter(req) });
    res.json({ message: 'Deleted spare part' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;