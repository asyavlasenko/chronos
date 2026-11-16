import mongoose from 'mongoose';

const { Schema } = mongoose;

const holidaySchema = new Schema(
  {
    date: { type: String, required: true },
    localName: { type: String, required: true },
    name: { type: String, required: true },
    global: { type: Boolean, default: true },
    types: { type: [String], default: [] },
  },
  { _id: false },
);

const holidayCacheSchema = new Schema(
  {
    country: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
    year: { type: Number, required: true, min: 1970, max: 2100 },
    holidays: { type: [holidaySchema], default: [] },
    fetchedAt: { type: Date, default: Date.now },
    source: { type: String, default: 'Nager.Date' },
  },
  { timestamps: true },
);

holidayCacheSchema.index({ country: 1, year: 1 }, { unique: true });

const HolidayCache = mongoose.model('HolidayCache', holidayCacheSchema);

export default HolidayCache;
