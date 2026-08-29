import express from 'express';
import GreyRoll from '../models/GreyRoll.js';
import Inward from '../models/Inward.js';
const router = express.Router();

const normalizeLookupValue = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const getOutletFilter = (req) => {
    const outletId = String(req.query.outletId || req.body?.outletId || '').trim();
    return outletId ? { outletId } : {};
};

const getBeamRecord = async (beamValue, outletId = '') => {
    if (!beamValue) return null;
    const normalizedBeam = normalizeLookupValue(beamValue);
    if (!normalizedBeam) return null;

    const inwardQuery = { type: 'beam' };
    if (outletId) inwardQuery.outletId = outletId;
    const inwardData = await Inward.find(inwardQuery);
    return inwardData.find((record) => {
        const matchesId = normalizeLookupValue(record.id) === normalizedBeam;
        const matchesBeam = normalizeLookupValue(record.wbLoom || '') === normalizedBeam;
        return matchesId || matchesBeam;
    }) || null;
};

const calculateBeamUsage = async (beamRecord) => {
    const totalMeters = Number(beamRecord.wbLength || 0) || 0;
    const usedResult = await GreyRoll.aggregate([
        { $match: { beam: beamRecord.id, outletId: beamRecord.outletId ? beamRecord.outletId : { $exists: false } } },
        { $group: { _id: null, usedMeters: { $sum: { $ifNull: ['$meters', 0] } } } }
    ]);
    const usedMeters = Number(usedResult[0]?.usedMeters || 0) || 0;
    const remainingMeters = Math.max(0, totalMeters - usedMeters);
    return { totalMeters, usedMeters, remainingMeters };
};

// 📋 GET: Fetch all Grey Rolls
router.get('/', async (req, res) => {
    try {
        const rolls = await GreyRoll.find(getOutletFilter(req)).sort({ createdAt: -1 });
        res.json(rolls);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📥 POST: Create single roll
router.post('/', async (req, res) => {
    try {
        const payload = { ...req.body };
        const outletFilter = getOutletFilter(req);
        if (!payload.outletId && outletFilter.outletId) payload.outletId = outletFilter.outletId;

        const beamValue = payload.beam;
        if (beamValue) {
            const beamRecord = await getBeamRecord(beamValue, payload.outletId || '');
            if (!beamRecord) {
                return res.status(400).json({ error: `Beam ${beamValue} not found in inward stock.` });
            }

            const { totalMeters, usedMeters, remainingMeters } = await calculateBeamUsage(beamRecord);
            const newMeters = Number(req.body.meters || 0) || 0;

            if (totalMeters > 0 && remainingMeters === 0) {
                return res.status(400).json({
                    error: `Beam ${beamValue} is fully consumed. No more meters can be allocated.`
                });
            }

            if (newMeters > remainingMeters) {
                return res.status(400).json({
                    error: `Beam ${beamValue} has only ${remainingMeters} m remaining. You cannot add ${newMeters} m.`
                });
            }
        }

        const newRoll = new GreyRoll(payload);
        const savedRoll = await newRoll.save();
        res.status(201).json(savedRoll);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ✏️ PUT: Update roll by Roll Number
router.put('/:no', async (req, res) => {
    try {
        const outletFilter = getOutletFilter(req);
        const currentRoll = await GreyRoll.findOne({ no: req.params.no, ...outletFilter });
        if (!currentRoll) return res.status(404).json({ error: 'Roll not found.' });

        const previousBeam = currentRoll.beam;
        const previousMeters = Number(currentRoll.meters || 0) || 0;
        const nextBeam = req.body.beam || previousBeam;
        const nextMeters = Number(req.body.meters || 0) || previousMeters;

        if (nextBeam) {
            const beamRecord = await getBeamRecord(nextBeam, currentRoll.outletId || outletFilter.outletId || '');
            if (!beamRecord) {
                return res.status(400).json({ error: `Beam ${nextBeam} not found in inward stock.` });
            }

            const { totalMeters, usedMeters } = await calculateBeamUsage(beamRecord);
            const previousContribution = previousBeam === nextBeam ? previousMeters : 0;
            const projectedUsed = usedMeters - previousContribution + nextMeters;

            if (projectedUsed > totalMeters) {
                const available = Math.max(0, totalMeters - (usedMeters - previousContribution));
                return res.status(400).json({
                    error: `Beam ${nextBeam} has only ${available} m remaining. You cannot assign ${nextMeters} m.`
                });
            }
        }

        const payload = { ...req.body };
        if (!payload.outletId && outletFilter.outletId) payload.outletId = outletFilter.outletId;
        const updated = await GreyRoll.findOneAndUpdate(
            { no: req.params.no, ...outletFilter },
            payload,
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
        const outletFilter = getOutletFilter(req);
        const roll = await GreyRoll.findOne({ no: req.params.no, ...outletFilter });
        await GreyRoll.findOneAndDelete({ no: req.params.no, ...outletFilter });
        res.json({ message: 'Grey Roll deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;