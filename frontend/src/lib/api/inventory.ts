import { JigFixtureItem } from '@/context/AppContext';
import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';

// Helper to construct headers with JWT token
function getAuthHeaders() {
  const token = Cookies.get('auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Shared fallback local storage keys
const ITEMS_STORAGE_KEY = 'jigfixture_items';

// Helper to get local storage fallback
function getLocalItems(): JigFixtureItem[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(ITEMS_STORAGE_KEY);
  if (!stored) return [];
  return JSON.parse(stored);
}

// Helper to save to local storage fallback
function saveLocalItems(items: JigFixtureItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
}

export async function fetchInventoryItems(filters?: {
  search?: string;
  line?: string;
  status?: string;
}): Promise<JigFixtureItem[]> {
  try {
    const queryParams = new URLSearchParams();
    if (filters?.search) queryParams.append('search', filters.search);
    if (filters?.line && filters.line !== 'All') queryParams.append('lineProduct', filters.line);
    if (filters?.status && filters.status !== 'All') queryParams.append('indicator', filters.status);
    
    // We request a high limit to get all items since front-end does client-side search/filters in some subviews
    queryParams.append('limit', '100');

    const res = await fetch(`${API_BASE_URL}/inventory?${queryParams.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!res.ok) throw new Error('API server returned error');
    const result = await res.json();
    
    // Unpack NestJS response format { data: [...] }
    return result.data || result;
  } catch (error) {
    console.warn('[API] NestJS backend offline or returned error. Using fallback local storage.', error);
    
    // Fallback logic
    let items = getLocalItems();
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(i => i.noReg.toLowerCase().includes(q) || i.assyPartName.toLowerCase().includes(q));
    }
    if (filters?.line && filters.line !== 'All') {
      items = items.filter(i => i.lineProduct === filters.line);
    }
    if (filters?.status && filters.status !== 'All') {
      items = items.filter(i => {
        if (filters.status === 'GREEN') return i.actualStock >= i.minimumStock && i.actualStock > 0;
        if (filters.status === 'YELLOW') return i.actualStock > 0 && i.actualStock < i.minimumStock;
        if (filters.status === 'RED') return i.actualStock === 0;
        return true;
      });
    }
    return items;
  }
}

export async function fetchInventoryItemById(id: string): Promise<JigFixtureItem | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/inventory/${id}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Item not found');
    return await res.json();
  } catch (error) {
    console.warn(`[API] NestJS backend offline. Loading item ${id} from fallback local storage.`, error);
    const items = getLocalItems();
    return items.find(i => i.id === id) || null;
  }
}

export async function updateInventoryStock(
  id: string,
  minStock: number,
  actualStock: number,
  lifecycleStatus?: string
): Promise<JigFixtureItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/inventory/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ minimumStock: minStock, actualStock, lifecycleStatus }),
    });

    if (!res.ok) throw new Error('Failed to update item on server');
    return await res.json();
  } catch (error) {
    console.warn(`[API] NestJS backend offline. Updating item ${id} in fallback local storage.`, error);
    const items = getLocalItems();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Item not found in fallback storage');
    
    const updatedItem = {
      ...items[index],
      minimumStock: minStock,
      actualStock,
      lifecycleStatus: lifecycleStatus || items[index].lifecycleStatus,
    };
    items[index] = updatedItem;
    saveLocalItems(items);
    return updatedItem;
  }
}
