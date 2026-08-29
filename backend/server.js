// backend/server.js
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import GreyRoll from './models/GreyRoll.js';
import SparePart from './models/SparePart.js';
import Inward from './models/Inward.js';
import Challan from './models/Challan.js';
import Outlet from './models/Outlet.js';
import ReadyToSell from './models/ReadyToSell.js';

// Routes
import inwardRoutes from './routes/inwardRoutes.js';
import greyRollRoutes from './routes/greyRollRoutes.js';
import challanRoutes from './routes/challanRoutes.js';
import spareRoutes from './routes/spareRoutes.js';
import readyToSellRoutes from './routes/readytosell.js';
import authRoutes from './routes/authRoutes.js';
import outletRoutes from './routes/outletRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
// Bind all interfaces so Render and localhost can reach the server.
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 5000;
const connString = process.env.MONGO_URI || process.env.MONGODB_URI;

async function ensureDefaultOutlet() {
    let defaultOutlet = await Outlet.findOne().sort({ createdAt: 1 });
    if (!defaultOutlet) {
        defaultOutlet = await Outlet.create({
            name: 'Dhanlaxmi',
            location: 'Beawar',
            code: 'DLT',
            isActive: true
        });
        console.log('✅ Default outlet created: Dhanlaxmi');
    }
    return defaultOutlet;
}

async function assignCurrentRecordsToOutlet() {
    const defaultOutlet = await ensureDefaultOutlet();

    const invalidOutletQuery = {
        $or: [
            { outletId: { $exists: false } },
            { outletId: null },
            { outletId: { $type: 'string' } }
        ]
    };

    await Inward.updateMany(invalidOutletQuery, { $set: { outletId: defaultOutlet._id } });
    await GreyRoll.updateMany(invalidOutletQuery, { $set: { outletId: defaultOutlet._id } });
    await SparePart.updateMany(invalidOutletQuery, { $set: { outletId: defaultOutlet._id } });
    await Challan.updateMany(invalidOutletQuery, { $set: { outletId: defaultOutlet._id } });
    await ReadyToSell.updateMany(invalidOutletQuery, { $set: { outletId: defaultOutlet._id } });

    console.log(`✅ Existing records assigned to outlet: ${defaultOutlet.name}`);
}

async function mergeDuplicateSpareParts() {
    const spares = await SparePart.find().sort({ createdAt: 1 });
    const groups = new Map();

    for (const spare of spares) {
        const key = String(spare.name || '').trim().toLowerCase();
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(spare);
    }

    for (const items of groups.values()) {
        if (items.length < 2) continue;

        const primary = items[0];
        const mergedQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const mergedIssuances = items.flatMap(item => item.issuances || []);
        const firstSupplier = items.find(item => item.supplier && String(item.supplier).trim())?.supplier || '';
        const minStock = Math.min(...items.map(item => Number(item.minStock || 0)));
        const earliestDate = new Date(Math.min(...items.map(item => new Date(item.dateAdded || item.createdAt || Date.now).getTime())));
        const mergedRemarks = items
            .map(item => item.remarks)
            .filter(Boolean)
            .join(' | ')
            .trim();

        const keepId = primary._id;
        const deleteIds = items.filter(item => String(item._id) !== String(keepId)).map(item => item._id);

        await SparePart.updateOne(
            { _id: keepId },
            {
                $set: {
                    name: String(primary.name || '').trim(),
                    quantity: mergedQuantity,
                    code: '',
                    machineType: '',
                    cost: 0,
                    supplier: firstSupplier,
                    unit: primary.unit || 'Pcs',
                    minStock,
                    dateAdded: earliestDate,
                    remarks: mergedRemarks,
                    issuances: mergedIssuances
                }
            }
        );

        if (deleteIds.length) {
            await SparePart.deleteMany({ _id: { $in: deleteIds } });
        }
    }

    console.log('✅ Duplicate spare parts merged and normalized.');
}

app.use(cors());
app.use(express.json());

// 1. ALL API ROUTES MUST BE DEFINED FIRST
app.use('/api/auth', authRoutes);
app.use('/api/users', authRoutes);
app.use('/api/outlets', outletRoutes);
app.use('/api/inward', inwardRoutes);
app.use('/api/greyrolls', greyRollRoutes);
app.use('/api/challans', challanRoutes);
app.use('/api/spares', spareRoutes);
app.use('/api/readytosell', readyToSellRoutes);

// 2. STATIC FILES
app.use(express.static(path.join(__dirname, '../')));

// 3. SPA CATCH-ALL MUST IGNORE API ROUTES
app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Database Connection & Server Start
mongoose.connect(connString)
.then(async () => {
    console.log('📦 MongoDB Atlas Connected Safely.');

    await GreyRoll.updateMany(
        {},
        {
            $unset: {
                weaver: 1,
                weave: 1,
                epi: 1,
                ppi: 1,
                warpCount: 1,
                weftCount: 1,
                warpYarn: 1,
                weftYarn: 1,
                rate: 1,
                defect: 1,
                shrink: 1,
                crimp: 1
            }
        }
    );
    await GreyRoll.updateMany(
        { quality: { $ne: 'Defective' } },
        { $set: { quality: 'Sell' } }
    );
    console.log('✅ Grey roll fields migrated.');

    await mergeDuplicateSpareParts();
    await assignCurrentRecordsToOutlet();

    const User = (await import('./models/User.js')).default;
    const superAdminExists = await User.findOne({ username: 'yashg' });
    if (!superAdminExists) {
        await User.create({
            name: 'Yash Goyal',
            username: 'yashg',
            password: 'pass123',
            role: 'super_admin'
        });
        console.log('✅ Super admin seeded: yashg / pass123');
    }


app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
})
.catch((err) => {
    console.error('❌ Database error:', err.message);
});