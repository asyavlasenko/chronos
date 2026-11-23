import { Router } from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { idParams } from '../../utils/validation.js';
import * as controller from './drawing.controller.js';
import { createDrawingSchema, rangeQuery } from './drawing.validation.js';

const router = Router();

router.use(auth);

router.get('/', validate({ query: rangeQuery }), controller.list);
router.post('/', validate({ body: createDrawingSchema }), controller.create);
router.delete('/', validate({ query: rangeQuery }), controller.clear);
router.delete('/:id', validate({ params: idParams }), controller.remove);

export default router;
