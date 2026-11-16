import * as authService from '../../src/modules/auth/auth.service.js';
import Calendar from '../../src/modules/calendars/calendar.model.js';

let counter = 0;

export async function createUser(overrides = {}) {
  counter += 1;
  const dto = {
    email: `user${counter}@mail.com`,
    password: 'secret123',
    name: `Користувач ${counter}`,
    ...overrides,
  };
  const { user, accessToken } = await authService.register(dto);
  return {
    user,
    token: accessToken,
    password: dto.password,
    headers: { Authorization: `Bearer ${accessToken}` },
  };
}

export const getMainCalendar = (userId) => Calendar.findOne({ owner: userId, isMain: true });
