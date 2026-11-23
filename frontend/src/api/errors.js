import axios from 'axios';

const UNAVAILABLE = 'Сервер недоступний, спробуй пізніше';
const UNKNOWN = 'Щось пішло не так, спробуй ще раз';
const NOT_IMPLEMENTED = 'Ця можливість ще в розробці';

function fallbackMessage(status) {
  if (status === 501) return NOT_IMPLEMENTED;
  if (status >= 500) return UNAVAILABLE;
  return UNKNOWN;
}

export function parseApiError(error) {
  const response = error?.response;
  if (!response) {
    const message = axios.isAxiosError(error) ? UNAVAILABLE : UNKNOWN;
    return { status: 0, message, fields: {}, code: null };
  }

  const { status, data } = response;
  const details = Array.isArray(data?.details) ? data.details : [];
  const fields = {};
  details.forEach((detail) => {
    if (detail?.field && !fields[detail.field]) fields[detail.field] = detail.message;
  });

  const hasMessage = typeof data?.message === 'string' && data.message !== '' && status !== 501;
  return {
    status,
    message: hasMessage ? data.message : fallbackMessage(status),
    fields,
    code: typeof data?.code === 'string' ? data.code : null,
  };
}
