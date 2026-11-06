// TODO(@nastia): контролери календарів (design/screens/08-calendars.html, 09-shared-calendar.html)

export const list = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@nastia): GET /api/calendars' });

export const create = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@nastia): POST /api/calendars' });

export const getOne = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@nastia): GET /api/calendars/:id' });

export const update = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@nastia): PATCH /api/calendars/:id' });

export const remove = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@nastia): DELETE /api/calendars/:id' });

export const updateVisibility = (req, res) =>
  res
    .status(501)
    .json({ status: 'error', message: 'TODO(@nastia): PATCH /api/calendars/:id/visibility' });

export const share = (req, res) =>
  res
    .status(501)
    .json({ status: 'error', message: 'TODO(@nastia): POST /api/calendars/:id/share' });

export const updateMember = (req, res) =>
  res
    .status(501)
    .json({ status: 'error', message: 'TODO(@nastia): PATCH /api/calendars/:id/members/:userId' });

export const removeMember = (req, res) =>
  res
    .status(501)
    .json({ status: 'error', message: 'TODO(@nastia): DELETE /api/calendars/:id/members/:userId' });
