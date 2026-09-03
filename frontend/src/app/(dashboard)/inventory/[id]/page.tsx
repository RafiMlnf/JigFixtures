'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { canEdit } from '@/lib/rbac';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditInventoryPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();
  const { items, updateItemStock, user, isLoading } = useApp();
  const isPic = !isLoading && canEdit(user?.role);

  const item = items.find((i) => i.id === id);

  const [minStock, setMinStock] = useState<number>(0);
  const [actStock, setActStock] = useState<number>(0);
  const [lifecycleStatus, setLifecycleStatus] = useState<string>('ACTIVE');
  const [showRedAlert, setShowRedAlert] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !canEdit(user?.role)) {
      router.replace('/design');
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (item) {
      setMinStock(item.minimumStock);
      setActStock(item.actualStock);
      setLifecycleStatus(item.lifecycleStatus || 'ACTIVE');
    }
  }, [item]);

  if (!item) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="text-center">
          <p className="text-sm font-bold text-red-500 mb-2">Item Not Found</p>
          <Link href="/inventory" className="text-xs text-blue-500 underline">
            Back to Inventory
          </Link>
        </div>
      </div>
    );
  }

  // Real-time status calculation
  let indicator = 'GREEN';
  let indicatorColor = 'bg-green-500 text-white';
  let indicatorText = 'Aman (Optimal)';
  if (actStock === 0) {
    indicator = 'RED';
    indicatorColor = 'bg-red-500 text-white animate-pulse';
    indicatorText = 'Critical (Stok 0)';
  } else if (actStock < minStock) {
    indicator = 'YELLOW';
    indicatorColor = 'bg-yellow-400 text-gray-900';
    indicatorText = 'Warning (Low Stock)';
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (minStock < 0 || actStock < 0) {
      setToastMessage('Stock levels cannot be negative.');
      return;
    }

    if (actStock === 0) {
      setShowRedAlert(true);
    } else {
      executeSave();
    }
  };

  const executeSave = () => {
    updateItemStock(item.id, minStock, actStock, lifecycleStatus);
    setToastMessage('Inventory saved successfully!');
    setShowRedAlert(false);

    // Auto redirect after a short delay
    setTimeout(() => {
      router.push('/inventory');
    }, 1500);
  };

  return (
    <div className="flex-1 flex flex-col px-5 pb-5 pt-2.5 bg-white h-full overflow-hidden relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg z-50 transition-opacity duration-300">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="h-12 flex justify-between items-center border-b border-gray-200 mb-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <Link href="/inventory" className="text-gray-500 hover:text-gray-800 flex items-center">
            <span className="material-symbols-outlined text-lg font-bold">arrow_back</span>
          </Link>
          <div>
            <h2 className="text-base font-bold text-gray-805">Edit Inventory Item</h2>
            <p className="text-xs text-gray-500">Modify stock specifications for {item.noReg}</p>
          </div>
        </div>
        <span className="text-[10px] bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">
          Fase 1 Flow
        </span>
      </header>

      {/* Main Form Content Split */}
      <div className="flex-1 flex gap-5 min-h-0">

        {/* Left Side: 3D CAD Mockup */}
        <div className="w-1/2 bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 flex flex-col justify-between overflow-hidden relative">
          <div className="flex justify-between items-center mb-3 z-10">
            <span className="text-[9px] bg-gray-900 text-white font-bold px-2.5 py-1 rounded uppercase flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[12px] text-primary">view_in_ar</span>
              3D CAD Render
            </span>
            <span className="text-[10px] text-on-surface-variant font-bold">
              Rev Status: {item.revStatus}
            </span>
          </div>

          {/* Render Mock Drawing */}
          <div className="flex-1 rounded-xl bg-surface flex items-center justify-center relative overflow-hidden mb-4 border border-outline-variant/20 shadow-inner group">
            <img
              src={item.newVisualDesign || "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80"}
              alt="3D CAD drawing"
              className="object-cover w-full h-full opacity-60 mix-blend-luminosity group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-pattern-lines opacity-10 mix-blend-overlay"></div>
            <div className="absolute bottom-3 left-3 right-3 bg-black/75 backdrop-blur-sm rounded-lg p-3 border border-white/10">
              <p className="text-[9.5px] text-gray-400 font-semibold leading-none mb-1">Assy Part Name</p>
              <p className="text-xs font-bold text-white truncate leading-none">{item.assyPartName}</p>
            </div>
          </div>

          <div className="text-xs text-on-surface-variant grid grid-cols-2 gap-3 bg-surface/50 border border-outline-variant/10 rounded-xl p-3">
            <div>
              <span className="block text-[9.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Line Product:</span>
              <span className="text-on-surface font-bold truncate block">{item.lineProduct}</span>
            </div>
            <div>
              <span className="block text-[9.5px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Process:</span>
              <span className="text-on-surface font-bold truncate block">{item.process}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Stock Input Form */}
        <div className="w-1/2 flex flex-col gap-3">
          <form onSubmit={handleSave} className="flex-1 flex flex-col justify-between border border-gray-300 rounded-xl p-4 bg-gray-50">

            <div className="space-y-4">
              <h3 className="font-bold text-sm text-gray-805 border-b border-gray-300 pb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">settings_input_composite</span>
                Stock Parameters
              </h3>

              {!isPic && (
                <div className="bg-yellow-50 border border-yellow-250 text-yellow-800 text-[10.5px] p-2.5 rounded-lg mb-2 flex items-center gap-1.5 font-bold">
                  <span className="material-symbols-outlined text-[13px]">lock</span>
                  <span>View Only: Hubungi PIC Jigs (PE_JIG_FIXTURE) untuk mengubah stock.</span>
                </div>
              )}
              {/* Min Stock input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Minimum Stock limit</label>
                <div className={`flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary ${isPic ? 'bg-white' : 'bg-gray-100'}`}>
                  <span className="material-symbols-outlined text-gray-400 text-lg px-3">vertical_align_bottom</span>
                  <input
                    type="number"
                    className="flex-1 py-3 px-2 text-sm border-none outline-none focus:ring-0 text-gray-805 font-bold disabled:opacity-75"
                    min="0"
                    value={minStock}
                    onChange={(e) => setMinStock(parseInt(e.target.value) || 0)}
                    disabled={!isPic}
                  />
                </div>
              </div>

              {/* Actual Stock input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Actual Stock quantity</label>
                <div className={`flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary ${isPic ? 'bg-white' : 'bg-gray-100'}`}>
                  <span className="material-symbols-outlined text-gray-400 text-lg px-3">inventory</span>
                  <input
                    type="number"
                    className="flex-1 py-3 px-2 text-sm border-none outline-none focus:ring-0 text-gray-805 font-bold disabled:opacity-75"
                    min="0"
                    value={actStock}
                    onChange={(e) => setActStock(parseInt(e.target.value) || 0)}
                    disabled={!isPic}
                  />
                </div>
              </div>

              {/* Lifecycle Status input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Lifecycle Status</label>
                <div className={`flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-primary bg-white`}>
                  <span className="material-symbols-outlined text-gray-400 text-lg px-3">hourglass_empty</span>
                  <select
                    className="flex-1 py-3 px-2 text-sm border-none outline-none focus:ring-0 text-gray-805 font-bold bg-white"
                    value={lifecycleStatus}
                    onChange={(e) => setLifecycleStatus(e.target.value)}
                    disabled={!isPic}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="UNDER_REPAIR">Under Repair</option>
                    <option value="UNDER_IMPROVEMENT">Under Improvement</option>
                    <option value="OBSOLETE">Obsolete</option>
                    <option value="SCRAP">Scrap</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Realtime indicator Preview Badge */}
            <div className="bg-white border border-gray-300 rounded-xl p-3.5 shadow-inner my-3 flex justify-between items-center">
              <div>
                <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Realtime Preview</h4>
                <p className="text-xs font-bold text-gray-700">Stock Status Indicator</p>
              </div>
              <span className={`text-[11px] font-extrabold px-3.5 py-1.5 rounded-full ${indicatorColor}`}>
                {indicatorText}
              </span>
            </div>

            {/* Form actions */}
            <div className="flex gap-2.5">
              <Link
                href="/inventory"
                className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-150 transition-colors text-center cursor-pointer"
              >
                {isPic ? 'Cancel' : 'Back to Inventory'}
              </Link>
              {isPic && (
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#0063ff] text-white rounded-lg text-sm font-bold hover:bg-[#0052d4] transition-colors cursor-pointer"
                >
                  Save Stock
                </button>
              )}
            </div>

          </form>
        </div>

      </div>

      {/* Red Alert Modal Popup */}
      {showRedAlert && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="max-w-xs w-full bg-surface-container border-2 border-red-500 rounded-2xl p-4 text-on-surface shadow-2xl relative animate-scale-up">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-red-500 text-xl font-bold animate-ping absolute">error</span>
              <span className="material-symbols-outlined text-red-500 text-xl font-bold z-10">error</span>
            </div>
            <h3 className="text-center font-bold text-sm text-red-500 mb-1">CRITICAL STOK 0 DETECTED!</h3>
            <p className="text-center text-[9.5px] text-on-surface-variant mb-4 leading-relaxed">
              Saving actual stock as <strong>0</strong> will trigger a high-priority system-wide <strong>Red Alert banner</strong> and broadcast push notifications to the Section Head and Department Head.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowRedAlert(false)}
                className="flex-1 py-1.5 border border-outline/30 rounded-lg text-[10px] font-bold hover:bg-surface-container-highest transition-colors cursor-pointer"
              >
                Go Back
              </button>
              <button
                onClick={executeSave}
                className="flex-1 py-1.5 bg-red-500 text-white rounded-lg text-[10px] font-bold hover:bg-red-650 transition-colors cursor-pointer"
              >
                Proceed & Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
