import mongoose from 'mongoose';
import { ROLES, COLOR_KEYS } from '../../constants/index.js';

const { Schema } = mongoose;

const memberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: Object.values(ROLES), required: true },
    color: { type: String, enum: COLOR_KEYS, default: null },
    isHidden: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const calendarSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    color: { type: String, enum: COLOR_KEYS, required: true, default: 'graphite' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isMain: { type: Boolean, default: false },
    members: { type: [memberSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        const out = { ...ret, id: ret._id };
        delete out._id;
        delete out.__v;
        return out;
      },
    },
  },
);

calendarSchema.index(
  { owner: 1, isMain: 1 },
  { unique: true, partialFilterExpression: { isMain: true } },
);
calendarSchema.index({ 'members.user': 1 });

calendarSchema.virtual('isShared').get(function isShared() {
  return this.members.length > 1;
});

const Calendar = mongoose.model('Calendar', calendarSchema);

export default Calendar;
