'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { canEdit, type AppRole } from '@/lib/rbac';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  NotificationItem,
} from '@/lib/api/notification';
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
    name: 'Master Data',
    icon: 'table_view',
    href: '/design',
    // visible to all roles
  },
  {
    name: 'Monitoring Abnormality',
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
  {
    name: 'TPM',
    icon: 'build_circle',
    href: '/tpm',
    // visible to all roles
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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifPopover, setShowNotifPopover] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const list = await fetchNotifications();
      setNotifications(list || []);
    } catch (e) {
      console.warn('Failed to load notifications', e);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      console.warn('Failed to mark all notifications read', e);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      markNotificationAsRead(notif.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
    }
    setShowNotifPopover(false);

    if (notif.type === 'WAITING_APPROVAL') {
      router.push('/approval-center');
    } else if (notif.type === 'INVENTORY_RED' || notif.type === 'INVENTORY_YELLOW') {
      router.push('/inventory');
    } else if (notif.type === 'ABNORMALITY_OPEN') {
      router.push('/update-abnormality');
    }
  };

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
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setShowNotifPopover(!showNotifPopover)}
              className="relative text-on-surface-variant hover:text-blue-500 transition-colors cursor-pointer flex items-center p-1 rounded-lg hover:bg-white/10"
              title={`Notifikasi (${unreadCount} belum dibaca)`}
              aria-label="Notifications"
            >
              <span className="material-symbols-outlined text-[16px]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[7px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {!isCollapsed && (
              <button
                onClick={logout}
                className="text-on-surface-variant hover:text-red-500 transition-colors cursor-pointer flex items-center p-1 rounded-lg hover:bg-white/10"
                title="Logout"
                aria-label="Logout"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
              </button>
            )}
          </div>
        </div>

        {/* Notification Popover Dropdown */}
        {showNotifPopover && (
          <div className="absolute bottom-16 left-full ml-3 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 text-xs z-50 animate-in fade-in duration-150 text-gray-800">
            <div className="flex items-center justify-between border-b border-gray-150 pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-[16px]">notifications</span>
                <span className="font-bold text-[11px] text-gray-800">Notifikasi</span>
                {unreadCount > 0 && (
                  <span className="bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                    {unreadCount} baru
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[9px] text-blue-650 hover:underline font-semibold cursor-pointer"
                  >
                    Baca Semua
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNotifPopover(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer flex"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
              {notifications.length === 0 ? (
                <div className="py-6 text-center text-gray-400 italic text-[10px]">
                  Tidak ada notifikasi saat ini.
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                      notif.isRead
                        ? 'bg-gray-50 border-gray-150 text-gray-600 hover:bg-gray-100/70'
                        : 'bg-blue-50/70 border-blue-200 text-gray-800 hover:bg-blue-100/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[10px] font-bold text-gray-800 leading-tight line-clamp-1">
                        {notif.title}
                      </span>
                      {!notif.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>
                      )}
                    </div>
                    <p className="text-[9px] text-gray-600 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                    <span className="text-[8px] text-gray-400 mt-1 block">
                      {new Date(notif.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(notif.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
