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
  memberParams,
  inviteParams,
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

router.patch(
  '/:id/visibility',
  validate({ params: calendarIdParams, body: visibilitySchema }),
  calendarAccess(ROLES.VIEWER),
  controller.updateVisibility,
);

router.post(
  '/:id/share',
  validate({ params: calendarIdParams, body: shareCalendarSchema }),
  calendarAccess(ROLES.OWNER),
  controller.share,
);

router.patch(
  '/:id/members/:userId',
  validate({ params: memberParams, body: updateMemberSchema }),
  calendarAccess(ROLES.OWNER),
  controller.updateMember,
);
router.delete(
  '/:id/members/:userId',
  validate({ params: memberParams }),
  calendarAccess(ROLES.VIEWER),
  controller.removeMember,
);

router.delete(
  '/:id/invites/:inviteId',
  validate({ params: inviteParams }),
  calendarAccess(ROLES.OWNER),
  controller.cancelInvite,
);

export default router;
