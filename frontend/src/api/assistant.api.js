import client from './client';

const DRAFT_TIMEOUT_MS = 45000;

export async function getAssistantStatus() {
  const { data } = await client.get('/assistant');
  return data;
}

export async function requestDraft(text) {
  const { data } = await client.post('/assistant/draft', { text }, { timeout: DRAFT_TIMEOUT_MS });
  return data.draft;
}
