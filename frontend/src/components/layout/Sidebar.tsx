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
    <aside className="w-56 bg-surface-container-low flex flex-col h-full z-10 shrink-0">

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
      <div className="p-4 py-5 border-b border-outline-variant h-[80px] flex flex-col justify-center overflow-hidden">
        <div className="relative w-full h-[32px] flex items-center justify-start px-2">
          {/* Logo Text */}
          <div
            className={`absolute inset-y-0 left-2 right-0 transition-all duration-1000 ease-in-out flex items-center justify-start ${showLogoImage ? 'opacity-0 -translate-x-8 pointer-events-none' : 'opacity-100 translate-x-0'
              }`}
          >
            <h1 className="text-[25px] text-on-surface leading-none text-left font-normal" style={{ fontFamily: "'ENOCH', sans-serif", fontWeight: 'normal' }}>
              JIG FIXTURES
            </h1>
          </div>

          {/* Logo Image */}
          <div
            className={`absolute inset-y-0 left-0 right-0 transition-all duration-1000 ease-in-out flex items-center justify-start ${showLogoImage ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'
              }`}
          >
            <Image
              src={logoImg}
              alt="MTM Logo"
              className="h-8 w-auto object-contain"
              style={{
                filter: 'url(#white-outline)'
              }}
              priority
            />
          </div>
        </div>
      </div>

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
                    className={`flex items-center gap-2 py-2 px-3 mx-2 rounded-lg transition-all group ${isActive
                      ? 'bg-secondary-container text-on-secondary-container font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/50'
                      }`}
                  >
                    <span
                      className={`material-symbols-outlined text-base transition-transform ${!isActive && 'group-hover:scale-110'
                        }`}
                    >
                      {item.icon}
                    </span>
                    <span className="font-medium text-xs flex-1">{item.name}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        {item.badge}
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
      <div className="p-3 border-t border-outline-variant mt-auto flex flex-col gap-2 relative">
        {showSubmitBtn && (
          <Link
            href="/design?action=revision"
            className="w-full py-1.5 px-3 rounded-lg bg-[#0063ff] text-white font-bold text-xs hover:bg-[#0052d4] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Submit Revision
          </Link>
        )}



        {/* User Profile and Logout */}
        <div className="flex items-center justify-between bg-surface-container-highest/20 border border-outline-variant/30 rounded-xl p-2 mt-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-[10px] font-bold shrink-0">
              {user ? getInitials(user.name) : 'PE'}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-on-surface truncate leading-none mb-1">
                {user?.name || 'Guest User'}
              </p>
              <p className="text-[8px] text-on-surface-variant truncate leading-none">
                {isLoading ? 'Loading' : getRoleLabel(role)}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-on-surface-variant hover:text-red-500 transition-colors cursor-pointer shrink-0 ml-1.5 flex items-center"
            title="Logout"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
