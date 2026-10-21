import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      default: '',
    },
    userName: {
      type: String,
      default: '',
    },
    subscriptionId: {
      type: String,
      default: '',
    },
    detail: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Activity || mongoose.model('Activity', activitySchema);
