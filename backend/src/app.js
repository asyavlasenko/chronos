import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import env from './config/env.js';
import notFound from './middlewares/notFound.js';
import errorHandler from './middlewares/errorHandler.js';

import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import calendarRoutes from './modules/calendars/calendar.routes.js';
import eventRoutes from './modules/events/event.routes.js';
import inviteRoutes from './modules/invites/invite.routes.js';
import holidayRoutes from './modules/holidays/holidays.routes.js';

// app.js не підключає БД (це робить server.js), тому його можна імпортувати в тестах без Mongo.
const app = express();

app.set('trust proxy', 1); // за nginx у Docker
app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/calendars', calendarRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/holidays', holidayRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
