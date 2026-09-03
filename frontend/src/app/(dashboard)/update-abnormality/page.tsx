'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { canEdit } from '@/lib/rbac';
import { fetchDesignItems, fetchAbnormalities, createAbnormality, updateAbnormalityStatus } from '@/lib/api/phase3';

const ABNORMALITY_TYPES = ['RUSAK', 'AUS', 'DEFORMASI', 'LAINNYA'];

const STATUS_CONFIG = {
  OPEN: { label: 'Open', color: 'bg-red-100 text-red-700 border-red-200' },
  MONITORING: { label: 'Monitoring', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  CLOSED: { label: 'Closed', color: 'bg-green-100 text-green-700 border-green-200' },
};

interface DesignItem {
  id: string;
  noReg: string;
  assyPartName: string;
  lineProduct: string;
  process?: string;
  type?: 'JF' | 'EQ';
}

interface AbnormalityReport {
  id: string;
  type: string;
  description: string;
  status: 'OPEN' | 'MONITORING' | 'CLOSED';
  dateFound: string;
  foundBy: string;
  rootCause: string;
  tempAction: string;
  correctiveAction: string;
  actionPic: string;
  linkToRevision: boolean;
  linkToSpare: boolean;
  createdAt: string;
  item: {
    noReg: string;
    assyPartName: string;
    lineProduct: string;
    process?: string;
    type?: 'JF' | 'EQ';
  };
  reportedBy: { name: string };
}

export default function UpdateAbnormalityPage() {
  const { user, isLoading } = useApp();
  const isPic = !isLoading && canEdit(user?.role);

  const [items, setItems] = useState<DesignItem[]>([]);
  const [reports, setReports] = useState<AbnormalityReport[]>([]);

  // Filter states for list
  const [searchRegId, setSearchRegId] = useState('');
  const [lineFilter, setLineFilter] = useState('All');
  const [processFilter, setProcessFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  // Form states
  const [selectedItemId, setSelectedItemId] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const [abnType, setAbnType] = useState('RUSAK');
  const [dateFound, setDateFound] = useState(new Date().toISOString().split('T')[0]);
  const [foundBy, setFoundBy] = useState('');
  const [description, setDescription] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [tempAction, setTempAction] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [actionPic, setActionPic] = useState('');
  const [status, setStatus] = useState<'OPEN' | 'MONITORING' | 'CLOSED'>('OPEN');
  const [linkToRevision, setLinkToRevision] = useState<boolean>(false);
  const [linkToSpare, setLinkToSpare] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'list'>('form');

  const loadData = useCallback(async () => {
    const [itemsData, reportsData] = await Promise.all([
      fetchDesignItems().catch(() => []),
      fetchAbnormalities().catch(() => []),
    ]);
    setItems(itemsData);
    setReports(reportsData);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Unique list filters derivation
  const uniqueLines = Array.from(new Set(reports.map((r) => r.item.lineProduct).filter(Boolean)));
  const uniqueProcesses = Array.from(new Set(reports.map((r) => r.item.process).filter(Boolean)));

  const filteredReports = reports.filter((r) => {
    const matchesReg = r.item.noReg.toLowerCase().includes(searchRegId.toLowerCase());
    const matchesLine = lineFilter === 'All' || r.item.lineProduct === lineFilter;
    const matchesProcess = processFilter === 'All' || r.item.process === processFilter;
    const matchesType = typeFilter === 'All' || r.item.type === typeFilter;
    return matchesReg && matchesLine && matchesProcess && matchesType;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !description.trim() || !foundBy.trim()) {
      setToast({ type: 'error', msg: 'Harap isi semua input wajib.' });
      return;
    }

    setSubmitting(true);
    try {
      await createAbnormality({
        itemId: selectedItemId,
        type: abnType,
        description,
        dateFound,
        foundBy,
        rootCause,
        tempAction,
        correctiveAction,
        actionPic,
        status,
        linkToRevision,
        linkToSpare,
      });

      setToast({
        type: 'success',
        msg: 'Laporan abnormality berhasil diajukan! Notifikasi dikirim ke Section & Dept Head.',
      });

      // Reset form
      setSelectedItemId('');
      setItemSearchQuery('');
      setDescription('');
      setFoundBy('');
      setRootCause('');
      setTempAction('');
      setCorrectiveAction('');
      setActionPic('');
      setLinkToRevision(false);
      setLinkToSpare(false);
      setStatus('OPEN');

      await loadData();
      setActiveTab('list');
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Gagal mengirim laporan.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'OPEN' | 'MONITORING' | 'CLOSED') => {
    try {
      await updateAbnormalityStatus(id, newStatus);
      await loadData();
      setToast({ type: 'success', msg: 'Status abnormality berhasil di-update.' });
    } catch (err: any) {
      setToast({ type: 'error', msg: 'Gagal update status.' });
    }
  };

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 pt-2 bg-white h-full overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 text-xs font-semibold px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 max-w-sm ${toast.type === 'success' ? 'bg-orange-600 text-white' : 'bg-red-600 text-white'}`}>
          <span className="material-symbols-outlined text-sm">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Header */}
      <header className="h-12 flex justify-between items-center border-b border-gray-150 mb-3 shrink-0">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#0063ff] text-lg">report_problem</span>
            Update Abnormality
          </h2>
        </div>
        {activeTab === 'form' && isPic && (
          <button
            type="submit"
            form="abnormalityForm"
            disabled={submitting}
            className="py-1.5 px-4 bg-[#0063ff] text-white rounded-lg text-xs font-bold hover:bg-[#0052d4] transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            {submitting ? (
              <span className="material-symbols-outlined animate-spin text-sm">sync</span>
            ) : (
              <span className="material-symbols-outlined text-sm">send</span>
            )}
            {submitting ? 'Mengirim...' : 'Laporkan Abnormality'}
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('form')}
          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeTab === 'form' ? 'bg-white text-[#0063ff] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="material-symbols-outlined text-[12px] align-middle mr-0.5">add_circle</span>
          Buat Laporan
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeTab === 'list' ? 'bg-white text-[#0063ff] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="material-symbols-outlined text-[12px] align-middle mr-0.5">list</span>
          Daftar Laporan
          {reports.filter((r) => r.status === 'OPEN').length > 0 && (
            <span className="ml-1 bg-red-500 text-white text-[8px] px-1 py-0.5 rounded-full">
              {reports.filter((r) => r.status === 'OPEN').length}
            </span>
          )}
        </button>
      </div>

      {/* Tab: Form */}
      {activeTab === 'form' && (
        <form id="abnormalityForm" onSubmit={handleSubmit} className="flex-1 grid grid-cols-2 gap-5 overflow-hidden mt-2 pr-1 pb-2">
          
          {/* Left Column: Problem Definition */}
          <div className="space-y-3.5 flex flex-col justify-start">
            <h3 className="font-bold text-xs text-gray-800 border-b border-gray-150 pb-2 flex items-center gap-1.5 shrink-0">
              <span className="material-symbols-outlined text-[#0063ff] text-sm">assignment_late</span>
              Informasi Masalah
            </h3>
            
            {/* Item selector */}
            <div>
              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Pilih Item Jig/Fixture *</label>
              {(() => {
                const selectedItem = items.find((item) => item.id === selectedItemId);
                const filteredItems = items.filter((item) => {
                  const query = itemSearchQuery.toLowerCase();
                  return (
                    item.noReg.toLowerCase().includes(query) ||
                    item.assyPartName.toLowerCase().includes(query) ||
                    item.lineProduct.toLowerCase().includes(query)
                  );
                });

                return (
                  <div className="relative">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="-- Cari berdasarkan No. Reg / Part Name / Line --"
                        value={isItemDropdownOpen ? itemSearchQuery : (selectedItem ? `${selectedItem.noReg} — ${selectedItem.assyPartName} [${selectedItem.lineProduct}]` : '')}
                        onChange={(e) => {
                          setItemSearchQuery(e.target.value);
                          if (!isItemDropdownOpen) setIsItemDropdownOpen(true);
                        }}
                        onFocus={() => {
                          setIsItemDropdownOpen(true);
                          setItemSearchQuery('');
                        }}
                        className="w-full border border-gray-300 rounded-lg pl-3 pr-12 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0063ff] outline-none text-gray-700 font-medium"
                      />
                      <input type="hidden" required value={selectedItemId} />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {selectedItemId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItemId('');
                              setItemSearchQuery('');
                            }}
                            className="text-gray-400 hover:text-gray-650 cursor-pointer flex"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsItemDropdownOpen(!isItemDropdownOpen)}
                          className="text-gray-400 hover:text-gray-650 cursor-pointer flex"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {isItemDropdownOpen ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Dropdown Options */}
                    {isItemDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsItemDropdownOpen(false)}
                        ></div>

                        <ul className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg z-50 text-xs no-scrollbar py-1">
                          {filteredItems.length > 0 ? (
                            filteredItems.map((item) => {
                              const isSelected = item.id === selectedItemId;
                              return (
                                <li
                                  key={item.id}
                                  onClick={() => {
                                    setSelectedItemId(item.id);
                                    setIsItemDropdownOpen(false);
                                    setItemSearchQuery('');
                                  }}
                                  className={`px-3 py-2 cursor-pointer transition-colors flex flex-col gap-0.5 ${
                                    isSelected
                                      ? 'bg-blue-50 text-blue-700 font-bold'
                                      : 'text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold text-gray-800">{item.noReg}</span>
                                    <span className="text-[8px] uppercase font-bold bg-gray-150 text-gray-600 px-1.5 py-0.25 rounded font-mono">
                                      {item.lineProduct}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-gray-500 font-medium truncate">{item.assyPartName}</span>
                                </li>
                              );
                            })
                          ) : (
                            <li className="px-3 py-2 text-gray-400 italic text-center">Item tidak ditemukan</li>
                          )}
                        </ul>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Date Found */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Tanggal Ditemukan *</label>
                <input
                  type="date"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0063ff] outline-none text-gray-700"
                  value={dateFound}
                  onChange={(e) => setDateFound(e.target.value)}
                />
              </div>

              {/* Found By */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Ditemukan Oleh *</label>
                <input
                  type="text"
                  placeholder="Nama pelapor..."
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0063ff] outline-none text-gray-700"
                  value={foundBy}
                  onChange={(e) => setFoundBy(e.target.value)}
                />
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Tipe Abnormality</label>
              <div className="flex gap-1.5 flex-wrap">
                {ABNORMALITY_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAbnType(t)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${abnType === t ? 'bg-[#0063ff] text-white border-[#0063ff]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#0063ff]'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="flex-1 flex flex-col min-h-0">
              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Problem Description (Deskripsi Masalah) *</label>
              <textarea
                placeholder="Detail gejala abnormal..."
                required
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#0063ff] outline-none resize-none text-gray-700 min-h-[90px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Right Column: Actions & Root Causes */}
          <div className="space-y-3.5 flex flex-col justify-start">
            <h3 className="font-bold text-xs text-gray-800 border-b border-gray-150 pb-2 flex items-center gap-1.5 shrink-0">
              <span className="material-symbols-outlined text-[#0063ff] text-sm">build</span>
              Analisa & Tindakan
            </h3>

            {/* Root Cause */}
            <div>
              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Root Cause (Penyebab Akar)</label>
              <textarea
                placeholder="Penyebab akar dari masalah..."
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0063ff] outline-none resize-none text-gray-700 h-[56px]"
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Temporary Action */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Temporary Action (Sementara)</label>
                <textarea
                  placeholder="Solusi sementara..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0063ff] outline-none resize-none text-gray-700 h-[56px]"
                  value={tempAction}
                  onChange={(e) => setTempAction(e.target.value)}
                />
              </div>

              {/* Corrective Action */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Corrective Action (Permanen)</label>
                <textarea
                  placeholder="Solusi jangka panjang..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0063ff] outline-none resize-none text-gray-700 h-[56px]"
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Action PIC */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Action PIC</label>
                <input
                  type="text"
                  placeholder="Nama PIC Tindakan..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0063ff] outline-none text-gray-700"
                  value={actionPic}
                  onChange={(e) => setActionPic(e.target.value)}
                />
              </div>

              {/* Initial Status */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Status Laporan</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0063ff] outline-none text-gray-700 font-bold"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="OPEN">Open</option>
                  <option value="MONITORING">Monitoring</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Link to Revision */}
              <div className="flex flex-col justify-center border border-gray-200 rounded-xl p-2.5 bg-gray-50">
                <label className="block text-[8px] font-bold text-gray-500 uppercase mb-0.5">Link to Revision?</label>
                <div className="flex gap-3 text-xs">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="linkToRevision"
                      checked={linkToRevision === true}
                      onChange={() => setLinkToRevision(true)}
                    />
                    <span>Ya</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="linkToRevision"
                      checked={linkToRevision === false}
                      onChange={() => setLinkToRevision(false)}
                    />
                    <span>Tidak</span>
                  </label>
                </div>
              </div>

              {/* Link to Spare Replacement */}
              <div className="flex flex-col justify-center border border-gray-200 rounded-xl p-2.5 bg-gray-50">
                <label className="block text-[8px] font-bold text-gray-500 uppercase mb-0.5">Link to Spare?</label>
                <div className="flex gap-3 text-xs">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="linkToSpare"
                      checked={linkToSpare === true}
                      onChange={() => setLinkToSpare(true)}
                    />
                    <span>Ya</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="linkToSpare"
                      checked={linkToSpare === false}
                      onChange={() => setLinkToSpare(false)}
                    />
                    <span>Tidak</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Alert info banner */}
            <div className="bg-orange-50 border border-orange-200 text-orange-850 text-[9px] p-2 rounded-lg flex items-start gap-1 font-medium leading-tight">
              <span className="material-symbols-outlined text-[12px] mt-0.5">warning</span>
              <span>Submit akan otomatis mengirimkan <strong>notifikasi darurat</strong> ke Section Head & Dept Head.</span>
            </div>
            
            {!isPic && (
              <p className="text-[9px] text-red-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-[11px]">lock</span>
                Hanya PIC Jig Fixture yang dapat membuat laporan.
              </p>
            )}
          </div>
        </form>
      )}

      {/* Tab: Report List */}
      {activeTab === 'list' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Detailed Filters row */}
          <div className="flex flex-wrap gap-2.5 items-center bg-gray-50 p-2.5 rounded-xl mb-3 border border-gray-150 text-[10px]">
            {/* Search Reg ID */}
            <div className="flex-1 min-w-[150px] relative">
              <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">search</span>
              <input
                className="pl-6 pr-2 py-1 bg-white border border-gray-300 rounded-full text-[10px] w-full focus:ring-1 focus:ring-[#0063ff] outline-none text-gray-700"
                placeholder="Cari No. Reg..."
                value={searchRegId}
                onChange={(e) => setSearchRegId(e.target.value)}
              />
            </div>

            {/* Line Filter */}
            <div className="relative border border-gray-300 rounded-full px-2.5 py-1 bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-all cursor-pointer">
              <span>Line: {lineFilter}</span>
              <select
                value={lineFilter}
                onChange={(e) => setLineFilter(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              >
                <option value="All">All Lines</option>
                {uniqueLines.map((line) => (
                  <option key={line} value={line}>{line}</option>
                ))}
              </select>
            </div>

            {/* Process Filter */}
            <div className="relative border border-gray-300 rounded-full px-2.5 py-1 bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-all cursor-pointer">
              <span>OP Number: {processFilter}</span>
              <select
                value={processFilter}
                onChange={(e) => setProcessFilter(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              >
                <option value="All">All Processes</option>
                {uniqueProcesses.map((proc) => (
                  <option key={proc} value={proc}>{proc}</option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="relative border border-gray-300 rounded-full px-2.5 py-1 bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-all cursor-pointer">
              <span>Type: {typeFilter}</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              >
                <option value="All">All Types</option>
                <option value="JF">JF (Jig Fixture)</option>
                <option value="EQ">EQ (Equipment)</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar rounded-lg border border-gray-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-semibold sticky top-0 border-b border-gray-200">
                  <th className="px-3 py-2">No. Reg</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Found By</th>
                  <th className="px-2 py-2">Problem Description</th>
                  <th className="px-2 py-2">Root Cause</th>
                  <th className="px-2 py-2">PIC Action</th>
                  <th className="px-2 py-2 text-center">Status</th>
                  {isPic && <th className="px-2 py-2 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={isPic ? 8 : 7} className="text-center py-12 text-gray-400">
                      Belum ada laporan abnormality yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((r) => {
                    const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.OPEN;
                    return (
                      <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono font-bold text-[9px] text-gray-850" title={`Line: ${r.item.lineProduct} | OP: ${r.item.process}`}>
                          {r.item.noReg}
                        </td>
                        <td className="px-2 py-2">
                          <span className="bg-blue-50 text-[#0063ff] border border-blue-200 px-1.5 py-0.5 rounded text-[8px] font-bold">
                            {r.item.type || 'JF'}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-gray-600 font-medium">
                          {r.foundBy} <span className="block text-[8px] text-gray-400">{new Date(r.dateFound).toLocaleDateString('id-ID')}</span>
                        </td>
                        <td className="px-2 py-2 max-w-[150px]" title={r.description}>
                          <p className="truncate text-[9px] text-gray-800">{r.description}</p>
                        </td>
                        <td className="px-2 py-2 max-w-[150px]" title={r.rootCause || 'N/A'}>
                          <p className="truncate text-[9px] text-gray-500 italic">{r.rootCause || 'N/A'}</p>
                        </td>
                        <td className="px-2 py-2 font-medium text-gray-700">
                          {r.actionPic || <span className="text-gray-400 italic">None</span>}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border ${sc.color}`}>
                            {sc.label}
                          </span>
                        </td>
                        {isPic && (
                          <td className="px-2 py-2 text-center">
                            <select
                              value={r.status}
                              onChange={(e) => handleStatusChange(r.id, e.target.value as any)}
                              className="text-[9px] border border-gray-200 rounded px-1 py-0.5 bg-white cursor-pointer font-bold text-gray-700"
                            >
                              <option value="OPEN">Open</option>
                              <option value="MONITORING">Monitoring</option>
                              <option value="CLOSED">Closed</option>
                            </select>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
