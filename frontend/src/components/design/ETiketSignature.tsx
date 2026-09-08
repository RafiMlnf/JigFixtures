'use client';

import React, { useState } from 'react';
import SignaturePadModal from './SignaturePadModal';
import { getFileUrl } from '@/lib/api/phase3';

export interface ETiketSlotData {
  name?: string | null;
  date?: string | null;
  signature?: string | null;
  npk?: string | null;
}

interface ETiketSignatureProps {
  drawn?: ETiketSlotData;
  checked?: ETiketSlotData;
  approved?: ETiketSlotData;
  stampedPdfPath?: string | null;
  canSignDrawn?: boolean;
  canSignChecked?: boolean;
  canSignApproved?: boolean;
  onSignDrawn?: (signatureData: string) => Promise<void>;
  onSignChecked?: (signatureData: string) => Promise<void>;
  onSignApproved?: (signatureData: string) => Promise<void>;
  onOpenDirectSigner?: () => void;
  currentUser?: { name: string; npk?: string; role?: string } | null;
}

export default function ETiketSignature({
  drawn,
  checked,
  approved,
  stampedPdfPath,
  canSignDrawn = false,
  canSignChecked = false,
  canSignApproved = false,
  onSignDrawn,
  onSignChecked,
  onSignApproved,
  onOpenDirectSigner,
  currentUser,
}: ETiketSignatureProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<'DRAWN' | 'CHECKED' | 'APPROVED'>('DRAWN');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenSignModal = (slot: 'DRAWN' | 'CHECKED' | 'APPROVED') => {
    if (onOpenDirectSigner) {
      onOpenDirectSigner();
      return;
    }
    setActiveSlot(slot);
    setModalOpen(true);
  };

  const handleConfirmSignature = async (sigData: string) => {
    setIsSubmitting(true);
    try {
      if (activeSlot === 'DRAWN' && onSignDrawn) {
        await onSignDrawn(sigData);
      } else if (activeSlot === 'CHECKED' && onSignChecked) {
        await onSignChecked(sigData);
      } else if (activeSlot === 'APPROVED' && onSignApproved) {
        await onSignApproved(sigData);
      }
      setModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan tanda tangan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
      {/* Header */}
      <div className="px-3.5 py-2 border-b border-gray-150 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 text-base">verified</span>
          <h4 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider">
            E-Tiket & Tanda Tangan Digital Drawing
          </h4>
        </div>
        {stampedPdfPath && (
          <a
            href={getFileUrl(stampedPdfPath) || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded"
            title="Buka PDF dengan Stempel Resmi"
          >
            <span className="material-symbols-outlined text-[11px]">download</span>
            PDF Tertanda-tangan
          </a>
        )}
      </div>

      {/* 3-Column E-Tiket Title Block Grid */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 text-center bg-white">
        {/* ── DRAWN COLUMN ── */}
        <div className="p-3 flex flex-col items-center justify-between min-h-[140px] relative">
          <div className="w-full">
            <span className="text-[9px] font-bold tracking-wider text-gray-400 uppercase block mb-1">
              Drawn (Dibuat)
            </span>
            <span
              className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full inline-block mb-2 ${
                drawn?.signature || drawn?.name
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {drawn?.signature || drawn?.name ? 'SIGNED' : 'PENDING'}
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center my-1 w-full">
            {drawn?.signature ? (
              <img
                src={drawn.signature}
                alt="Drawn Signature"
                className="max-h-14 max-w-[120px] object-contain border border-gray-100 p-1 rounded bg-gray-50/50"
              />
            ) : drawn?.name ? (
              <div className="border border-dashed border-emerald-300 rounded p-1.5 bg-emerald-50/30 text-center w-full">
                <span className="material-symbols-outlined text-emerald-600 text-base">verified</span>
                <p className="text-[9px] font-bold text-emerald-800 truncate">{drawn.name}</p>
                <p className="text-[7px] text-gray-400">Digital Approved</p>
              </div>
            ) : (
              <div className="text-gray-300 flex flex-col items-center py-2">
                <span className="material-symbols-outlined text-2xl">edit_note</span>
                <span className="text-[8px] italic">Belum ditandatangani</span>
              </div>
            )}
          </div>

          <div className="w-full pt-1 border-t border-gray-100 flex flex-col items-center">
            <span className="text-[9px] font-bold text-gray-700 truncate max-w-[130px]">
              {drawn?.name || '—'}
            </span>
            <span className="text-[8px] text-gray-400">
              {drawn?.date ? drawn.date.split('T')[0] : 'Date: —'}
            </span>
            {canSignDrawn && !drawn?.signature && (
              <button
                type="button"
                onClick={() => handleOpenSignModal('DRAWN')}
                className="mt-1.5 text-[9px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-0.5 rounded shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[10px]">draw</span>
                Tanda Tangani
              </button>
            )}
          </div>
        </div>

        {/* ── CHECKED COLUMN ── */}
        <div className="p-3 flex flex-col items-center justify-between min-h-[140px] relative">
          <div className="w-full">
            <span className="text-[9px] font-bold tracking-wider text-gray-400 uppercase block mb-1">
              Checked (Diperiksa)
            </span>
            <span
              className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full inline-block mb-2 ${
                checked?.signature || checked?.name
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {checked?.signature || checked?.name ? 'VERIFIED' : 'PENDING'}
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center my-1 w-full">
            {checked?.signature ? (
              <img
                src={checked.signature}
                alt="Checked Signature"
                className="max-h-14 max-w-[120px] object-contain border border-gray-100 p-1 rounded bg-gray-50/50"
              />
            ) : checked?.name ? (
              <div className="border border-dashed border-emerald-300 rounded p-1.5 bg-emerald-50/30 text-center w-full">
                <span className="material-symbols-outlined text-emerald-600 text-base">verified</span>
                <p className="text-[9px] font-bold text-emerald-800 truncate">{checked.name}</p>
                <p className="text-[7px] text-gray-400">Section Head Sign</p>
              </div>
            ) : (
              <div className="text-gray-300 flex flex-col items-center py-2">
                <span className="material-symbols-outlined text-2xl">rule</span>
                <span className="text-[8px] italic">Awaiting Section Head</span>
              </div>
            )}
          </div>

          <div className="w-full pt-1 border-t border-gray-100 flex flex-col items-center">
            <span className="text-[9px] font-bold text-gray-700 truncate max-w-[130px]">
              {checked?.name || '—'}
            </span>
            <span className="text-[8px] text-gray-400">
              {checked?.date ? checked.date.split('T')[0] : 'Date: —'}
            </span>
            {canSignChecked && !checked?.signature && (
              <button
                type="button"
                onClick={() => handleOpenSignModal('CHECKED')}
                className="mt-1.5 text-[9px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-0.5 rounded shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[10px]">draw</span>
                Verifikasi
              </button>
            )}
          </div>
        </div>

        {/* ── APPROVED COLUMN ── */}
        <div className="p-3 flex flex-col items-center justify-between min-h-[140px] relative">
          <div className="w-full">
            <span className="text-[9px] font-bold tracking-wider text-gray-400 uppercase block mb-1">
              Approved (Disetujui)
            </span>
            <span
              className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full inline-block mb-2 ${
                approved?.signature || approved?.name
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {approved?.signature || approved?.name ? 'APPROVED' : 'PENDING'}
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center my-1 w-full">
            {approved?.signature ? (
              <img
                src={approved.signature}
                alt="Approved Signature"
                className="max-h-14 max-w-[120px] object-contain border border-gray-100 p-1 rounded bg-gray-50/50"
              />
            ) : approved?.name ? (
              <div className="border border-dashed border-emerald-300 rounded p-1.5 bg-emerald-50/30 text-center w-full">
                <span className="material-symbols-outlined text-emerald-600 text-base">verified</span>
                <p className="text-[9px] font-bold text-emerald-800 truncate">{approved.name}</p>
                <p className="text-[7px] text-gray-400">Dept Head Sign</p>
              </div>
            ) : (
              <div className="text-gray-300 flex flex-col items-center py-2">
                <span className="material-symbols-outlined text-2xl">approval</span>
                <span className="text-[8px] italic">Awaiting Dept Head</span>
              </div>
            )}
          </div>

          <div className="w-full pt-1 border-t border-gray-100 flex flex-col items-center">
            <span className="text-[9px] font-bold text-gray-700 truncate max-w-[130px]">
              {approved?.name || '—'}
            </span>
            <span className="text-[8px] text-gray-400">
              {approved?.date ? approved.date.split('T')[0] : 'Date: —'}
            </span>
            {canSignApproved && !approved?.signature && (
              <button
                type="button"
                onClick={() => handleOpenSignModal('APPROVED')}
                className="mt-1.5 text-[9px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-0.5 rounded shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[10px]">draw</span>
                Setujui
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      <SignaturePadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirmSignature}
        title={`Tanda Tangan Digital Kolom [${activeSlot}]`}
        roleLabel={activeSlot === 'DRAWN' ? 'Drafter (PIC)' : activeSlot === 'CHECKED' ? 'Section Head' : 'Dept Head'}
        signerName={currentUser?.name || (activeSlot === 'DRAWN' ? 'Kukuh' : activeSlot === 'CHECKED' ? 'M. Fariedl' : 'Rahmat K.')}
        signerNpk={currentUser?.npk || 'NPK001'}
      />
    </div>
  );
}
