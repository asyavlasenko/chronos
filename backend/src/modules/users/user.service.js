import ApiError from '../../utils/ApiError.js';
import { comparePassword, hashPassword, issueTokens } from '../auth/auth.service.js';
import User from './user.model.js';

export async function updateProfile(user, { notifications, ...fields }) {
  user.set(fields);
  if (notifications) user.notifications.set(notifications);
  await user.save();
  return user;
}

export async function changePassword(user, { currentPassword, newPassword }) {
  const account = await User.findById(user.id).select('+passwordHash');
  if (!account) throw new ApiError(401, 'Сесія недійсна або закінчилась, увійди знову');

  if (!(await comparePassword(currentPassword, account.passwordHash))) {
    throw new ApiError(400, 'Поточний пароль невірний', [
      { field: 'currentPassword', message: 'Поточний пароль невірний' },
    ]);
  }

  account.passwordHash = await hashPassword(newPassword);
  account.tokenVersion += 1;
  await account.save();

  return issueTokens(account);
}

export async function logoutEverywhere(user) {
  await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
}
