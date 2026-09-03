'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { canApprove } from '@/lib/rbac';

export default function RightPanel() {
  const { user, logout, isLoading, approvals } = useApp();
  // Only show approver UI after auth state has resolved (not during loading)
  const userCanApprove = !isLoading && canApprove(user?.role);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentDate, setCurrentDate] = useState('05 Nov');

  const getRoleLabel = (role: string) => {
    if (role === 'PE_JIG_FIXTURE') return 'PIC Jig Fixture';
    if (role === 'PE_SECTION_HEAD') return 'Section Head';
    if (role === 'PE_DEPT_HEAD') return 'Dept Head';
    return 'Guest';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };
  const [isExpanded, setIsExpanded] = useState(true);

  // Use dynamic approvals from backend context, filtered by WAITING status
  const pendingApprovals = approvals.filter((a) => a.status === 'WAITING');

  return (
    <aside 
      className={`${isExpanded ? 'w-[310px] p-3 pr-12' : 'w-14 p-0'} bg-[#3b82f6] flex flex-col gap-3 border-2 border-black rounded-l-2xl shrink-0 relative overflow-visible shadow-[-5px_0_15px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out`}
    >
      
      {/* Expand/Collapse Toggle Button */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -left-[18px] top-1/2 -translate-y-1/2 w-[16px] h-10 bg-black text-white rounded-l-md flex items-center justify-center cursor-pointer z-50 hover:bg-gray-800 transition-colors shadow-md border border-black border-r-0"
      >
        <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'wght' 200", fontWeight: 200 }}>
          {isExpanded ? 'chevron_right' : 'chevron_left'}
        </span>
      </button>

      {/* Main Content Container - fades and hides when collapsed */}
      <div className={`flex flex-col h-full overflow-y-auto no-scrollbar transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
        
        {/* Header */}
        <div className="flex justify-between items-center mb-2 pb-2 relative border-b border-gray-600">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-gray-800">Pending Approvals</span>
          </div>
          
          {/* Date Dropdown Trigger */}
          <div 
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center gap-1 text-[10px] font-semibold text-gray-700 bg-white/50 px-2 py-1 rounded-full cursor-pointer hover:bg-white transition-colors border border-gray-400"
          >
            <span>{currentDate}</span> 
            <span className="material-symbols-outlined text-[12px]">expand_more</span>
          </div>

          {/* Small Calendar Dropdown Pop-up */}
          {showCalendar && (
            <div className="absolute right-0 top-7 bg-white border border-gray-300 rounded-xl p-2.5 shadow-xl z-50 text-[10px] text-gray-700 w-44">
              <div className="flex justify-between items-center mb-2 font-bold border-b border-gray-100 pb-1">
                <span>November 2025</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowCalendar(false); }}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center font-semibold text-gray-400 mb-1 text-[8px]">
                <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({ length: 30 }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const isSelected = dayNum === parseInt(currentDate.split(' ')[0]);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const paddedDay = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
                        setCurrentDate(`${paddedDay} Nov`);
                        setShowCalendar(false);
                      }}
                      className={`p-0.5 rounded-md hover:bg-gray-100 transition-colors text-[9px] ${
                        isSelected ? 'bg-primary text-on-primary font-bold' : ''
                      }`}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 mb-1 overflow-x-auto no-scrollbar">
          <span className="px-2 py-0.5 bg-gray-900 text-white text-[9px] font-bold rounded-full whitespace-nowrap cursor-pointer">All</span>
          <span className="px-2 py-0.5 bg-white/50 text-gray-700 text-[9px] font-bold rounded-full whitespace-nowrap cursor-pointer hover:bg-white transition-colors border border-gray-300">Design Rev</span>
          <span className="px-2 py-0.5 bg-[#d8b4fe] text-gray-900 text-[9px] font-bold rounded-full whitespace-nowrap cursor-pointer hover:brightness-95 transition-all">Inventory</span>
        </div>

        {/* Team Header */}
        <div className="flex justify-between items-center mb-2 mt-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-900 leading-tight">Waiting Review</h2>
            <span className="bg-gray-900 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
              {pendingApprovals.length}
            </span>
          </div>
        </div>

        {/* Status Cards List */}
        <div className="flex flex-col gap-2.5">
          {pendingApprovals.map((card) => (
            <Link 
              key={card.id} 
              href={`/approval-center/${card.id}`}
              className="bg-white border-gray-200 block rounded-2xl p-3 shadow-sm border hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer"
            >
              {card.type === 'Inventory Update' && (
                <div className="absolute inset-0 opacity-30 bg-pattern-dots mix-blend-overlay"></div>
              )}
              <div className="relative z-10">
                <p className="text-[9px] text-gray-800 font-medium flex items-center gap-1 mb-1">
                  {card.date}
                </p>
                <h3 className="text-xs font-bold text-gray-900 mb-0.5">{card.noReg}</h3>
                <p className="text-[9px] text-gray-800 leading-tight mb-2 font-medium truncate">{card.itemName}</p>
                
                {card.has3DRender && (
                  <div className="bg-gray-900 rounded-lg p-1.5 flex justify-center items-center mb-2 cursor-pointer hover:bg-gray-800 transition-colors">
                    <div className="flex items-center gap-1 text-white text-[9px] font-medium">
                      <span className="material-symbols-outlined text-[12px]">view_in_ar</span> View 3D Render
                    </div>
                  </div>
                )}

                {card.note && !card.has3DRender && (
                  <div className="bg-white/40 p-1.5 rounded-md mb-2">
                    <p className="text-[8px] text-gray-800 font-medium italic line-clamp-2">"{card.note}"</p>
                  </div>
                )}

                 <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-bold text-black">{card.author}</span>
                  </div>
                  <span className="bg-gray-900 text-white text-[8px] px-1.5 py-0.5 rounded-sm">{card.type}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>


      </div>

      {/* Floating Right Action Bar - Always visible */}
      <div className="absolute right-0 top-3 bottom-3 w-10 bg-[#fdf287] border-l border-yellow-200 flex flex-col items-center py-3 rounded-l-xl z-20 shadow-[-2px_0_10px_rgba(0,0,0,0.05)] transition-transform duration-300">
        
        {/* User profile and logout at the bottom */}
        <div className="mt-auto flex flex-col gap-3 items-center w-full">
          <div className="relative group cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gray-900 border-2 border-gray-900 flex items-center justify-center text-white text-[10px] font-bold relative z-10 shadow-sm hover:scale-105 transition-transform">
              {user ? getInitials(user.name) : 'PE'}
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full border border-gray-900 flex items-center justify-center font-bold text-gray-900 text-[8px] z-20">+</div>
            
            {/* Role Tooltip */}
            <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-2.5 py-1 bg-gray-900 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap flex flex-col gap-0.5 shadow-lg z-30">
              <div className="flex items-center gap-1 text-[10px]">
                <span className="material-symbols-outlined text-[11px] text-primary">badge</span>
                <span>{user ? getRoleLabel(user.role) : 'Guest'}</span>
              </div>
              <span className="text-[8px] text-gray-400 font-normal leading-none">{user?.name || 'Guest'}</span>
              {/* Tooltip triangle */}
              <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-[4px] border-transparent border-l-gray-900"></div>
            </div>
          </div>
          <button 
            onClick={logout}
            className="text-gray-900 hover:text-primary transition-colors cursor-pointer"
            title="Sign Out"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>

      </div>
    </aside>
  );
}
