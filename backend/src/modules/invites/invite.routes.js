import { Router } from 'express';
import auth from '../../middlewares/auth.js';
import * as controller from './invite.controller.js';

const router = Router();

router.get('/', auth, controller.listMine);
router.get('/:token', controller.getByToken);
router.post('/:token/accept', auth, controller.accept);
router.post('/:token/decline', auth, controller.decline);

export default router;
