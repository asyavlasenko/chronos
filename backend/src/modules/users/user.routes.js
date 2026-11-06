import { Router } from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as controller from './user.controller.js';
import { updateMeSchema, changePasswordSchema } from './user.validation.js';

const router = Router();

router.use(auth);

router.get('/me', controller.getMe);
router.patch('/me', validate({ body: updateMeSchema }), controller.updateMe);
router.post('/me/password', validate({ body: changePasswordSchema }), controller.changePassword);
router.post('/me/logout-everywhere', controller.logoutEverywhere);

export default router;
