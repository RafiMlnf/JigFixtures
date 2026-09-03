import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';

export interface NotificationItem {
  id: string;
  type: 'INVENTORY_RED' | 'INVENTORY_YELLOW' | 'WAITING_APPROVAL' | 'ABNORMALITY_OPEN';
  title: string;
  message: string;
  isRead: boolean;
  itemId?: string;
  userId: string;
  createdAt: string;
}

// Helper to construct headers with JWT token
function getAuthHeaders() {
  const token = Cookies.get('auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

const STORAGE_KEY = 'jigfixture_notifications';

function getLocalNotifications(): NotificationItem[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    // Initial mock notifications
    const initial: NotificationItem[] = [
      {
        id: 'notif-1',
        type: 'INVENTORY_RED',
        title: 'Critical Stock Alert',
        message: 'Pin Locator (TXMACH-ASAU010102) is out of stock (0 items).',
        isRead: false,
        itemId: '3',
        userId: 'user-1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'notif-2',
        type: 'WAITING_APPROVAL',
        title: 'Pending Approval',
        message: 'Azka A. submitted design revision for Sub Assy 1.',
        isRead: false,
        userId: 'user-1',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      }
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(stored);
}

function saveLocalNotifications(notifs: NotificationItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('API server returned error');
    return await res.json();
  } catch (error) {
    console.warn('[API] NestJS backend offline. Using fallback local storage for notifications.', error);
    return getLocalNotifications();
  }
}

export async function markNotificationAsRead(id: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to update status on server');
  } catch (error) {
    console.warn(`[API] NestJS backend offline. Marking notification ${id} as read in fallback storage.`, error);
    const notifs = getLocalNotifications();
    const updated = notifs.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    saveLocalNotifications(updated);
  }
}
