import mongoose from 'mongoose';

const GreyRollSchema = new mongoose.Schema({
    outletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', default: null },
    no: { type: String, required: true, unique: true },
    date: { type: String, required: true },
    beam: { type: String, default: '' },       // Beam / Warp reference entered in form
    inwardRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Inward' }, // Optional link to Inward document
    loom: { type: String, default: '' },
    construction: { type: String, default: '' },
    width: { type: Number, default: 0 },
    meters: { type: Number, required: true, default: 0 },
    weight: { type: Number, default: 0 },
    quality: { type: String, enum: ['Sell', 'Defective'], default: 'Sell' },
    status: { type: String, default: 'In Stock' },
    remarks: { type: String, default: '' }
}, { timestamps: true });

const GreyRoll = mongoose.models.GreyRoll || mongoose.model('GreyRoll', GreyRollSchema);
export default GreyRoll;
