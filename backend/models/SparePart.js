import mongoose from 'mongoose';

const IssuanceSchema = new mongoose.Schema({
  machineNo: { type: String, required: true },
  qtyIssued: { type: Number, required: true },
  dateIssued: { type: Date, default: Date.now },
  issuedTo: { type: String, default: '' },
  remarks: { type: String, default: '' }
});

const SparePartSchema = new mongoose.Schema({
  outletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', default: null },
  name: { type: String, required: true },
  code: { type: String, default: '' },
  machineType: { type: String, default: '' },
  quantity: { type: Number, required: true, default: 0 },
  unit: { type: String, default: 'Pcs' },
  supplier: { type: String, default: '' },
  cost: { type: Number, default: 0 },
  minStock: { type: Number, default: 0 },
  dateAdded: { type: Date, default: Date.now },
  remarks: { type: String, default: '' },
  issuances: [IssuanceSchema]
}, { timestamps: true });

export default mongoose.model('SparePart', SparePartSchema);