import Cookies from 'js-cookie';
import { getApiBaseUrl } from './config';

const API_BASE_URL = getApiBaseUrl();

export interface NotificationItem {
  id: string;
  type: 'INVENTORY_RED' | 'INVENTORY_YELLOW' | 'WAITING_APPROVAL' | 'REVISION_REQUESTED' | 'ABNORMALITY_OPEN' | string;
  title: string;
  message: string;
  isRead: boolean;
  itemId?: string;
  designId?: string;
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
    return [];
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

export async function markAllNotificationsAsRead(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to mark all as read on server');
  } catch (error) {
    console.warn('[API] NestJS backend offline. Marking all notifications as read in fallback storage.', error);
    const notifs = getLocalNotifications();
    const updated = notifs.map((n) => ({ ...n, isRead: true }));
    saveLocalNotifications(updated);
  }
}
