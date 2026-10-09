'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InventoryRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/jig-management');
  }, [router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white min-h-[400px]">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
      <p className="text-xs font-semibold text-gray-500">Mengarahkan ke Jig Management...</p>
    </div>
  );
}
