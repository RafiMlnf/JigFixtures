'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
    href: '/update-abnormality',
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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const [activeNotifTab, setActiveNotifTab] = useState<'ALL' | 'REVISION' | 'APPROVAL'>('ALL');

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

  // Synthesize real-time revision alerts directly into notification feed
  const synthesizedRevisionNotifs: NotificationItem[] = useMemo(() => {
    return revisionApprovals.map((appr) => ({
      id: `rev-${appr.id}`,
      type: 'REVISION_REQUESTED',
      title: `⚠️ Perlu Revisi: ${appr.noReg}`,
      message: appr.note
        ? `Catatan: "${appr.note}"`
        : `Drawing ${appr.itemName} dikembalikan oleh Section/Dept Head untuk diperbaiki.`,
      isRead: false,
      itemId: appr.id,
      designId: appr.designId,
      userId: user?.id || '',
      createdAt: appr.date || new Date().toISOString(),
    }));
  }, [revisionApprovals, user?.id]);

  // Synthesize waiting approvals alerts for approvers
  const synthesizedWaitingNotifs: NotificationItem[] = useMemo(() => {
    if (role === 'PE_JIG_FIXTURE') return [];
    return waitingApprovals.map((appr) => ({
      id: `wait-${appr.id}`,
      type: 'WAITING_APPROVAL',
      title: `📋 Menunggu Approval: ${appr.noReg}`,
      message: `Drawing ${appr.itemName} diajukan oleh ${appr.author}. Menunggu review & persetujuan Anda.`,
      isRead: false,
      itemId: appr.id,
      designId: appr.designId,
      userId: user?.id || '',
      createdAt: appr.date || new Date().toISOString(),
    }));
  }, [waitingApprovals, role, user?.id]);

  // Merge and deduplicate by title
  const allCombinedNotifs = useMemo(() => {
    const list = [...synthesizedRevisionNotifs, ...synthesizedWaitingNotifs];
    const seenTitles = new Set(list.map((n) => n.title));
    for (const dbNotif of notifications) {
      if (!seenTitles.has(dbNotif.title)) {
        list.push(dbNotif);
      }
    }
    return list;
  }, [synthesizedRevisionNotifs, synthesizedWaitingNotifs, notifications]);

  const filteredNotifs = useMemo(() => {
    if (activeNotifTab === 'REVISION') {
      return allCombinedNotifs.filter((n) => n.type === 'REVISION_REQUESTED');
    }
    if (activeNotifTab === 'APPROVAL') {
      return allCombinedNotifs.filter((n) => n.type === 'WAITING_APPROVAL');
    }
    return allCombinedNotifs;
  }, [activeNotifTab, allCombinedNotifs]);

  const unreadCount = allCombinedNotifs.filter((n) => !n.isRead).length;

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
    if (!notif.isRead && !notif.id.startsWith('rev-') && !notif.id.startsWith('wait-')) {
      markNotificationAsRead(notif.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
    }
    setShowNotifPopover(false);

    if (notif.type === 'REVISION_REQUESTED' || notif.type === 'WAITING_APPROVAL') {
      const targetId = notif.itemId || notif.designId;
      if (targetId && !targetId.startsWith('rev-') && !targetId.startsWith('wait-')) {
        router.push(`/approval-center/${targetId}`);
      } else {
        router.push('/approval-center');
      }
    } else if (notif.type === 'INVENTORY_RED' || notif.type === 'INVENTORY_YELLOW') {
      router.push('/jig-management');
    } else if (notif.type === 'ABNORMALITY_OPEN') {
      router.push('/update-abnormality');
    } else {
      router.push('/dashboard');
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
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[7.5px] font-black min-w-3.5 h-3.5 px-0.5 rounded-full flex items-center justify-center animate-pulse shadow-xs">
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

        {/* Proper Notification Modal / Popover (Fixed, Never Clipped) */}
        {showNotifPopover && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[0.5px]"
              onClick={() => setShowNotifPopover(false)}
            />

            {/* Flyout Panel */}
            <div
              className={`fixed bottom-4 z-50 ${
                isCollapsed ? 'left-18' : 'left-60'
              } w-88 max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[520px] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800`}
            >
              {/* Header */}
              <div className="p-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-400/30">
                    <span className="material-symbols-outlined text-[16px]">notifications</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-xs flex items-center gap-1.5 leading-none">
                      Pusat Notifikasi
                      {unreadCount > 0 && (
                        <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                          {unreadCount} Baru
                        </span>
                      )}
                    </h3>
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-none">
                      Pemberitahuan revisi, approval & sistem
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[9px] font-semibold text-blue-300 hover:text-white px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                    >
                      Baca Semua
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNotifPopover(false)}
                    className="w-6 h-6 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                    title="Tutup"
                  >
                    <span className="material-symbols-outlined text-[15px]">close</span>
                  </button>
                </div>
              </div>

              {/* Tabs Filter */}
              <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-[10px] font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveNotifTab('ALL')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    activeNotifTab === 'ALL'
                      ? 'bg-white text-blue-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({allCombinedNotifs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNotifTab('REVISION')}
                  className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer ${
                    activeNotifTab === 'REVISION'
                      ? 'bg-white text-rose-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Perlu Revisi</span>
                  {revisionCount > 0 && (
                    <span className="bg-rose-500 text-white text-[8px] font-black px-1 py-0.2 rounded-full">
                      {revisionCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNotifTab('APPROVAL')}
                  className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer ${
                    activeNotifTab === 'APPROVAL'
                      ? 'bg-white text-amber-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Menunggu</span>
                  {waitingApprovalsCount > 0 && (
                    <span className="bg-amber-500 text-white text-[8px] font-black px-1 py-0.2 rounded-full">
                      {waitingApprovalsCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Notification List Content */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[340px]">
                {filteredNotifs.length === 0 ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center text-slate-400">
                    <span className="material-symbols-outlined text-3xl text-emerald-500 mb-1">done_all</span>
                    <p className="text-[11px] font-bold text-slate-700">Semua Terbaca & Selesai</p>
                    <p className="text-[9px] text-slate-400 max-w-[200px] mt-0.5">
                      Tidak ada notifikasi revisi atau tugas mendesak saat ini.
                    </p>
                  </div>
                ) : (
                  filteredNotifs.map((notif) => {
                    const isRev = notif.type === 'REVISION_REQUESTED';
                    const isAppr = notif.type === 'WAITING_APPROVAL';

                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex gap-2.5 items-start group ${
                          !notif.isRead
                            ? isRev
                              ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/70 hover:border-rose-300'
                              : isAppr
                              ? 'bg-amber-50/70 border-amber-200 hover:bg-amber-100/70 hover:border-amber-300'
                              : 'bg-blue-50/60 border-blue-200 hover:bg-blue-100/60 hover:border-blue-300'
                            : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        {/* Icon category */}
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white shadow-2xs ${
                            isRev
                              ? 'bg-rose-600'
                              : isAppr
                              ? 'bg-amber-500'
                              : notif.type === 'INVENTORY_RED'
                              ? 'bg-red-600'
                              : 'bg-blue-600'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {isRev
                              ? 'history_edu'
                              : isAppr
                              ? 'schedule'
                              : notif.type === 'INVENTORY_RED'
                              ? 'inventory_2'
                              : 'notifications'}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span
                              className={`text-[10px] font-bold leading-tight truncate ${
                                isRev ? 'text-rose-900' : isAppr ? 'text-amber-900' : 'text-slate-900'
                              }`}
                            >
                              {notif.title}
                            </span>
                            {!notif.isRead && (
                              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                            )}
                          </div>
                          <p className="text-[9px] text-slate-600 line-clamp-2 leading-relaxed">
                            {notif.message}
                          </p>
                          <div className="flex items-center justify-between mt-1 text-[8px] text-slate-400">
                            <span>
                              {notif.createdAt
                                ? new Date(notif.createdAt).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Baru saja'}
                            </span>
                            <span className="font-semibold text-blue-600 group-hover:underline flex items-center gap-0.5">
                              Lihat Detail <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer Quick Action */}
              <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500 shrink-0">
                <span className="text-slate-400">Pembaruan otomatis berkala</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifPopover(false);
                    router.push('/approval-center');
                  }}
                  className="font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  Buka Approval Center
                  <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
