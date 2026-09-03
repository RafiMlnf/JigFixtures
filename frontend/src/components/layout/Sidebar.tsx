'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
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
    // visible to all roles
  },
  {
    name: 'Design',
    icon: 'table_view',
    href: '/design',
    // visible to all roles
  },
  {
    name: 'Update Abnormality',
    icon: 'report_problem',
    href: '/update-abnormality',
    allowedRoles: ['PE_JIG_FIXTURE'],               // Update → PIC only
  },
  {
    name: 'Update Inventory',
    icon: 'inventory_2',
    href: '/inventory',
    allowedRoles: ['PE_JIG_FIXTURE'],               // Update → PIC only
  },
  {
    name: 'Approval Center',
    icon: 'fact_check',
    href: '/approval-center',
    allowedRoles: ['PE_JIG_FIXTURE', 'PE_SECTION_HEAD', 'PE_DEPT_HEAD'], // NOT Tamu
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
  const { user, isLoading, approvals } = useApp();
  const role = user?.role ?? null;

  const [showLogoImage, setShowLogoImage] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  useEffect(() => {
    const interval = setInterval(() => {
      setShowLogoImage((prev) => !prev);
    }, 4000); // loop switch every 4 seconds
    return () => clearInterval(interval);
  }, []);

  // Filter menu items based on current user's role and compute badge count dynamically
  const visibleItems = ALL_MENU_ITEMS.map((item) => {
    if (item.href === '/approval-center') {
      const waitingCount = approvals.filter((a) => a.status === 'WAITING').length;
      return { ...item, badge: waitingCount };
    }
    return item;
  }).filter((item) => {
    if (isLoading) return false; // hide all until auth resolves
    if (!item.allowedRoles) return true; // no restriction → everyone
    return role !== null && item.allowedRoles.includes(role);
  });

  // "Submit Revision" footer button only for PIC
  const showSubmitBtn = !isLoading && canEdit(role);

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
      {/* Import ENOCH Font */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.cdnfonts.com/css/enoch');
      `}} />

      {/* SVG Outline Filter */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <filter id="white-outline">
          <feMorphology operator="dilate" radius="0.8" in="SourceAlpha" result="dilated" />
          <feFlood floodColor="white" floodOpacity="1" result="flooded" />
          <feComposite in="flooded" in2="dilated" operator="in" result="outline" />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </svg>

      {/* Header */}
      <div className={`border-b border-outline-variant h-[80px] flex items-center justify-between overflow-hidden relative ${isCollapsed ? 'px-2 justify-center' : 'p-4 py-5'}`}>
        {!isCollapsed ? (
          <div className="relative w-full h-[42px] flex items-center justify-start px-2">
            {/* Logo Text */}
            <div
              className={`absolute inset-y-0 left-2 right-0 transition-all duration-1000 ease-in-out flex items-center justify-start ${
                showLogoImage ? 'opacity-0 -translate-x-8 pointer-events-none' : 'opacity-100 translate-x-0'
              }`}
            >
              <h1
                className="text-[21px] text-on-surface leading-[0.92] text-left font-normal tracking-wide whitespace-nowrap"
                style={{ fontFamily: "'ENOCH', sans-serif", fontWeight: 'normal' }}
              >
                JIG<br />FIXTURES
              </h1>
            </div>

            {/* Logo Image */}
            <div
              className={`absolute inset-y-0 left-0 right-0 transition-all duration-1000 ease-in-out flex items-center justify-start ${
                showLogoImage ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'
              }`}
            >
              <Image
                src={logoImg}
                alt="MTM Logo"
                className="h-8 w-auto object-contain"
                style={{
                  filter: 'url(#white-outline)',
                }}
                priority
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-2xl font-bold">build_circle</span>
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
        {showSubmitBtn && (
          <Link
            href="/design?action=revision"
            title={isCollapsed ? 'Submit Revision' : undefined}
            className={`rounded-lg bg-[#0063ff] text-white font-bold text-xs hover:bg-[#0052d4] transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              isCollapsed ? 'w-10 h-10 p-0' : 'w-full py-1.5 px-3'
            }`}
          >
            <span className="material-symbols-outlined text-sm">add</span>
            {!isCollapsed && <span>Submit Revision</span>}
          </Link>
        )}

        {/* User Profile and Logout */}
        <div
          className={`flex items-center ${
            isCollapsed ? 'justify-center p-1.5 w-10 h-10' : 'justify-between p-2'
          } bg-surface-container-highest/20 border border-outline-variant/30 rounded-xl mt-1`}
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
          {!isCollapsed && (
            <button
              onClick={logout}
              className="text-on-surface-variant hover:text-red-500 transition-colors cursor-pointer shrink-0 ml-1.5 flex items-center"
              title="Logout"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
