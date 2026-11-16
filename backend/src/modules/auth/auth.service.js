import bcrypt from 'bcryptjs';
import env from '../../config/env.js';
import { ROLES } from '../../constants/index.js';
import ApiError from '../../utils/ApiError.js';
import { sendPasswordResetEmail } from '../../utils/mailer.js';
import {
  hashToken,
  randomToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/tokens.js';
import Calendar from '../calendars/calendar.model.js';
import User from '../users/user.model.js';

const SALT_ROUNDS = 10;
const MAIN_CALENDAR = { name: 'Основний', description: 'Особисті справи', color: 'graphite' };

export const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);

export const comparePassword = (password, passwordHash) => bcrypt.compare(password, passwordHash);

export function issueTokens(user, { remember = true } = {}) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user, { remember }),
  };
}

export async function register({ email, password, name, country, timezone }) {
  if (await User.exists({ email })) {
    throw new ApiError(409, 'Користувач з таким email уже існує', [
      { field: 'email', message: 'Цей email уже зареєстрований' },
    ]);
  }

  const user = await User.create({
    email,
    passwordHash: await hashPassword(password),
    name,
    country: country || env.holidays.defaultCountry,
    timezone: timezone || 'Europe/Kyiv',
  });

  try {
    await Calendar.create({
      ...MAIN_CALENDAR,
      owner: user._id,
      isMain: true,
      members: [{ user: user._id, role: ROLES.OWNER }],
    });
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  return { user, ...issueTokens(user) };
}

export async function login({ email, password }, { remember = true } = {}) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const isValid = user ? await comparePassword(password, user.passwordHash) : false;
  if (!isValid) throw new ApiError(401, 'Невірний email або пароль');

  return { user, ...issueTokens(user, { remember }) };
}

export async function refresh(token) {
  if (!token) throw new ApiError(401, 'Сесія відсутня, увійди знову');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, 'Сесія закінчилась, увійди знову');
  }

  const user = payload.typ === 'refresh' ? await User.findById(payload.sub) : null;
  if (!user || user.tokenVersion !== payload.tv) {
    throw new ApiError(401, 'Сесія закінчилась, увійди знову');
  }

  const remember = payload.rm !== false;
  return { user, remember, ...issueTokens(user, { remember }) };
}

export async function requestPasswordReset(email) {
  const user = await User.findOne({ email });
  if (!user) return;

  const token = randomToken();
  user.passwordResetToken = hashToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + env.passwordResetTtlMinutes * 60 * 1000);
  await user.save();

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: `${env.clientUrl}/reset?token=${token}`,
      ttlMinutes: env.passwordResetTtlMinutes,
    });
  } catch (err) {
    console.error(`[mail] Не вдалося надіслати лист скидання пароля: ${err.message}`);
  }
}

export async function confirmPasswordReset({ token, password }) {
  const user = await User.findOne({
    passwordResetToken: hashToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
  });
  if (!user) throw new ApiError(400, 'Посилання недійсне або прострочене');

  user.passwordHash = await hashPassword(password);
  user.passwordResetToken = undefined;
  user.passwordResetExpiresAt = undefined;
  user.tokenVersion += 1;
  await user.save();
}
