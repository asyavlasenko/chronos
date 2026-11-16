import mongoose from 'mongoose';
import {
  EVENT_TYPES,
  PRIORITIES,
  PARTICIPANT_STATUSES,
  COLOR_KEYS,
} from '../../constants/index.js';

const { Schema } = mongoose;

export const TYPE_RULE_MESSAGES = Object.freeze({
  startRequired: 'Для зустрічі та нагадування потрібні дата й час початку',
  endAfterStart: 'Кінець має бути пізніше за початок',
  completedTaskOnly: 'Позначити виконаною можна лише задачу',
});

const TYPE_RULE_PATHS = ['type', 'startAt', 'endAt', 'isCompleted', 'completedAt'];

export function typeRuleViolations({ type, startAt, endAt }) {
  const violations = [];

  if (type !== EVENT_TYPES.TASK && !startAt) {
    violations.push({ field: 'startAt', message: TYPE_RULE_MESSAGES.startRequired });
  }
  if (type === EVENT_TYPES.ARRANGEMENT && startAt && endAt && endAt <= startAt) {
    violations.push({ field: 'endAt', message: TYPE_RULE_MESSAGES.endAfterStart });
  }

  return violations;
}

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

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    type: { type: String, enum: Object.values(EVENT_TYPES), required: true },

    calendar: { type: Schema.Types.ObjectId, ref: 'Calendar', required: true },
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    allDay: { type: Boolean, default: false },

    color: { type: String, enum: COLOR_KEYS, default: null },
    location: { type: String, trim: true, maxlength: 200, default: '' },
    reminderMinutesBefore: { type: Number, min: 0, max: 10080, default: 10 },

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

eventSchema.index({ calendar: 1, startAt: 1 });
eventSchema.index({ calendar: 1, endAt: 1 });
eventSchema.index({ creator: 1, type: 1 });
eventSchema.index({ title: 'text', description: 'text' }, { default_language: 'none' });
eventSchema.index({ 'participants.user': 1 });

eventSchema.pre('validate', function applyTypeRules() {
  if (!this.isNew && !this.isModified(TYPE_RULE_PATHS)) return;

  if (this.type !== EVENT_TYPES.ARRANGEMENT) {
    this.endAt = null;
  }
  if (this.type !== EVENT_TYPES.TASK) {
    this.isCompleted = false;
    this.completedAt = null;
  }

  typeRuleViolations(this).forEach(({ field, message }) => this.invalidate(field, message));
});

const Event = mongoose.model('Event', eventSchema);

export default Event;
