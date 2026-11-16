import asyncHandler from '../../utils/asyncHandler.js';
import { getHolidays } from './holidays.service.js';

export const list = asyncHandler(async (req, res) => {
  const { year = new Date().getUTCFullYear(), country = req.user.country } = req.query;
  res.json(await getHolidays({ country, year }));
});
