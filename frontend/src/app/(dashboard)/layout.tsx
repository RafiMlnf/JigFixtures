'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { fetchDashboardAlerts } from '@/lib/api/phase3';

interface AlertData {
  redItems: Array<{ id: string; noReg: string; assyPartName: string }>;
  delayedAbnormalities: Array<{ id: string; design: { noReg: string; assyPartName: string } }>;
  waitingApprovalsCount: number;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, approvals } = useApp();
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertData>({
    redItems: [],
    delayedAbnormalities: [],
    waitingApprovalsCount: 0,
  });

  const waitingApprovalsCount = approvals.filter((a) => a.status === 'WAITING').length;

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      fetchDashboardAlerts()
        .then(setAlerts)
        .catch(() => {});
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#1a1c1f] h-full w-full text-white">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">sync</span>
        <p className="text-xs text-gray-400 mt-2 font-medium">Checking PE Session authorization...</p>
      </div>
    );
  }

  if (!user) {
    return null; // block unauthorized render
  }

  return (
    <>
      <Sidebar />
      <div className="flex-1 flex h-full bg-[#f8f9fa] rounded-l-2xl overflow-hidden relative shadow-[-10px_0_20px_rgba(0,0,0,0.2)]">
        <main className="flex-1 flex flex-col h-full overflow-hidden text-surface z-20 relative">
          {children}
        </main>
      </div>
    </>
  );
}
