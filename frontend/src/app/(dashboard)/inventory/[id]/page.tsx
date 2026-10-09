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
    <div className="flex-1 flex flex-col px-4 pb-4 pt-2 bg-white h-full overflow-hidden relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[99] px-4 py-2 rounded-lg text-xs font-bold shadow-lg bg-gray-900 text-white transition-all animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="h-12 flex justify-between items-center border-b border-gray-150 mb-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/inventory"
            className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900 shrink-0"
            title="Kembali ke Daftar Inventory"
          >
            <span className="material-symbols-outlined text-base font-bold">arrow_back</span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs truncate">
            <span className="font-mono text-gray-900 font-bold truncate">{item.noReg}</span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-600 font-medium truncate max-w-[260px]">{item.assyPartName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Rev {item.revStatus}
          </span>
          <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase tracking-wider">
            {item.lineProduct} · {item.process}
          </span>
        </div>
      </header>

      {/* Main Form Content Split */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-y-auto no-scrollbar">

        {/* Left Side: Drawing / CAD Preview Card */}
        <div className="w-1/2 flex flex-col gap-3 min-h-0">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex flex-col justify-between overflow-hidden relative shadow-2xs">
            <div className="flex justify-between items-center mb-2 z-10">
              <span className="text-[9px] bg-gray-900 text-white font-bold px-2 py-0.5 rounded flex items-center gap-1">
                <span className="material-symbols-outlined text-[11px] text-blue-400">deployed_code</span>
                Visual Drawing CAD
              </span>
              <span className="text-[9px] text-gray-500 font-mono font-semibold">
                Tipe: {item.type}
              </span>
            </div>

            {/* Render Mock Drawing */}
            <div className="flex-1 rounded-lg bg-white flex items-center justify-center relative overflow-hidden mb-3 border border-gray-200 shadow-inner group min-h-[220px]">
              <img
                src={item.newVisualDesign || "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80"}
                alt="3D CAD drawing"
                className="object-cover w-full h-full opacity-65 mix-blend-luminosity group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-gray-900/85 backdrop-blur-sm rounded-lg p-2.5 border border-white/10">
                <p className="text-[8px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Nama Assembly Part</p>
                <p className="text-[11px] font-bold text-white truncate">{item.assyPartName}</p>
              </div>
            </div>

            <div className="text-[10px] text-gray-600 grid grid-cols-2 gap-2 bg-white border border-gray-200 rounded-lg p-2.5">
              <div>
                <span className="block text-[8px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Lini Produksi</span>
                <span className="text-gray-800 font-bold truncate block">{item.lineProduct || '-'}</span>
              </div>
              <div>
                <span className="block text-[8px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Operasi / Proses</span>
                <span className="text-gray-800 font-bold truncate block">{item.process || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Stock Input Form */}
        <div className="w-1/2 flex flex-col gap-3 min-h-0">
          <form onSubmit={handleSave} className="flex-1 flex flex-col justify-between border border-gray-200 rounded-xl p-4 bg-white shadow-2xs">

            <div className="space-y-3.5">
              <div className="border-b border-gray-150 pb-2">
                <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#0063ff] text-base">tune</span>
                  Parameter Inventory &amp; Stok
                </h3>
                <p className="text-[9.5px] text-gray-400 mt-0.5">Perbarui kuantitas aktual, batas minimum, dan status siklus pakai jig</p>
              </div>

              {!isPic && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] p-2.5 rounded-lg flex items-center gap-1.5 font-medium">
                  <span className="material-symbols-outlined text-[13px] text-amber-600">lock</span>
                  <span>Mode View Only: Hanya PIC Jig &amp; Fixture (PE_JIG_FIXTURE) yang dapat mengubah parameter stok.</span>
                </div>
              )}

              {/* Min Stock input */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                  Minimum Stock Limit <span className="text-gray-400 font-normal">(Ambang Batas)</span>
                </label>
                <div className={`flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 ${isPic ? 'bg-gray-50' : 'bg-gray-100'}`}>
                  <span className="material-symbols-outlined text-gray-400 text-base px-2.5">vertical_align_bottom</span>
                  <input
                    type="number"
                    className="flex-1 py-2 px-1 text-xs border-none outline-none focus:ring-0 text-gray-800 font-bold disabled:opacity-75 bg-transparent"
                    min="0"
                    value={minStock}
                    onChange={(e) => setMinStock(parseInt(e.target.value) || 0)}
                    disabled={!isPic}
                  />
                  <span className="text-[10px] font-bold text-gray-400 pr-3">unit</span>
                </div>
              </div>

              {/* Actual Stock input */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                  Actual Stock Quantity <span className="text-gray-400 font-normal">(Fisik di Lapangan)</span>
                </label>
                <div className={`flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 ${isPic ? 'bg-gray-50' : 'bg-gray-100'}`}>
                  <span className="material-symbols-outlined text-gray-400 text-base px-2.5">inventory</span>
                  <input
                    type="number"
                    className="flex-1 py-2 px-1 text-xs border-none outline-none focus:ring-0 text-gray-800 font-bold disabled:opacity-75 bg-transparent"
                    min="0"
                    value={actStock}
                    onChange={(e) => setActStock(parseInt(e.target.value) || 0)}
                    disabled={!isPic}
                  />
                  <span className="text-[10px] font-bold text-gray-400 pr-3">unit</span>
                </div>
              </div>

              {/* Lifecycle Status input */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                  Lifecycle Status
                </label>
                <div className={`flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 bg-gray-50`}>
                  <span className="material-symbols-outlined text-gray-400 text-base px-2.5">hourglass_empty</span>
                  <select
                    className="flex-1 py-2 px-1 text-xs border-none outline-none focus:ring-0 text-gray-800 font-bold bg-transparent cursor-pointer"
                    value={lifecycleStatus}
                    onChange={(e) => setLifecycleStatus(e.target.value)}
                    disabled={!isPic}
                  >
                    <option value="ACTIVE">Active (Siap Pakai)</option>
                    <option value="UNDER_REPAIR">Under Repair (Sedang Perbaikan)</option>
                    <option value="UNDER_IMPROVEMENT">Under Improvement (Modifikasi)</option>
                    <option value="OBSOLETE">Obsolete (Tidak Digunakan)</option>
                    <option value="SCRAP">Scrap (Afkir)</option>
                  </select>
                </div>
              </div>

              {/* Realtime indicator Preview Badge */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex justify-between items-center mt-2">
                <div>
                  <h4 className="text-[8.5px] font-bold text-gray-400 uppercase tracking-wider">Preview Indikator Real-Time</h4>
                  <p className="text-[11px] font-bold text-gray-700">Status Ketersediaan</p>
                </div>
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full shadow-2xs ${indicatorColor}`}>
                  {indicatorText}
                </span>
              </div>
            </div>

            {/* Form actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-gray-150 mt-4">
              <Link
                href="/inventory"
                className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors text-center cursor-pointer"
              >
                {isPic ? 'Batal' : 'Kembali ke Inventory'}
              </Link>
              {isPic && (
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#0063ff] hover:bg-[#0052d4] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  Simpan Perubahan
                </button>
              )}
            </div>

          </form>
        </div>

      </div>

      {/* Red Alert Modal Popup */}
      {showRedAlert && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[99]">
          <div className="max-w-sm w-full bg-white border border-red-200 rounded-2xl p-5 text-gray-800 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3 text-red-600">
              <span className="material-symbols-outlined text-2xl font-bold">error</span>
            </div>
            <h3 className="text-center font-bold text-sm text-red-600 mb-1">PERINGATAN STOK 0 DETECTED!</h3>
            <p className="text-center text-[10px] text-gray-500 mb-4 leading-relaxed">
              Menyimpan stok aktual bernilai <strong>0 unit</strong> akan memicu status <strong>Critical (Red Alert)</strong> dan memunculkan notifikasi prioritas tinggi pada dashboard manajemen.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRedAlert(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cek Kembali
              </button>
              <button
                onClick={executeSave}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                Lanjutkan Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
