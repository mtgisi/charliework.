const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...opts,
  });
  if (res.status === 401 || res.status === 403) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || 'Unauthorized');
    err.status = res.status;
    throw err;
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed');
  return res.json();
}

export const api = {
  me: () => req('/auth/me'),
  logout: () => req('/auth/logout', { method: 'POST' }),
  listTasks: () => req('/api/tasks'),
  createTask: (data) => req('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => req(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (id) => req(`/api/tasks/${id}`, { method: 'DELETE' }),
  reorder: (ids) => req('/api/tasks/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
  listQuestions: () => req('/api/questions'),
  createQuestion: (data) => req('/api/questions', { method: 'POST', body: JSON.stringify(data) }),
  updateQuestion: (id, data) => req(`/api/questions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteQuestion: (id) => req(`/api/questions/${id}`, { method: 'DELETE' }),
  listShortcuts: () => req('/api/shortcuts'),
  createShortcut: (data) => req('/api/shortcuts', { method: 'POST', body: JSON.stringify(data) }),
  updateShortcut: (id, data) => req(`/api/shortcuts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteShortcut: (id) => req(`/api/shortcuts/${id}`, { method: 'DELETE' }),
  listMembers: (all = false) => req(`/api/members${all ? '?all=1' : ''}`),
  createMember: (data) => req('/api/members', { method: 'POST', body: JSON.stringify(data) }),
  updateMember: (id, data) => req(`/api/members/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMember: (id) => req(`/api/members/${id}`, { method: 'DELETE' }),
  listMemberQuestions: () => req('/api/member-questions'),
  createMemberQuestion: (data) => req('/api/member-questions', { method: 'POST', body: JSON.stringify(data) }),
  updateMemberQuestion: (id, data) => req(`/api/member-questions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMemberQuestion: (id) => req(`/api/member-questions/${id}`, { method: 'DELETE' }),
};
