import mongoose from 'mongoose';

const ChallanItemSchema = new mongoose.Schema({
  rollNo: { type: String, required: true },
  quality: { type: String, default: '' },
  remarks: { type: String, default: '' },
  meters: { type: Number, required: true, default: 0 },
  weight: { type: Number, default: 0 }
});

const ChallanSchema = new mongoose.Schema({
  outletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', default: null },
  no: { type: String }, // 👈 Keep this so Mongoose doesn't drop the 'no' property
  challanNo: { type: String, required: true },
  partyName: { type: String, required: true },
  address: { type: String, default: '' },
  gstOrMobile: { type: String, default: '' },
  transport: { type: String, default: '' },
  deliveryDate: { type: Date, default: Date.now },
  remarks: { type: String, default: '' },
  items: [ChallanItemSchema],
  totalMeters: { type: Number, default: 0 },
  totalItems: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Challan', ChallanSchema);
