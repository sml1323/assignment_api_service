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

export interface Page {
  id: string;
  page_number: number;
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
  const res = await fetch(`${BASE}/api/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
): Promise<{ created: number; pages: any[] }> {
  const form = new FormData();
  photos.forEach((p) => form.append('photos', p));
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
