import { Router } from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import calendarAccess from '../../middlewares/calendarAccess.js';
import { ROLES } from '../../constants/index.js';
import * as controller from './calendar.controller.js';
import {
  createCalendarSchema,
  updateCalendarSchema,
  visibilitySchema,
  shareCalendarSchema,
  updateMemberSchema,
  calendarIdParams,
} from './calendar.validation.js';

const router = Router();

router.use(auth);

router.get('/', controller.list);
router.post('/', validate({ body: createCalendarSchema }), controller.create);

router.get(
  '/:id',
  validate({ params: calendarIdParams }),
  calendarAccess(ROLES.VIEWER),
  controller.getOne,
);
router.patch(
  '/:id',
  validate({ params: calendarIdParams, body: updateCalendarSchema }),
  calendarAccess(ROLES.OWNER),
  controller.update,
);
router.delete(
  '/:id',
  validate({ params: calendarIdParams }),
  calendarAccess(ROLES.OWNER),
  controller.remove,
);

// Налаштування поточного учасника: сховати для себе / мій колір (будь-яка роль)
router.patch(
  '/:id/visibility',
  validate({ params: calendarIdParams, body: visibilitySchema }),
  calendarAccess(ROLES.VIEWER),
  controller.updateVisibility,
);

// Спільний доступ (лише owner)
router.post(
  '/:id/share',
  validate({ params: calendarIdParams, body: shareCalendarSchema }),
  calendarAccess(ROLES.OWNER),
  controller.share,
);
router.patch(
  '/:id/members/:userId',
  validate({ body: updateMemberSchema }),
  calendarAccess(ROLES.OWNER),
  controller.updateMember,
);
router.delete('/:id/members/:userId', calendarAccess(ROLES.OWNER), controller.removeMember);

export default router;
