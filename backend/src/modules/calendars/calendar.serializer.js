export const MEMBER_POPULATE = { path: 'members.user', select: 'name email' };

const idOf = (value) => String(value?._id ?? value);

const isPopulated = (value) => Boolean(value) && typeof value.email === 'string';

export function serializeMember(member) {
  const populated = isPopulated(member.user);
  return {
    user: idOf(member.user),
    name: populated ? member.user.name : null,
    email: populated ? member.user.email : null,
    role: member.role,
    color: member.color ?? null,
    joinedAt: member.joinedAt,
  };
}

export function serializePendingInvite(invite) {
  return {
    id: String(invite._id),
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
  };
}

export function serializeCalendar(calendar, userId, { eventsCount = 0, pendingInvites = [] } = {}) {
  const mine = calendar.members.find((m) => idOf(m.user) === String(userId)) || null;
  return {
    id: String(calendar._id),
    name: calendar.name,
    description: calendar.description,
    color: calendar.color,
    owner: idOf(calendar.owner),
    isMain: calendar.isMain,
    isShared: calendar.members.length > 1,
    myRole: mine ? mine.role : null,
    myColor: mine ? (mine.color ?? null) : null,
    isHidden: Boolean(mine?.isHidden),
    members: calendar.members.map(serializeMember),
    pendingInvites: pendingInvites.map(serializePendingInvite),
    eventsCount,
    createdAt: calendar.createdAt,
    updatedAt: calendar.updatedAt,
  };
}
