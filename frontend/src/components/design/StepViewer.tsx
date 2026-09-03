'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface StepViewerProps {
  fileUrl: string;
  fileName?: string;
  onClose: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';

export default function StepViewer({ fileUrl, fileName, onClose }: StepViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameRef = useRef<number>(0);
  const meshGroupRef = useRef<THREE.Group | null>(null);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [wireframe, setWireframe] = useState(false);
  const [loadStep, setLoadStep] = useState('Inisialisasi WASM...');
  const [bgBrightness, setBgBrightness] = useState(88); // 0 (Black) to 100 (White), default 88 (e2e8f0)

  // Sync background brightness with Three.js scene background
  useEffect(() => {
    if (sceneRef.current) {
      const val = bgBrightness / 100;
      sceneRef.current.background = new THREE.Color(val, val, val);
    }
  }, [bgBrightness]);

  const resetView = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const group = meshGroupRef.current;
    if (!camera || !controls || !group) return;
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const distance = Math.abs(maxDim / Math.sin(fov / 2)) * 0.8;
    camera.position.set(center.x + distance * 0.5, center.y + distance * 0.5, center.z + distance);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
  }, []);

  const toggleWireframe = useCallback(() => {
    setWireframe((prev) => {
      const next = !prev;
      meshGroupRef.current?.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach((m) => { (m as THREE.MeshStandardMaterial).wireframe = next; });
          else (mat as THREE.MeshStandardMaterial).wireframe = next;
        }
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;
    const W = mount.clientWidth;
    const H = mount.clientHeight;

    const scene = new THREE.Scene();
    const val = bgBrightness / 100;
    scene.background = new THREE.Color(val, val, val);
    sceneRef.current = scene;

    const grid = new THREE.GridHelper(200, 40, 0x64748b, 0xcbd5e1);
    grid.position.y = -0.01;
    scene.add(grid);

    // Add color-coded XYZ Axes Helper
    const axesHelper = new THREE.AxesHelper(100);
    scene.add(axesHelper);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dir1.position.set(5, 10, 5);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0x4488ff, 0.4);
    dir2.position.set(-5, -5, -5);
    scene.add(dir2);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 10000);
    camera.position.set(5, 5, 10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.screenSpacePanning = true;
    controlsRef.current = controls;

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // Use clientWidth/clientHeight or contentRect
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(mount);

    let cancelled = false;

    (async () => {
      try {
        const isIges = fileUrl.toLowerCase().endsWith('.igs') || fileUrl.toLowerCase().endsWith('.iges');
        setLoadStep(isIges ? 'Mengunduh file IGS...' : 'Mengunduh file STEP...');
        setLoadProgress(10);
        const resp = await fetch(fileUrl);
        if (!resp.ok) throw new Error(`Gagal mengunduh file: HTTP ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();
        setLoadProgress(35);

        setLoadStep('Memuat modul WASM OpenCASCADE...');
        const occtModule = await import('occt-import-js');
        const occt = await (occtModule.default as any)({ locateFile: () => '/occt-import-js.wasm' });
        setLoadProgress(65);

        if (cancelled) return;
        setLoadStep(isIges ? 'Parsing geometri IGS...' : 'Parsing geometri STEP...');

        const fileBuffer = new Uint8Array(arrayBuffer);
        const result = isIges 
          ? occt.ReadIgesFile(fileBuffer, null)
          : occt.ReadStepFile(fileBuffer, null);
        setLoadProgress(85);

        if (!result.success) throw new Error(`Gagal parse file ${isIges ? 'IGS' : 'STEP'}. Pastikan file valid.`);
        if (cancelled) return;

        setLoadStep('Membangun mesh 3D...');
        const group = new THREE.Group();
        meshGroupRef.current = group;

        const palette = [0x4f8ef7, 0x56c8a0, 0xe8834a, 0xe05c7a, 0xa78bfa, 0xf7c948, 0x60c0e8, 0xf48fb1, 0x80cbc4, 0xffab40];

        result.meshes.forEach((mesh: any, idx: number) => {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3));
          if (mesh.attributes.normal) {
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3));
          } else {
            geometry.computeVertexNormals();
          }
          if (mesh.index) {
            geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(mesh.index.array), 1));
          }
          const color = mesh.color ? new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2]) : new THREE.Color(palette[idx % palette.length]);
          const material = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.55, side: THREE.DoubleSide });
          group.add(new THREE.Mesh(geometry, material));
        });

        scene.add(group);
        setLoadProgress(100);
        if (!cancelled) {
          setLoadState('ready');
          setTimeout(resetView, 50);
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err.message || 'Terjadi kesalahan tidak diketahui.');
          setLoadState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const displayName = fileName || fileUrl.split('/').pop() || '3D Model';

  const val255 = Math.round((bgBrightness / 100) * 255);
  const bgColorStyle = `rgb(${val255}, ${val255}, ${val255})`;

  return (
    <div className="w-full h-full flex flex-col relative" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: bgColorStyle }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b shrink-0 bg-white border-gray-200">
        {/* Left Info */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[18px]" style={{ color: '#4f46e5' }}>deployed_code</span>
          <span className="text-[11px] font-bold text-gray-800 truncate">{displayName}</span>
          {loadState === 'ready' && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full ml-1" style={{ background: '#f1f5f9', color: '#4f46e5' }}>
              {fileUrl.toLowerCase().endsWith('.igs') || fileUrl.toLowerCase().endsWith('.iges') ? 'IGS' : 'STEP'}
            </span>
          )}
        </div>

        {/* Right Actions & Slider */}
        <div className="flex items-center gap-2">
          {loadState === 'ready' && (
            <div className="flex items-center gap-2">
              {/* Brightness/Gray Slider */}
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded h-6">
                <span className="material-symbols-outlined text-[12px] text-gray-500">brightness_medium</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={bgBrightness}
                  onChange={(e) => setBgBrightness(parseInt(e.target.value))}
                  title="Sesuaikan kecerahan background (Putih - Hitam)"
                  className="w-14 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                  style={{ outline: 'none' }}
                />
                <span className="text-[8px] font-mono text-gray-400 font-bold w-4 text-right">{bgBrightness}%</span>
              </div>

              <button onClick={toggleWireframe} title="Toggle Wireframe" className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition-all h-6" style={{ background: wireframe ? '#e0e7ff' : '#f1f5f9', color: wireframe ? '#4f46e5' : '#475569', border: `1px solid ${wireframe ? '#a5b4fc' : '#cbd5e1'}` }}>
                <span className="material-symbols-outlined text-[12px]">grid_3x3</span>
                Wireframe
              </button>
              <button onClick={resetView} title="Reset View" className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition-all h-6" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                <span className="material-symbols-outlined text-[12px]">center_focus_strong</span>
                Reset View
              </button>
              <div style={{ width: 1, height: 16, background: '#e2e8f0' }} className="mx-0.5" />
            </div>
          )}
          <button onClick={onClose} title="Tutup" className="flex items-center justify-center w-6 h-6 rounded transition-colors hover:bg-gray-100 shrink-0" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      </div>

      {/* Viewport */}
      <div className="flex-1 relative min-h-0">
        <div ref={mountRef} className="w-full h-full" />

        {/* Loading overlay (Skeleton Loader) */}
        {loadState === 'loading' && (
          <div className="absolute inset-0 flex flex-col justify-between p-6 overflow-hidden" style={{ backgroundColor: bgColorStyle }}>
            {/* Shimmering Grid Background */}
            <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 gap-2 p-2 opacity-25 pointer-events-none">
              {[...Array(144)].map((_, i) => (
                <div key={i} className="border border-gray-400/30 rounded-sm bg-gray-300/10 animate-pulse" />
              ))}
            </div>

            {/* Central Isometric Wireframe Shape */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-64 h-64 flex items-center justify-center">
                {/* Outmost pulsing circle */}
                <div className="absolute w-60 h-60 rounded-full border-2 border-dashed border-indigo-200/40 animate-pulse" />
                {/* Pulsing wireframe block */}
                <div className="w-36 h-36 rounded-2xl border-4 border-indigo-300/50 bg-white/40 backdrop-blur-sm shadow-xl flex items-center justify-center animate-pulse relative">
                  {/* Corner notches for blueprint feel */}
                  <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-4 border-l-4 border-indigo-500/60" />
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-4 border-r-4 border-indigo-500/60" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-4 border-l-4 border-indigo-500/60" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-4 border-r-4 border-indigo-500/60" />
                  
                  <span className="material-symbols-outlined text-[64px] text-indigo-500/70 animate-pulse" style={{ animationDuration: '1.5s' }}>
                    view_in_ar
                  </span>
                </div>
              </div>
            </div>

            {/* Status Panel HUD (Bottom overlay) */}
            <div className="relative mt-auto mx-auto w-full max-w-md bg-white/85 backdrop-blur-md border border-gray-200 shadow-lg rounded-2xl p-4 flex flex-col gap-3 transition-all z-10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-indigo-600 animate-spin" style={{ animationDuration: '3s' }}>sync</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-extrabold text-gray-800 tracking-wide uppercase">{loadStep}</p>
                  <p className="text-[9px] text-gray-500 truncate mt-0.5">{displayName}</p>
                </div>
                <span className="text-[11px] font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{loadProgress}%</span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                <div className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-indigo-500 to-indigo-600" style={{ width: `${loadProgress}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {loadState === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ backgroundColor: bgColorStyle }}>
            <div className="flex items-center justify-center w-14 h-14 rounded-full" style={{ background: '#fee2e2', border: '1.5px solid #fca5a5' }}>
              <span className="material-symbols-outlined text-[28px]" style={{ color: '#ef4444' }}>error</span>
            </div>
            <div className="text-center space-y-1.5 max-w-sm px-4">
              <p className="text-[13px] font-bold" style={{ color: '#ef4444' }}>Gagal Memuat Model 3D</p>
              <p className="text-[10px] leading-relaxed text-gray-500">{errorMsg}</p>
            </div>
            <button onClick={onClose} className="px-4 py-1.5 rounded text-[10px] font-bold transition-colors" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
              Tutup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
