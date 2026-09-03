# 🖥️ Frontend Implementation Plan — Jig Fixture Management

> **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Prisma Client  
> **Direktori:** `front/`  
> **Prioritas:** Frontend dikerjakan **lebih dulu** sebelum backend. API call dibuat dengan struktur yang siap diganti dari mock/hardcode ke real API nanti.

---

## 🗂️ Ringkasan Sistem & Role

**Alur Menu Utama:**
```
User Login
    → Role Identification (PE Jig Fixture / Section Head / Dept Head / Tamu)
    → Dashboard
    → Menu:
        ├── View Data
        ├── Update Design
        ├── Update Abnormality
        ├── Update Inventory     ← Fase 1 Frontend
        └── Approval Center      ← Fase 2 Frontend
```

**Role & Akses:**
| Role | View | Update | Approval | Download |
|------|------|--------|----------|----------|
| PIC Jig Fixture | ✅ | ✅ | Submit | ✅ |
| Section Head | ✅ | ❌ | ✅ | ✅ |
| Dept Head | ✅ | ❌ | ✅ | ✅ |
| Tamu | ✅ (Approved only) | ❌ | ❌ | ✅ |

---

## 🏗️ Arsitektur Folder Frontend

```
front/src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx              # Halaman login
│   └── (dashboard)/
│       ├── layout.tsx                # Shared layout: Navbar + Sidebar + NotificationBell
│       ├── dashboard/
│       │   └── page.tsx              # Dashboard: summary cards + recent activity
│       ├── inventory/                # UPDATE INVENTORY FLOW ← Fase 1
│       │   ├── page.tsx
│       │   ├── [id]/page.tsx
│       │   └── components/
│       │       ├── InventoryTable.tsx
│       │       ├── InventoryFilter.tsx
│       │       ├── InventoryIndicatorBadge.tsx
│       │       ├── InventoryEditForm.tsx
│       │       ├── InventorySummaryCards.tsx
│       │       └── InventoryRedAlert.tsx
│       └── approval-center/          # APPROVAL CENTER FLOW ← Fase 2
│           ├── page.tsx
│           ├── [id]/page.tsx
│           └── components/
│               ├── ApprovalList.tsx
│               ├── ApprovalFilter.tsx
│               ├── ApprovalStatusBadge.tsx
│               ├── ApprovalDetailCard.tsx
│               ├── ApprovalActionForm.tsx
│               ├── ApprovalTimeline.tsx
│               └── ApprovalCommentModal.tsx
├── components/
│   ├── ui/                           # Shared UI: Button, Badge, Modal, Toast, Input, Card
│   └── layout/
│       ├── Navbar.tsx
│       ├── Sidebar.tsx
│       └── NotificationBell.tsx
├── lib/
│   ├── api/
│   │   ├── inventory.ts              # Fetch helper untuk inventory endpoints
│   │   ├── approval.ts               # Fetch helper untuk approval endpoints
│   │   └── notification.ts           # Fetch helper untuk notifikasi
│   ├── hooks/
│   │   ├── useInventory.ts
│   │   ├── useApproval.ts
│   │   └── useNotifications.ts
│   └── db.ts                         # Prisma client singleton
└── types/
    ├── inventory.ts
    ├── approval.ts
    └── notification.ts
```

---

## 🔄 Fase 1 Frontend: UPDATE INVENTORY FLOW

### Alur dari Diagram
```
Update Inventory
    → Filter Inventory
    → Select Inventory Item
    → Edit Minimum Stock
    → Edit Actual Stock
    → Save Inventory
        ├── Inventory Indicator Red   → Red Alert Banner
        ├── Inventory Indicator Green
        └── Inventory Indicator Yellow
```

### Business Logic (Client-side)

```typescript
// types/inventory.ts
export type InventoryIndicator = 'RED' | 'YELLOW' | 'GREEN';

export interface InventoryItem {
  id: string;
  lineProduct: string;
  process: string;
  type: 'JF' | 'EQ';
  noItemAssy: string;
  assyPartName: string;
  noReg: string;
  qty: string;
  designDateLast?: string;
  designDateNew?: string;
  revStatus?: string;
  minimumStock: number;
  actualStock: number;
  indicator: InventoryIndicator;
  newVisualDesign?: string;  // URL gambar 3D render
}

export interface InventoryFilter {
  lineProduct?: string;
  process?: string;
  type?: 'JF' | 'EQ';
  indicator?: InventoryIndicator;
  search?: string;
}

// lib/inventory.utils.ts
export function getInventoryIndicator(
  actualStock: number,
  minimumStock: number
): InventoryIndicator {
  if (actualStock === 0) return 'RED';
  if (actualStock < minimumStock) return 'YELLOW';
  return 'GREEN';
}
```

### Halaman & Komponen

#### 1. Halaman List Inventory (`/inventory`)

