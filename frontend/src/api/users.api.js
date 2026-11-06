/** GET /users/me → { user } */
export async function getMe() {
  throw new Error('TODO(@teammate2): users.api.getMe');
}

/** PATCH /users/me { name?, country?, timezone?, defaultArrangementDuration?, weekStartsOn?, … } → { user } */
export async function updateMe() {
  throw new Error('TODO(@teammate2): users.api.updateMe');
}

/** POST /users/me/password { currentPassword, newPassword } → 204 */
export async function changePassword() {
  throw new Error('TODO(@teammate2): users.api.changePassword');
}
