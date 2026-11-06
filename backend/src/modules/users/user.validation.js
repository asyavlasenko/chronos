import Joi from 'joi';

// PATCH /api/users/me:
// { name?, avatarUrl?, country? (2 літери), timezone? (IANA), defaultArrangementDuration? (5..480),
//   weekStartsOn? (0|1), timeFormat? ('24h'|'12h'), showWeekNumbers?, showHolidays?,
//   notifications? { emailReminders?, push?, sharedCalendarEmails? } }
export const updateMeSchema = Joi.object().unknown(true); // TODO(@nastia)

// POST /api/users/me/password: { currentPassword, newPassword (min 8) }
export const changePasswordSchema = Joi.object().unknown(true); // TODO(@nastia)
