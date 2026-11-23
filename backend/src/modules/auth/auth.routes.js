import { Router } from 'express';
import env from '../../config/env.js';
import rateLimit from '../../middlewares/rateLimit.js';
import validate from '../../middlewares/validate.js';
import * as controller from './auth.controller.js';
import {
  registerSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from './auth.validation.js';

const MINUTE_MS = 60 * 1000;

const router = Router();
const limitAttempts = rateLimit({
  windowMs: env.authRateLimit.windowMinutes * MINUTE_MS,
  max: env.authRateLimit.max,
  message: 'Забагато спроб. Спробуй ще раз трохи згодом',
});

router.post('/register', limitAttempts, validate({ body: registerSchema }), controller.register);
router.post('/login', limitAttempts, validate({ body: loginSchema }), controller.login);
router.post(
  '/verify-email',
  limitAttempts,
  validate({ body: verifyEmailSchema }),
  controller.verifyEmail,
);
router.post(
  '/verify-email/resend',
  limitAttempts,
  validate({ body: resendVerificationSchema }),
  controller.resendVerification,
);
router.post('/logout', controller.logout);
router.post('/refresh', controller.refresh);
router.post(
  '/password-reset',
  limitAttempts,
  validate({ body: passwordResetRequestSchema }),
  controller.requestPasswordReset,
);
router.post(
  '/password-reset/confirm',
  limitAttempts,
  validate({ body: passwordResetConfirmSchema }),
  controller.confirmPasswordReset,
);

export default router;
