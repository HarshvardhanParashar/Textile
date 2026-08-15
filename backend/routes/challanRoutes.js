// import express from 'express';
// import Challan from '../models/Challan.js';

// const router = express.Router();

// // GET all issued challans
// router.get('/', async (req, res) => {
//   try {
//     const challans = await Challan.find().sort({ createdAt: -1 });
//     res.json(challans);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // POST generate new challan
// router.post('/', async (req, res) => {
//   try {
//     const { partyName, address, gstOrMobile, transport, deliveryDate, remarks, items } = req.body;

//     if (!partyName || !items || !items.length) {
//       return res.status(400).json({ error: 'Party Name and at least 1 item are required' });
//     }

//     // Secure Challan Number generation (prevents duplicate key conflicts)
//     const latestChallan = await Challan.findOne().sort({ createdAt: -1 });
//     let nextNum = 1001;

//     if (latestChallan && latestChallan.challanNo) {
//       const match = latestChallan.challanNo.match(/\d+/);
//       if (match) {
//         nextNum = parseInt(match[0], 10) + 1;
//       }
//     }
//     const challanNo = `CH-${nextNum}`;

//     const totalMeters = items.reduce((acc, item) => acc + (Number(item.meters) || 0), 0);

//     const challan = new Challan({
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

//     await challan.save();
//     res.status(201).json(challan);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// });

// export default router;


import express from 'express';
import mongoose from 'mongoose';
import Challan from '../models/Challan.js';
import GreyRoll from '../models/GreyRoll.js';

const router = express.Router();

// GET all available rolls (excluding dispatched ones)
router.get('/ready-rolls', async (req, res) => {
  try {
    const rolls = await GreyRoll.find({ status: { $ne: 'Dispatched' } });
    res.json(rolls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all issued challans
router.get('/', async (req, res) => {
  try {
    const challans = await Challan.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    res.json(challans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate new challan & automatically delete selected rolls
router.post('/', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { partyName, address, gstOrMobile, transport, deliveryDate, remarks, items } = req.body;

    if (!partyName || !items || !items.length) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Party Name and at least 1 item are required' });
    }

    // Auto-generate safe sequence Challan Number
    const latestChallan = await Challan.findOne().sort({ createdAt: -1 }).session(session);
    let nextNum = 1001;

    if (latestChallan && latestChallan.challanNo) {
      const match = latestChallan.challanNo.match(/\d+/);
      if (match) nextNum = parseInt(match[0], 10) + 1;
    }
    const challanNo = `CH-${nextNum}`;

    const totalMeters = items.reduce((acc, item) => acc + (Number(item.meters) || 0), 0);

    const challan = new Challan({
      no: challanNo, // Satisfies legacy index
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

    await challan.save({ session });

    // Extract item IDs and delete selected rolls from DB
    const rollIds = items.map(item => item._id || item.id).filter(Boolean);
    if (rollIds.length > 0) {
      await GreyRoll.deleteMany({ _id: { $in: rollIds } }).session(session);
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
