import { Router } from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as controller from './holidays.controller.js';
import { listQuerySchema } from './holidays.validation.js';

const router = Router();

router.get('/', auth, validate({ query: listQuerySchema }), controller.list);

export default router;
