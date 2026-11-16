import { useMemo } from 'react';
import { initials } from '../utils/text';
import useAuth from './useAuth';
import useCalendars from './useCalendars';

const FALLBACK_COLORS = ['purple', 'green', 'orange', 'pink', 'graphite'];

function colorFor(id) {
  const sum = [...String(id)].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FALLBACK_COLORS[sum % FALLBACK_COLORS.length];
}

export default function usePeople() {
  const { user } = useAuth();
  const { calendars } = useCalendars();

  return useMemo(() => {
    const people = {};

    if (user) {
      people[user.id] = {
        id: user.id,
        name: 'Ти',
        fullName: user.name,
        email: user.email,
        initials: 'ТИ',
        color: 'blue',
        isMe: true,
      };
    }

    calendars.forEach((calendar) => {
      (calendar.members || []).forEach((member) => {
        if (people[member.user]) {
          if (!people[member.user].isMe && !people[member.user].hasOwnColor && member.color) {
            people[member.user].color = member.color;
            people[member.user].hasOwnColor = true;
          }
          return;
        }
        const name = member.name || (member.email || '').split('@')[0] || 'Учасник';
        people[member.user] = {
          id: member.user,
          name,
          fullName: name,
          email: member.email || '',
          initials: initials(name),
          color: member.color || colorFor(member.user),
          hasOwnColor: Boolean(member.color),
          isMe: false,
        };
      });
    });

    return people;
  }, [user, calendars]);
}
