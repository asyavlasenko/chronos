import { Router } from 'express';
import auth from '../../middlewares/auth.js';
import * as controller from './holidays.controller.js';

const router = Router();

router.get('/', auth, controller.list);

export default router;
