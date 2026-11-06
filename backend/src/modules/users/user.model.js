import mongoose from 'mongoose';
import { TIME_FORMATS, WEEK_STARTS } from '../../constants/index.js';

const { Schema } = mongoose;

const notificationsSchema = new Schema(
  {
    emailReminders: { type: Boolean, default: true }, // нагадування на email
    push: { type: Boolean, default: false }, // push у браузері (Creative)
    sharedCalendarEmails: { type: Boolean, default: true }, // листи про запрошення та зміни
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

    // Налаштування календаря (design/screens/14-profile.html)
    country: { type: String, default: 'UA', uppercase: true, minlength: 2, maxlength: 2 }, // ISO 3166-1 alpha-2, для свят
    timezone: { type: String, default: 'Europe/Kyiv' }, // IANA, події зберігаються в UTC
    defaultArrangementDuration: { type: Number, default: 60, min: 5, max: 480 }, // хвилини
    weekStartsOn: { type: Number, enum: Object.values(WEEK_STARTS), default: WEEK_STARTS.MONDAY },
    timeFormat: { type: String, enum: TIME_FORMATS, default: '24h' },
    showWeekNumbers: { type: Boolean, default: true },
    showHolidays: { type: Boolean, default: true }, // видимість віртуального календаря свят
    notifications: { type: notificationsSchema, default: () => ({}) },

    // Безпека
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    passwordResetToken: { type: String, select: false }, // зберігати хеш, не сам токен
    passwordResetExpiresAt: { type: Date, select: false },
    tokenVersion: { type: Number, default: 0 }, // ++ робить недійсними всі refresh-токени («Вийти всюди»)
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
        return safe;
      },
    },
  },
);

// TODO(@nastia): методи/статики за потреби, напр. userSchema.methods.comparePassword(password)

const User = mongoose.model('User', userSchema);

export default User;
