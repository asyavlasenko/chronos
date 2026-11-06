import PropTypes from 'prop-types';

// Спільні PropTypes-форми для подій, календарів, користувачів (у формі відповідей API, docs/api.md)

export const dateLike = PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]);

export const participantShape = PropTypes.shape({
  user: PropTypes.string,
  email: PropTypes.string.isRequired,
  name: PropTypes.string,
  status: PropTypes.oneOf(['pending', 'accepted', 'declined']),
});

export const eventShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  type: PropTypes.oneOf(['arrangement', 'reminder', 'task', 'holiday']).isRequired,
  calendar: PropTypes.string.isRequired,
  creator: PropTypes.string,
  startAt: dateLike,
  endAt: dateLike,
  allDay: PropTypes.bool,
  color: PropTypes.string,
  location: PropTypes.string,
  reminderMinutesBefore: PropTypes.number,
  isCompleted: PropTypes.bool,
  priority: PropTypes.oneOf(['low', 'medium', 'high']),
  estimateMinutes: PropTypes.number,
  participants: PropTypes.arrayOf(participantShape),
});

export const memberShape = PropTypes.shape({
  user: PropTypes.string.isRequired,
  name: PropTypes.string,
  email: PropTypes.string,
  role: PropTypes.oneOf(['owner', 'editor', 'viewer']).isRequired,
  color: PropTypes.string,
  isHidden: PropTypes.bool,
});

export const calendarShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  description: PropTypes.string,
  color: PropTypes.string.isRequired,
  owner: PropTypes.string,
  isMain: PropTypes.bool,
  isShared: PropTypes.bool,
  isReadOnly: PropTypes.bool,
  isHidden: PropTypes.bool,
  myRole: PropTypes.oneOf(['owner', 'editor', 'viewer']),
  myColor: PropTypes.string,
  members: PropTypes.arrayOf(memberShape),
  eventsCount: PropTypes.number,
});

export const userShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  firstName: PropTypes.string,
  email: PropTypes.string.isRequired,
  country: PropTypes.string,
  timezone: PropTypes.string,
  defaultArrangementDuration: PropTypes.number,
  weekStartsOn: PropTypes.oneOf([0, 1]),
  timeFormat: PropTypes.oneOf(['24h', '12h']),
  showWeekNumbers: PropTypes.bool,
});

export const holidayShape = PropTypes.shape({
  date: PropTypes.string.isRequired,
  localName: PropTypes.string.isRequired,
  name: PropTypes.string,
});

export const inviteShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  kind: PropTypes.oneOf(['event', 'calendar']).isRequired,
  status: PropTypes.string,
  invitedBy: PropTypes.shape({ id: PropTypes.string, name: PropTypes.string }),
  event: eventShape,
  calendar: calendarShape,
});
