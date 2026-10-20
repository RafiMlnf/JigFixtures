'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface MarkerPin {
  id: string;
  xPct: number; // 0 - 100%
  yPct: number; // 0 - 100%
  number: number;
  note: string;
  color: string;
}

export interface FreeStroke {
  id: string;
  points: Array<{ xPct: number; yPct: number }>;
  color: string;
  size: number;
}

export interface BoxAnnotation {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  size: number;
}

type EditorTool = 'PIN' | 'PEN' | 'BOX';

interface SnapshotEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotImage: string;
  designNoReg: string;
  initialComment?: string;
  currentPage?: number;
  totalPages?: number;
  onChangePage?: (page: number) => void;
  isChangingPage?: boolean;
  onSubmitRevision: (data: { comment: string; markupData: string }) => Promise<void>;
}

export default function SnapshotEditorModal({
  isOpen,
  onClose,
  snapshotImage,
  designNoReg,
  initialComment = '',
  currentPage = 1,
  totalPages = 1,
  onChangePage,
  isChangingPage = false,
  onSubmitRevision,
}: SnapshotEditorModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tool, setTool] = useState<EditorTool>('PIN');
  const [color, setColor] = useState('#dc2626'); // Red default
  const [strokeSize, setStrokeSize] = useState<number>(3);

  // Annotations state
  const [pins, setPins] = useState<MarkerPin[]>([]);
  const [strokes, setStrokes] = useState<FreeStroke[]>([]);
  const [boxes, setBoxes] = useState<BoxAnnotation[]>([]);
  const [historyStack, setHistoryStack] = useState<Array<'PIN' | 'STROKE' | 'BOX'>>([]);

  // Active interaction state
  const [currentStrokePoints, setCurrentStrokePoints] = useState<Array<{ xPct: number; yPct: number }> | null>(null);
  const [currentBox, setCurrentBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activePinId, setActivePinId] = useState<string | null>(null);

  // Comment & submission state
  const [mainComment, setMainComment] = useState(initialComment);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  // Calculate mouse position as percentages (0-100%) inside image container
  const getCoordinatesPct = (e: React.PointerEvent) => {
    const container = imageContainerRef.current;
    if (!container) return { xPct: 0, yPct: 0 };
    const rect = container.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const xPct = Math.max(0, Math.min(100, (rawX / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, (rawY / rect.height) * 100));
    return { xPct, yPct };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Primary click only
    const { xPct, yPct } = getCoordinatesPct(e);

    if (tool === 'PIN') {
      const newPin: MarkerPin = {
        id: `pin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        xPct,
        yPct,
        number: pins.length + 1,
        note: '',
        color,
      };
      setPins((prev) => [...prev, newPin]);
      setHistoryStack((prev) => [...prev, 'PIN']);
      setActivePinId(newPin.id);
    } else if (tool === 'PEN') {
      setIsDrawing(true);
      setCurrentStrokePoints([{ xPct, yPct }]);
    } else if (tool === 'BOX') {
      setIsDrawing(true);
      setCurrentBox({ startX: xPct, startY: yPct, endX: xPct, endY: yPct });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const { xPct, yPct } = getCoordinatesPct(e);

    if (tool === 'PEN') {
      setCurrentStrokePoints((prev) => (prev ? [...prev, { xPct, yPct }] : [{ xPct, yPct }]));
    } else if (tool === 'BOX' && currentBox) {
      setCurrentBox((prev) => (prev ? { ...prev, endX: xPct, endY: yPct } : null));
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === 'PEN' && currentStrokePoints && currentStrokePoints.length > 1) {
      const newStroke: FreeStroke = {
        id: `stroke_${Date.now()}`,
        points: currentStrokePoints,
        color,
        size: strokeSize,
      };
      setStrokes((prev) => [...prev, newStroke]);
      setHistoryStack((prev) => [...prev, 'STROKE']);
    } else if (tool === 'BOX' && currentBox) {
      const width = Math.abs(currentBox.endX - currentBox.startX);
      const height = Math.abs(currentBox.endY - currentBox.startY);
      // Only keep box if dragged sufficiently
      if (width > 1 || height > 1) {
        const newBox: BoxAnnotation = {
          id: `box_${Date.now()}`,
          startX: currentBox.startX,
          startY: currentBox.startY,
          endX: currentBox.endX,
          endY: currentBox.endY,
          color,
          size: strokeSize,
        };
        setBoxes((prev) => [...prev, newBox]);
        setHistoryStack((prev) => [...prev, 'BOX']);
      }
    }

    setCurrentStrokePoints(null);
    setCurrentBox(null);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const lastType = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));

    if (lastType === 'PIN') {
      setPins((prev) => {
        const updated = prev.slice(0, -1);
        // Re-number remaining pins
        return updated.map((p, idx) => ({ ...p, number: idx + 1 }));
      });
    } else if (lastType === 'STROKE') {
      setStrokes((prev) => prev.slice(0, -1));
    } else if (lastType === 'BOX') {
      setBoxes((prev) => prev.slice(0, -1));
    }
  };

  const handleClearAll = () => {
    if (pins.length === 0 && strokes.length === 0 && boxes.length === 0) return;
    if (!window.confirm('Bersihkan semua pin dan coretan pada snapshot ini?')) return;
    setPins([]);
    setStrokes([]);
    setBoxes([]);
    setHistoryStack([]);
    setActivePinId(null);
  };

  const handleDeletePin = (pinId: string) => {
    setPins((prev) => {
      const filtered = prev.filter((p) => p.id !== pinId);
      // Re-number sequentially
      return filtered.map((p, idx) => ({ ...p, number: idx + 1 }));
    });
    setHistoryStack((prev) => prev.filter((item, idx) => idx !== historyStack.lastIndexOf('PIN')));
    if (activePinId === pinId) setActivePinId(null);
  };

  const handleUpdatePinNote = (pinId: string, noteText: string) => {
    setPins((prev) => prev.map((p) => (p.id === pinId ? { ...p, note: noteText } : p)));
  };

  const handleCopyPinsToComment = () => {
    if (pins.length === 0) return;
    const pinSummary = pins
      .map((p) => `• [Pin #${p.number}] ${p.note.trim() ? p.note : 'Periksa area penanda ini'}`)
      .join('\n');

    const prefix = mainComment.trim() ? `${mainComment.trim()}\n\n` : '';
    setMainComment(`${prefix}Detail Poin Revisi:\n${pinSummary}`);
  };

  const handleSubmit = async () => {
    // Compile comment
    let finalComment = mainComment.trim();
    if (pins.length > 0 && !finalComment.includes('[Pin #')) {
      const pinNotes = pins
        .filter((p) => p.note.trim())
        .map((p) => `• [Pin #${p.number}] ${p.note.trim()}`)
        .join('\n');
      if (pinNotes) {
        finalComment = finalComment
          ? `${finalComment}\n\nDetail Poin Revisi:\n${pinNotes}`
          : `Detail Poin Revisi:\n${pinNotes}`;
      }
    }

    if (!finalComment) {
      alert('Tuliskan catatan revisi atau beri keterangan pada pin penanda.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Render snapshot image + annotations onto high-res canvas
      const img = new Image();
      img.src = snapshotImage;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Gagal memuat snapshot image'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1600;
      canvas.height = img.naturalHeight || 900;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Draw background drawing
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const scaleRatio = canvas.width / 1000;

      // Draw freehand strokes
      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = Math.max(2, stroke.size * scaleRatio);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo((stroke.points[0].xPct / 100) * canvas.width, (stroke.points[0].yPct / 100) * canvas.height);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo((stroke.points[i].xPct / 100) * canvas.width, (stroke.points[i].yPct / 100) * canvas.height);
        }
        ctx.stroke();
      }

      // Draw box annotations
      for (const box of boxes) {
        const x = (Math.min(box.startX, box.endX) / 100) * canvas.width;
        const y = (Math.min(box.startY, box.endY) / 100) * canvas.height;
        const w = (Math.abs(box.endX - box.startX) / 100) * canvas.width;
        const h = (Math.abs(box.endY - box.startY) / 100) * canvas.height;
        ctx.strokeStyle = box.color;
        ctx.lineWidth = Math.max(2, box.size * scaleRatio);
        ctx.strokeRect(x, y, w, h);
      }

      // Draw Pins
      for (const pin of pins) {
        const px = (pin.xPct / 100) * canvas.width;
        const py = (pin.yPct / 100) * canvas.height;
        const radius = Math.max(14, 16 * scaleRatio);

        // Shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 8 * scaleRatio;
        ctx.shadowOffsetX = 2 * scaleRatio;
        ctx.shadowOffsetY = 3 * scaleRatio;

        // Badge circle
        ctx.fillStyle = pin.color || '#dc2626';
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // White border ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2.5, 3 * scaleRatio);
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Pin number
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(radius * 1.15)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(pin.number), px, py);
      }

      // 2. Export to high-res, optimized image data URL
      const finalMarkupData = canvas.toDataURL('image/jpeg', 0.92);

      // 3. Submit revision
      await onSubmitRevision({
        comment: finalComment,
        markupData: finalMarkupData,
      });

      onClose();
    } catch (err: any) {
      alert(`Gagal mengirim revisi: ${err.message || 'Error server'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-6xl max-h-[96vh] bg-white rounded-2xl shadow-2xl border border-blue-200/80 flex flex-col overflow-hidden text-slate-800">
        {/* Header - Standard App Brand Bar */}
        <div className="h-10 px-4 bg-[#0063ff] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[18px]">draw</span>
            <div>
              <h3 className="font-bold text-xs flex items-center gap-2 leading-tight">
                Editor Coretan &amp; Pin Penanda Revisi
                <span className="bg-white/20 text-white text-[9.5px] font-mono px-2 py-0.5 rounded font-bold border border-white/20">
                  {designNoReg}
                </span>
                {totalPages > 1 && (
                  <span className="bg-amber-400 text-slate-950 font-bold text-[9px] px-2 py-0.5 rounded shadow-3xs">
                    Halaman {currentPage} dari {totalPages}
                  </span>
                )}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg w-7 h-7 flex items-center justify-center transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-3.5 py-1.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 select-none">
          {/* Tool Modes & Page Switcher */}
          <div className="flex items-center gap-2">
            {/* Page Switcher (when PDF has multiple pages) */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 shadow-3xs mr-1">
                <button
                  type="button"
                  disabled={isChangingPage || !currentPage || currentPage <= 1}
                  onClick={() => onChangePage && onChangePage(currentPage - 1)}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-slate-700"
                  title="Halaman Sebelumnya"
                >
                  <span className="material-symbols-outlined text-[15px]">chevron_left</span>
                </button>
                <span className="text-[10px] font-bold text-slate-700 px-1 select-none flex items-center gap-1 font-mono">
                  <span>Hal</span>
                  <span className="text-[#0063ff] font-black">{currentPage}</span>
                  <span className="text-slate-400">/</span>
                  <span>{totalPages}</span>
                </span>
                <button
                  type="button"
                  disabled={isChangingPage || !currentPage || currentPage >= totalPages}
                  onClick={() => onChangePage && onChangePage(currentPage + 1)}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-slate-700"
                  title="Halaman Berikutnya"
                >
                  <span className="material-symbols-outlined text-[15px]">chevron_right</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setTool('PIN')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                tool === 'PIN'
                  ? 'bg-rose-600 text-white shadow-3xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
              title="Klik di mana saja pada gambar untuk menaruh Pin penanda berurutan"
            >
              <span className="material-symbols-outlined text-[14px]">location_on</span>
              <span>Pin Tanda (📍)</span>
              {pins.length > 0 && (
                <span className="bg-white/25 text-white text-[9px] px-1.5 rounded-full font-black">
                  {pins.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setTool('PEN')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                tool === 'PEN'
                  ? 'bg-[#0063ff] text-white shadow-3xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
              title="Coret bebas untuk melingkari atau menandai gambar teknik"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span>
              <span>Coretan Bebas</span>
            </button>

            <button
              type="button"
              onClick={() => setTool('BOX')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                tool === 'BOX'
                  ? 'bg-[#0063ff] text-white shadow-3xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
              title="Tarik kotak persegi untuk menandai area dimensi atau tabel tertentu"
            >
              <span className="material-symbols-outlined text-[14px]">crop_square</span>
              <span>Kotak Area</span>
            </button>
          </div>

          {/* Color & Size & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Color Swatches */}
            <div className="flex items-center gap-1 border-r border-slate-200 pr-2.5">
              {[
                { hex: '#dc2626', label: 'Merah' },
                { hex: '#f59e0b', label: 'Kuning' },
                { hex: '#0063ff', label: 'Biru' },
              ].map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  className={`w-4.5 h-4.5 rounded-full transition-transform cursor-pointer ${
                    color === c.hex ? 'ring-2 ring-slate-900 scale-110 shadow-3xs' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                />
              ))}
            </div>

            {/* Thickness (for pen/box) */}
            {tool !== 'PIN' && (
              <div className="flex items-center gap-1 border-r border-slate-200 pr-2.5">
                <button
                  type="button"
                  onClick={() => setStrokeSize(2)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    strokeSize === 2 ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Tipis
                </button>
                <button
                  type="button"
                  onClick={() => setStrokeSize(4)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    strokeSize === 4 ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Tebal
                </button>
              </div>
            )}

            {/* Undo / Clear */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyStack.length === 0}
                className="px-2 py-0.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer text-[9.5px]"
                title="Batalkan coretan atau pin terakhir"
              >
                <span className="material-symbols-outlined text-[13px]">undo</span>
                <span>Undo</span>
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                disabled={pins.length === 0 && strokes.length === 0 && boxes.length === 0}
                className="px-2 py-0.5 rounded-md text-rose-600 hover:text-rose-800 hover:bg-rose-50 font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer text-[9.5px]"
                title="Hapus semua coretan dan pin"
              >
                <span className="material-symbols-outlined text-[13px]">delete</span>
                <span>Bersihkan</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area: Left Canvas, Right Notes */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden bg-slate-100">
          {/* Left: Snapshot Drawing Canvas */}
          <div className="flex-1 relative flex items-center justify-center p-3 overflow-auto bg-slate-200/80 select-none">
            {isChangingPage && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-40">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-md text-slate-700 text-xs font-bold">
                  <span className="material-symbols-outlined animate-spin text-sm text-[#0063ff]">sync</span>
                  <span>Memuat Halaman {currentPage}...</span>
                </div>
              </div>
            )}
            <div
              ref={imageContainerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className={`relative max-w-full max-h-[72vh] shadow-xl rounded-lg overflow-hidden border border-slate-300 bg-white ${
                tool === 'PIN' ? 'cursor-crosshair' : tool === 'PEN' ? 'cursor-crosshair' : 'cursor-crosshair'
              }`}
            >
              {/* Snapshot Image */}
              <img
                src={snapshotImage}
                alt="Snapshot Drawing"
                className="w-full h-auto max-h-[70vh] object-contain pointer-events-none block select-none"
                draggable={false}
              />

              {/* SVG Layer for Freehand Strokes & Boxes */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Committed strokes */}
                {strokes.map((s) => {
                  if (s.points.length < 2) return null;
                  const pathData = s.points
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.xPct} ${p.yPct}`)
                    .join(' ');
                  return (
                    <path
                      key={s.id}
                      d={pathData}
                      stroke={s.color}
                      strokeWidth={s.size * 0.25}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  );
                })}

                {/* Active stroke being drawn */}
                {currentStrokePoints && currentStrokePoints.length > 1 && (
                  <path
                    d={currentStrokePoints
                      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.xPct} ${p.yPct}`)
                      .join(' ')}
                    stroke={color}
                    strokeWidth={strokeSize * 0.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                )}

                {/* Committed boxes */}
                {boxes.map((b) => {
                  const x = Math.min(b.startX, b.endX);
                  const y = Math.min(b.startY, b.endY);
                  const w = Math.abs(b.endX - b.startX);
                  const h = Math.abs(b.endY - b.startY);
                  return (
                    <rect
                      key={b.id}
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      stroke={b.color}
                      strokeWidth={b.size * 0.25}
                      fill="none"
                    />
                  );
                })}

                {/* Active box being drawn */}
                {currentBox && (
                  <rect
                    x={Math.min(currentBox.startX, currentBox.endX)}
                    y={Math.min(currentBox.startY, currentBox.endY)}
                    width={Math.abs(currentBox.endX - currentBox.startX)}
                    height={Math.abs(currentBox.endY - currentBox.startY)}
                    stroke={color}
                    strokeWidth={strokeSize * 0.25}
                    fill="none"
                    strokeDasharray="2 2"
                  />
                )}
              </svg>

              {/* Pins Layer */}
              {pins.map((pin) => (
                <div
                  key={pin.id}
                  style={{ left: `${pin.xPct}%`, top: `${pin.yPct}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePinId(pin.id);
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-30 transition-transform hover:scale-125"
                  title={`Pin #${pin.number}: ${pin.note || 'Klik untuk beri catatan'}`}
                >
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-black text-[11px] shadow-lg border-2 border-white select-none ring-2 ${
                        activePinId === pin.id ? 'ring-yellow-400 scale-115' : 'ring-black/25'
                      }`}
                      style={{ backgroundColor: pin.color || '#dc2626' }}
                    >
                      {pin.number}
                    </div>
                    <div
                      className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[4px] -mt-0.5"
                      style={{ borderTopColor: pin.color || '#dc2626' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Notes & Pins Management Panel */}
          <div className="w-full md:w-80 lg:w-96 p-4 bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col justify-between shrink-0 overflow-y-auto max-h-[45vh] md:max-h-none">
            <div className="space-y-3.5">
              {/* Pins Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1 uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[15px] text-rose-600">location_on</span>
                    Daftar Pin Penanda ({pins.length})
                  </span>
                  {pins.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyPinsToComment}
                      className="text-[9.5px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                      title="Salin catatan semua pin ke kolom catatan utama di bawah"
                    >
                      + Salin ke Catatan
                    </button>
                  )}
                </div>

                {pins.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-[10px]">
                    <span className="material-symbols-outlined text-xl text-slate-300 block mb-0.5">add_location_alt</span>
                    Klik mode <strong>&ldquo;Pin Tanda (📍)&rdquo;</strong> lalu klik pada area gambar untuk menandai titik revisi.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {pins.map((pin) => (
                      <div
                        key={pin.id}
                        onClick={() => setActivePinId(pin.id)}
                        className={`p-2 rounded-xl border transition-all text-xs flex gap-2 items-start ${
                          activePinId === pin.id
                            ? 'bg-rose-50/70 border-rose-300 shadow-2xs ring-1 ring-rose-200'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white font-black text-[10px] shrink-0 shadow-2xs mt-0.5"
                          style={{ backgroundColor: pin.color || '#dc2626' }}
                        >
                          {pin.number}
                        </span>
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={pin.note}
                            onChange={(e) => handleUpdatePinNote(pin.id, e.target.value)}
                            placeholder={`Catatan untuk Pin #${pin.number}...`}
                            className="w-full text-[10.5px] font-medium bg-transparent border-0 border-b border-slate-300 focus:border-rose-500 focus:ring-0 p-0 pb-0.5 text-slate-800 placeholder-slate-400 outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePin(pin.id);
                          }}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 cursor-pointer"
                          title="Hapus pin ini"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Main Overall Revision Comment */}
              <div>
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Catatan Keseluruhan untuk Drawer <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={mainComment}
                  onChange={(e) => setMainComment(e.target.value)}
                  placeholder="Contoh: Dimensi lubang pin perlu disesuaikan dengan toleransi H7, periksa juga ketebalan base plate..."
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-[11px] font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="pt-3 border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-2 px-3 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    <span>Kirim Revisi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
