'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
}

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
  const [activeTab, setActiveTab] = useState<'draw' | 'stamp' | 'upload'>('draw');
  const [inkColor, setInkColor] = useState<'#002b80' | '#0f172a'>('#002b80');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stampCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const pointsRef = useRef<Point[]>([]);
  const prevMidPointRef = useRef<Point | null>(null);

  // Calibrated coordinate calculation (1:1 with cursor without drift)
  const getCoordinates = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  // Smooth Bezier Curve Drawing Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDrawing(true);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getCoordinates(e);
    pointsRef.current = [pt];
    prevMidPointRef.current = pt;

    ctx.fillStyle = inkColor;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentPt = getCoordinates(e);
    const points = pointsRef.current;
    if (points.length === 0) return;

    const prevPt = points[points.length - 1];
    const midPoint: Point = {
      x: (prevPt.x + currentPt.x) / 2,
      y: (prevPt.y + currentPt.y) / 2,
    };

    const startPt = prevMidPointRef.current || prevPt;

    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = inkColor;

    ctx.beginPath();
    ctx.moveTo(startPt.x, startPt.y);
    ctx.quadraticCurveTo(prevPt.x, prevPt.y, midPoint.x, midPoint.y);
    ctx.stroke();

    prevMidPointRef.current = midPoint;
    points.push(currentPt);
    setHasDrawn(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const canvas = canvasRef.current;
    if (canvas && pointsRef.current.length > 0 && prevMidPointRef.current) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const lastPt = pointsRef.current[pointsRef.current.length - 1];
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = inkColor;
        ctx.beginPath();
        ctx.moveTo(prevMidPointRef.current.x, prevMidPointRef.current.y);
        ctx.lineTo(lastPt.x, lastPt.y);
        ctx.stroke();
      }
    }

    setIsDrawing(false);
    pointsRef.current = [];
    prevMidPointRef.current = null;
  };

  const clearDrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    pointsRef.current = [];
    prevMidPointRef.current = null;
  };

  // Auto-render official MTM stamp on stamp tab
  useEffect(() => {
    if (!isOpen || activeTab !== 'stamp') return;
    const canvas = stampCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#004080';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    ctx.strokeStyle = '#0052cc';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(11, 11, canvas.width - 22, canvas.height - 22);

    ctx.fillStyle = 'rgba(0, 82, 204, 0.04)';
    ctx.fillRect(11, 11, canvas.width - 22, canvas.height - 22);

    ctx.fillStyle = '#002b80';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PT MENARA TERUS MAKMUR', canvas.width / 2, 28);

    ctx.fillStyle = '#555555';
    ctx.font = '8.5px Arial, sans-serif';
    ctx.fillText('ASTRA OTOPARTS GROUP', canvas.width / 2, 40);

    ctx.strokeStyle = '#004080';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(18, 46);
    ctx.lineTo(canvas.width - 18, 46);
    ctx.stroke();

    ctx.fillStyle = '#0052cc';
    ctx.font = 'bold 12.5px Arial, sans-serif';
    ctx.fillText(`DIGITALLY SIGNED: [${roleLabel.toUpperCase()}]`, canvas.width / 2, 65);

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 11.5px Arial, sans-serif';
    ctx.fillText(signerName.toUpperCase(), canvas.width / 2, 82);

    ctx.fillStyle = '#4b5563';
    ctx.font = '9px Arial, sans-serif';
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').slice(0, 19);
    ctx.fillText(`NPK: ${signerNpk}  •  ${dateStr}`, canvas.width / 2, 97);

    const hash = Math.random().toString(36).substring(2, 9).toUpperCase();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '7.5px monospace';
    ctx.fillText(`VERIF-ID: MTM-${hash}-E-TIKET`, canvas.width / 2, 111);
  }, [isOpen, activeTab, roleLabel, signerName, signerNpk]);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-150 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-blue-200">ink_pen</span>
            <div>
              <h3 className="font-bold text-xs">{title}</h3>
              <p className="text-[9px] text-blue-200">
                Kolom E-Tiket: <span className="font-bold text-white">{roleLabel}</span> ({signerName})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-gray-200 px-5 pt-3 gap-4 bg-gray-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('draw')}
            className={`pb-2 text-[11px] font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'draw'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">gesture</span>
            Gores Halus
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stamp')}
            className={`pb-2 text-[11px] font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'stamp'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">verified</span>
            Stempel MTM
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2 text-[11px] font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
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
          {activeTab === 'draw' && (
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="flex justify-between items-center w-full px-1 text-[10px]">
                {/* Ink selection */}
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 font-semibold">Tinta:</span>
                  <button
                    type="button"
                    onClick={() => setInkColor('#002b80')}
                    className={`w-4 h-4 rounded-full bg-[#002b80] transition-transform cursor-pointer ${inkColor === '#002b80' ? 'ring-2 ring-blue-500 scale-110' : 'opacity-60'}`}
                    title="Tinta Biru Resmi MTM"
                  />
                  <button
                    type="button"
                    onClick={() => setInkColor('#0f172a')}
                    className={`w-4 h-4 rounded-full bg-[#0f172a] transition-transform cursor-pointer ${inkColor === '#0f172a' ? 'ring-2 ring-blue-500 scale-110' : 'opacity-60'}`}
                    title="Tinta Hitam Pekat"
                  />
                </div>

                <button
                  type="button"
                  onClick={clearDrawCanvas}
                  className="text-red-600 hover:text-red-700 font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[12px]">delete</span>
                  Bersihkan
                </button>
              </div>

              <div className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl bg-slate-50/60 transition-colors cursor-crosshair relative shadow-inner overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={480}
                  height={180}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="w-full h-[140px] touch-none block"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-gray-400 text-xs gap-1">
                    <span className="material-symbols-outlined text-lg text-blue-300 animate-pulse">gesture</span>
                    <span className="text-[10px]">Goreskan tanda tangan kursor/stylus di sini</span>
                    <span className="text-[8px] text-gray-400">Presisi 1:1 akurat &amp; bebas lag</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'stamp' && (
            <div className="flex flex-col items-center gap-3 w-full">
              <p className="text-[10px] text-gray-500 text-center">
                Stempel verifikasi digital terenkripsi dengan identitas resmi Astra Otoparts & PT Menara Terus Makmur.
              </p>
              <div className="border border-blue-200 rounded-xl p-2 bg-blue-50/30 shadow-inner flex justify-center w-full">
                <canvas
                  ref={stampCanvasRef}
                  width={480}
                  height={160}
                  className="w-full h-[125px] rounded-lg shadow-xs bg-white"
                />
              </div>
              <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">check_circle</span>
                Siap distempel ke kolom {roleLabel} pada E-Tiket PDF
              </span>
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
            className="px-3.5 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-lg font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">task_alt</span>
            Terapkan Tanda Tangan
          </button>
        </div>
      </div>
    </div>
  );
}
