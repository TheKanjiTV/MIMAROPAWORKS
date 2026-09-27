let csrf = '';
let sessionRequest: Promise<unknown> | null = null;
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function api<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  if (body !== undefined && !csrf) {
    sessionRequest ??= api('/auth/session').finally(() => {
      sessionRequest = null;
    });
    await sessionRequest;
  }
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: body === undefined ? 'GET' : method,
      credentials: 'same-origin',
      headers:
        body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError('We could not connect. Check your connection and try again.', 0);
  }
  const data = await response
    .json()
    .catch(() => ({ message: 'The service is unavailable. Please try again shortly.' }));
  if (!response.ok) {
    if (response.status === 403) csrf = '';
    throw new ApiError(data.message || 'Something went wrong. Please try again.', response.status);
  }
  if (data.csrf) csrf = data.csrf;
  if (path === '/auth/logout' || path === '/auth/reset-password') csrf = '';
  return data as T;
}
export async function upload<T>(path: string, file: File): Promise<T> {
  if (!csrf) await api('/auth/session');
  const form = new FormData(); form.append('resume', file);
  const response = await fetch(`/api${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf }, body: form });
  const data = await response.json().catch(() => ({ message: 'Upload failed.' }));
  if (!response.ok) throw new ApiError(data.message || 'Upload failed.', response.status);
  return data as T;
}
export async function uploadFiles<T>(path: string, files: File[]): Promise<T> {
  if (!csrf) await api('/auth/session');
  const form = new FormData(); files.forEach((file) => form.append('documents', file));
  const response = await fetch(`/api${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf }, body: form });
  const data = await response.json().catch(() => ({ message: 'Upload failed.' }));
  if (!response.ok) throw new ApiError(data.message || 'Upload failed.', response.status);
  return data as T;
}
