import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['user', 'super_admin'],
    default: 'user'
  }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
