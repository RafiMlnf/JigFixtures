# 📋 Implementation Plan: Jig Fixture Management System

> Berdasarkan analisa dokumen:
> - `DRAFT DIGITALISASI JIG FIXTURE MANAGEMENT.xlsx` — System flow diagram & role matrix
> - `JIG & FIXTURE DESIGN MASTER LIST.xlsx` — Master data inventory jig & fixture

---

## 🗂️ Ringkasan Analisa Dokumen

### Sumber Data: JIG & FIXTURE DESIGN MASTER LIST.xlsx

**Departemen:** Process Engineering — Section: PE-Machining  
**Disetujui oleh:** Rahmat K. | **Diperiksa:** M. Fariedl | **Disiapkan:** Azka A.

**Struktur Kolom Master List:**
| Kolom | Field | Keterangan |
|-------|-------|------------|
| A | No | Nomor urut |
| B | Line / Product | Nama line produksi |
| C | Process | Nama proses (OP#1, OP#2, dll) |
| D | Type | Tipe item: `JF` (Jig & Fixture) / `EQ` (Equipment) |
| E | No.Item / Assy | Nomor item atau assy (00, 01, 1.1, 1.2, dst) |
| F | Assy/Part Name | Nama assembly atau part |
| H | No. Reg | Nomor registrasi (kode unik, misal: `TXMACH-ASAU010101`) |
| J | Qty | Kuantitas |
| K | Design Date (Last) | Tanggal desain terakhir |
| L | Design Date (New) | Tanggal desain baru / revisi |
| M | Rev Status | Status revisi: `0`, `1`, `2`, atau `N/A` |
| N | Doc. Location (2D) | Path lokasi dokumen PDF / 2D |
| O | Doc. Location (3D) | Path lokasi 3D model |
| Q | New Visual Design | Gambar 3D visual item (embedded di Excel) |

**Data Line/Product yang Ada (11 Line):**
- Auto Assy Steering Stem (69 item — paling banyak, multi-OP)
- Manual Assy Steering Stem (2 item)
- D38-Hub Clutch, D80-Hub Front, D14, D40, T86
- UB 6-7, UB Robot 1-4, UB Robot 5
- 2CF - 2MD

**Rev Status Values:** `0` = Belum ada revisi, `1` = Rev 1, `2` = Rev 2, `N/A` = Spare part/baut (tidak punya desain)

**Gambar di Master List:** 65 foto 3D model jig & fixture (render CAD) yang tertanam langsung di Excel. Gambar-gambar ini perlu diekspor dan di-host untuk ditampilkan di web.

---

### Sumber Alur: DRAFT DIGITALISASI JIG FIXTURE MANAGEMENT.xlsx

**Alur Utama Sistem:**

```
User Login
    → Role Identification
        ├── PE Jig Fixture
        ├── PE Section Head
        ├── PE Dept Head
        └── OTHER (Tamu)
    → Dashboard Display
    → Menu Selection
        ├── VIEW DATA FLOW
        ├── UPDATE DESIGN FLOW
        ├── UPDATE ABNORMALITY FLOW
        ├── UPDATE INVENTORY FLOW     ← Fokus Fase 1
        └── APPROVAL CENTER FLOW      ← Fokus Fase 2
```

**Tabel Role & Akses:**
| Role | View | Update | Approval | Download |
|------|------|--------|----------|----------|
| PIC Jig Fixture | ✅ | ✅ | Submit | ✅ |
| Section Head | ✅ | ❌ | ✅ | ✅ |
| Dept Head | ✅ | ❌ | ✅ | ✅ |
| Tamu | ✅ (Approved only) | ❌ | ❌ | ✅ |

---

## 🔄 Fase 1: UPDATE INVENTORY FLOW

### Gambaran Alur (dari diagram)

```
Update Inventory
    → Filter Inventory
    → Select Inventory Item
    → Edit Minimum Stock
    → Edit Actual Stock
    → Save Inventory
        ├── Inventory Indicator Red   → Inventory Red Alert → Notification System + Inventory Red Notification
        ├── Inventory Indicator Green
        └── Inventory Indicator Yellow
```

### 1.1 Prisma Schema — Inventory

```prisma
// Tambahkan ke: prisma/schema.prisma (backend & front)

model JigFixtureItem {
  id              String   @id @default(cuid())
  no              Int?
  lineProduct     String
  process         String
  type            String   // JF / EQ
  noItemAssy      String
  assyPartName    String
  noReg           String   @unique
  qty             String
  designDateLast  DateTime?
  designDateNew   DateTime?
  revStatus       String?  // "0", "1", "2", "N/A"
  docLocation2D   String?
  docLocation3D   String?
  newVisualDesign String?  // URL gambar 3D visual

  // Inventory fields (baru)
  minimumStock    Int      @default(0)
  actualStock     Int      @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  inventoryLogs   InventoryLog[]
  notifications   Notification[]
  approvals       Approval[]
}

model InventoryLog {
  id            String          @id @default(cuid())
  itemId        String
  item          JigFixtureItem  @relation(fields: [itemId], references: [id])
  changedById   String
  changedBy     User            @relation(fields: [changedById], references: [id])
  prevMinStock  Int
  newMinStock   Int
  prevActStock  Int
  newActStock   Int
  indicator     String          // RED / YELLOW / GREEN
  createdAt     DateTime        @default(now())
}

model Notification {
  id          String          @id @default(cuid())
  type        String          // INVENTORY_RED / INVENTORY_YELLOW / WAITING_APPROVAL / ABNORMALITY_OPEN
  title       String
  message     String
  isRead      Boolean         @default(false)
  itemId      String?
  item        JigFixtureItem? @relation(fields: [itemId], references: [id])
  userId      String
  user        User            @relation(fields: [userId], references: [id])
  createdAt   DateTime        @default(now())
}

model User {
  id            String         @id @default(cuid())
  name          String
  email         String         @unique
  role          UserRole
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  inventoryLogs InventoryLog[]
  notifications Notification[]
  approvals     Approval[]
}

enum UserRole {
  PE_JIG_FIXTURE
  PE_SECTION_HEAD
  PE_DEPT_HEAD
  TAMU
}

model Approval {
  id             String         @id @default(cuid())
  type           ApprovalType
  status         ApprovalStatus @default(WAITING)
  itemId         String
  item           JigFixtureItem @relation(fields: [itemId], references: [id])
  revisionNote   String?

  submittedById  String
  submittedBy    User           @relation(fields: [submittedById], references: [id])
  submittedAt    DateTime       @default(now())

  sectionHeadId  String?
  sectionStatus  ApprovalStatus @default(WAITING)
  sectionComment String?
  sectionAt      DateTime?

  deptHeadId     String?
  deptStatus     ApprovalStatus @default(WAITING)
  deptComment    String?
  deptAt         DateTime?

  finalStatus    ApprovalStatus @default(WAITING)
  finalComment   String?

  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}

enum ApprovalType {
  DESIGN_REVISION
  INVENTORY_UPDATE
}

enum ApprovalStatus {
  WAITING
  APPROVED
  REJECTED
}
```

### 1.2 Business Logic — Inventory Indicator

```typescript
// inventory.types.ts
export enum InventoryIndicator {
  GREEN = 'GREEN',   // actualStock >= minimumStock
  YELLOW = 'YELLOW', // 0 < actualStock < minimumStock
  RED = 'RED',       // actualStock === 0
}

export function getInventoryIndicator(
  actualStock: number,
  minimumStock: number
): InventoryIndicator {
  if (actualStock === 0) return InventoryIndicator.RED;
  if (actualStock < minimumStock) return InventoryIndicator.YELLOW;
  return InventoryIndicator.GREEN;
}
```

### 1.3 Backend (NestJS) — Modul & Endpoint

#### Struktur File

```
backend/src/
├── inventory/
│   ├── inventory.module.ts
│   ├── inventory.controller.ts
│   ├── inventory.service.ts
│   └── dto/
│       ├── filter-inventory.dto.ts
│       ├── update-inventory.dto.ts
│       └── inventory-response.dto.ts
├── notification/
│   ├── notification.module.ts
│   ├── notification.controller.ts
│   └── notification.service.ts
└── jig-fixture-item/
    ├── jig-fixture-item.module.ts
    ├── jig-fixture-item.controller.ts
    └── jig-fixture-item.service.ts
```

#### API Endpoints

| Method | Endpoint | Deskripsi | Role |
|--------|----------|-----------|------|
| `GET` | `/api/inventory` | Get daftar inventory + filter | PE_JIG_FIXTURE |
| `GET` | `/api/inventory/:id` | Get detail satu item | PE_JIG_FIXTURE |
| `PATCH` | `/api/inventory/:id` | Update min & actual stock | PE_JIG_FIXTURE |
| `GET` | `/api/inventory/indicators/summary` | Jumlah RED / YELLOW / GREEN | All |
| `GET` | `/api/notifications` | Get notifikasi user | All |
| `PATCH` | `/api/notifications/:id/read` | Mark as read | All |

#### Service Logic — Save Inventory + Trigger Notifikasi

```typescript
// inventory.service.ts (pseudocode)
async updateInventory(id: string, dto: UpdateInventoryDto, userId: string) {
  const item = await prisma.jigFixtureItem.findUnique({ where: { id } });
  const indicator = getInventoryIndicator(dto.actualStock, dto.minimumStock);

  // Log perubahan
  await prisma.inventoryLog.create({
    data: {
      itemId: id,
      changedById: userId,
      prevMinStock: item.minimumStock,
      newMinStock: dto.minimumStock,
      prevActStock: item.actualStock,
      newActStock: dto.actualStock,
      indicator,
    }
  });

  // Update item
  const updated = await prisma.jigFixtureItem.update({
    where: { id },
    data: { minimumStock: dto.minimumStock, actualStock: dto.actualStock }
  });

  // Auto-notifikasi jika RED
  if (indicator === InventoryIndicator.RED) {
    await notificationService.createInventoryRedAlert(id, userId);
  }

  return { ...updated, indicator };
}
```

### 1.4 Frontend (Next.js) — Halaman & Komponen

#### Struktur File

```
front/src/
├── app/
│   └── (dashboard)/
│       └── inventory/
│           ├── page.tsx                     # List inventory + filter
│           ├── [id]/page.tsx                # Edit inventory item
│           └── components/
│               ├── InventoryTable.tsx
│               ├── InventoryFilter.tsx      # Filter: line, process, type, indicator, search
│               ├── InventoryIndicatorBadge.tsx  # Badge RED/YELLOW/GREEN
│               ├── InventoryEditForm.tsx    # Form min stock & actual stock
│               ├── InventorySummaryCards.tsx    # Cards: jumlah per indicator
│               └── InventoryRedAlert.tsx    # Banner/modal alert RED
├── lib/api/inventory.ts
├── lib/hooks/useInventory.ts
└── types/inventory.ts
```

#### Alur UI — Halaman List Inventory

1. User klik menu **Update Inventory** di sidebar
2. Muncul **filter bar** di atas: Line/Product, Process, Type, Indicator (RED/YELLOW/GREEN), search
3. Di bawah filter ada **summary cards**: 🟢 Aman | 🟡 Warning | 🔴 Critical
4. Tabel menampilkan: No.Reg, Part Name, Line, Process, Type, Qty, Min Stock, Actual Stock, Indicator Badge, Action

#### Alur UI — Halaman Edit Inventory Item

1. User klik baris di tabel → navigasi ke `/inventory/[id]`
2. Tampil info item: **foto 3D render** (New Visual Design), No.Reg, Part Name, Line, Process
3. Form edit: input `Minimum Stock` + `Actual Stock`
4. **Real-time preview** indicator (berubah saat user mengetik)
5. Klik **Save Inventory** → PATCH ke API
6. Jika hasil = RED → tampil **alert merah** + kirim notifikasi ke sistem
7. Toast success → redirect ke list

#### Alur UI — Notifikasi Inventory

- **Bell icon** di navbar, badge merah = jumlah unread
- Klik bell → dropdown 5 notifikasi terbaru
- Tipe notifikasi: `INVENTORY_RED`, `INVENTORY_YELLOW`, `WAITING_APPROVAL`, `ABNORMALITY_OPEN`
- Klik notifikasi → navigate ke item terkait

### 1.5 Urutan Implementasi — Update Inventory Flow

```
[ ] Phase 1.1 — Backend Foundation
    [ ] Buat Prisma schema (JigFixtureItem, InventoryLog, User, Notification)
    [ ] Jalankan prisma migrate dev
    [ ] Buat seed script dari data Excel (89 item dari MASTER LIST)
    [ ] Buat inventory.module, inventory.service, inventory.controller
    [ ] Endpoint GET /api/inventory (dengan query filter: line, process, type, indicator, search)
    [ ] Endpoint GET /api/inventory/:id
    [ ] Endpoint PATCH /api/inventory/:id (update min & actual stock)
    [ ] Endpoint GET /api/inventory/indicators/summary
    [ ] Business logic: getInventoryIndicator()
    [ ] Buat notification.module & notification.service
    [ ] Auto-create notification INVENTORY_RED saat actualStock = 0

[ ] Phase 1.2 — Frontend Inventory List
    [ ] Layout halaman /inventory (server component)
    [ ] Komponen InventoryFilter (server-side filtering via URL params)
    [ ] Komponen InventoryTable (tabel data lengkap)
    [ ] Komponen InventoryIndicatorBadge (RED/YELLOW/GREEN dengan warna dan animasi)
    [ ] Komponen InventorySummaryCards (di dashboard + di halaman inventory)
    [ ] Pagination jika data banyak

[ ] Phase 1.3 — Frontend Inventory Edit
    [ ] Halaman /inventory/[id] (layout detail)
    [ ] Tampil foto visual design (gambar 3D render)
    [ ] Form InventoryEditForm (controlled inputs)
    [ ] Real-time indicator preview
    [ ] Submit handler + PATCH API call
    [ ] Toast success / error handler
    [ ] Inventory Red Alert (banner/modal)
    [ ] Redirect ke list setelah save

[ ] Phase 1.4 — Notification System
    [ ] Komponen NotificationBell di navbar
    [ ] Endpoint GET /api/notifications
    [ ] Endpoint PATCH /api/notifications/:id/read
    [ ] Dropdown notifikasi (max 5 terbaru)
    [ ] Badge counter unread (auto-refresh setiap 30 detik)
    [ ] Navigate ke item terkait saat klik notifikasi
```

---

## ✅ Fase 2: APPROVAL CENTER FLOW

### Gambaran Alur (dari diagram)

```
Approval Center
    → Review Approval Item
        ├── Reject  → Approval Comment (wajib)
        └── Approve → Approval Comment (opsional)
```

**Alur submit dari PIC:**
```
PIC Jig Fixture: Submit Revisi
    → Notifikasi "Waiting Approval" ke Section Head
    → Section Head Review:
        ├── Reject → Notifikasi "Revision Rejected" ke PIC (selesai)
        └── Approve → Notifikasi ke Dept Head
    → Dept Head Review:
        ├── Reject → Notifikasi "Revision Rejected" ke PIC
        └── Approve → Status = "Revision Approved" → Notifikasi ke PIC
```

### 2.1 Business Logic — Approval Berjenjang

```typescript
// approval.service.ts (pseudocode)
async processApproval(id: string, action: 'APPROVE' | 'REJECT', comment: string, approverId: string) {
  const approval = await prisma.approval.findUnique({ where: { id }, include: { item: true } });
  const approver = await prisma.user.findUnique({ where: { id: approverId } });

  if (approver.role === 'PE_SECTION_HEAD') {
    if (action === 'APPROVE') {
      await prisma.approval.update({
        where: { id },
        data: {
          sectionHeadId: approverId,
          sectionStatus: 'APPROVED',
          sectionComment: comment,
          sectionAt: new Date(),
          status: 'WAITING', // menunggu Dept Head
        }
      });
      await notificationService.notifyDeptHead(approval); // kirim ke Dept Head

    } else { // REJECT
      await prisma.approval.update({
        where: { id },
        data: {
          sectionStatus: 'REJECTED',
          sectionComment: comment,
          finalStatus: 'REJECTED',
          finalComment: comment,
        }
      });
      await notificationService.notifyRevisionRejected(approval, comment); // kirim ke PIC
    }
  }

  if (approver.role === 'PE_DEPT_HEAD') {
    if (action === 'APPROVE') {
      await prisma.approval.update({
        where: { id },
        data: {
          deptHeadId: approverId,
          deptStatus: 'APPROVED',
          deptComment: comment,
          deptAt: new Date(),
          finalStatus: 'APPROVED',
        }
      });
      await jigFixtureItemService.markAsApproved(approval.itemId);
      await notificationService.notifyRevisionApproved(approval); // kirim ke PIC

    } else { // REJECT
      await prisma.approval.update({
        where: { id },
        data: {
          deptStatus: 'REJECTED',
          deptComment: comment,
          finalStatus: 'REJECTED',
          finalComment: comment,
        }
      });
      await notificationService.notifyRevisionRejected(approval, comment); // kirim ke PIC
    }
  }
}
```

### 2.2 Backend (NestJS) — Modul & Endpoint

#### Struktur File

```
backend/src/
└── approval/
    ├── approval.module.ts
    ├── approval.controller.ts
    ├── approval.service.ts
    └── dto/
        ├── submit-approval.dto.ts
        ├── process-approval.dto.ts   # action: APPROVE/REJECT, comment: string
        └── approval-response.dto.ts
```

#### API Endpoints

| Method | Endpoint | Deskripsi | Role |
|--------|----------|-----------|------|
| `GET` | `/api/approvals` | List approval (filter status, type) | Section Head, Dept Head |
| `GET` | `/api/approvals/:id` | Detail satu approval | Section Head, Dept Head |
| `POST` | `/api/approvals` | Submit item untuk approval | PE_JIG_FIXTURE |
| `PATCH` | `/api/approvals/:id/approve` | Approve item + opsional comment | Section Head, Dept Head |
| `PATCH` | `/api/approvals/:id/reject` | Reject item + wajib comment | Section Head, Dept Head |
| `GET` | `/api/approvals/my-submissions` | List submission oleh PIC ini | PE_JIG_FIXTURE |

### 2.3 Frontend (Next.js) — Halaman & Komponen

#### Struktur File

```
front/src/
├── app/
│   └── (dashboard)/
│       └── approval-center/
│           ├── page.tsx                      # List approval items
│           ├── [id]/page.tsx                 # Review detail approval
│           └── components/
│               ├── ApprovalList.tsx
│               ├── ApprovalFilter.tsx        # Filter: status, type
│               ├── ApprovalStatusBadge.tsx   # WAITING/APPROVED/REJECTED badge
│               ├── ApprovalDetailCard.tsx    # Info item + visual
│               ├── ApprovalActionForm.tsx    # Tombol Approve + Reject
│               ├── ApprovalTimeline.tsx      # Timeline proses (siapa approve kapan)
│               └── ApprovalCommentModal.tsx  # Modal komentar (wajib saat reject)
└── lib/api/approval.ts
```

#### Alur UI — Halaman Approval Center (List)

1. User (Section Head / Dept Head) klik menu **Approval Center**
2. Tampil list item yang **menunggu approval dari user tersebut** (sesuai role)
3. Filter: by Status (WAITING/APPROVED/REJECTED), by Type (Design/Inventory)
4. Setiap item: Nama Item, No.Reg, Tipe, Submitted By, Tanggal, Status Badge
5. **Perbedaan tampilan per role:**
   - Section Head: hanya melihat item dengan `sectionStatus = WAITING`
   - Dept Head: hanya melihat item dengan `sectionStatus = APPROVED` dan `deptStatus = WAITING`

#### Alur UI — Halaman Review Detail Approval

1. Klik item → navigasi ke `/approval-center/[id]`
2. Tampil:
   - **Info item**: foto 3D render, No.Reg, nama, line, process, type
   - **Revision note** dari PIC (alasan pengajuan revisi)
   - **Approval Timeline**: siapa sudah approve/reject, kapan, komentar
3. Dua aksi tombol:
   - 🔴 **Reject** → tampil modal input komentar (wajib)
   - 🟢 **Approve** → langsung submit (komentar opsional)
4. Toast success → redirect ke list

#### Approval Timeline Component

```
Contoh tampilan timeline:

[✅] Submitted oleh Azka A. — 05 Nov 2025, 09:15
     Note: "Revisi desain Sub Assy 1 — perubahan diameter pin"

[✅] Disetujui oleh Section Head (M. Fariedl) — 05 Nov 2025, 14:30
     Komentar: "Disetujui, mohon perbaiki toleransi di rev berikutnya."

[⏳] Menunggu persetujuan Dept Head (Rahmat K.) ...
```

### 2.4 Urutan Implementasi — Approval Center Flow

```
[ ] Phase 2.1 — Backend Approval Foundation
    [ ] Tambah model Approval ke Prisma schema
    [ ] Jalankan prisma migrate dev
    [ ] Buat approval.module, approval.service, approval.controller
    [ ] Endpoint POST /api/approvals (submit dari PIC, auto-notifikasi ke Section Head)
    [ ] Endpoint GET /api/approvals (filter by role user yang login)
    [ ] Endpoint GET /api/approvals/:id
    [ ] Endpoint PATCH /api/approvals/:id/approve (logic berjenjang Section Head → Dept Head)
    [ ] Endpoint PATCH /api/approvals/:id/reject (wajib ada comment)
    [ ] Integrasi dengan NotificationService (Waiting Approval, Revision Approved, Revision Rejected)
    [ ] Role Guard: hanya PE_JIG_FIXTURE bisa submit, hanya Section/Dept Head bisa approve/reject
    [ ] Endpoint GET /api/approvals/my-submissions

[ ] Phase 2.2 — Frontend Approval List
    [ ] Layout halaman /approval-center
    [ ] ApprovalFilter (status + type)
    [ ] ApprovalList + ApprovalStatusBadge
    [ ] Tampilkan berbeda untuk Section Head vs Dept Head (filter otomatis per role)
    [ ] Badge jumlah "Menunggu Review" di sidebar menu

[ ] Phase 2.3 — Frontend Review Detail
    [ ] Halaman /approval-center/[id]
    [ ] ApprovalDetailCard (info item + foto visual)
    [ ] ApprovalTimeline (riwayat review)
    [ ] ApprovalActionForm (Approve / Reject buttons)
    [ ] ApprovalCommentModal (modal komentar wajib saat reject)
    [ ] Toast success/error
    [ ] Redirect ke list setelah aksi

[ ] Phase 2.4 — Integrasi Notifikasi
    [ ] Notifikasi "Waiting Approval" → ke Section Head (saat PIC submit)
    [ ] Notifikasi ke Dept Head (saat Section Head approve)
    [ ] Notifikasi "Revision Approved" → ke PIC (saat Dept Head approve)
    [ ] Notifikasi "Revision Rejected" → ke PIC (saat siapapun reject)
    [ ] Update badge notifikasi di navbar secara real-time
```

---

## 📦 Seed Data — Dari Excel ke Database

```typescript
// Contoh struktur data seed dari Excel (89 item total)
const seedItems = [
  {
    no: 1,
    lineProduct: "Auto Assy Steering Stem",
    process: "OP#1 (PressFit)",
    type: "JF",
    noItemAssy: "00",
    assyPartName: "Full Assy",
    noReg: "TXMACH-ASAU010000",
    qty: "N/A",
    designDateLast: new Date("2017-12-07"),
    designDateNew: new Date("2025-11-09"),
    revStatus: "1",
    docLocation2D: "path/to/pdf...",
    docLocation3D: "path/to/3d-model...",
    minimumStock: 0, // default — diisi via Update Inventory Flow
    actualStock: 0,
  },
  // ... 88 item lainnya
];
```

> **Catatan:** Field `minimumStock` dan `actualStock` tidak ada di Excel — default `0`.  
> Akan diisi pertama kali melalui **Update Inventory Flow** oleh PIC Jig Fixture.

**Script seed yang disarankan:** Gunakan library `xlsx` atau `exceljs` di Node.js untuk membaca langsung dari file Excel, menghindari input manual 89 item.

---

## 🏗️ Arsitektur Keseluruhan

```
jigfixtures/
├── front/              # Next.js 16 — App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx            # Shared layout (navbar + sidebar)
│   │   │   │   ├── dashboard/page.tsx    # Dashboard + summary cards
│   │   │   │   ├── view-data/            # VIEW DATA FLOW
│   │   │   │   ├── inventory/            # UPDATE INVENTORY FLOW ← Fase 1
│   │   │   │   ├── approval-center/      # APPROVAL CENTER FLOW ← Fase 2
│   │   │   │   ├── update-design/        # UPDATE DESIGN FLOW
│   │   │   │   └── abnormality/          # UPDATE ABNORMALITY FLOW
│   │   │   └── (auth)/
│   │   │       └── login/page.tsx
│   │   ├── components/
│   │   │   ├── ui/                       # Shared UI components
│   │   │   └── layout/                   # Navbar, Sidebar, NotificationBell
│   │   ├── lib/
│   │   │   ├── api/                      # API fetch helpers
│   │   │   ├── hooks/                    # Custom React hooks
│   │   │   └── db.ts                     # Prisma client singleton
│   │   └── types/
│   └── prisma/schema.prisma
│
└── backend/            # NestJS 11 — REST API
    ├── src/
    │   ├── auth/               # Autentikasi & role guard
    │   ├── user/               # User management
    │   ├── jig-fixture-item/   # CRUD master data JF items
    │   ├── inventory/          # Update Inventory Flow ← Fase 1
    │   ├── approval/           # Approval Center Flow ← Fase 2
    │   ├── notification/       # Notification system
    │   ├── design/             # Update Design Flow
    │   ├── abnormality/        # Update Abnormality Flow
    │   └── prisma.service.ts
    └── prisma/schema.prisma
```

---

## 📝 Catatan Penting

> [!IMPORTANT]
> Dokumen ini adalah **panduan teknis** saja — implementasi belum dimulai. Gunakan sebagai referensi saat development diminta.

> [!NOTE]
> **Gambar Visual Design (65 foto 3D):** Perlu diekspor dari Excel dan di-hosting ke cloud storage (Supabase Storage / S3) agar bisa ditampilkan di web. Path akan disimpan di kolom `newVisualDesign` di database.

> [!NOTE]
> **Stock Data:** Minimum Stock dan Actual Stock **tidak ada** di Excel sumber — akan mulai dari `0` dan diisi pertama kali via Update Inventory Flow.

> [!WARNING]
> **Approval Berjenjang:** Section Head reject → selesai (Dept Head tidak perlu review). Section Head approve → Dept Head harus review. Implementasikan state machine dengan benar agar tidak ada celah skip approval.

> [!TIP]
> **Seed Script:** Gunakan `exceljs` atau `xlsx` di Node.js untuk baca otomatis dari file `JIG & FIXTURE DESIGN MASTER LIST.xlsx` — lebih efisien dari input manual 89 item.
