import asyncHandler from '../../utils/asyncHandler.js';
import { serializeInvite } from './invite.serializer.js';
import * as inviteService from './invite.service.js';

export const listMine = asyncHandler(async (req, res) => {
  const invites = await inviteService.listPendingInvites(req.user.email);
  res.json({ invites: invites.map((invite) => serializeInvite(invite, { withToken: true })) });
});

export const getByToken = asyncHandler(async (req, res) => {
  const invite = await inviteService.getInviteByToken(req.params.token);
  res.json({ invite: serializeInvite(invite) });
});

export const accept = asyncHandler(async (req, res) => {
  const invite = await inviteService.acceptInvite(req.params.token, req.user);
  res.json({ invite: serializeInvite(invite) });
});

export const decline = asyncHandler(async (req, res) => {
  const invite = await inviteService.declineInvite(req.params.token, req.user);
  res.json({ invite: serializeInvite(invite) });
});
