import mongoose from 'mongoose';
import {
  EVENT_TYPES,
  PRIORITIES,
  PARTICIPANT_STATUSES,
  COLOR_KEYS,
} from '../../constants/index.js';

const { Schema } = mongoose;

/** Учасник події. user = null, доки запрошений не зареєструється. */
const participantSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    email: { type: String, required: true, lowercase: true, trim: true },
    status: {
      type: String,
      enum: Object.values(PARTICIPANT_STATUSES),
      default: PARTICIPANT_STATUSES.PENDING,
    },
    invitedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
  },
  { _id: false },
);

/**
 * Подія трьох типів (design/README.md, таблиця типів):
 *   arrangement — startAt + endAt (за замовчуванням startAt + user.defaultArrangementDuration)
 *   reminder    — лише startAt (момент)
 *   task        — startAt = дедлайн (може бути null → «без дати»), isCompleted, priority
 * Усі дати — UTC. Обов'язкові для будь-якого типу: title, type, calendar, creator.
 */
const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    type: { type: String, enum: Object.values(EVENT_TYPES), required: true },

    calendar: { type: Schema.Types.ObjectId, ref: 'Calendar', required: true },
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    startAt: { type: Date, default: null }, // для arrangement/reminder обов'язкова (перевіряє валідація)
    endAt: { type: Date, default: null }, // лише arrangement; > startAt
    allDay: { type: Boolean, default: false },

    color: { type: String, enum: COLOR_KEYS, default: null }, // null = колір календаря (або учасника у спільному)
    location: { type: String, trim: true, maxlength: 200, default: '' }, // адреса, кімната або посилання на Meet
    reminderMinutesBefore: { type: Number, min: 0, max: 10080, default: 10 },

    // task
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    priority: { type: String, enum: Object.values(PRIORITIES), default: PRIORITIES.MEDIUM },

    participants: { type: [participantSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        const out = { ...ret, id: ret._id };
        delete out._id;
        delete out.__v;
        return out;
      },
    },
  },
);

// Основний запит: події календарів користувача в діапазоні дат
eventSchema.index({ calendar: 1, startAt: 1 });
eventSchema.index({ calendar: 1, endAt: 1 });
eventSchema.index({ creator: 1, type: 1 });
// Пошук (?q=) по назві й опису
eventSchema.index({ title: 'text', description: 'text' }, { default_language: 'none' });
// Учасник бачить події, куди його запросили
eventSchema.index({ 'participants.user': 1 });

// TODO(@teammate1): pre('validate') — для arrangement вимагати startAt і endAt > startAt;
// для reminder — startAt; для task endAt не зберігати.

const Event = mongoose.model('Event', eventSchema);

export default Event;
