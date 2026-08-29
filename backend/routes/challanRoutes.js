import express from 'express';
import mongoose from 'mongoose';
import Challan from '../models/Challan.js';
import GreyRoll from '../models/GreyRoll.js';

// Try importing ReadyToSell if you have that model, or create dummy fallback
let ReadyToSell;
try {
  ReadyToSell = (await import('../models/ReadyToSell.js')).default;
} catch (e) {
  ReadyToSell = null;
}

const router = express.Router();

const getOutletFilter = (req) => {
  const outletId = String(req.query.outletId || req.body?.outletId || '').trim();
  return outletId ? { outletId } : {};
};

// 🔴 Auto-drop the old lingering "no_1" index from MongoDB as soon as routes initialize
Challan.collection.dropIndex('no_1').catch(() => {
  // Index already dropped or doesn't exist - safely ignore error
});

// GET all available rolls for selection in challan UI
router.get('/ready-rolls', async (req, res) => {
  try {
    const outletFilter = getOutletFilter(req);
    const rolls = await GreyRoll.find({ status: { $ne: 'Dispatched' }, ...outletFilter });
    res.json(rolls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all issued active challans
router.get('/', async (req, res) => {
  try {
    const challans = await Challan.find({ isDeleted: { $ne: true }, ...getOutletFilter(req) }).sort({ createdAt: -1 });
    res.json(challans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate new challan AND remove selected rolls from stock
router.post('/', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { partyName, address, gstOrMobile, transport, deliveryDate, remarks, items } = req.body;
    const outletId = String(req.body.outletId || req.query.outletId || '').trim() || null;

    const normalizedItems = (items || []).map(item => ({
      ...item,
      rollNo: item.rollNo || item.no || 'Item',
      quality: item.quality || '',
      remarks: item.remarks || '',
      meters: Number(item.meters || 0),
      weight: Number(item.weight || 0)
    }));

    if (!partyName || !normalizedItems.length) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Party Name and at least 1 item are required' });
    }

    // Auto-generate unique Challan Number (e.g. CH-1001, CH-1002)
    const latestChallan = await Challan.findOne().sort({ createdAt: -1 }).session(session);
    let nextNum = 1001;
    if (latestChallan && latestChallan.challanNo) {
      const match = latestChallan.challanNo.match(/\d+/);
      if (match) nextNum = parseInt(match[0], 10) + 1;
    }
    const challanNo = `CH-${nextNum}`;

    const totalMeters = normalizedItems.reduce((acc, item) => acc + (Number(item.meters) || 0), 0);

    // Create Challan Document (Setting 'no' explicitly fixes any fallback index issues)
    const challan = new Challan({
      outletId: outletId || null,
      no: challanNo,
      challanNo,
      partyName,
      address,
      gstOrMobile,
      transport,
      deliveryDate: deliveryDate || new Date(),
      remarks,
      items: normalizedItems,
      totalItems: normalizedItems.length,
      totalMeters
    });

    await challan.save({ session });

    //  REMOVE / DELETE SELECTED ROLLS FROM INVENTORY
    const rollIds = normalizedItems.map(item => item._id || item.id).filter(Boolean);

    if (rollIds.length > 0) {
      // 1. Delete or mark as Dispatched in GreyRoll collection
      await GreyRoll.deleteMany({ _id: { $in: rollIds } }).session(session);

      // 2. If you also use ReadyToSell stock, delete from there too
      if (ReadyToSell) {
        await ReadyToSell.deleteMany({ _id: { $in: rollIds } }).session(session);
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json(challan);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ error: err.message });
  }
});

export default router;

// import express from 'express';
// import mongoose from 'mongoose';
// import Challan from '../models/Challan.js';
// import GreyRoll from '../models/GreyRoll.js';

// const router = express.Router();

// // GET all available rolls (excluding dispatched ones)
// router.get('/ready-rolls', async (req, res) => {
//   try {
//     const rolls = await GreyRoll.find({ status: { $ne: 'Dispatched' } });
//     res.json(rolls);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // GET all issued challans
// router.get('/', async (req, res) => {
//   try {
//     const challans = await Challan.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
//     res.json(challans);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // POST generate new challan & automatically delete selected rolls
// router.post('/', async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { partyName, address, gstOrMobile, transport, deliveryDate, remarks, items } = req.body;

//     if (!partyName || !items || !items.length) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({ error: 'Party Name and at least 1 item are required' });
//     }

//     // Auto-generate safe sequence Challan Number
//     const latestChallan = await Challan.findOne().sort({ createdAt: -1 }).session(session);
//     let nextNum = 1001;

//     if (latestChallan && latestChallan.challanNo) {
//       const match = latestChallan.challanNo.match(/\d+/);
//       if (match) nextNum = parseInt(match[0], 10) + 1;
//     }
//     const challanNo = `CH-${nextNum}`;

//     const totalMeters = items.reduce((acc, item) => acc + (Number(item.meters) || 0), 0);

//     const challan = new Challan({
//       no: challanNo, // Satisfies legacy index
//       challanNo,
//       partyName,
//       address,
//       gstOrMobile,
//       transport,
//       deliveryDate: deliveryDate || new Date(),
//       remarks,
//       items,
//       totalItems: items.length,
//       totalMeters
//     });

//     await challan.save({ session });

//     // Extract item IDs and delete selected rolls from DB
//     const rollIds = items.map(item => item._id || item.id).filter(Boolean);
//     if (rollIds.length > 0) {
//       await GreyRoll.deleteMany({ _id: { $in: rollIds } }).session(session);
//     }

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json(challan);
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     res.status(400).json({ error: err.message });
//   }
// });

// export default router;
