import { Router } from 'express';
import validate from '../../middlewares/validate.js';
import auth from '../../middlewares/auth.js';
import * as controller from './auth.controller.js';
import {
  registerSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
} from './auth.validation.js';

const router = Router();

router.post('/register', validate({ body: registerSchema }), controller.register);
router.post('/login', validate({ body: loginSchema }), controller.login);
router.post('/logout', auth, controller.logout);
router.post('/refresh', controller.refresh); // refresh-токен береться з httpOnly cookie
router.post(
  '/password-reset',
  validate({ body: passwordResetRequestSchema }),
  controller.requestPasswordReset,
);
router.post(
  '/password-reset/confirm',
  validate({ body: passwordResetConfirmSchema }),
  controller.confirmPasswordReset,
);

export default router;
