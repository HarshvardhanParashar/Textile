import mongoose from 'mongoose';

const readyToSellSchema = new mongoose.Schema({
  outletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', default: null },
  itemCode: { type: String, required: true, unique: true },
  sourceGreyRollId: { type: mongoose.Schema.Types.ObjectId, ref: 'GreyRoll' },
  fabricType: { type: String, required: true },
  qualityGrade: { 
    type: String, 
    enum: ['Standard', 'Second Quality'], 
    required: true 
  },
  quantityMeters: { type: Number, required: true, min: 0 },
  rollsCount: { type: Number, required: true, min: 1 },
  pricePerMeter: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['Available', 'Reserved', 'Sold'], 
    default: 'Available' 
  }
}, { timestamps: true });

export default mongoose.model('ReadyToSell', readyToSellSchema);