'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white h-full">
      <span className="material-symbols-outlined animate-spin text-2xl text-blue-500">sync</span>
      <p className="text-xs text-gray-500 mt-2">Loading...</p>
    </div>
  );
}
