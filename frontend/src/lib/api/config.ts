/**
 * JigFixtures API Configuration Helper
 * Mendukung pembacaan dari environment variable NEXT_PUBLIC_API_URL
 * dengan dynamic fallback berbasis browser hostname dan public IP (bukan hardcoded localhost).
 */

export function getApiBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost') {
    return `${window.location.protocol}//${window.location.hostname}:3002/api`;
  }
  return 'http://192.168.100.222:3002/api';
}

/**
 * Mengembalikan host root tanpa prefix '/api' (contoh: http://192.168.100.222:3002)
 * Digunakan untuk static assets seperti file uploads, gambar, 3D model, dan PDF.
 */
export function getApiHost(): string {
  return getApiBaseUrl().replace(/\/api\/?$/, '');
}
