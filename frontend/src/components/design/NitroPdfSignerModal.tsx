'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

export interface VisualPlacement {
  pageIndex: number;
  xPercent: number;     // 0.0 - 1.0 from left
  yPercent: number;     // 0.0 - 1.0 from top
  widthPercent: number; // 0.0 - 1.0
  heightPercent: number;// 0.0 - 1.0
}

interface Point {
  x: number;
  y: number;
}

interface NitroPdfSignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  onApplySignature: (
    signatureDataUrl: string,
    placement: VisualPlacement,
    type: 'DRAW' | 'STAMP' | 'UPLOAD',
  ) => Promise<void>;
  roleLabel?: string;
  signerName?: string;
  signerNpk?: string;
  initialPageIndex?: number;
}

export default function NitroPdfSignerModal({
  isOpen,
  onClose,
  pdfUrl,
  onApplySignature,
  roleLabel = 'Drafter',
  signerName = 'User PIC',
  signerNpk = 'NPK001',
  initialPageIndex = 0,
}: NitroPdfSignerModalProps) {
  // Mode selection: draw, stamp, upload
  const [signMode, setSignMode] = useState<'draw' | 'stamp' | 'upload'>('draw');
  const [inkColor, setInkColor] = useState<'#002b80' | '#0f172a' | '#0052cc'>('#002b80');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // PDF Viewer State
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(initialPageIndex + 1);
  const [zoomScale, setZoomScale] = useState<number>(0.85);
  const [pdfLoading, setPdfLoading] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Signature Stamp Box on PDF (values in PERCENTAGES: 0.0 to 1.0)
  // Default position: near bottom right corner (title block of engineering drawing)
  const [stampPos, setStampPos] = useState({
    xPercent: 0.67,
    yPercent: 0.90,
    widthPercent: 0.075,
    heightPercent: 0.045,
  });

  // Drag & Resize state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ mouseX: number; mouseY: number; initialX: number; initialY: number } | null>(null);
  const [activeResizeHandle, setActiveResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    mouseX: number;
    mouseY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Canvas Refs
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stampCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);

  // Smooth drawing states
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const pointsRef = useRef<Point[]>([]);
  const prevMidPointRef = useRef<Point | null>(null);

  // Cached PDF Document Object
  const pdfDocRef = useRef<any>(null);

  // ─────────────────────────────────────────────────────────────
  // 1. PDF.js Document Loading & Rendering
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !pdfUrl) return;

    let isMounted = true;
    setPdfLoading(true);
    setPdfError(null);

    const loadPdfDoc = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
        // Configure worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (!isMounted) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setCurrentPage(Math.min(initialPageIndex + 1, doc.numPages));
        setPdfLoading(false);
      } catch (err: any) {
        console.error('Failed to load PDF via PDF.js:', err);
        if (isMounted) {
          setPdfError(err.message || 'Gagal memuat file PDF drawing');
          setPdfLoading(false);
        }
      }
    };

    loadPdfDoc();

    return () => {
      isMounted = false;
    };
  }, [isOpen, pdfUrl, initialPageIndex]);

  // Render Page onto Canvas when page or zoomScale changes
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDocRef.current || !pdfCanvasRef.current) return;
    try {
      const page = await pdfDocRef.current.getPage(currentPage);
      const viewport = page.getViewport({ scale: zoomScale * 1.5 }); // High DPI factor

      const canvas = pdfCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / 1.5}px`;
      canvas.style.height = `${viewport.height / 1.5}px`;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Error rendering PDF page:', err);
    }
  }, [currentPage, zoomScale]);

  useEffect(() => {
    if (!pdfLoading && pdfDocRef.current) {
      renderCurrentPage();
    }
  }, [pdfLoading, currentPage, zoomScale, renderCurrentPage]);

  // ─────────────────────────────────────────────────────────────
  // 2. Official MTM Digital Verification Stamp Generation
  // ─────────────────────────────────────────────────────────────
  const generateStampCanvas = useCallback(() => {
    const canvas = stampCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Double border
    ctx.strokeStyle = '#004080';
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    ctx.strokeStyle = '#0052cc';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);

    // Subtle background tint
    ctx.fillStyle = 'rgba(0, 82, 204, 0.04)';
    ctx.fillRect(9, 9, canvas.width - 18, canvas.height - 18);

    // Header
    ctx.fillStyle = '#002b80';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PT MENARA TERUS MAKMUR', canvas.width / 2, 24);

    ctx.fillStyle = '#64748b';
    ctx.font = '7.5px Arial, sans-serif';
    ctx.fillText('ASTRA OTOPARTS GROUP', canvas.width / 2, 34);

    // Line
    ctx.strokeStyle = '#004080';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(14, 40);
    ctx.lineTo(canvas.width - 14, 40);
    ctx.stroke();

    // Role & Signer
    ctx.fillStyle = '#0052cc';
    ctx.font = 'bold 10.5px Arial, sans-serif';
    ctx.fillText(`DIGITALLY SIGNED [${roleLabel.toUpperCase()}]`, canvas.width / 2, 56);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.fillText(signerName.toUpperCase(), canvas.width / 2, 70);

    ctx.fillStyle = '#475569';
    ctx.font = '8px Arial, sans-serif';
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    ctx.fillText(`NPK: ${signerNpk}  •  ${nowStr}`, canvas.width / 2, 83);

    // Verification ID
    const hash = Math.random().toString(36).substring(2, 8).toUpperCase();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '7px monospace';
    ctx.fillText(`VERIF-ID: MTM-${hash}-ETIKET`, canvas.width / 2, 95);
  }, [roleLabel, signerName, signerNpk]);

  useEffect(() => {
    if (isOpen && signMode === 'stamp') {
      generateStampCanvas();
    }
  }, [isOpen, signMode, generateStampCanvas]);

  // ─────────────────────────────────────────────────────────────
  // 3. Smooth Signature Pad Engine (Drawing)
  // ─────────────────────────────────────────────────────────────
  const getDrawCoordinates = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handlePointerDownDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDrawing(true);

    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getDrawCoordinates(e);
    pointsRef.current = [pt];
    prevMidPointRef.current = pt;

    ctx.fillStyle = inkColor;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  };

  const handlePointerMoveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentPt = getDrawCoordinates(e);
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

  const handlePointerUpDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const canvas = drawCanvasRef.current;
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
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    pointsRef.current = [];
    prevMidPointRef.current = null;
  };

  const getTrimmedDrawDataUrl = (sourceCanvas: HTMLCanvasElement): string => {
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
        if (alpha > 10) {
          hasPixel = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasPixel) return sourceCanvas.toDataURL('image/png');

    const pad = 6;
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

  // ─────────────────────────────────────────────────────────────
  // 4. Interactive Drag & Drop / Resize Stamp on the PDF Page
  // ─────────────────────────────────────────────────────────────
  const handleStampMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: stampPos.xPercent,
      initialY: stampPos.yPercent,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveResizeHandle(handle);
    setResizeStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: stampPos.xPercent,
      initialY: stampPos.yPercent,
      initialW: stampPos.widthPercent,
      initialH: stampPos.heightPercent,
    });
  };

  // Global Mouse Move & Up listeners for Drag/Resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const pageEl = pageContainerRef.current;
      if (!pageEl) return;
      const rect = pageEl.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // 1. Dragging
      if (isDragging && dragStart) {
        const deltaX = (e.clientX - dragStart.mouseX) / rect.width;
        const deltaY = (e.clientY - dragStart.mouseY) / rect.height;

        let newX = dragStart.initialX + deltaX;
        let newY = dragStart.initialY + deltaY;

        // Keep inside bounds
        newX = Math.max(0, Math.min(newX, 1 - stampPos.widthPercent));
        newY = Math.max(0, Math.min(newY, 1 - stampPos.heightPercent));

        setStampPos((prev) => ({
          ...prev,
          xPercent: newX,
          yPercent: newY,
        }));
      }

      // 2. Resizing
      if (activeResizeHandle && resizeStart) {
        const deltaX = (e.clientX - resizeStart.mouseX) / rect.width;
        const deltaY = (e.clientY - resizeStart.mouseY) / rect.height;

        let newX = resizeStart.initialX;
        let newY = resizeStart.initialY;
        let newW = resizeStart.initialW;
        let newH = resizeStart.initialH;

        if (activeResizeHandle.includes('e')) {
          newW = Math.max(0.02, Math.min(resizeStart.initialW + deltaX, 1 - newX));
        }
        if (activeResizeHandle.includes('s')) {
          newH = Math.max(0.015, Math.min(resizeStart.initialH + deltaY, 1 - newY));
        }
        if (activeResizeHandle.includes('w')) {
          const possibleW = resizeStart.initialW - deltaX;
          if (possibleW >= 0.02 && resizeStart.initialX + deltaX >= 0) {
            newW = possibleW;
            newX = resizeStart.initialX + deltaX;
          }
        }
        if (activeResizeHandle.includes('n')) {
          const possibleH = resizeStart.initialH - deltaY;
          if (possibleH >= 0.015 && resizeStart.initialY + deltaY >= 0) {
            newH = possibleH;
            newY = resizeStart.initialY + deltaY;
          }
        }

        setStampPos({
          xPercent: newX,
          yPercent: newY,
          widthPercent: newW,
          heightPercent: newH,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragStart(null);
      setActiveResizeHandle(null);
      setResizeStart(null);
    };

    if (isDragging || activeResizeHandle) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, activeResizeHandle, resizeStart, stampPos.widthPercent, stampPos.heightPercent]);

  // Click on PDF Canvas to move the stamp directly to that location
  const handlePageContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || activeResizeHandle) return;
    const pageEl = pageContainerRef.current;
    if (!pageEl) return;
    const rect = pageEl.getBoundingClientRect();

    const clickXPercent = (e.clientX - rect.left) / rect.width;
    const clickYPercent = (e.clientY - rect.top) / rect.height;

    const newX = Math.max(0, Math.min(clickXPercent - stampPos.widthPercent / 2, 1 - stampPos.widthPercent));
    const newY = Math.max(0, Math.min(clickYPercent - stampPos.heightPercent / 2, 1 - stampPos.heightPercent));

    setStampPos((prev) => ({
      ...prev,
      xPercent: newX,
      yPercent: newY,
    }));
  };

  // ─────────────────────────────────────────────────────────────
  // 5. Submit & Apply Signature
  // ─────────────────────────────────────────────────────────────
  const handleApply = async () => {
    let dataUrl = '';
    let type: 'DRAW' | 'STAMP' | 'UPLOAD' = 'DRAW';

    if (signMode === 'draw') {
      const canvas = drawCanvasRef.current;
      if (!canvas || !hasDrawn) {
        alert('Silakan goreskan tanda tangan Anda pada kotak tanda tangan terlebih dahulu.');
        return;
      }
      dataUrl = getTrimmedDrawDataUrl(canvas);
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
      const placement: VisualPlacement = {
        pageIndex: currentPage - 1,
        xPercent: stampPos.xPercent,
        yPercent: stampPos.yPercent,
        widthPercent: stampPos.widthPercent,
        heightPercent: stampPos.heightPercent,
      };

      await onApplySignature(dataUrl, placement, type);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Gagal menerapkan tanda tangan ke dokumen PDF');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200 select-none overflow-hidden">
      {/* ── TOP HEADER / TOOLBAR ── */}
      <header className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-white shrink-0 z-10 shadow-md">
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-white text-base">ink_pen</span>
          </div>
          <div>
            <h3 className="text-xs font-bold flex items-center gap-1.5 leading-none">
              <span>Studio Tanda Tangan PDF</span>
              <span className="bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                Nitro Mode
              </span>
            </h3>
            <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
              Geser kotak stempel ke kolom etiket gambar. Ukuran dan posisi akan dibakar permanen ke PDF.
            </p>
          </div>
        </div>

        {/* Center: PDF Zoom & Navigation Controls */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700/60 shadow-inner">
          {/* Page switch */}
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-300 mr-2 border-r border-slate-700 pr-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-700 disabled:opacity-30 cursor-pointer disabled:cursor-default"
              title="Halaman Sebelumnya"
            >
              <span className="material-symbols-outlined text-xs">chevron_left</span>
            </button>
            <span className="font-bold text-white">Hal {currentPage}</span>
            <span className="text-slate-500">/ {numPages}</span>
            <button
              type="button"
              disabled={currentPage >= numPages}
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-700 disabled:opacity-30 cursor-pointer disabled:cursor-default"
              title="Halaman Berikutnya"
            >
              <span className="material-symbols-outlined text-xs">chevron_right</span>
            </button>
          </div>

          {/* Zoom controls */}
          <button
            type="button"
            onClick={() => setZoomScale((s) => Math.max(0.4, Number((s - 0.15).toFixed(2))))}
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title="Zoom Out"
          >
            <span className="material-symbols-outlined text-xs">remove</span>
          </button>
          <span className="text-[10px] font-mono font-bold text-blue-300 w-10 text-center">
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoomScale((s) => Math.min(2.5, Number((s + 0.15).toFixed(2))))}
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title="Zoom In"
          >
            <span className="material-symbols-outlined text-xs">add</span>
          </button>

          <button
            type="button"
            onClick={() => setZoomScale(0.85)}
            className="text-[9px] font-semibold text-slate-300 hover:text-white hover:bg-slate-700 px-1.5 py-0.5 rounded cursor-pointer ml-1"
          >
            Reset
          </button>
        </div>

        {/* Right: Close button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            <span>Batal</span>
          </button>
        </div>
      </header>

      {/* ── WORKSPACE BODY ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ── LEFT DOCK: SIGNING CONTROLS ── */}
        <div className="w-[320px] bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-10 shadow-xl">
          {/* Signer Identity Banner */}
          <div className="p-3 bg-gradient-to-r from-blue-900/50 via-slate-800 to-indigo-950/40 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">
                Penandatangan [{roleLabel}]
              </span>
              <span className="text-[9px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                {signerNpk}
              </span>
            </div>
            <p className="text-xs font-bold text-white mt-0.5">{signerName}</p>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setSignMode('draw')}
              className={`flex-1 py-1.5 flex items-center justify-center gap-1 rounded-lg transition-all cursor-pointer ${
                signMode === 'draw'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">draw</span>
              Gores Halus
            </button>
            <button
              type="button"
              onClick={() => setSignMode('stamp')}
              className={`flex-1 py-1.5 flex items-center justify-center gap-1 rounded-lg transition-all cursor-pointer ${
                signMode === 'stamp'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">verified</span>
              Stempel MTM
            </button>
            <button
              type="button"
              onClick={() => setSignMode('upload')}
              className={`flex-1 py-1.5 flex items-center justify-center gap-1 rounded-lg transition-all cursor-pointer ${
                signMode === 'upload'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">upload_file</span>
              Upload
            </button>
          </div>

          {/* Mode Content / Drawing Pad */}
          <div className="p-3 flex-1 flex flex-col overflow-y-auto space-y-3">
            {signMode === 'draw' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-semibold">Tinta:</span>
                    <button
                      type="button"
                      onClick={() => setInkColor('#002b80')}
                      className={`w-4 h-4 rounded-full bg-[#002b80] transition-transform cursor-pointer ${
                        inkColor === '#002b80' ? 'ring-2 ring-blue-400 scale-115' : 'opacity-60'
                      }`}
                      title="Biru Resmi MTM"
                    />
                    <button
                      type="button"
                      onClick={() => setInkColor('#0f172a')}
                      className={`w-4 h-4 rounded-full bg-[#0f172a] transition-transform cursor-pointer ${
                        inkColor === '#0f172a' ? 'ring-2 ring-blue-400 scale-115' : 'opacity-60'
                      }`}
                      title="Hitam Pekat"
                    />
                    <button
                      type="button"
                      onClick={() => setInkColor('#0052cc')}
                      className={`w-4 h-4 rounded-full bg-[#0052cc] transition-transform cursor-pointer ${
                        inkColor === '#0052cc' ? 'ring-2 ring-blue-400 scale-115' : 'opacity-60'
                      }`}
                      title="Biru Terang"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={clearDrawCanvas}
                    className="text-slate-400 hover:text-red-400 text-[10px] font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[12px]">delete</span>
                    Hapus
                  </button>
                </div>

                {/* Draw Canvas */}
                <div className="relative border-2 border-slate-700 hover:border-blue-500 rounded-xl overflow-hidden bg-white shadow-inner">
                  <canvas
                    ref={drawCanvasRef}
                    width={380}
                    height={160}
                    className="w-full h-28 touch-none cursor-crosshair block"
                    onPointerDown={handlePointerDownDraw}
                    onPointerMove={handlePointerMoveDraw}
                    onPointerUp={handlePointerUpDraw}
                    onPointerCancel={handlePointerUpDraw}
                  />
                  {!hasDrawn && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400 text-xs font-medium">
                      Goreskan tanda tangan di sini
                    </div>
                  )}
                </div>
              </div>
            )}

            {signMode === 'stamp' && (
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 block">Preview Stempel Resmi PT MTM:</span>
                <div className="border border-slate-700 rounded-xl p-2 bg-white flex items-center justify-center shadow-sm">
                  <canvas
                    ref={stampCanvasRef}
                    width={280}
                    height={108}
                    className="w-full h-auto block"
                  />
                </div>
              </div>
            )}

            {signMode === 'upload' && (
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 block">Pilih File Tanda Tangan (PNG/JPG transparan):</span>
                <label className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-800/40">
                  <span className="material-symbols-outlined text-2xl text-blue-400">cloud_upload</span>
                  <span className="text-[10px] font-semibold text-slate-300 mt-1">Pilih Gambar</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => setUploadedImage(event.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
                {uploadedImage && (
                  <div className="border border-slate-700 rounded-lg p-2 bg-white">
                    <img src={uploadedImage} alt="Uploaded Sig" className="max-h-20 object-contain mx-auto" />
                  </div>
                )}
              </div>
            )}

            {/* Position Guide & Coordinate Box */}
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-2.5 space-y-1.5 text-[9px] text-slate-300">
              <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                <span className="material-symbols-outlined text-xs">pinch</span>
                <span>Panduan Penempatan:</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                • <strong>Klik &amp; geser</strong> kotak biru di lembar drawing ke kolom etiket (Dibuat / Diperiksa / Disetujui).
              </p>
              <p className="text-slate-400 leading-relaxed">
                • <strong>Tarik sudut kotak</strong> untuk menyesuaikan tinggi &amp; lebar agar pas dengan garis etiket.
              </p>
              <div className="pt-1 flex items-center justify-between font-mono text-[8.5px] text-slate-400 border-t border-slate-700/50">
                <span>X: {Math.round(stampPos.xPercent * 100)}%</span>
                <span>Y: {Math.round(stampPos.yPercent * 100)}%</span>
                <span>W: {Math.round(stampPos.widthPercent * 100)}%</span>
                <span>H: {Math.round(stampPos.heightPercent * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Submit Action Button */}
          <div className="p-3 border-t border-slate-800 bg-slate-900">
            <button
              type="button"
              onClick={handleApply}
              disabled={isSubmitting || pdfLoading}
              className="w-full py-2.5 px-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-600 via-blue-650 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  <span>Membakar ke PDF...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">verified</span>
                  <span>Terapkan Tanda Tangan ke PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── CENTER WORKSPACE: PDF VIEWER & INTERACTIVE CANVAS ── */}
        <div
          ref={pdfContainerRef}
          className="flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-8 relative"
        >
          {pdfLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
              <span className="material-symbols-outlined animate-spin text-4xl text-blue-500">sync</span>
              <p className="text-xs font-semibold">Memuat rendering halaman drawing CAD...</p>
            </div>
          ) : pdfError ? (
            <div className="flex flex-col items-center justify-center gap-2 text-red-400 max-w-md text-center">
              <span className="material-symbols-outlined text-4xl">error</span>
              <p className="text-xs font-bold">{pdfError}</p>
              <button
                onClick={onClose}
                className="mt-2 text-[10px] text-white bg-slate-800 px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-700"
              >
                Tutup
              </button>
            </div>
          ) : (
            /* Page Container with exact 1:1 pixel overlay */
            <div
              ref={pageContainerRef}
              onClick={handlePageContainerClick}
              className="relative shadow-2xl bg-white select-none transition-shadow"
              style={{
                width: pdfCanvasRef.current ? pdfCanvasRef.current.style.width : 'auto',
                height: pdfCanvasRef.current ? pdfCanvasRef.current.style.height : 'auto',
              }}
            >
              {/* PDF Background Canvas */}
              <canvas ref={pdfCanvasRef} className="block pointer-events-none" />

              {/* ── INTERACTIVE DRAGGABLE & RESIZABLE STAMP BOX ── */}
              <div
                onMouseDown={handleStampMouseDown}
                className={`absolute cursor-move border-2 ${
                  isDragging || activeResizeHandle
                    ? 'border-blue-400 bg-blue-500/25 ring-2 ring-blue-400/50'
                    : 'border-blue-600 bg-blue-500/15 hover:bg-blue-500/20'
                } rounded transition-colors group z-20 flex items-center justify-center overflow-visible shadow-md`}
                style={{
                  left: `${stampPos.xPercent * 100}%`,
                  top: `${stampPos.yPercent * 100}%`,
                  width: `${stampPos.widthPercent * 100}%`,
                  height: `${stampPos.heightPercent * 100}%`,
                }}
                title="Klik dan geser ke kolom etiket. Tarik titik sudut untuk mengatur ukuran."
              >
                {/* Floating Badge Header */}
                <div className="absolute -top-5 left-0 bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap pointer-events-none flex items-center gap-1">
                  <span className="material-symbols-outlined text-[10px]">drag_pan</span>
                  <span>{roleLabel}: {signerName}</span>
                </div>

                {/* Stamp Preview Content inside the box */}
                <div className="w-full h-full flex items-center justify-center p-0.5 pointer-events-none overflow-hidden">
                  {signMode === 'draw' && hasDrawn && drawCanvasRef.current ? (
                    <img
                      src={drawCanvasRef.current.toDataURL('image/png')}
                      alt="Sig Preview"
                      className="max-w-full max-h-full object-contain filter drop-shadow-xs"
                    />
                  ) : signMode === 'stamp' && stampCanvasRef.current ? (
                    <img
                      src={stampCanvasRef.current.toDataURL('image/png')}
                      alt="Stamp Preview"
                      className="max-w-full max-h-full object-contain filter drop-shadow-xs"
                    />
                  ) : signMode === 'upload' && uploadedImage ? (
                    <img
                      src={uploadedImage}
                      alt="Upload Preview"
                      className="max-w-full max-h-full object-contain filter drop-shadow-xs"
                    />
                  ) : (
                    <div className="text-[8px] font-bold text-blue-800 text-center leading-tight">
                      [Goreskan tanda tangan pada panel kiri]
                    </div>
                  )}
                </div>

                {/* 4 Corner Resize Handles */}
                <div
                  onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
                  className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize shadow-xs z-30"
                  title="Tarik untuk perbesar / perkecil"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
                  className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize shadow-xs z-30"
                  title="Tarik untuk perbesar / perkecil"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
                  className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize shadow-xs z-30"
                  title="Tarik untuk perbesar / perkecil"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
                  className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize shadow-xs z-30"
                  title="Tarik untuk perbesar / perkecil"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
