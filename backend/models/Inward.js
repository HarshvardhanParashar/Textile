import mongoose from 'mongoose';
const InwardSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    type: { type: String, required: true, enum: ['yarn', 'beam'] },
    date: { type: String, required: true },
    status: { type: String, default: 'In Stock' },
    lot: { type: String, default: '' },
    remarks: { type: String, default: '' },

    // 🧶 Dedicated Yarn Roll Parameters
    yrCount: { type: String },
    yrType: { type: String },
    yrPly: { type: String, default: '1' },
    yrColor: { type: String, default: '' },
    yrWeight: { type: Number, default: 0 },
    yrQty: { type: Number, default: 1 },

    // 🪡 Dedicated Warp Beam Parameters
    wbEnds: { type: Number },
    wbReed: { type: Number },
    wbLength: { type: Number },
    wbWeight: { type: Number, default: 0 },
    wbNetYarn: { type: Number, default: 0 },
    wbEpi: { type: Number },
    wbLoom: { type: String }
}, { timestamps: true });

export default mongoose.model('Inward', InwardSchema);