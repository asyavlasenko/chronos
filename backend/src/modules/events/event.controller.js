// TODO(@teammate1): контролери подій (design/screens/10-event-create.html, 11, 12)

export const list = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@teammate1): GET /api/events' });

export const create = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@teammate1): POST /api/events' });

export const getOne = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@teammate1): GET /api/events/:id' });

export const update = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@teammate1): PATCH /api/events/:id' });

export const remove = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@teammate1): DELETE /api/events/:id' });

export const invite = (req, res) =>
  res
    .status(501)
    .json({ status: 'error', message: 'TODO(@teammate1): POST /api/events/:id/invite' });
