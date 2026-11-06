import { Router } from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as controller from './event.controller.js';
import {
  listEventsQuery,
  createEventSchema,
  updateEventSchema,
  inviteToEventSchema,
  eventIdParams,
} from './event.validation.js';

const router = Router();

router.use(auth);

// Роль у календарі для подій перевіряється в сервісі (assertCalendarRole),
// бо id календаря береться з тіла (POST) або з самої події (PATCH/DELETE).
router.get('/', validate({ query: listEventsQuery }), controller.list);
router.post('/', validate({ body: createEventSchema }), controller.create);
router.get('/:id', validate({ params: eventIdParams }), controller.getOne);
router.patch(
  '/:id',
  validate({ params: eventIdParams, body: updateEventSchema }),
  controller.update,
);
router.delete('/:id', validate({ params: eventIdParams }), controller.remove);
router.post(
  '/:id/invite',
  validate({ params: eventIdParams, body: inviteToEventSchema }),
  controller.invite,
);

export default router;
