'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
}

interface DirectPdfSignerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySignature: (signatureDataUrl: string, type: 'DRAW' | 'STAMP' | 'UPLOAD', comment?: string) => Promise<void>;
  roleLabel?: string; // "Drafter", "Section Head", "Dept Head"
  signerName?: string;
  signerNpk?: string;
  pdfUrl?: string | null;
  showCommentField?: boolean;
}

export default function DirectPdfSigner({
  isOpen,
  onClose,
  onApplySignature,
  roleLabel = 'Drafter',
  signerName = 'User PIC',
  signerNpk = 'NPK001',
  showCommentField = false,
}: DirectPdfSignerProps) {
  const [signMode, setSignMode] = useState<'draw' | 'stamp' | 'upload'>('draw');
  const [inkColor, setInkColor] = useState<'#002b80' | '#0f172a' | '#0284c7'>('#002b80'); // Navy, Black, or MTM Blue
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stampCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const prevMidPointRef = useRef<Point | null>(null);

  // Coordinate calculation calibrated 1:1 with the cursor / stylus position
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

  // Ultra-Smooth Bezier Curve Drawing Engine with Pointer Events
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

    // Draw initial contact dot
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
    // Calculate midpoint between previous point and current point
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

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    pointsRef.current = [];
    prevMidPointRef.current = null;
  };

  /**
   * Export the canvas with transparent edges trimmed.
   * This ensures the actual signature strokes fill the PDF slot well
   * rather than being scaled-down due to excess whitespace.
   */
  const getTrimmedSignatureDataUrl = (sourceCanvas: HTMLCanvasElement): string => {
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return sourceCanvas.toDataURL('image/png');

    const { width, height } = sourceCanvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasPixel = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 10) { // non-transparent pixel
          hasPixel = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasPixel) return sourceCanvas.toDataURL('image/png');

    // Add 8px padding around the actual strokes
    const pad = 8;
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(width, maxX + pad) - cropX;
    const cropH = Math.min(height, maxY + pad) - cropY;

    const offscreen = document.createElement('canvas');
    offscreen.width = cropW;
    offscreen.height = cropH;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return sourceCanvas.toDataURL('image/png');

    offCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    return offscreen.toDataURL('image/png');
  };

  // Render Official MTM Digital Verification Stamp on Canvas
  useEffect(() => {
    if (!isOpen || signMode !== 'stamp') return;
    const canvas = stampCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Outer double border
    ctx.strokeStyle = '#004080';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    ctx.strokeStyle = '#0052cc';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(11, 11, canvas.width - 22, canvas.height - 22);

    // Subtle background tint
    ctx.fillStyle = 'rgba(0, 82, 204, 0.04)';
    ctx.fillRect(11, 11, canvas.width - 22, canvas.height - 22);

    // Header
    ctx.fillStyle = '#002b80';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PT MENARA TERUS MAKMUR', canvas.width / 2, 28);

    ctx.fillStyle = '#555555';
    ctx.font = '8.5px Arial, sans-serif';
    ctx.fillText('ASTRA OTOPARTS GROUP', canvas.width / 2, 40);

    // Line
    ctx.strokeStyle = '#004080';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(18, 46);
    ctx.lineTo(canvas.width - 18, 46);
    ctx.stroke();

    // Role & Signer
    ctx.fillStyle = '#0052cc';
    ctx.font = 'bold 12.5px Arial, sans-serif';
    ctx.fillText(`DIGITALLY SIGNED [${roleLabel.toUpperCase()}]`, canvas.width / 2, 65);

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 11.5px Arial, sans-serif';
    ctx.fillText(signerName.toUpperCase(), canvas.width / 2, 82);

    ctx.fillStyle = '#4b5563';
    ctx.font = '9px Arial, sans-serif';
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    ctx.fillText(`NPK: ${signerNpk}  •  ${nowStr}`, canvas.width / 2, 97);

    // Verification ID
    const hash = Math.random().toString(36).substring(2, 9).toUpperCase();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '7.5px monospace';
    ctx.fillText(`VERIF-ID: MTM-${hash}-ETIKET`, canvas.width / 2, 111);
  }, [isOpen, signMode, roleLabel, signerName, signerNpk]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleApply = async () => {
    let dataUrl = '';
    let type: 'DRAW' | 'STAMP' | 'UPLOAD' = 'DRAW';

    if (signMode === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) {
        alert('Silakan goreskan tanda tangan Anda pada kotak tanda tangan.');
        return;
      }
      // Use trimmed export to remove excess transparent whitespace
      dataUrl = getTrimmedSignatureDataUrl(canvas);
      type = 'DRAW';
    } else if (signMode === 'stamp') {
      const canvas = stampCanvasRef.current;
      if (!canvas) return;
      dataUrl = canvas.toDataURL('image/png');
      type = 'STAMP';
    } else if (signMode === 'upload') {
      if (!uploadedImage) {
        alert('Silakan pilih file gambar tanda tangan terlebih dahulu.');
        return;
      }
      dataUrl = uploadedImage;
      type = 'UPLOAD';
    }

    setIsSubmitting(true);
    try {
      await onApplySignature(dataUrl, type, commentText || undefined);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Gagal menerapkan tanda tangan ke PDF');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col pointer-events-none animate-in fade-in duration-200 select-none">
      {/* Top Banner Guide in PDF Canvas */}
      <div className="bg-slate-900/92 text-white px-4 py-2 flex items-center justify-between pointer-events-auto backdrop-blur-md border-b border-white/10 shadow-lg shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-400/40">
            <span className="material-symbols-outlined text-blue-400 text-sm animate-pulse">draw</span>
          </div>
          <div>
            <h4 className="text-[11px] font-bold flex items-center gap-1.5 leading-tight">
              <span>Mode Tanda Tangan Langsung di Dokumen PDF</span>
              <span className="bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                {roleLabel}
              </span>
            </h4>
            <p className="text-[9px] text-gray-300">
              Tanda tangan akan langsung di-stempel &amp; di-bake permanen ke kolom E-Tiket di dalam file PDF drawing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-gray-300 hover:text-white flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
            title={isMinimized ? 'Perbesar panel tanda tangan' : 'Kecilkan panel untuk melihat gambar'}
          >
            <span className="material-symbols-outlined text-sm">
              {isMinimized ? 'open_in_full' : 'close_fullscreen'}
            </span>
            <span>{isMinimized ? 'Tampilkan Panel' : 'Lihat Gambar'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-white flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            <span>Batal</span>
          </button>
        </div>
      </div>

      {/* Main Signing Dock Floating Over PDF */}
      <div className="flex-1 relative flex items-end justify-end p-4 pointer-events-none">
        {isMinimized ? (
          /* Minimized Pill */
          <div className="pointer-events-auto bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-2 cursor-pointer transition-all animate-in slide-in-from-bottom-2"
            onClick={() => setIsMinimized(false)}
          >
            <span className="material-symbols-outlined text-base animate-bounce">draw</span>
            <div className="text-left">
              <p className="text-[10px] font-bold leading-tight">Panel Tanda Tangan [{roleLabel}]</p>
              <p className="text-[8px] text-blue-200">Klik untuk membuka kembali &amp; membubuhkan tanda tangan</p>
            </div>
            <span className="material-symbols-outlined text-sm ml-1">expand_less</span>
          </div>
        ) : (
          /* Full Signing Dock */
          <div className="w-[370px] bg-white rounded-2xl shadow-2xl border-2 border-blue-500 pointer-events-auto overflow-hidden flex flex-col animate-in slide-in-from-bottom-3 duration-200">
            {/* Dock Header */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-650 to-indigo-700 text-white px-3.5 py-2.5 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-blue-200">ink_pen</span>
                <span className="text-[10.5px] font-bold">Kolom E-Tiket: {roleLabel}</span>
              </div>
              <span className="text-[9px] text-blue-100 font-mono bg-white/15 px-2 py-0.5 rounded-full">
                {signerNpk} &bull; {signerName}
              </span>
            </div>

            {/* Mode Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50 px-2 pt-1.5 gap-1 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setSignMode('draw')}
                className={`flex-1 py-1.5 flex items-center justify-center gap-1 rounded-t-lg transition-all cursor-pointer ${
                  signMode === 'draw'
                    ? 'bg-white text-blue-700 border-t border-x border-gray-200 shadow-3xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span className="material-symbols-outlined text-[12px]">edit</span>
                Gores Halus
              </button>

              <button
                type="button"
                onClick={() => setSignMode('stamp')}
                className={`flex-1 py-1.5 flex items-center justify-center gap-1 rounded-t-lg transition-all cursor-pointer ${
                  signMode === 'stamp'
                    ? 'bg-white text-blue-700 border-t border-x border-gray-200 shadow-3xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span className="material-symbols-outlined text-[12px]">verified</span>
                Stempel MTM
              </button>

              <button
                type="button"
                onClick={() => setSignMode('upload')}
                className={`flex-1 py-1.5 flex items-center justify-center gap-1 rounded-t-lg transition-all cursor-pointer ${
                  signMode === 'upload'
                    ? 'bg-white text-blue-700 border-t border-x border-gray-200 shadow-3xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span className="material-symbols-outlined text-[12px]">upload_file</span>
                Upload
              </button>
            </div>

            {/* Canvas & Input Area */}
            <div className="p-3 bg-white flex flex-col items-center">
              {signMode === 'draw' && (
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between text-[9px]">
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
                      <button
                        type="button"
                        onClick={() => setInkColor('#0284c7')}
                        className={`w-4 h-4 rounded-full bg-[#0284c7] transition-transform cursor-pointer ${inkColor === '#0284c7' ? 'ring-2 ring-blue-500 scale-110' : 'opacity-60'}`}
                        title="Tinta Cyan MTM"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-red-600 hover:text-red-700 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[11px]">restart_alt</span>
                      Bersihkan
                    </button>
                  </div>

                  {/* Ultra-Smooth Drawing Canvas with calibrated coordinate mapping */}
                  <div className="relative border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-xl bg-slate-50/60 overflow-hidden shadow-inner cursor-crosshair">
                    <canvas
                      ref={canvasRef}
                      width={480}
                      height={180}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      className="w-full h-[125px] touch-none block"
                    />
                    {!hasDrawn && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-gray-400 text-[10px] gap-1">
                        <span className="material-symbols-outlined text-base text-blue-300 animate-pulse">gesture</span>
                        <span className="font-medium text-gray-500">Goreskan tanda tangan kursor/stylus di sini</span>
                        <span className="text-[8px] text-gray-400">Presisi 1:1 akurat &amp; bebas lag</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {signMode === 'stamp' && (
                <div className="w-full flex flex-col items-center gap-2">
                  <canvas
                    ref={stampCanvasRef}
                    width={480}
                    height={160}
                    className="w-full h-[115px] rounded-lg border border-blue-200 bg-white shadow-xs"
                  />
                  <p className="text-[8.5px] text-emerald-600 font-semibold flex items-center gap-1 text-center">
                    <span className="material-symbols-outlined text-[11px]">verified</span>
                    Stempel digital resmi Astra Otoparts &amp; PT MTM
                  </p>
                </div>
              )}

              {signMode === 'upload' && (
                <div className="w-full">
                  <label className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-gray-50 hover:bg-blue-50/30 transition-all text-center">
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    {uploadedImage ? (
                      <img src={uploadedImage} alt="Signature Preview" className="max-h-16 max-w-[200px] object-contain" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-gray-400 text-2xl">add_photo_alternate</span>
                        <span className="text-[10px] font-bold text-gray-700">Pilih file tanda tangan (PNG)</span>
                        <span className="text-[8px] text-gray-400">Format transparan direkomendasikan</span>
                      </>
                    )}
                  </label>
                </div>
              )}

              {/* Optional Comment Field for Section/Dept Head */}
              {showCommentField && (
                <div className="w-full mt-2 pt-2 border-t border-gray-100">
                  <label className="block text-[8.5px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Catatan Approval (Opsional):
                  </label>
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Contoh: Disetujui sesuai drawing revisi..."
                    className="w-full px-2.5 py-1 text-[9.5px] border border-gray-250 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50 text-gray-800"
                  />
                </div>
              )}
            </div>

            {/* Dock Action Buttons */}
            <div className="p-3 bg-gray-50 border-t border-gray-150 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-[10px] font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleApply}
                disabled={isSubmitting}
                className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[13px]">
                  {isSubmitting ? 'sync' : 'task_alt'}
                </span>
                <span>{isSubmitting ? 'Menerapkan ke PDF...' : 'Terapkan & Stempel ke PDF'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
