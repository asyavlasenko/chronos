import asyncHandler from '../../utils/asyncHandler.js';
import * as assistantService from './assistant.service.js';

export const status = (req, res) => {
  res.json(assistantService.getStatus());
};

export const draft = asyncHandler(async (req, res) => {
  const result = await assistantService.draftFromText(req.user, req.body.text);
  res.json({ draft: result });
});
