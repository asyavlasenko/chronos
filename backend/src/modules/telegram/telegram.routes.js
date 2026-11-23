import { Router } from 'express';
import env from '../../config/env.js';
import auth from '../../middlewares/auth.js';
import rateLimit from '../../middlewares/rateLimit.js';
import * as controller from './telegram.controller.js';

const MINUTE_MS = 60 * 1000;

const router = Router();
const limitRequests = rateLimit({
  windowMs: env.telegram.rateLimitWindowMinutes * MINUTE_MS,
  max: env.telegram.rateLimitMax,
  message: 'Забагато запитів до Telegram. Спробуй за кілька хвилин',
  keyOf: (req) => req.user.id,
});

router.use(auth);

router.get('/', controller.status);
router.post('/link', limitRequests, controller.createLink);
router.delete('/link', controller.disconnect);
router.post('/test', limitRequests, controller.sendTest);

export default router;
