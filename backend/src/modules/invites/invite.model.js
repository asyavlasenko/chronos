import mongoose from 'mongoose';
import { INVITE_KINDS, INVITE_STATUSES, ROLES, INVITE_TTL_DAYS } from '../../constants/index.js';

const { Schema } = mongoose;

/**
 * Запрошення по email — на подію (kind 'event') або в календар (kind 'calendar').
 * Посилання в листі: `${CLIENT_URL}/invite/${token}` (design/screens/15-invite.html).
 * Якщо email ще не зареєстрований, запрошення спрацює після реєстрації з цим email.
 */
const inviteSchema = new Schema(
  {
    kind: { type: String, enum: Object.values(INVITE_KINDS), required: true },
    token: { type: String, required: true, unique: true }, // crypto.randomBytes(32).toString('hex')
    email: { type: String, required: true, lowercase: true, trim: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    event: { type: Schema.Types.ObjectId, ref: 'Event', default: null }, // kind 'event'
    calendar: { type: Schema.Types.ObjectId, ref: 'Calendar', default: null }, // kind 'calendar'
    role: { type: String, enum: [ROLES.EDITOR, ROLES.VIEWER], default: ROLES.VIEWER }, // лише для kind 'calendar'

    status: {
      type: String,
      enum: Object.values(INVITE_STATUSES),
      default: INVITE_STATUSES.PENDING,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
    respondedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        const out = { ...ret, id: ret._id };
        delete out._id;
        delete out.__v;
        delete out.token; // токен не віддаємо в списках
        return out;
      },
    },
  },
);

// Вхідні запрошення користувача (блок «Запрошення» на Огляді)
inviteSchema.index({ email: 1, status: 1 });
// Не TTL-індекс навмисно: прострочені лишаються в історії зі status 'expired'
inviteSchema.index({ expiresAt: 1 });
inviteSchema.index({ event: 1 });
inviteSchema.index({ calendar: 1 });

// TODO(@nastia): inviteSchema.pre('validate') — рівно одне з event/calendar відповідно до kind

const Invite = mongoose.model('Invite', inviteSchema);

export default Invite;
