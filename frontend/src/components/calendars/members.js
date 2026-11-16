import { initials as toInitials } from '../../utils/text';

export const ROLE_LABELS = { owner: 'власник', editor: 'редактор', viewer: 'глядач' };

export const ROLE_OPTIONS = [
  { value: 'editor', label: 'Редактор' },
  { value: 'viewer', label: 'Глядач' },
];

const localPart = (email) => (email || '').split('@')[0];

export function memberAvatar(member, people = {}) {
  const person = people[member.user];
  const name = person?.name || member.name || localPart(member.email) || 'Учасник';
  return {
    id: member.user,
    initials: person?.initials || toInitials(name) || '?',
    color: member.color || person?.color || 'graphite',
    name,
  };
}

export const membersToAvatars = (members = [], people = {}) =>
  members.map((member) => memberAvatar(member, people));
