import { getApiBaseUrl } from './config';
import Cookies from 'js-cookie';

export interface UserRole {
  id: string;
  name: string;
  _count?: {
    users: number;
  };
}

export interface UserItem {
  id: string;
  name: string;
  npk: string;
  email: string;
  roleId: string;
  role: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

function getAuthHeader() {
  const token = Cookies.get('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchAllUsers(): Promise<UserItem[]> {
  const res = await fetch(`${getApiBaseUrl()}/users`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal memuat data pengguna');
  }
  return res.json();
}

export async function fetchAllRoles(): Promise<UserRole[]> {
  const res = await fetch(`${getApiBaseUrl()}/users/roles`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal memuat data role');
  }
  return res.json();
}

export async function createUser(data: {
  name: string;
  npk: string;
  email: string;
  password?: string;
  roleId: string;
}): Promise<UserItem> {
  const res = await fetch(`${getApiBaseUrl()}/users`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal membuat pengguna baru');
  }
  return res.json();
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    npk?: string;
    email?: string;
    password?: string;
    roleId?: string;
  },
): Promise<UserItem> {
  const res = await fetch(`${getApiBaseUrl()}/users/${id}`, {
    method: 'PATCH',
    headers: getAuthHeader(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal memperbarui pengguna');
  }
  return res.json();
}

export async function deleteUser(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${getApiBaseUrl()}/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal menghapus pengguna');
  }
  return res.json();
}
