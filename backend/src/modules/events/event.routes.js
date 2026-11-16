import { Router } from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { idParams } from '../../utils/validation.js';
import * as controller from './event.controller.js';
import {
  listEventsQuery,
  createEventSchema,
  updateEventSchema,
  inviteToEventSchema,
} from './event.validation.js';

const router = Router();

router.use(auth);

router.get('/', validate({ query: listEventsQuery }), controller.list);
router.post('/', validate({ body: createEventSchema }), controller.create);
router.get('/:id', validate({ params: idParams }), controller.getOne);
router.patch('/:id', validate({ params: idParams, body: updateEventSchema }), controller.update);
router.delete('/:id', validate({ params: idParams }), controller.remove);
router.post(
  '/:id/invite',
  validate({ params: idParams, body: inviteToEventSchema }),
  controller.invite,
);

export default router;
