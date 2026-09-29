const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('kinexy_token');
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `API error: ${response.status}`);
  return body;
}
async function uploadImage(file) {
  const token = localStorage.getItem('kinexy_token');
  const form = new FormData();
  form.append('image', file);
  const response = await fetch(`${API_BASE}/uploads/image`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No se pudo cargar la imagen');
  return body;
}
const api = {
  get: (endpoint) => request(endpoint),
  post: (endpoint, data) => request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint, data) => request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  patch: (endpoint, data) => request(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
};
export const authService = { login: (data) => api.post('/auth/login', data), register: (data) => api.post('/auth/register', data), google: (credential, role = 'client', registration = {}) => api.post('/auth/google', { credential, role, ...registration }), me: () => api.get('/auth/me'), becomeCreator: (data = {}) => api.post('/user/become-creator', data) };
export const profilesService = { list: (params = {}) => api.get(`/profiles?${new URLSearchParams(params)}`), mine: () => api.get('/advertiser/profiles'), getById: (id) => api.get(`/profiles/${id}`), create: (data) => api.post('/profiles', data), update: (id, data) => api.put(`/profiles/${id}`, data), reviews: id => api.get(`/profiles/${id}/reviews`), addReview: (id, data) => api.post(`/profiles/${id}/reviews`, data), report: (id, data) => api.post(`/profiles/${id}/reports`, data), toggleLike: id => api.post(`/profiles/${id}/like`, {}) };
export const accountsService = { list: () => api.get('/users'), create: (data) => api.post('/users', data), setRole: (id, role) => api.patch(`/users/${id}/role`, { role }), remove: (id) => api.delete(`/users/${id}`), creditTokens: (userIds, amount, note = '') => api.post('/admin/wallet/credit', { user_ids: userIds, amount, note }), grantFreePlan: (id, plan, days) => api.post(`/admin/creators/${id}/grant-free-plan`, { plan, days }) };
export const membershipsService = { list: () => api.get('/membership-plans'), mine: () => api.get('/membership/me'), subscribe: tier => api.post('/membership/subscribe', { tier }), create: data => api.post('/membership-plans', data) };
export const postAccessService = { unlock: id => api.post(`/creator/posts/${id}/unlock`, {}) };
export const contactService = { status: id => api.get(`/profiles/${id}/contact`), unlock: id => api.post(`/profiles/${id}/contact/unlock`, {}) };
export const socialService = { follow: id => api.post(`/creators/${id}/follow`, {}), unfollow: id => api.delete(`/creators/${id}/follow`), status: id => api.get(`/creators/${id}/follow`) };
export const commentsService = { list: id => api.get(`/creator/posts/${id}/comments`), create: (id, text) => api.post(`/creator/posts/${id}/comments`, { text }), remove: id => api.delete(`/comments/${id}`) };
export const likesService = { status: id => api.get(`/creator/posts/${id}/likes`), toggle: id => api.post(`/creator/posts/${id}/likes`, {}) };
export const notificationsService = { list: () => api.get('/notifications'), markRead: () => api.patch('/notifications/read', {}) };
export const moderationService = { overview: () => api.get('/moderation/overview'), queue: () => api.get('/moderation/queue'), reports: () => api.get('/moderation/reports'), actions: () => api.get('/moderation/actions'), decideReport: (id, status, note = '') => api.patch(`/moderation/reports/${id}`, { status, note }), approveProfile: (id, approved) => api.patch(`/profiles/${id}/approve`, { approved }) };
export const permissionsService = { mine: () => api.get('/permissions/me'), matrix: () => api.get('/admin/role-permissions'), update: (role, permission, enabled) => api.patch(`/admin/role-permissions/${role}`, { permission, enabled }) };
export const walletService = { get: () => api.get('/wallet'), demoCredit: (amount, method) => api.post('/wallet/demo-credit', { amount, method }), spend: (productId) => api.post('/wallet/spend', { product_id: productId }) };
export const paymentsService = { packs: () => api.get('/payments/yape/packs'), mine: () => api.get('/payments/yape/mine'), request: (tokens, operation_code) => api.post('/payments/yape', { tokens, operation_code }), reviewQueue: () => api.get('/moderation/payments'), review: (id, decision, note = '') => api.patch(`/moderation/payments/${id}`, { decision, note }) };
export const tipsService = { send: (receiver_id, amount) => api.post('/tips', { receiver_id, amount }) };
export const withdrawalsService = { mine: () => api.get('/wallet/withdrawals'), request: data => api.post('/wallet/withdrawals', data), reviewQueue: () => api.get('/moderation/withdrawals'), review: (id, decision, note = '') => api.patch(`/moderation/withdrawals/${id}`, { decision, note }) };
export const publicationPlanService = { get: () => api.get('/creator/publication-plan'), request: (plan, operation_code) => api.post('/creator/publication-plan', { plan, operation_code }) };
export const creatorService = {
  studio: () => api.get('/creator/studio'),
  createPost: data => api.post('/creator/posts', data),
  setPostStatus: (id, status) => api.patch(`/creator/posts/${id}`, { status }),
  updatePost: (id, data) => api.patch(`/creator/posts/${id}`, data),
  uploadImage,
};
export default api;
