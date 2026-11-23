import mongoose from 'mongoose';

const { Schema } = mongoose;

const snoozeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    dueAt: { type: Date, required: true },
  },
  { timestamps: true },
);

snoozeSchema.index({ user: 1, event: 1 }, { unique: true });
snoozeSchema.index({ dueAt: 1 });

const TelegramSnooze = mongoose.model('TelegramSnooze', snoozeSchema);

export default TelegramSnooze;
