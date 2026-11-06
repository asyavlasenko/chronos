// TODO(@teammate1): GET /api/holidays?year=2026&country=UA (country за замовчуванням — з профілю користувача)
// Відповідь: { country, year, holidays: [{ date, localName, name }] }

export const list = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@teammate1): GET /api/holidays' });