**Alur UI:**
1. User klik menu **Update Inventory** di sidebar
2. Tampil **filter bar** di atas: Line/Product, Process, Type, Indicator, search
3. Di bawah filter ada **summary cards**: 🟢 Aman | 🟡 Warning | 🔴 Critical
4. Tabel menampilkan: No.Reg, Part Name, Line, Process, Type, Qty, Min Stock, Actual Stock, Indicator Badge, Action button

**Komponen:**
- `InventoryFilter` — dropdown filter + search input, update URL query params
- `InventorySummaryCards` — 3 cards (RED count, YELLOW count, GREEN count)
- `InventoryTable` — tabel paginated dengan sort dan filter
- `InventoryIndicatorBadge` — badge berwarna (merah/kuning/hijau) dengan animasi pulse untuk RED

#### 2. Halaman Edit Inventory (`/inventory/[id]`)

**Alur UI:**
1. User klik baris di tabel → navigasi ke `/inventory/[id]`
2. Tampil info item: **foto 3D render** (New Visual Design), No.Reg, Part Name, Line, Process
3. Form edit: input `Minimum Stock` + `Actual Stock`
4. **Real-time preview** indicator badge berubah sesuai nilai input
5. Klik **Save Inventory** → PATCH ke API
6. Jika hasil = RED → tampil **banner alert merah**
7. Toast success → redirect kembali ke list

**Komponen:**
- `InventoryEditForm` — controlled form dengan validasi (angka ≥ 0)
- `InventoryRedAlert` — banner/modal peringatan saat stok = 0

#### 3. Notifikasi Inventory

- **Bell icon** di Navbar dengan badge counter merah (unread count)
- Klik bell → dropdown dengan 5 notifikasi terbaru
- Tipe: `INVENTORY_RED`, `INVENTORY_YELLOW`, `WAITING_APPROVAL`, `ABNORMALITY_OPEN`
- Klik notifikasi → navigate ke item terkait
- Auto-refresh setiap 30 detik

### Checklist Implementasi — Fase 1 Frontend

```
[ ] F1.1 — Setup & Fondasi
    [ ] Setup TypeScript types (types/inventory.ts, types/notification.ts)
    [ ] Buat shared UI components: Button, Badge, Card, Input, Modal, Toast
    [ ] Buat layout dashboard: Navbar, Sidebar, NotificationBell skeleton
    [ ] Setup routing: /dashboard, /inventory, /inventory/[id]
    [ ] Buat lib/api/inventory.ts (fetch wrapper dengan mock data awal)
    [ ] Buat lib/inventory.utils.ts (getInventoryIndicator function)

[ ] F1.2 — Halaman List Inventory
    [ ] Layout halaman /inventory (server component)
    [ ] Komponen InventoryFilter (filter via URL search params)
    [ ] Komponen InventorySummaryCards (jumlah per indicator)
    [ ] Komponen InventoryTable dengan kolom lengkap
    [ ] Komponen InventoryIndicatorBadge (warna + animasi pulse untuk RED)
    [ ] Pagination (jika data banyak)
    [ ] Loading skeleton saat fetch data

[ ] F1.3 — Halaman Edit Inventory
    [ ] Halaman /inventory/[id] dengan detail item
    [ ] Tampil foto visual design (gambar 3D render dari newVisualDesign)
    [ ] Komponen InventoryEditForm (input min stock + actual stock)
    [ ] Real-time preview indicator saat user mengetik
    [ ] Submit handler → call API PATCH /inventory/:id
    [ ] Toast success / error
    [ ] Komponen InventoryRedAlert (banner/modal jika hasil = RED)
    [ ] Redirect ke /inventory setelah save berhasil

[ ] F1.4 — Notification System (Frontend)
    [ ] Komponen NotificationBell di Navbar
    [ ] Fetch GET /api/notifications
    [ ] Dropdown notifikasi (max 5 terbaru + link "Lihat Semua")
    [ ] Badge counter unread
    [ ] Auto-refresh polling setiap 30 detik
    [ ] Mark as read saat klik notifikasi
    [ ] Navigate ke item terkait
```

---

## ✅ Fase 2 Frontend: APPROVAL CENTER FLOW

### Alur dari Diagram
```
Approval Center
    → Review Approval Item
        ├── Reject  → Approval Comment (wajib diisi)
        └── Approve → Approval Comment (opsional)
```

**Alur notifikasi:**
```
PIC submit → Notifikasi ke Section Head
Section Head approve → Notifikasi ke Dept Head
Dept Head approve/reject → Notifikasi ke PIC
```

### Types

