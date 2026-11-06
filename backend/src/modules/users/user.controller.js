// TODO(@nastia): профіль поточного користувача (design/screens/14-profile.html)

export const getMe = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@nastia): GET /api/users/me' });

export const updateMe = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@nastia): PATCH /api/users/me' });

export const changePassword = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@nastia): POST /api/users/me/password' });

export const logoutEverywhere = (req, res) =>
  res
    .status(501)
    .json({ status: 'error', message: 'TODO(@nastia): POST /api/users/me/logout-everywhere' });
