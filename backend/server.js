// backend/server.js
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

// Routes
import inwardRoutes from './routes/inwardRoutes.js';
import greyRollRoutes from './routes/greyRollRoutes.js';
import challanRoutes from './routes/challanRoutes.js';
import spareRoutes from './routes/spareRoutes.js';
import readyToSellRoutes from './routes/readytosell.js';
import authRoutes from './routes/authRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const connString = process.env.MONGO_URI || process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

// 1. ALL API ROUTES MUST BE DEFINED FIRST
app.use('/api/auth', authRoutes);
app.use('/api/users', authRoutes);
app.use('/api/inward', inwardRoutes);
app.use('/api/greyrolls', greyRollRoutes);
app.use('/api/challans', challanRoutes);
app.use('/api/spares', spareRoutes);
app.use('/api/readytosell', readyToSellRoutes);

// 2. STATIC FILES
app.use(express.static(path.join(__dirname, '../')));

// 3. SPA WILDCARD CATCH-ALL MUST BE LAST
app.get('/*splat', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Database Connection & Server Start
mongoose.connect(connString)
.then(async () => {
    console.log('📦 MongoDB Atlas Connected Safely.');

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

    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
})
.catch((err) => {
    console.error('❌ Database error:', err.message);
});