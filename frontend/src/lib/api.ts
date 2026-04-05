const BASE = '';

export interface Event {
  id: string;
  title: string;
  event_type: string;
  recipient_name: string;
  organizer_name?: string;
  share_code: string;
  admin_token?: string;
  status: string;
  sweetbook_book_uid?: string;
  sweetbook_order_uid?: string;
  created_at: string;
  contribution_count: number;
}

export interface Contribution {
  id: string;
  contributor_name: string;
  message: string;
  image_filename?: string;
  image_url?: string;
  page_order: number;
  created_at: string;
}

export async function createEvent(data: {
  title: string;
  event_type: string;
  recipient_name: string;
  organizer_name: string;
}): Promise<Event> {
  const res = await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail || 'Error');
  return res.json();
}

export async function getEvent(shareCode: string): Promise<Event> {
  const res = await fetch(`${BASE}/api/events/${shareCode}`);
  if (!res.ok) throw new Error((await res.json()).detail || 'Error');
  return res.json();
}

export async function getEventAdmin(shareCode: string, token: string): Promise<Event> {
  const res = await fetch(`${BASE}/api/events/${shareCode}/admin?token=${token}`);
  if (!res.ok) throw new Error((await res.json()).detail || 'Error');
  return res.json();
}

export async function getContributions(shareCode: string): Promise<Contribution[]> {
  const res = await fetch(`${BASE}/api/events/${shareCode}/contributions`);
  if (!res.ok) throw new Error((await res.json()).detail || 'Error');
  return res.json();
}

export async function createContribution(
  shareCode: string,
  data: { contributor_name: string; message: string; image?: File }
): Promise<Contribution> {
  const form = new FormData();
  form.append('contributor_name', data.contributor_name);
  form.append('message', data.message);
  if (data.image) form.append('image', data.image);
  const res = await fetch(`${BASE}/api/events/${shareCode}/contributions`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error((await res.json()).detail || 'Error');
  return res.json();
}

export async function createBook(shareCode: string, token: string): Promise<any> {
  const res = await fetch(`${BASE}/api/events/${shareCode}/book?token=${token}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error((await res.json()).detail || 'Error');
  return res.json();
}

export async function estimateOrder(shareCode: string, token: string): Promise<any> {
  const res = await fetch(`${BASE}/api/events/${shareCode}/estimate?token=${token}`);
  if (!res.ok) throw new Error((await res.json()).detail || 'Error');
  return res.json();
}

export async function createOrder(
  shareCode: string,
  token: string,
  shipping: {
    recipient_name: string;
    recipient_phone: string;
    postal_code: string;
    address1: string;
    address2?: string;
    memo?: string;
  }
): Promise<any> {
  const res = await fetch(`${BASE}/api/events/${shareCode}/order?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(shipping),
  });
  if (!res.ok) throw new Error((await res.json()).detail || 'Error');
  return res.json();
}
