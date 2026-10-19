'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { canEdit, type AppRole } from '@/lib/rbac';
import logoImg from '../../../assets/img/mtmwide.png';

interface MenuItem {
  name: string;
  icon: string;
  href: string;
  badge?: number;
  /** Roles allowed to see this item. If undefined, all roles can see it. */
  allowedRoles?: AppRole[];
}

const ALL_MENU_ITEMS: MenuItem[] = [
  {
    name: 'Dashboard',
    icon: 'dashboard',
    href: '/dashboard',
  },
  {
    name: 'Master Drawing',
    icon: 'table_view',
    href: '/design',
  },
  {
    name: 'Jig Management',
    icon: 'precision_manufacturing',
    href: '/jig-management',
  },
  {
    name: 'Monitoring',
    icon: 'monitoring',
    href: '/monitoring',
  },
  {
    name: 'TPM Control',
    icon: 'build_circle',
    href: '/tpm',
  },
];

const getRoleLabel = (role?: AppRole | null) => {
  if (role === 'PE_JIG_FIXTURE') return 'Admin / PIC Jig Fixture';
  if (role === 'PE_SECTION_HEAD') return 'Section Head View';
  if (role === 'PE_DEPT_HEAD') return 'Dept Head View';
  if (role === 'TAMU') return 'Guest (View Only)';
  return 'Loading…';
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, approvals } = useApp();
  const role = user?.role ?? null;

  const [isCollapsed, setIsCollapsed] = useState(false);

  // Real-time revision approvals (Item yang disuruh revisi oleh approver)
  const revisionApprovals = useMemo(() => {
    return approvals.filter((a) => a.status === 'REJECTED');
  }, [approvals]);

  // Real-time waiting approvals (Item yang sedang menunggu review)
  const waitingApprovals = useMemo(() => {
    return approvals.filter((a) => a.status === 'WAITING');
  }, [approvals]);

  const revisionCount = revisionApprovals.length;
  const waitingApprovalsCount = waitingApprovals.length;

  useEffect(() => {
    // Read saved preference
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const showApprovalCenterBtn = !isLoading && role !== 'TAMU';

  const visibleItems = ALL_MENU_ITEMS.filter((item) => {
    if (isLoading) return false;
    if (!item.allowedRoles) return true;
    return role !== null && item.allowedRoles.includes(role);
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const { logout } = useApp();

  return (
    <aside
      className={`${
        isCollapsed ? 'w-16' : 'w-56'
      } bg-surface-container-low flex flex-col h-full z-10 shrink-0 transition-all duration-300 relative`}
    >
      {/* SVG Outline Filter (Crisp & Solid Stroke, No Feather) */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <filter id="white-outline" x="-20%" y="-20%" width="140%" height="140%">
          <feMorphology operator="dilate" radius="0.8" in="SourceAlpha" result="dilated" />
          <feFlood floodColor="#ffffff" floodOpacity="1" result="flooded" />
          <feComposite in="flooded" in2="dilated" operator="in" result="outline" />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </svg>

      {/* Header */}
      <div className={`border-b border-outline-variant h-[80px] flex items-center justify-center overflow-hidden relative ${isCollapsed ? 'px-2' : 'px-3 py-2'}`}>
        {!isCollapsed ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <Image
              src={logoImg}
              alt="Logo PT Menara Terus Makmur"
              className="max-h-[52px] w-auto max-w-[95%] object-contain"
              style={{ filter: 'url(#white-outline)' }}
              priority
            />
          </div>
        ) : (
          <div className="flex items-center justify-center p-0.5" title="PT Menara Terus Makmur">
            <Image
              src={logoImg}
              alt="Logo PT Menara Terus Makmur"
              className="w-[48px] h-auto object-contain"
              style={{ filter: 'url(#white-outline)' }}
              priority
            />
          </div>
        )}
      </div>

      {/* Floating 3-Dots Toggle Button: Luar Sidebar, Align Tengah Vertikal */}
      <button
        type="button"
        onClick={toggleSidebar}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-white/95 hover:bg-white text-slate-400 hover:text-slate-700 border border-slate-200/90 rounded-full flex items-center justify-center shadow-md z-30 cursor-pointer transition-all hover:scale-105 group"
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span className="material-symbols-outlined text-[16px] leading-none select-none text-slate-500 group-hover:text-blue-600 transition-colors">
          more_vert
        </span>
      </button>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="flex flex-col gap-1 px-3 py-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {visibleItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    title={isCollapsed ? item.name : undefined}
                    className={`flex items-center ${
                      isCollapsed ? 'justify-center px-0 mx-1.5 h-10' : 'gap-2 px-3 mx-2'
                    } py-2 rounded-lg transition-all group relative ${
                      isActive
                        ? 'bg-secondary-container text-on-secondary-container font-semibold'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/50'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-base transition-transform ${
                        !isActive && 'group-hover:scale-110'
                      }`}
                    >
                      {item.icon}
                    </span>
                    {!isCollapsed && <span className="font-medium text-xs flex-1 truncate">{item.name}</span>}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`${
                          isCollapsed
                            ? 'absolute top-1 right-1 w-2 h-2 p-0 rounded-full'
                            : 'text-[9px] font-bold px-1.5 py-0.5 rounded-full'
                        } bg-red-500 text-white`}
                      >
                        {!isCollapsed && item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Footer Container */}
      <div className={`border-t border-outline-variant mt-auto flex flex-col gap-2 relative ${isCollapsed ? 'p-1.5 items-center' : 'p-3'}`}>
        {/* Approval Center Button (Alih fungsi dari Submit Revision) */}
        {showApprovalCenterBtn && (
          <Link
            href="/approval-center"
            title={
              isCollapsed
                ? `Approval Center (${revisionCount > 0 ? `${revisionCount} perlu revisi, ` : ''}${waitingApprovalsCount} pending)`
                : undefined
            }
            className={`rounded-xl bg-[#0063ff] hover:bg-[#0052d4] text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm relative ${
              pathname.startsWith('/approval-center') ? 'ring-2 ring-blue-300 bg-[#0052d4]' : ''
            } ${
              isCollapsed ? 'w-10 h-10 p-0' : 'w-full py-2 px-3'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">fact_check</span>
            {!isCollapsed && <span className="truncate flex-1 text-left">Approval Center</span>}

            {/* Notification Badge: nomor saja di pojok kanan atas */}
            {revisionCount > 0 ? (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-[8px] font-black bg-rose-600 text-white shadow-md border-2 border-white animate-pulse"
                title={`${revisionCount} Revisi`}
              >
                {revisionCount}
              </span>
            ) : waitingApprovalsCount > 0 ? (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-[8px] font-black bg-amber-400 text-yellow-950 shadow-md border-2 border-white"
                title={`${waitingApprovalsCount} Menunggu`}
              >
                {waitingApprovalsCount}
              </span>
            ) : null}
          </Link>
        )}

        {/* User Profile, Notifications and Logout */}
        <div
          className={`flex items-center ${
            isCollapsed ? 'justify-center p-1.5 w-10 h-10' : 'justify-between p-2'
          } bg-surface-container-highest/20 border border-outline-variant/30 rounded-xl mt-1 relative`}
        >
          <div
            className="flex items-center gap-2 min-w-0"
            title={isCollapsed ? `${user?.name || 'User'} (${getRoleLabel(role)})` : undefined}
          >
            <div className="w-7 h-7 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-[10px] font-bold shrink-0">
              {user ? getInitials(user.name) : 'PE'}
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-on-surface truncate leading-none mb-1">
                  {user?.name || 'Guest User'}
                </p>
                <p className="text-[8px] text-on-surface-variant truncate leading-none">
                  {isLoading ? 'Loading' : getRoleLabel(role)}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center shrink-0 ml-1">
            <button
              onClick={logout}
              className="text-on-surface-variant hover:text-red-500 transition-colors cursor-pointer flex items-center p-1 rounded-lg hover:bg-white/10"
              title="Logout"
              aria-label="Logout"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
            </button>
          </div>
        </div>

      </div>
    </aside>
  );
}
