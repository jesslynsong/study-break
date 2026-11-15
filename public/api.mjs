export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}
export async function requestJSON(path, { method = 'GET', body, code, timeout = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(path, { method, cache: 'no-store', signal: controller.signal, headers: {
      Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(code ? { Authorization: `Bearer ${code}` } : {})
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    let data;
    try { data = await response.json(); } catch { throw new ApiError('The online service is not ready. Please check back shortly.', 503); }
    if (!response.ok) throw new ApiError(data.error || 'The request was not accepted.', response.status);
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('The connection dropped before confirmation. Please reconnect and retry the same action.');
  } finally { clearTimeout(timer); }
}
