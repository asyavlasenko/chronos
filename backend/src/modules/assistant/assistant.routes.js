import { Router } from 'express';
import env from '../../config/env.js';
import auth from '../../middlewares/auth.js';
import rateLimit from '../../middlewares/rateLimit.js';
import validate from '../../middlewares/validate.js';
import * as controller from './assistant.controller.js';
import { draftSchema } from './assistant.validation.js';

const MINUTE_MS = 60 * 1000;

const router = Router();
const limitRequests = rateLimit({
  windowMs: env.assistant.rateLimitWindowMinutes * MINUTE_MS,
  max: env.assistant.rateLimitMax,
  message: 'Забагато запитів до помічника. Спробуй за кілька хвилин',
  keyOf: (req) => req.user.id,
});

router.use(auth);

router.get('/', controller.status);
router.post('/draft', limitRequests, validate({ body: draftSchema }), controller.draft);

export default router;
