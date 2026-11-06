import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Одне свято у форматі Nager.Date (https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}). */
const holidaySchema = new Schema(
  {
    date: { type: String, required: true }, // 'YYYY-MM-DD' (без часу: свято — весь день у локальному часі)
    localName: { type: String, required: true }, // 'Різдво Христове'
    name: { type: String, required: true }, // 'Christmas Day'
    global: { type: Boolean, default: true },
    types: { type: [String], default: [] }, // ['Public']
  },
  { _id: false },
);

/**
 * Кеш свят по країні та року. Свята не зберігаються як Event —
 * фронт показує їх як віртуальний календар 'holidays' (read-only).
 */
const holidayCacheSchema = new Schema(
  {
    country: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
    year: { type: Number, required: true, min: 1970, max: 2100 },
    holidays: { type: [holidaySchema], default: [] },
    fetchedAt: { type: Date, default: Date.now }, // оновлювати, якщо старше env.holidays.cacheTtlDays
    source: { type: String, default: 'Nager.Date' },
  },
  { timestamps: true },
);

holidayCacheSchema.index({ country: 1, year: 1 }, { unique: true });

const HolidayCache = mongoose.model('HolidayCache', holidayCacheSchema);

export default HolidayCache;