```typescript
// types/approval.ts
export type ApprovalStatus = 'WAITING' | 'APPROVED' | 'REJECTED';
export type ApprovalType = 'DESIGN_REVISION' | 'INVENTORY_UPDATE';

export interface ApprovalItem {
  id: string;
  type: ApprovalType;
  status: ApprovalStatus;
  itemId: string;
  itemName: string;
  noReg: string;
  newVisualDesign?: string;
  revisionNote?: string;
  submittedBy: string;
  submittedAt: string;

  // Section Head step
  sectionStatus: ApprovalStatus;
  sectionComment?: string;
  sectionAt?: string;

  // Dept Head step
  deptStatus: ApprovalStatus;
  deptComment?: string;
  deptAt?: string;

  finalStatus: ApprovalStatus;
  finalComment?: string;
}
```

### Halaman & Komponen

#### 1. Halaman Approval Center List (`/approval-center`)

**Alur UI:**
1. User (Section Head / Dept Head) klik menu **Approval Center**
2. Tampil list item yang **menunggu approval dari user tersebut** (filter otomatis berdasarkan role)
3. Filter tambahan: by Status (WAITING/APPROVED/REJECTED), by Type (Design/Inventory)
4. Kolom: Nama Item, No.Reg, Tipe, Submitted By, Tanggal, Status Badge
5. **Perbedaan per role:**
   - Section Head → hanya lihat item dengan `sectionStatus = WAITING`
   - Dept Head → hanya lihat item dengan `sectionStatus = APPROVED` dan `deptStatus = WAITING`

#### 2. Halaman Review Detail Approval (`/approval-center/[id]`)

**Alur UI:**
1. Klik item → navigasi ke `/approval-center/[id]`
2. Tampil:
   - **Info item**: foto 3D render, No.Reg, nama, line, process, type
   - **Revision note** dari PIC (alasan submit)
   - **Approval Timeline**: riwayat siapa approve/reject + komentar + waktu
3. Dua tombol aksi:
   - 🔴 **Reject** → muncul modal input komentar **(wajib diisi)**
   - 🟢 **Approve** → langsung submit (komentar opsional)
4. Toast success → redirect ke list

#### 3. Approval Timeline Component

```
Contoh tampilan:

[✅] Submitted oleh Azka A. — 05 Nov 2025, 09:15
     Note: "Revisi desain Sub Assy 1 — perubahan diameter pin"

[✅] Disetujui oleh Section Head (M. Fariedl) — 05 Nov 2025, 14:30
     Komentar: "Disetujui, mohon perbaiki toleransi di rev berikutnya."

[⏳] Menunggu persetujuan Dept Head (Rahmat K.) ...
```

### Checklist Implementasi — Fase 2 Frontend

```
[ ] F2.1 — Setup Types & API Helpers
    [ ] Buat types/approval.ts
    [ ] Buat lib/api/approval.ts (fetch wrapper dengan mock data)
    [ ] Buat lib/hooks/useApproval.ts

[ ] F2.2 — Halaman Approval Center List
    [ ] Layout halaman /approval-center
    [ ] Komponen ApprovalFilter (filter status + type)
    [ ] Komponen ApprovalList (tabel list approval)
    [ ] Komponen ApprovalStatusBadge (WAITING=kuning pulse / APPROVED=hijau / REJECTED=merah)
    [ ] Filter otomatis per role (Section Head vs Dept Head)
    [ ] Badge jumlah "Menunggu Review" di sidebar menu

[ ] F2.3 — Halaman Review Detail
    [ ] Halaman /approval-center/[id]
    [ ] Komponen ApprovalDetailCard (info item + foto visual)
    [ ] Komponen ApprovalTimeline (riwayat step approval)
    [ ] Komponen ApprovalActionForm (tombol Approve + Reject)
    [ ] Komponen ApprovalCommentModal (modal komentar, wajib saat reject)
    [ ] Validasi: tombol Reject tidak bisa submit tanpa komentar
    [ ] Toast success/error setelah aksi
    [ ] Redirect ke /approval-center setelah aksi

[ ] F2.4 — Integrasi Notifikasi Approval
    [ ] Notifikasi "Waiting Approval" tampil di bell saat PIC submit
    [ ] Notifikasi "Revision Approved/Rejected" tampil di bell setelah diproses
    [ ] Update badge notifikasi secara real-time
```

---

## 📝 Catatan Frontend

> [!IMPORTANT]
> **Backend belum ada saat frontend dikerjakan.** Gunakan **mock data** atau **hardcode sementara** di `lib/api/` untuk semua data. Struktur response harus sudah mengikuti kontrak API yang sudah didefinisikan di [BACKEND_PLAN.md](./BACKEND_PLAN.md) agar mudah diganti nanti.

> [!NOTE]
> **Gambar 3D Visual Design:** Sementara gunakan placeholder image. Setelah backend & cloud storage siap, ganti URL dari `newVisualDesign` field.

> [!TIP]
> **Mulai dari komponen UI dulu** (Button, Badge, Card, Input, Toast) sebelum membangun halaman, agar konsisten di seluruh aplikasi.
