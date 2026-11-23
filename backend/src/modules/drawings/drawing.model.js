import mongoose from 'mongoose';
import { COLOR_KEYS } from '../../constants/index.js';

const { Schema } = mongoose;

export const MIN_POINTS = 2;
export const MAX_POINTS = 2000;
export const MAX_WIDTH = 12;

const hasValidLength = (points) => points.length >= MIN_POINTS && points.length <= MAX_POINTS;

const drawingSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    color: { type: String, enum: COLOR_KEYS, required: true },
    width: { type: Number, min: 1, max: MAX_WIDTH, required: true },
    points: {
      type: [[Number]],
      required: true,
      validate: [hasValidLength, `У штриху має бути від ${MIN_POINTS} до ${MAX_POINTS} точок`],
    },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
  },
  { timestamps: true },
);

drawingSchema.index({ owner: 1, startAt: 1 });

const Drawing = mongoose.model('Drawing', drawingSchema);

export default Drawing;
