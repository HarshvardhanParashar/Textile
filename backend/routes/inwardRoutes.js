import express from 'express';
import Inward from '../models/Inward.js';
import GreyRoll from '../models/GreyRoll.js';
import Outlet from '../models/Outlet.js';
const router = express.Router();

const normalizeLookupValue = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const getOutletFilter = (req) => {
  const outletId = String(req.query.outletId || req.body?.outletId || '').trim();
  return outletId ? { outletId } : {};
};

const normalizeLoomValue = (value) => normalizeLookupValue(value).replace(/^(loom|machine|mc)/, '');

router.get('/loom-range', async (req, res) => {
  try {
    const outletId = String(req.query.outletId || '').trim();
    if (!outletId) return res.status(400).json({ error: 'Select an outlet to view its loom range.' });
    const outlet = await Outlet.findById(outletId).select('loomStart loomEnd');
    if (!outlet) return res.status(404).json({ error: 'Outlet not found.' });
    res.json({ start: outlet.loomStart, end: outlet.loomEnd });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/loom-range', async (req, res) => {
  try {
    const outletId = String(req.body.outletId || req.query.outletId || '').trim();
    const start = Number(req.body.start);
    const end = Number(req.body.end);
    if (!outletId) return res.status(400).json({ error: 'Select an outlet before saving its loom range.' });
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end - start > 299) {
      return res.status(400).json({ error: 'Enter a valid loom range of up to 300 slots.' });
    }
    const outlet = await Outlet.findByIdAndUpdate(
      outletId,
      { $set: { loomStart: start, loomEnd: end } },
      { returnDocument: 'after', runValidators: true }
    ).select('loomStart loomEnd');
    if (!outlet) return res.status(404).json({ error: 'Outlet not found.' });
    res.json({ start: outlet.loomStart, end: outlet.loomEnd });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const matchesLookupValue = (storedValue, lookupValue) => {
  const normalizedStored = normalizeLookupValue(storedValue);
  const normalizedLookup = normalizeLookupValue(lookupValue);

  if (!normalizedStored || !normalizedLookup) return false;

  const variants = new Set([
    normalizedLookup,
    normalizedLookup.replace(/^(loom|machine|mc)/, ''),
    normalizedStored,
    normalizedStored.replace(/^(loom|machine|mc)/, '')
  ]);

  return Array.from(variants).some(v => 
    v && (normalizedStored === v || normalizedLookup === v || normalizedStored.includes(v) || normalizedLookup.includes(v))
  );
};

// 📋 GET: Fetch all Inward entries
router.get('/', async (req, res) => {
    try {
        const items = await Inward.find(getOutletFilter(req)).sort({ createdAt: -1 });
        const enriched = await Promise.all(items.map(async (item) => {
            if (item.type !== 'beam') return item.toObject();
            const totalLength = Number(item.wbLength || 0) || 0;
            const usedResult = await GreyRoll.aggregate([
                { $match: { beam: item.id } },
                { $group: { _id: null, usedMeters: { $sum: { $ifNull: ['$meters', 0] } } } }
            ]);
            const usedMeters = Number(usedResult[0]?.usedMeters || 0) || 0;
            return {
                ...item.toObject(),
                usedMeters,
                remainingMeters: Math.max(0, totalLength - usedMeters)
            };
        }));
        res.json(enriched);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📥 POST: Create new entry
router.post('/', async (req, res) => {
    try {
        const payload = { ...req.body };
        if (!payload.outletId) {
            payload.outletId = String(req.query.outletId || '').trim() || null;
        }
        const newEntry = new Inward(payload);
        await newEntry.save();
        res.status(201).json(newEntry);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ✏️ PUT: Update existing entry by ID
router.put('/:id', async (req, res) => {
    try {
        const payload = { ...req.body };
        const outletFilter = getOutletFilter(req);
        const updatedEntry = await Inward.findOneAndUpdate(
            { id: req.params.id, ...outletFilter },
            payload,
            { returnDocument: 'after', runValidators: true }
        );
        if (!updatedEntry) return res.status(404).json({ error: 'Record not found.' });
        res.json(updatedEntry);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// GET details by beam number from Inward Stock
router.get('/beam/:beamNo', async (req, res) => {
  try {
    const value = decodeURIComponent(req.params.beamNo).trim();
    const inwardData = await Inward.find({ type: 'beam', ...getOutletFilter(req) });
    const normalizedValue = normalizeLookupValue(value);
    const match = inwardData.find((record) => normalizeLookupValue(record.id) === normalizedValue);

    if (!match) {
      return res.status(404).json({ error: 'Beam Number not found in Inward Stock' });
    }

    const totalLength = Number(match.wbLength || 0) || 0;
    const usedResult = await GreyRoll.aggregate([
      { $match: { beam: match.id } },
      { $group: { _id: null, usedMeters: { $sum: { $ifNull: ['$meters', 0] } } } }
    ]);
    const usedMeters = Number(usedResult[0]?.usedMeters || 0) || 0;
    const remainingMeters = Math.max(0, totalLength - usedMeters);

    res.json({
      ...match.toObject(),
      usedMeters,
      remainingMeters
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET details by loom number from Inward Stock
router.get('/loom/:loomNo', async (req, res) => {
  try {
    const value = decodeURIComponent(req.params.loomNo).trim();
    const inwardData = await Inward.find({ type: 'beam', ...getOutletFilter(req) });
    const normalizedValue = normalizeLookupValue(value);
    const match = inwardData.find((record) => normalizeLookupValue(record.wbLoom) === normalizedValue);

    if (!match) {
      return res.status(404).json({ error: 'Loom Number not found in Inward Stock' });
    }

    res.json(match);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/wastage', async (req, res) => {
  try {
    const beams = await Inward.find({
      type: 'beam',
      'finishHistory.0': { $exists: true },
      ...getOutletFilter(req)
    }).select('id finishHistory');
    const records = beams.flatMap(beam => beam.finishHistory.map((finish, index) => ({
      id: `${beam.id}-${index + 1}`,
      beam: beam.id,
      loom: finish.loom,
      date: finish.date,
      construction: finish.construction,
      beamLength: finish.beamLength,
      producedMeters: finish.producedMeters,
      wastageMeters: finish.wastageMeters
    })));
    res.json(records.sort((a, b) => new Date(b.date) - new Date(a.date)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/loom/:loomNo/finish', async (req, res) => {
  try {
    const loomNo = normalizeLoomValue(decodeURIComponent(req.params.loomNo));
    const beams = await Inward.find({ type: 'beam', ...getOutletFilter(req) });
    const assignedBeam = beams.find((record) => normalizeLoomValue(record.wbLoom) === loomNo);
    if (!assignedBeam) return res.status(404).json({ error: 'No beam is assigned to this loom.' });

    const outletFilter = assignedBeam.outletId
      ? { outletId: assignedBeam.outletId }
      : { $or: [{ outletId: null }, { outletId: { $exists: false } }] };
    const usedResult = await GreyRoll.aggregate([
      { $match: { beam: assignedBeam.id, ...outletFilter } },
      { $group: { _id: null, usedMeters: { $sum: { $ifNull: ['$meters', 0] } } } }
    ]);
    const beamLength = Number(assignedBeam.wbLength || 0) || 0;
    const producedMeters = Number(usedResult[0]?.usedMeters || 0) || 0;
    const wastageMeters = Math.max(0, beamLength - producedMeters);
    const updated = await Inward.findOneAndUpdate(
      { id: assignedBeam.id, wbLoom: assignedBeam.wbLoom, ...getOutletFilter(req) },
      {
        $set: { wbLoom: '' },
        $push: {
          finishHistory: {
            loom: assignedBeam.wbLoom || loomNo,
            date: new Date(),
            construction: assignedBeam.construction || '',
            beamLength,
            producedMeters,
            wastageMeters
          }
        }
      },
      { returnDocument: 'after' }
    );
    if (!updated) return res.status(409).json({ error: 'This loom was already finished. Refresh and try again.' });
    res.json({ message: 'Loom finished and released.', beam: updated, wastageMeters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🗑️ DELETE: Remove entry by ID
router.delete('/:id', async (req, res) => {
    try {
        await Inward.findOneAndDelete({ id: req.params.id, ...getOutletFilter(req) });
        res.json({ message: 'Asset removed successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
