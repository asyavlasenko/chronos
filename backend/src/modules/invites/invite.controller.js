// TODO(@nastia): запрошення (design/screens/15-invite.html, блок «Запрошення» на 01-overview.html)
// Accept для kind 'calendar' → додати members[] з role із запрошення;
// для kind 'event' → participants[].status = 'accepted' і подія з'являється в головному календарі користувача.

export const listMine = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@nastia): GET /api/invites' });

export const getByToken = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@nastia): GET /api/invites/:token' });

export const accept = (req, res) =>
  res
    .status(501)
    .json({ status: 'error', message: 'TODO(@nastia): POST /api/invites/:token/accept' });

export const decline = (req, res) =>
  res
    .status(501)
    .json({ status: 'error', message: 'TODO(@nastia): POST /api/invites/:token/decline' });
