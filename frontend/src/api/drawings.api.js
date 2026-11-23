import client from './client';

const toRangeParams = ({ from, to }) => ({ from: from.toISOString(), to: to.toISOString() });

export async function listDrawings(range) {
  const { data } = await client.get('/drawings', { params: toRangeParams(range) });
  return data.drawings;
}

export async function createDrawing(payload) {
  const { data } = await client.post('/drawings', payload);
  return data.drawing;
}

export async function deleteDrawing(id) {
  await client.delete(`/drawings/${id}`);
}

export async function clearDrawings(range) {
  await client.delete('/drawings', { params: toRangeParams(range) });
}
