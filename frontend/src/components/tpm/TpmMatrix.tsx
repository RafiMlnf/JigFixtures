'use client';

import React, { useMemo, useState } from 'react';
import { TpmScheduleItem, TpmMaintenanceLogItem } from '@/lib/api/tpm';

const MONTHS = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
const WEEKS = [1, 2, 3, 4, 5];

/** Minggu ke-n dalam bulan (W1..W5), sama seperti kolom di PDF manual */
function weekOfMonth(d: Date) {
  return Math.min(5, Math.ceil(d.getDate() / 7));
}

interface Props {
  schedules: TpmScheduleItem[];
  logs: TpmMaintenanceLogItem[];
}

export default function TpmMatrix({ schedules, logs }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [half, setHalf] = useState<0 | 1>(now.getMonth() < 6 ? 0 : 1);

  const months = useMemo(() => Array.from({ length: 6 }, (_, i) => half * 6 + i), [half]);

  // Key tiap item: childPartId untuk child part, designId untuk jig
  const matrix = useMemo(() => {
    // lineName -> `${month}-${week}` -> { plan: Set<itemId>, act: Set<itemId> }
    const rows = new Map<string, Map<string, { plan: Set<string>; act: Set<string> }>>();
    const cell = (line: string, m: number, w: number) => {
      if (!rows.has(line)) rows.set(line, new Map());
      const r = rows.get(line)!;
      const k = `${m}-${w}`;
      if (!r.has(k)) r.set(k, { plan: new Set(), act: new Set() });
      return r.get(k)!;
    };

    const lineByItem = new Map<string, string>();
    schedules.forEach((s) => {
      lineByItem.set(s.id, s.lineName || '-');
      if (!s.tpmScheduleDeadline) return;
      const d = new Date(s.tpmScheduleDeadline);
      if (d.getFullYear() !== year) return;
      cell(s.lineName || '-', d.getMonth(), weekOfMonth(d)).plan.add(s.id);
    });

    logs.forEach((l) => {
      if (l.status !== 'COMPLETED') return;
      const d = new Date(l.performedAt);
      if (d.getFullYear() !== year) return;
      const itemId = l.childPartId || l.designId;
      const line = lineByItem.get(itemId) || l.design?.line?.lineName || '-';
      cell(line, d.getMonth(), weekOfMonth(d)).act.add(itemId);
    });

    return rows;
  }, [schedules, logs, year]);

  const lineNames = useMemo(() => Array.from(matrix.keys()).sort(), [matrix]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-slate-50 shrink-0">
        <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
          Schedule TPM Jig Fixture {year}
        </h2>
        <div className="flex items-center gap-2 text-[10px]">
          <button type="button" onClick={() => setYear(year - 1)} className="px-2 py-1 border rounded hover:bg-gray-100 cursor-pointer">‹</button>
          <span className="font-bold font-mono">{year}</span>
          <button type="button" onClick={() => setYear(year + 1)} className="px-2 py-1 border rounded hover:bg-gray-100 cursor-pointer">›</button>
          <div className="flex border rounded overflow-hidden ml-2">
            {[0, 1].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHalf(h as 0 | 1)}
                className={`px-2 py-1 font-semibold cursor-pointer ${half === h ? 'bg-[#0063ff] text-white' : 'hover:bg-gray-100'}`}
              >
                {h === 0 ? 'Jan–Jun' : 'Jul–Des'}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1 ml-2"><i className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />Plan</span>
          <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Act</span>
          <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />Terlewat</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[9px] text-center">
          <thead className="sticky top-0 z-10 bg-slate-100">
            <tr>
              <th rowSpan={2} className="border border-gray-200 px-2 py-1 text-left min-w-[160px]">LINE</th>
              <th rowSpan={2} className="border border-gray-200 px-1 py-1 w-[40px]"> </th>
              {months.map((m) => (
                <th key={m} colSpan={5} className="border border-gray-200 px-1 py-1 font-bold">{MONTHS[m]}</th>
              ))}
            </tr>
            <tr>
              {months.map((m) =>
                WEEKS.map((w) => (
                  <th key={`${m}-${w}`} className="border border-gray-200 px-0.5 py-0.5 font-semibold text-gray-500">W{w}</th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {lineNames.length === 0 && (
              <tr>
                <td colSpan={2 + 30} className="py-10 text-gray-400">Belum ada jadwal TPM untuk tahun {year}.</td>
              </tr>
            )}
            {lineNames.map((line) => {
              const r = matrix.get(line)!;
              return (
                <React.Fragment key={line}>
                  <tr>
                    <td rowSpan={2} className="border border-gray-200 px-2 py-1 text-left font-bold text-gray-800">{line}</td>
                    <td className="border border-gray-200 text-[8px] font-bold text-blue-600">PLAN</td>
                    {months.map((m) =>
                      WEEKS.map((w) => {
                        const c = r.get(`${m}-${w}`);
                        const plan = c?.plan.size ?? 0;
                        const actDone = c ? [...c.plan].filter((id) => c.act.has(id)).length : 0;
                        const missed = plan > 0 && actDone < plan && new Date(year, m, w * 7) < now;
                        return (
                          <td
                            key={`p-${m}-${w}`}
                            className={`border border-gray-200 h-5 font-bold ${plan ? (missed ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700') : ''}`}
                          >
                            {plan || ''}
                          </td>
                        );
                      }),
                    )}
                  </tr>
                  <tr>
                    <td className="border border-gray-200 text-[8px] font-bold text-emerald-600">ACT</td>
                    {months.map((m) =>
                      WEEKS.map((w) => {
                        const c = r.get(`${m}-${w}`);
                        const act = c?.act.size ?? 0;
                        return (
                          <td
                            key={`a-${m}-${w}`}
                            className={`border border-gray-200 h-5 font-bold ${act ? 'bg-emerald-100 text-emerald-700' : ''}`}
                          >
                            {act || ''}
                          </td>
                        );
                      }),
                    )}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
