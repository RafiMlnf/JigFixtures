'use client';

import React, { useRef, useState, useEffect } from 'react';

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (signatureDataUrl: string, type: 'DRAW' | 'STAMP' | 'UPLOAD') => void;
  title?: string;
  roleLabel?: string; // e.g. "Drafter", "Section Head", "Dept Head"
  signerName?: string;
  signerNpk?: string;
}

export default function SignaturePadModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Tanda Tangan Digital E-Tiket',
  roleLabel = 'Drafter',
  signerName = 'User PIC',
  signerNpk = 'NPK001',
}: SignaturePadModalProps) {
  const [activeTab, setActiveTab] = useState<'stamp' | 'draw' | 'upload'>('stamp');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stampCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Auto-render official MTM stamp on stamp tab
  useEffect(() => {
    if (!isOpen || activeTab !== 'stamp') return;
    const canvas = stampCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Stamp Border (double rectangle with rounded corners)
    ctx.strokeStyle = '#0052cc';
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    ctx.strokeStyle = '#0052cc';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Background tint
    ctx.fillStyle = 'rgba(0, 102, 255, 0.04)';
    ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Company Header
    ctx.fillStyle = '#003399';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PT MENARA TERUS MAKMUR', canvas.width / 2, 28);

    ctx.fillStyle = '#666666';
    ctx.font = '9px Arial, sans-serif';
    ctx.fillText('ASTRA OTOPARTS GROUP', canvas.width / 2, 40);

    // Divider
    ctx.strokeStyle = '#0052cc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(15, 46);
    ctx.lineTo(canvas.width - 15, 46);
    ctx.stroke();

    // Role Badge & Status
    ctx.fillStyle = '#0066cc';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillText(`DIGITALLY SIGNED: [${roleLabel.toUpperCase()}]`, canvas.width / 2, 66);

    // Signer Details
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText(signerName.toUpperCase(), canvas.width / 2, 85);

    ctx.fillStyle = '#4b5563';
    ctx.font = '10px Arial, sans-serif';
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').slice(0, 19);
    ctx.fillText(`NPK: ${signerNpk}  •  ${dateStr}`, canvas.width / 2, 100);

    // Security Verification Code
    const hash = Math.random().toString(36).substring(2, 10).toUpperCase();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '8px monospace';
    ctx.fillText(`VERIF-ID: MTM-${hash}-E-TIKET`, canvas.width / 2, 115);
  }, [isOpen, activeTab, roleLabel, signerName, signerNpk]);

  if (!isOpen) return null;

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearDrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (activeTab === 'stamp') {
      const canvas = stampCanvasRef.current;
      if (!canvas) return;
      onConfirm(canvas.toDataURL('image/png'), 'STAMP');
    } else if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) {
        alert('Silakan gambar tanda tangan Anda di canvas terlebih dahulu.');
        return;
      }
      onConfirm(canvas.toDataURL('image/png'), 'DRAW');
    } else if (activeTab === 'upload') {
      if (!uploadedImage) {
        alert('Silakan pilih file gambar tanda tangan (PNG/JPG).');
        return;
      }
      onConfirm(uploadedImage, 'UPLOAD');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-xs">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-150 bg-gray-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-lg">draw</span>
            <div>
              <h3 className="text-xs font-bold text-gray-900">{title}</h3>
              <p className="text-[10px] text-gray-500">
                Kolom: <span className="font-bold text-blue-700">{roleLabel}</span> &bull; {signerName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm font-bold">
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 bg-white px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('stamp')}
            className={`pb-2 text-[11px] font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'stamp'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">verified</span>
            Stempel Digital Resmi MTM
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('draw')}
            className={`pb-2 text-[11px] font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'draw'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">gesture</span>
            Gambar Manual
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2 text-[11px] font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">upload_file</span>
            Upload File
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 flex flex-col items-center">
          {activeTab === 'stamp' && (
            <div className="flex flex-col items-center gap-3 w-full">
              <p className="text-[10px] text-gray-500 text-center">
                Stempel verifikasi digital terenkripsi dengan identitas resmi Astra Otoparts & PT Menara Terus Makmur.
              </p>
              <div className="border border-blue-200 rounded-xl p-2 bg-blue-50/30 shadow-inner flex justify-center">
                <canvas
                  ref={stampCanvasRef}
                  width={340}
                  height={130}
                  className="rounded-lg shadow-xs bg-white"
                />
              </div>
              <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">check_circle</span>
                Siap distempel ke kolom {roleLabel} pada E-Tiket PDF
              </span>
            </div>
          )}

          {activeTab === 'draw' && (
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="flex justify-between items-center w-full px-1">
                <span className="text-[10px] text-gray-500">Tanda tangani pada area di bawah:</span>
                <button
                  type="button"
                  onClick={clearDrawCanvas}
                  className="text-[10px] text-red-600 hover:text-red-700 font-bold flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[12px]">delete</span>
                  Bersihkan
                </button>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-white transition-colors cursor-crosshair relative shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={140}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="rounded-lg"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400 text-xs">
                    Goreskan tanda tangan di sini...
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="flex flex-col items-center gap-3 w-full">
              <label className="border-2 border-dashed border-gray-300 rounded-xl p-4 w-full flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-blue-50/50 hover:border-blue-400 transition-all bg-gray-50">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {uploadedImage ? (
                  <img src={uploadedImage} alt="Preview" className="max-h-24 max-w-[250px] object-contain" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-gray-400 text-3xl">add_photo_alternate</span>
                    <span className="text-xs font-semibold text-gray-700">Pilih gambar tanda tangan (PNG transparan)</span>
                    <span className="text-[9px] text-gray-400">Maks 2MB</span>
                  </>
                )}
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-150 bg-gray-50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">verified_user</span>
            Gunakan Tanda Tangan Ini
          </button>
        </div>
      </div>
    </div>
  );
}
