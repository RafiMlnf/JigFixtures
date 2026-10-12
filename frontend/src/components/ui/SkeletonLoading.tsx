import React from 'react';

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  compact?: boolean;
}

export function TableSkeleton({ rows = 6, cols = 8, compact = false }: TableSkeletonProps) {
  return (
    <div className="w-full h-full p-3 space-y-2.5 animate-pulse bg-white">
      {/* Header skeleton */}
      <div className="h-7 bg-slate-100 rounded-md w-full flex items-center px-3 gap-3">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className="h-3.5 bg-slate-200/80 rounded"
            style={{ width: i === 0 ? '30px' : i === 1 ? '100px' : i === 2 ? '180px' : '75px' }}
          />
        ))}
      </div>

      {/* Rows skeleton */}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div
            key={rIdx}
            className={`w-full bg-slate-50 border border-slate-150/70 rounded-md flex items-center px-3 gap-3 ${
              compact ? 'h-7' : 'h-9'
            }`}
          >
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                className="h-3 bg-slate-200/70 rounded"
                style={{
                  width:
                    cIdx === 0
                      ? '24px'
                      : cIdx === 1
                      ? '90px'
                      : cIdx === 2
                      ? '160px'
                      : cIdx === 3
                      ? '70px'
                      : '55px',
                  opacity: Math.max(0.4, 1 - rIdx * 0.08),
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-4 bg-slate-150 rounded w-16" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 bg-slate-150 rounded w-3/4" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
            <div className="h-3 bg-slate-150 rounded w-20" />
            <div className="h-5 bg-slate-200 rounded w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2 p-1 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-50 border border-slate-200/70 rounded-lg p-2 flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-3 bg-slate-200 rounded w-28" />
            <div className="h-2 bg-slate-150 rounded w-44" />
          </div>
          <div className="h-5 bg-slate-150 rounded w-12" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex-1 flex flex-col h-full bg-white p-4 space-y-4 animate-pulse">
      {/* Top Header skeleton */}
      <div className="h-12 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-200" />
          <div className="space-y-1.5">
            <div className="h-4 bg-slate-200 rounded w-44" />
            <div className="h-2.5 bg-slate-150 rounded w-60" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-20 h-7 rounded bg-slate-200" />
          <div className="w-24 h-7 rounded bg-slate-200" />
        </div>
      </div>

      {/* Main split preview skeleton */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 bg-slate-100/70 rounded-xl border border-slate-200 flex items-center justify-center">
          <div className="w-32 h-32 rounded-xl bg-slate-200/60" />
        </div>
        <div className="w-80 bg-slate-50/70 rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="h-4 bg-slate-200 rounded w-1/2" />
          <div className="space-y-2">
            <div className="h-3 bg-slate-150 rounded w-full" />
            <div className="h-3 bg-slate-150 rounded w-5/6" />
            <div className="h-3 bg-slate-150 rounded w-4/6" />
          </div>
          <div className="h-28 bg-slate-200/60 rounded-lg mt-4" />
        </div>
      </div>
    </div>
  );
}
