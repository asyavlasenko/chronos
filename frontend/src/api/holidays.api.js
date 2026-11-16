import client from './client';

export async function listHolidays({ year, country } = {}) {
  const { data } = await client.get('/holidays', { params: { year, country } });
  return data;
}
