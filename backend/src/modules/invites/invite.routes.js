import { Router } from 'express';
import auth from '../../middlewares/auth.js';
import * as controller from './invite.controller.js';

const router = Router();

// Перегляд запрошення за токеном — публічний (посилання з листа відкривають до входу)
router.get('/:token', controller.getByToken);

router.get('/', auth, controller.listMine);
router.post('/:token/accept', auth, controller.accept);
router.post('/:token/decline', auth, controller.decline);

export default router;
