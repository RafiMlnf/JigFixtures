'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { canEdit } from '@/lib/rbac';

export default function InventoryPage() {
  const { items, user, isLoading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !canEdit(user?.role)) {
      router.replace('/design');
    }
  }, [isLoading, user, router]);

  const isPic = !isLoading && canEdit(user?.role);
  const [search, setSearch] = useState('');
  const [lineFilter, setLineFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Filter items
  const filteredItems = items.filter((item) => {
    const searchTerms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matchesSearch = searchTerms.every((term) => {
      return (
        item.noReg.toLowerCase().includes(term) ||
        item.assyPartName.toLowerCase().includes(term) ||
        item.lineProduct.toLowerCase().includes(term) ||
        item.process.toLowerCase().includes(term)
      );
    });

    const matchesLine = lineFilter === 'All' || item.lineProduct === lineFilter;

    let matchesStatus = true;
    if (statusFilter === 'GREEN') {
      matchesStatus = item.actualStock >= item.minimumStock && item.actualStock > 0;
    } else if (statusFilter === 'YELLOW') {
      matchesStatus = item.actualStock > 0 && item.actualStock < item.minimumStock;
    } else if (statusFilter === 'RED') {
      matchesStatus = item.actualStock === 0;
    }

    return matchesSearch && matchesLine && matchesStatus;
  });

  // Calculate metrics
  const total = items.length;
  const greenItems = items.filter((i) => i.actualStock >= i.minimumStock && i.actualStock > 0).length;
  const yellowItems = items.filter((i) => i.actualStock > 0 && i.actualStock < i.minimumStock).length;
  const redItems = items.filter((i) => i.actualStock === 0).length;

  const uniqueLines = ['All', ...Array.from(new Set(items.map((i) => i.lineProduct)))];

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 pt-2 bg-white h-full overflow-hidden">
      {/* Header controls */}
      <header className="h-12 flex justify-between items-center border-b border-gray-150 mb-3 shrink-0">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-blue-500 text-lg">inventory_2</span>
            Update Inventory
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]" style={{ fontSize: '10px' }}>search</span>
            <input
              className="pl-7 pr-3 py-1 bg-gray-100 border border-gray-400 rounded-full text-[10px] w-48 focus:ring-1 focus:ring-primary outline-none text-gray-700 placeholder-gray-500"
              placeholder="Search No.Reg, Part Name..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative flex items-center gap-1 text-[9px] text-gray-500 font-semibold border border-gray-200 rounded-full px-2 py-0.5 cursor-pointer hover:bg-gray-50">
            <span>Line: {lineFilter}</span>
            <span className="material-symbols-outlined text-[12px]">expand_more</span>
            <select
              value={lineFilter}
              onChange={(e) => setLineFilter(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer text-xs"
            >
              {uniqueLines.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
          </div>
          <button className="bg-[#0063ff] text-white px-2.5 py-0.5 rounded-full text-[9px] font-semibold flex items-center gap-1 hover:bg-[#0052d4] transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[12px]">download</span> Export
          </button>
        </div>
      </header>

      {/* Summary Cards Row */}
      <div className="flex gap-3 mb-3 h-14">
        {/* Green */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'GREEN' ? 'All' : 'GREEN')}
          className={`flex-1 rounded-xl px-3 py-1.5 flex items-center gap-3 shadow-sm border cursor-pointer transition-all ${statusFilter === 'GREEN'
            ? 'bg-green-500/10 border-green-500'
            : 'bg-white border-gray-200 hover:border-green-500/30'
            }`}
        >
          <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-green-500 text-base">check_circle</span>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 leading-none mb-0.5">Aman (Green)</p>
            <h3 className="text-base font-bold text-gray-800 leading-none">
              {greenItems} <span className="text-[9px] font-normal text-gray-500">Items</span>
            </h3>
          </div>
        </div>

        {/* Yellow */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'YELLOW' ? 'All' : 'YELLOW')}
          className={`flex-1 rounded-xl px-3 py-1.5 flex items-center gap-3 shadow-sm border cursor-pointer transition-all ${statusFilter === 'YELLOW'
            ? 'bg-yellow-500/10 border-yellow-500'
            : 'bg-white border-gray-200 hover:border-yellow-500/30'
            }`}
        >
          <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-yellow-500 text-base">warning</span>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 leading-none mb-0.5">Warning (Yellow)</p>
            <h3 className="text-base font-bold text-gray-800 leading-none">
              {yellowItems} <span className="text-[9px] font-normal text-gray-500">Items</span>
            </h3>
          </div>
        </div>

        {/* Red */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'RED' ? 'All' : 'RED')}
          className={`flex-1 rounded-xl px-3 py-1.5 flex items-center gap-3 shadow-sm border cursor-pointer transition-all relative overflow-hidden ${statusFilter === 'RED'
            ? 'bg-red-500/10 border-red-500'
            : 'bg-white border-gray-200 hover:border-red-500/30'
            }`}
        >
          {redItems > 0 && <div className="absolute inset-0 bg-red-500/5 animate-pulse"></div>}
          <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center z-10 shrink-0">
            <span className="material-symbols-outlined text-white text-base">error</span>
          </div>
          <div className="z-10">
            <p className="text-[9px] text-gray-500 leading-none mb-0.5">Critical/Stok 0</p>
            <h3 className="text-base font-bold text-gray-800 leading-none">
              {redItems} <span className="text-[9px] font-normal text-gray-500">Items</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="flex-1 overflow-y-auto no-scrollbar rounded-lg border border-gray-200">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-500 font-semibold sticky top-0 z-10 border-b border-gray-200">
              <th className="px-3 py-2">No. Reg</th>
              <th className="px-2 py-2">Part Name</th>
              <th className="px-2 py-2">Line</th>
              <th className="px-2 py-2">Process</th>
              <th className="px-2 text-center py-2">Lifecycle</th>
              <th className="px-2 text-right py-2">Min Stock</th>
              <th className="px-2 text-right py-2">Actual</th>
              <th className="px-2 text-center py-2">Status</th>
              {isPic && <th className="px-2 text-center py-2">Action</th>}
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {filteredItems.map((item) => {
              const isRed = item.actualStock === 0;
              const isYellow = item.actualStock > 0 && item.actualStock < item.minimumStock;
              return (
                <tr
                  key={item.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isRed ? 'border-b border-red-100 bg-red-50 hover:bg-red-100/60' : ''
                    }`}
                >
                  <td className={`px-3 font-normal font-mono py-2 ${isRed ? 'text-red-700' : ''}`}>
                    {item.noReg}
                  </td>
                  <td className="px-2 py-2 flex items-center gap-1.5">
                    <div className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-gray-400 text-xs">view_in_ar</span>
                    </div>
                    <span className="truncate max-w-[150px] font-medium">{item.assyPartName}</span>
                  </td>
                  <td className="px-2 text-gray-500 py-2">{item.lineProduct}</td>
                  <td className="px-2 text-gray-500 py-2">{item.process}</td>
                  <td className="px-2 text-center py-2">
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${item.lifecycleStatus === 'UNDER_REPAIR' ? 'bg-orange-100 text-orange-700' :
                        item.lifecycleStatus === 'UNDER_IMPROVEMENT' ? 'bg-blue-100 text-blue-700' :
                          item.lifecycleStatus === 'OBSOLETE' ? 'bg-gray-100 text-gray-700' :
                            item.lifecycleStatus === 'SCRAP' ? 'bg-red-100 text-red-700' :
                              'bg-green-100 text-green-700'
                      }`}>
                      {item.lifecycleStatus || 'ACTIVE'}
                    </span>
                  </td>
                  <td className={`px-2 text-right py-2 ${isRed ? 'text-red-700 font-semibold' : ''}`}>
                    {item.minimumStock}
                  </td>
                  <td className={`px-2 text-right font-bold py-2 ${isRed ? 'text-red-600' : isYellow ? 'text-yellow-600' : ''
                    }`}>
                    {item.actualStock}
                  </td>
                  <td className={`px-2 py-2 text-center font-bold text-[9px] uppercase tracking-wider ${isRed ? 'bg-red-500 text-white' : isYellow ? 'bg-yellow-400 text-yellow-950' : 'bg-green-500 text-white'
                    }`}>
                    {isRed ? 'Critical' : isYellow ? 'Warning' : 'Aman'}
                  </td>
                  {isPic && (
                    <td className="px-2 text-center py-2">
                      <Link href={`/inventory/${item.id}`} className="text-primary hover:text-blue-600">
                        <span className="material-symbols-outlined text-sm font-semibold text-blue-500 hover:text-blue-700">edit</span>
                      </Link>
                    </td>
                  )}
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={isPic ? 10 : 9} className="text-center py-12 text-gray-400 text-xs">
                  No inventory items match current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
