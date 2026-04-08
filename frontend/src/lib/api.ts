const BASE = '';

// --- Types ---

export interface Trip {
  id: string;
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  cover_image: string | null;
  status: string;
  share_token: string;
  admin_token?: string;
  sweetbook_book_uid?: string;
  sweetbook_order_uid?: string;
  created_at: string;
  page_count: number;
  zone_stats: { total: number; claimed: number };
}

export interface TripDay {
  id: string;
  day_number: number;
  title: string | null;
  date: string | null;
  description: string | null;
  pages: Page[];
}

export interface Page {
  id: string;
  page_number: number;
  day_order: number | null;
  photo_url: string;
  caption: string | null;
  subtitle: string | null;
  zones: Zone[];
}

export interface Zone {
  id: string;
  zone_number: number;
  claimed_by: string | null;
  max_length: number;
  message: Message | null;
}

export interface Message {
  id: string;
  author_name: string;
  content: string;
  color: string;
  position_x: number;
  position_y: number;
  updated_at: string | null;
  created_at: string;
}

export interface EstimateItem {
  bookUid: string;
  title: string;
  pageCount: number;
  quantity: number;
  unitPrice: number;
}

export interface EstimateResponse {
  items: EstimateItem[];
  productAmount: number;
  shippingFee: number;
  totalAmount: number;
  paidCreditAmount: number;
  creditBalance: number;
  creditSufficient: boolean;
}

export interface CreditBalance {
  balance: number;
  currency: string;
  env: string;
}

// --- Auth ---

export interface AuthResponse {
  user_id: string;
  username: string;
  token: string;
}

export interface MyTrip {
  id: string;
  title: string;
  destination: string;
  status: string;
  created_at: string;
  page_count: number;
  admin_token: string;
  sweetbook_book_uid: string | null;
  sweetbook_order_uid: string | null;
}

// --- Helper ---

function adminHeaders(token: string) {
  return { 'X-Admin-Token': token };
}

function shareHeaders(token: string) {
  return { 'X-Share-Token': token };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- Trip ---

export async function createTrip(data: {
  title: string;
  destination: string;
  start_date?: string;
  end_date?: string;
}): Promise<Trip> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const userToken = localStorage.getItem('user_token');
  if (userToken) headers['X-User-Token'] = userToken;
  const res = await fetch(`${BASE}/api/trips`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function getTrip(tripId: string, adminToken: string): Promise<Trip> {
  const res = await fetch(`${BASE}/api/trips/${tripId}`, {
    headers: adminHeaders(adminToken),
  });
  return handleResponse(res);
}

export async function getTripByShare(shareToken: string): Promise<Trip> {
  const res = await fetch(`${BASE}/api/trips/share/${shareToken}`);
  return handleResponse(res);
}

export async function updateTripStatus(
  tripId: string,
  status: string,
  adminToken: string,
): Promise<void> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/status`, {
    method: 'PATCH',
    headers: { ...adminHeaders(adminToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
}

// --- Pages ---

export async function uploadPage(
  tripId: string,
  photo: File,
  adminToken: string,
  caption?: string,
  subtitle?: string,
): Promise<Page> {
  const form = new FormData();
  form.append('photo', photo);
  if (caption) form.append('caption', caption);
  if (subtitle) form.append('subtitle', subtitle);
  const res = await fetch(`${BASE}/api/trips/${tripId}/pages`, {
    method: 'POST',
    headers: adminHeaders(adminToken),
    body: form,
  });
  return handleResponse(res);
}

export async function uploadPagesBulk(
  tripId: string,
  photos: File[],
  adminToken: string,
  tripDayId?: string,
): Promise<{ created: number; pages: any[] }> {
  const form = new FormData();
  photos.forEach((p) => form.append('photos', p));
  if (tripDayId) form.append('trip_day_id', tripDayId);
  const res = await fetch(`${BASE}/api/trips/${tripId}/pages/bulk`, {
    method: 'POST',
    headers: adminHeaders(adminToken),
    body: form,
  });
  return handleResponse(res);
}

export async function getPages(
  tripId: string,
  token: string,
  isAdmin: boolean,
): Promise<Page[]> {
  const headers = isAdmin ? adminHeaders(token) : shareHeaders(token);
  const res = await fetch(`${BASE}/api/trips/${tripId}/pages`, { headers });
  return handleResponse(res);
}

export async function reorderPages(
  tripId: string,
  pageIds: string[],
  adminToken: string,
): Promise<void> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/pages/reorder`, {
    method: 'PATCH',
    headers: { ...adminHeaders(adminToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_ids: pageIds }),
  });
  return handleResponse(res);
}

// --- Days ---

export async function getDays(
  tripId: string,
  token: string,
  isAdmin: boolean,
): Promise<{ days: TripDay[] }> {
  const headers = isAdmin ? adminHeaders(token) : shareHeaders(token);
  const res = await fetch(`${BASE}/api/trips/${tripId}/days`, { headers });
  return handleResponse(res);
}

