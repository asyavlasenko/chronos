import mongoose from 'mongoose';
import { TIME_FORMATS, WEEK_STARTS } from '../../constants/index.js';

const { Schema } = mongoose;

const notificationsSchema = new Schema(
  {
    emailReminders: { type: Boolean, default: true },
    push: { type: Boolean, default: false },
    sharedCalendarEmails: { type: Boolean, default: true },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    avatarUrl: { type: String, default: null },

    country: { type: String, default: 'UA', uppercase: true, minlength: 2, maxlength: 2 },
    timezone: { type: String, default: 'Europe/Kyiv' },
    defaultArrangementDuration: { type: Number, default: 60, min: 5, max: 480 },
    weekStartsOn: { type: Number, enum: Object.values(WEEK_STARTS), default: WEEK_STARTS.MONDAY },
    timeFormat: { type: String, enum: TIME_FORMATS, default: '24h' },
    showWeekNumbers: { type: Boolean, default: true },
    showHolidays: { type: Boolean, default: true },
    notifications: { type: notificationsSchema, default: () => ({}) },

    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        const safe = { ...ret, id: ret._id };
        delete safe._id;
        delete safe.__v;
        delete safe.passwordHash;
        delete safe.emailVerificationToken;
        delete safe.passwordResetToken;
        delete safe.passwordResetExpiresAt;
        delete safe.tokenVersion;
        return safe;
      },
    },
  },
);

const User = mongoose.model('User', userSchema);

export default User;
