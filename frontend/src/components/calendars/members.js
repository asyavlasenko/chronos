// Довідкові функції для учасників календаря: аватар (ініціали + колір) і підписи ролей.
// Використовують CalendarRow, MemberRow, CalendarSettingsPanel, CalendarsPage, SharedCalendarPage.
import { people } from '../../mocks/data';
import { initials as toInitials } from '../../utils/text';

export const ROLE_LABELS = { owner: 'власник', editor: 'редактор', viewer: 'глядач' };

export const ROLE_OPTIONS = [
  { value: 'editor', label: 'Редактор' },
  { value: 'viewer', label: 'Глядач' },
];

/**
 * Учасник календаря → { id, initials, color, name } для Avatar/AvatarStack.
 * Колір — з членства (member.color), інакше з довідника людей; ініціали — з довідника або з імені.
 */
export function memberAvatar(member) {
  const person = people[member.user];
  const name = member.name || person?.name || member.email || '';
  return {
    id: member.user,
    initials: person?.initials || toInitials(name) || '?',
    color: member.color || person?.color || 'graphite',
    name,
  };
}

export const membersToAvatars = (members = []) => members.map(memberAvatar);
