import mongoose from 'mongoose';

const OutletSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, default: '' },
  location: { type: String, default: '' },
  loomStart: { type: Number, default: null },
  loomEnd: { type: Number, default: null },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Outlet', OutletSchema);