export async function updateDay(
  tripId: string,
  dayId: string,
  adminToken: string,
  data: { title?: string; description?: string },
): Promise<void> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/days/${dayId}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(adminToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updatePage(
  pageId: string,
  adminToken: string,
  data: { subtitle?: string; caption?: string },
): Promise<void> {
  const params = new URLSearchParams();
  if (data.subtitle !== undefined) params.set('subtitle', data.subtitle);
  if (data.caption !== undefined) params.set('caption', data.caption);
  const res = await fetch(`${BASE}/api/pages/${pageId}?${params.toString()}`, {
    method: 'PUT',
    headers: adminHeaders(adminToken),
  });
  return handleResponse(res);
}

export async function movePage(
  pageId: string,
  adminToken: string,
  targetDayId: string,
  position?: number,
): Promise<void> {
  const res = await fetch(`${BASE}/api/pages/${pageId}/move`, {
    method: 'PATCH',
    headers: { ...adminHeaders(adminToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_day_id: targetDayId, position }),
  });
  return handleResponse(res);
}

export async function setCover(
  tripId: string,
  adminToken: string,
  pageId: string,
): Promise<void> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/cover`, {
    method: 'PATCH',
    headers: { ...adminHeaders(adminToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_id: pageId }),
  });
  return handleResponse(res);
}

// --- Messages ---

export async function claimZone(
  zoneId: string,
  shareToken: string,
  data: { author_name: string; content: string; color?: string; position_x?: number; position_y?: number },
): Promise<Message> {
  const res = await fetch(`${BASE}/api/zones/${zoneId}/message`, {
    method: 'POST',
    headers: { ...shareHeaders(shareToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateMessage(
  messageId: string,
  token: string,
  isAdmin: boolean,
  data: { content?: string; color?: string; position_x?: number; position_y?: number },
): Promise<Message> {
  const headers = isAdmin
    ? { ...adminHeaders(token), 'Content-Type': 'application/json' }
    : { ...shareHeaders(token), 'Content-Type': 'application/json' };
  const res = await fetch(`${BASE}/api/messages/${messageId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteMessage(
  messageId: string,
  adminToken: string,
): Promise<void> {
  const res = await fetch(`${BASE}/api/messages/${messageId}`, {
    method: 'DELETE',
    headers: adminHeaders(adminToken),
  });
  return handleResponse(res);
}

// --- Audit ---

export interface AuditEntry {
  id: string;
  trip_id: string | null;
  action: string;
  actor: string;
  target: string | null;
  detail: string | null;
  created_at: string;
}

export async function getAuditLog(
  tripId: string,
  adminToken: string,
): Promise<AuditEntry[]> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/audit`, {
    headers: adminHeaders(adminToken),
  });
  return handleResponse(res);
}

// --- Book / Order ---

export async function finalizeBook(
  tripId: string,
  adminToken: string,
): Promise<{ book_uid: string; page_count: number }> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/finalize`, {
    method: 'POST',
    headers: adminHeaders(adminToken),
  });
  return handleResponse(res);
}

export async function placeOrder(
  tripId: string,
  adminToken: string,
  data: {
    shipping: {
      recipientName: string;
      recipientPhone: string;
      postalCode: string;
      address1: string;
      address2?: string;
      memo?: string;
    };
    quantity?: number;
  },
): Promise<any> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/order`, {
    method: 'POST',
    headers: { ...adminHeaders(adminToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function getOrderStatus(
  tripId: string,
  adminToken: string,
): Promise<any> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/order`, {
    headers: adminHeaders(adminToken),
  });
  return handleResponse(res);
}

export async function getEstimate(
  tripId: string,
  adminToken: string,
  quantity: number = 1,
): Promise<EstimateResponse> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/estimate?quantity=${quantity}`, {
    headers: adminHeaders(adminToken),
  });
  return handleResponse(res);
}

export async function getCreditBalance(adminToken: string): Promise<CreditBalance> {
  const res = await fetch(`${BASE}/api/credits/balance`, {
    headers: adminHeaders(adminToken),
  });
  return handleResponse(res);
}

export async function getCreditTransactions(
  limit: number = 20,
  offset: number = 0,
): Promise<any> {
  const res = await fetch(`${BASE}/api/credits/transactions?limit=${limit}&offset=${offset}`);
  return handleResponse(res);
}

export async function sandboxCharge(
  amount: number,
  memo?: string,
): Promise<any> {
  const res = await fetch(`${BASE}/api/credits/sandbox-charge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, memo }),
  });
  return handleResponse(res);
}

export async function cancelOrder(
  tripId: string,
  adminToken: string,
  reason: string,
): Promise<{ status: string; trip_status: string }> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/order/cancel`, {
    method: 'POST',
    headers: { ...adminHeaders(adminToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  return handleResponse(res);
}

export async function updateShipping(
  tripId: string,
  adminToken: string,
  shipping: Partial<{
    recipientName: string;
    recipientPhone: string;
    postalCode: string;
    address1: string;
    address2: string;
    memo: string;
  }>,
): Promise<{ status: string; fields: string[] }> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/order/shipping`, {
    method: 'PUT',
    headers: { ...adminHeaders(adminToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(shipping),
  });
  return handleResponse(res);
}

// --- Auth ---

export async function register(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(res);
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(res);
}

export async function getMyTrips(): Promise<MyTrip[]> {
  const token = localStorage.getItem('user_token') || '';
  const res = await fetch(`${BASE}/api/auth/my/trips`, {
    headers: { 'X-User-Token': token },
  });
  return handleResponse(res);
}
