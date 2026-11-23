import bcrypt from 'bcryptjs';
import env from '../../config/env.js';
import { ROLES } from '../../constants/index.js';
import ApiError from '../../utils/ApiError.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../utils/mailer.js';
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
const HOUR_MS = 60 * 60 * 1000;
const MAIN_CALENDAR = { name: 'Основний', description: 'Особисті справи', color: 'graphite' };

export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

export const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);

export const comparePassword = (password, passwordHash) => bcrypt.compare(password, passwordHash);

export function issueTokens(user, { remember = true } = {}) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user, { remember }),
  };
}

export async function createAccount(
  { email, password, name, country, timezone },
  { isEmailVerified = false } = {},
) {
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
    isEmailVerified,
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

  return user;
}

async function sendVerification(user, next) {
  const token = randomToken();
  user.set({
    emailVerificationToken: hashToken(token),
    emailVerificationExpiresAt: new Date(Date.now() + env.emailVerificationTtlHours * HOUR_MS),
  });
  await user.save();

  const query = next ? `?next=${encodeURIComponent(next)}` : '';
  try {
    const { previewUrl } = await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl: `${env.clientUrl}/verify-email/${token}${query}`,
      ttlHours: env.emailVerificationTtlHours,
    });
    return previewUrl;
  } catch (err) {
    console.error(`[mail] Не вдалося надіслати лист підтвердження: ${err.message}`);
    return null;
  }
}

export async function register({ next, ...account }) {
  const user = await createAccount(account);
  const previewUrl = await sendVerification(user, next);

  return { user, previewUrl };
}

export async function verifyEmail(token) {
  const user = await User.findOne({
    emailVerificationToken: hashToken(token),
    emailVerificationExpiresAt: { $gt: new Date() },
  });
  if (!user) throw new ApiError(400, 'Посилання недійсне або прострочене. Запроси новий лист');

  user.set({
    isEmailVerified: true,
    emailVerificationToken: undefined,
    emailVerificationExpiresAt: undefined,
  });
  await user.save();

  return { user, ...issueTokens(user) };
}

export async function resendVerification(email) {
  const user = await User.findOne({ email });
  if (!user || user.isEmailVerified) return null;

  return sendVerification(user);
}

export async function login({ email, password }, { remember = true } = {}) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const isValid = user ? await comparePassword(password, user.passwordHash) : false;
  if (!isValid) throw new ApiError(401, 'Невірний email або пароль');
  if (!user.isEmailVerified) {
    throw new ApiError(
      403,
      'Спершу підтверди email: ми надіслали лист із посиланням',
      undefined,
      EMAIL_NOT_VERIFIED,
    );
  }

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
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiresAt = undefined;
  user.tokenVersion += 1;
  await user.save();
}
