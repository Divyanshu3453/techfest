export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) payload = form;
  else if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.data = data; // e.g. { code: 'DUPLICATE_FOUND', duplicates: [...] }
    throw err;
  }
  return data;
}

export const fmtDate = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
export const fmtDay = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const statusLabel = (s) => ({
  processing: 'Being triaged', assigned: 'Assigned', in_progress: 'In progress', resolved: 'Resolved – please confirm',
  reopened: 'Reopened', closed: 'Closed', linked: 'Linked to an existing ticket'
}[s] || s);
