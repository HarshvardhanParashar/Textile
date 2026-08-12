import mongoose from 'mongoose';
const GreyRollSchema = new mongoose.Schema({
    no: { type: String, required: true, unique: true },
    date: { type: String, required: true },
    beam: { type: String, default: '' },
    loom: { type: String, default: '' },
    weaver: { type: String, default: '' },
    construction: { type: String, default: '' },
    weave: { type: String, default: '' },
    width: { type: Number, default: 0 },
    meters: { type: Number, required: true, default: 0 },
    weight: { type: Number, default: 0 },
    epi: { type: Number, default: 0 },
    ppi: { type: Number, default: 0 },
    warpCount: { type: String, default: '' },
    weftCount: { type: String, default: '' },
    warpYarn: { type: String, default: '' },
    weftYarn: { type: String, default: '' },
    rate: { type: Number, default: 0 },
    quality: { type: String, default: 'Pending' },
    defect: { type: String, default: 'None' },
    shrink: { type: Number, default: 0 },
    crimp: { type: Number, default: 0 },
    status: { type: String, default: 'In Stock' },
    remarks: { type: String, default: '' }
}, { timestamps: true });

const GreyRoll = mongoose.models.GreyRoll || mongoose.model('GreyRoll', GreyRollSchema);
export default GreyRoll;