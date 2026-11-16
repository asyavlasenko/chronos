import mongoose from 'mongoose';
import { INVITE_KINDS, INVITE_STATUSES, ROLES, INVITE_TTL_DAYS } from '../../constants/index.js';

const { Schema } = mongoose;

const inviteSchema = new Schema(
  {
    kind: { type: String, enum: Object.values(INVITE_KINDS), required: true },
    token: { type: String, required: true, unique: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    event: { type: Schema.Types.ObjectId, ref: 'Event', default: null },
    calendar: { type: Schema.Types.ObjectId, ref: 'Calendar', default: null },
    role: { type: String, enum: [ROLES.EDITOR, ROLES.VIEWER], default: ROLES.VIEWER },

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
        delete out.token;
        return out;
      },
    },
  },
);

inviteSchema.index({ email: 1, status: 1 });
inviteSchema.index({ expiresAt: 1 });
inviteSchema.index({ event: 1 });
inviteSchema.index({ calendar: 1 });

const Invite = mongoose.model('Invite', inviteSchema);

export default Invite;
