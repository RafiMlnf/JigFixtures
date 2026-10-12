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
      <div className="flex-1 flex h-full w-full bg-slate-50 animate-pulse">
        {/* Sidebar skeleton */}
        <div className="w-56 bg-slate-100 border-r border-slate-200 p-4 space-y-4 hidden md:block">
          <div className="h-8 bg-slate-200 rounded-lg w-3/4 mb-6" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 bg-slate-200/70 rounded-lg w-full" />
            ))}
          </div>
        </div>
        {/* Main content skeleton */}
        <div className="flex-1 flex flex-col p-4 space-y-4">
          <div className="h-10 bg-slate-100 border border-slate-200 rounded-lg w-full" />
          <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="h-6 bg-slate-100 rounded w-1/4" />
            <div className="space-y-2 pt-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-50 border border-slate-100 rounded-lg w-full" />
              ))}
            </div>
          </div>
        </div>
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
