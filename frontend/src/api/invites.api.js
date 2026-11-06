/** GET /invites → { invites: [...] } (вхідні, status pending) */
export async function listMyInvites() {
  throw new Error('TODO(@teammate2): invites.api.listMyInvites');
}

/** GET /invites/:token → { invite } (публічно, для сторінки /invite/:token) */
export async function getInvite() {
  throw new Error('TODO(@teammate2): invites.api.getInvite');
}

/** POST /invites/:token/accept → { invite } */
export async function acceptInvite() {
  throw new Error('TODO(@teammate2): invites.api.acceptInvite');
}

/** POST /invites/:token/decline → { invite } */
export async function declineInvite() {
  throw new Error('TODO(@teammate2): invites.api.declineInvite');
}
