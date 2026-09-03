# 🔧 Backend Implementation Plan — Jig Fixture Management

> **Stack:** NestJS 11 · TypeScript · Prisma ORM · PostgreSQL  
> **Direktori:** `backend/`  
> **Urutan:** Backend dikerjakan **setelah frontend selesai**. Kontrak API endpoint sudah didefinisikan di sini agar frontend bisa mempersiapkan `lib/api/` yang sesuai dengan mock data terlebih dahulu.

---

## 🗂️ Ringkasan Kontrak API

Semua endpoint menggunakan prefix `/api` dan mengembalikan format JSON standar:

```typescript
// Response sukses
{ data: T, message?: string }

// Response error
{ statusCode: number, message: string, error?: string }
```

---

## 🏗️ Arsitektur Folder Backend

```
backend/src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts        # POST /auth/login, POST /auth/logout
│   ├── auth.service.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   └── decorators/
│       └── roles.decorator.ts
├── user/
│   ├── user.module.ts
│   ├── user.controller.ts        # GET /users/me
│   └── user.service.ts
├── jig-fixture-item/
│   ├── jig-fixture-item.module.ts
│   ├── jig-fixture-item.controller.ts  # CRUD master data item
│   └── jig-fixture-item.service.ts
├── inventory/
│   ├── inventory.module.ts
│   ├── inventory.controller.ts   # GET/PATCH /inventory
│   ├── inventory.service.ts
│   └── dto/
│       ├── filter-inventory.dto.ts
│       ├── update-inventory.dto.ts
│       └── inventory-response.dto.ts
├── approval/
│   ├── approval.module.ts
│   ├── approval.controller.ts    # GET/POST/PATCH /approvals
│   ├── approval.service.ts
│   └── dto/
│       ├── submit-approval.dto.ts
│       ├── process-approval.dto.ts
│       └── approval-response.dto.ts
├── notification/
│   ├── notification.module.ts
│   ├── notification.controller.ts  # GET/PATCH /notifications
│   └── notification.service.ts
└── prisma.service.ts
```

---

## 🗄️ Prisma Schema Lengkap

```prisma
// backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String         @id @default(cuid())
  name          String
  email         String         @unique
  password      String         // hashed
  role          UserRole
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  inventoryLogs InventoryLog[]
  notifications Notification[]
  submittedApprovals  Approval[] @relation("SubmittedBy")
  sectionApprovals    Approval[] @relation("SectionHead")
  deptApprovals       Approval[] @relation("DeptHead")
}

enum UserRole {
  PE_JIG_FIXTURE
  PE_SECTION_HEAD
  PE_DEPT_HEAD
  TAMU
}

model JigFixtureItem {
  id              String    @id @default(cuid())
  no              Int?
  lineProduct     String
  process         String
  type            String    // JF / EQ
  noItemAssy      String
  assyPartName    String
  noReg           String    @unique
  qty             String
  designDateLast  DateTime?
  designDateNew   DateTime?
  revStatus       String?   // "0", "1", "2", "N/A"
  docLocation2D   String?
  docLocation3D   String?
  newVisualDesign String?   // URL gambar 3D render

  minimumStock    Int       @default(0)
  actualStock     Int       @default(0)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  inventoryLogs   InventoryLog[]
  notifications   Notification[]
  approvals       Approval[]
}

model InventoryLog {
  id            String         @id @default(cuid())
  itemId        String
  item          JigFixtureItem @relation(fields: [itemId], references: [id])
  changedById   String
  changedBy     User           @relation(fields: [changedById], references: [id])
  prevMinStock  Int
  newMinStock   Int
  prevActStock  Int
  newActStock   Int
  indicator     String         // RED / YELLOW / GREEN
  createdAt     DateTime       @default(now())
}

model Notification {
  id        String          @id @default(cuid())
  type      String          // INVENTORY_RED | INVENTORY_YELLOW | WAITING_APPROVAL | ABNORMALITY_OPEN
  title     String
  message   String
  isRead    Boolean         @default(false)
  itemId    String?
  item      JigFixtureItem? @relation(fields: [itemId], references: [id])
  userId    String
  user      User            @relation(fields: [userId], references: [id])
  createdAt DateTime        @default(now())
}

model Approval {
  id             String         @id @default(cuid())
  type           ApprovalType
  status         ApprovalStatus @default(WAITING)

  itemId         String
  item           JigFixtureItem @relation(fields: [itemId], references: [id])
  revisionNote   String?

  submittedById  String
  submittedBy    User           @relation("SubmittedBy", fields: [submittedById], references: [id])
  submittedAt    DateTime       @default(now())

  sectionHeadId  String?
  sectionHead    User?          @relation("SectionHead", fields: [sectionHeadId], references: [id])
  sectionStatus  ApprovalStatus @default(WAITING)
  sectionComment String?
  sectionAt      DateTime?

  deptHeadId     String?
  deptHead       User?          @relation("DeptHead", fields: [deptHeadId], references: [id])
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

---

## 🔄 Fase 1 Backend: UPDATE INVENTORY FLOW

### API Endpoints

| Method | Endpoint | Deskripsi | Role yang Diizinkan |
|--------|----------|-----------|---------------------|
| `GET` | `/api/inventory` | Daftar inventory dengan filter | All (authenticated) |
| `GET` | `/api/inventory/indicators/summary` | Jumlah RED / YELLOW / GREEN | All (authenticated) |
| `GET` | `/api/inventory/:id` | Detail satu item | All (authenticated) |
| `PATCH` | `/api/inventory/:id` | Update min & actual stock | PE_JIG_FIXTURE |
| `GET` | `/api/notifications` | Get notifikasi user login | All (authenticated) |
| `PATCH` | `/api/notifications/:id/read` | Mark notifikasi sebagai read | All (authenticated) |

### Query Parameters — GET `/api/inventory`

```
?lineProduct=Auto+Assy+Steering+Stem
&process=OP%231
&type=JF
&indicator=RED
&search=TXMACH
&page=1
&limit=20
```

### Response — GET `/api/inventory`

```json
{
  "data": [
    {
      "id": "cuid_xxx",
      "lineProduct": "Auto Assy Steering Stem",
      "process": "OP#1 (PressFit)",
      "type": "JF",
      "noItemAssy": "00",
      "assyPartName": "Full Assy",
      "noReg": "TXMACH-ASAU010000",
      "qty": "N/A",
      "minimumStock": 5,
      "actualStock": 0,
      "indicator": "RED",
      "newVisualDesign": "https://storage.example.com/img0.png"
    }
  ],
  "meta": {
    "total": 89,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Business Logic — Inventory Indicator

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

### Service Logic — PATCH Inventory + Auto Notifikasi

```typescript
// inventory.service.ts
async updateInventory(id: string, dto: UpdateInventoryDto, userId: string) {
  const item = await this.prisma.jigFixtureItem.findUniqueOrThrow({ where: { id } });
  const indicator = getInventoryIndicator(dto.actualStock, dto.minimumStock);

  // Simpan log perubahan
  await this.prisma.inventoryLog.create({
    data: {
      itemId: id,
      changedById: userId,
      prevMinStock: item.minimumStock,
      newMinStock: dto.minimumStock,
      prevActStock: item.actualStock,
      newActStock: dto.actualStock,
      indicator,
    },
  });

  // Update item
  const updated = await this.prisma.jigFixtureItem.update({
    where: { id },
    data: { minimumStock: dto.minimumStock, actualStock: dto.actualStock },
  });

  // Auto-notifikasi semua user jika RED
  if (indicator === InventoryIndicator.RED) {
    await this.notificationService.createInventoryRedAlert(id);
  }

  return { ...updated, indicator };
}
```

### Checklist Implementasi — Fase 1 Backend

```
[ ] B1.1 — Prisma Schema & Database
    [ ] Tulis schema.prisma lengkap (semua model dari dokumen ini)
    [ ] Jalankan: npx prisma migrate dev --name init
    [ ] Buat seed script (prisma/seed.ts) yang baca dari Excel
        [ ] Install: npm install exceljs
        [ ] Parse JIG & FIXTURE DESIGN MASTER LIST.xlsx
        [ ] Insert 89 item ke JigFixtureItem
    [ ] Jalankan: npx prisma db seed
    [ ] Verifikasi data dengan Prisma Studio: npx prisma studio

[ ] B1.2 — Auth & User Module
    [ ] Install: npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
    [ ] Buat User module & service
    [ ] Implementasi JWT login (POST /auth/login)
    [ ] Buat JwtAuthGuard dan RolesGuard
    [ ] Buat @Roles() decorator
    [ ] Endpoint GET /users/me (info user yang sedang login)

[ ] B1.3 — JigFixtureItem Module
    [ ] Buat jig-fixture-item.module, service, controller
    [ ] Endpoint GET /jig-fixture-items (list semua item master data)
    [ ] Endpoint GET /jig-fixture-items/:id (detail item)

[ ] B1.4 — Inventory Module
    [ ] Buat inventory.module, service, controller
    [ ] Buat filter-inventory.dto.ts (query params validation)
    [ ] Buat update-inventory.dto.ts (body validation: minimumStock, actualStock ≥ 0)
    [ ] Endpoint GET /inventory (dengan filtering + pagination)
    [ ] Endpoint GET /inventory/indicators/summary
    [ ] Endpoint GET /inventory/:id
    [ ] Endpoint PATCH /inventory/:id (role guard: PE_JIG_FIXTURE)
    [ ] Business logic getInventoryIndicator()
    [ ] Simpan InventoryLog setiap kali update

[ ] B1.5 — Notification Module
    [ ] Buat notification.module, service, controller
    [ ] Endpoint GET /notifications (filter by userId dari JWT)
    [ ] Endpoint PATCH /notifications/:id/read
    [ ] Method createInventoryRedAlert(itemId) di service
    [ ] Kirim notifikasi ke semua user yang relevan saat RED
```

---

## ✅ Fase 2 Backend: APPROVAL CENTER FLOW

### API Endpoints

| Method | Endpoint | Deskripsi | Role yang Diizinkan |
|--------|----------|-----------|---------------------|
| `POST` | `/api/approvals` | Submit item untuk approval | PE_JIG_FIXTURE |
| `GET` | `/api/approvals` | List approval (filter per role user) | Section Head, Dept Head |
| `GET` | `/api/approvals/my-submissions` | List yang disubmit oleh PIC ini | PE_JIG_FIXTURE |
| `GET` | `/api/approvals/:id` | Detail satu approval | All (authenticated) |
| `PATCH` | `/api/approvals/:id/approve` | Approve + opsional comment | PE_SECTION_HEAD, PE_DEPT_HEAD |
| `PATCH` | `/api/approvals/:id/reject` | Reject + wajib comment | PE_SECTION_HEAD, PE_DEPT_HEAD |

### Business Logic — Approval Berjenjang

```typescript
// approval.service.ts
async processApproval(
  id: string,
  action: 'APPROVE' | 'REJECT',
  comment: string,
  approverId: string
) {
  const approval = await this.prisma.approval.findUniqueOrThrow({
    where: { id },
    include: { item: true, submittedBy: true },
  });
  const approver = await this.prisma.user.findUniqueOrThrow({
    where: { id: approverId },
  });

  if (approver.role === 'PE_SECTION_HEAD') {
    if (action === 'APPROVE') {
      // Update: Section Head approve, status masih WAITING menunggu Dept Head
      await this.prisma.approval.update({
        where: { id },
        data: {
          sectionHeadId: approverId,
          sectionStatus: 'APPROVED',
          sectionComment: comment,
          sectionAt: new Date(),
          // status tetap WAITING, menunggu Dept Head
        },
      });
      // Kirim notifikasi ke semua Dept Head
      await this.notificationService.notifyDeptHeads(approval);

    } else { // REJECT
      await this.prisma.approval.update({
        where: { id },
        data: {
          sectionHeadId: approverId,
          sectionStatus: 'REJECTED',
          sectionComment: comment,
          sectionAt: new Date(),
          status: 'REJECTED',
          finalStatus: 'REJECTED',
          finalComment: comment,
        },
      });
      // Kirim notifikasi "Revision Rejected" ke PIC
      await this.notificationService.notifyRevisionRejected(approval, comment);
    }

  } else if (approver.role === 'PE_DEPT_HEAD') {
    // Validasi: pastikan sectionStatus sudah APPROVED dulu
    if (approval.sectionStatus !== 'APPROVED') {
      throw new BadRequestException('Section Head belum menyetujui item ini');
    }

    if (action === 'APPROVE') {
      await this.prisma.approval.update({
        where: { id },
        data: {
          deptHeadId: approverId,
          deptStatus: 'APPROVED',
          deptComment: comment,
          deptAt: new Date(),
          status: 'APPROVED',
          finalStatus: 'APPROVED',
          finalComment: comment,
        },
      });
      // Kirim notifikasi "Revision Approved" ke PIC
      await this.notificationService.notifyRevisionApproved(approval);

    } else { // REJECT
      await this.prisma.approval.update({
        where: { id },
        data: {
          deptHeadId: approverId,
          deptStatus: 'REJECTED',
          deptComment: comment,
          deptAt: new Date(),
          status: 'REJECTED',
          finalStatus: 'REJECTED',
          finalComment: comment,
        },
      });
      await this.notificationService.notifyRevisionRejected(approval, comment);
    }
  }
}
```

### Checklist Implementasi — Fase 2 Backend

```
[ ] B2.1 — Approval Module
    [ ] Tambah model Approval ke schema.prisma (sudah ada di schema fase 1)
    [ ] Jalankan: npx prisma migrate dev --name add_approval (jika belum)
    [ ] Buat approval.module, approval.service, approval.controller
    [ ] Buat submit-approval.dto.ts (itemId, revisionNote, type)
    [ ] Buat process-approval.dto.ts (action: APPROVE/REJECT, comment: string)
    [ ] Validasi: comment wajib diisi saat action = REJECT

[ ] B2.2 — Endpoint Submit & List
    [ ] POST /approvals — submit dari PIC, auto-notifikasi ke Section Head
    [ ] GET /approvals — filter otomatis berdasarkan role user:
        · Section Head → tampilkan item dengan sectionStatus = WAITING
        · Dept Head → tampilkan item dengan sectionStatus = APPROVED & deptStatus = WAITING
    [ ] GET /approvals/my-submissions — list submission milik PIC yang login
    [ ] GET /approvals/:id — detail lengkap satu approval

[ ] B2.3 — Endpoint Approve & Reject
    [ ] PATCH /approvals/:id/approve
        [ ] Role guard: hanya PE_SECTION_HEAD atau PE_DEPT_HEAD
        [ ] Logic berjenjang (lihat business logic di atas)
        [ ] Kirim notifikasi yang sesuai
    [ ] PATCH /approvals/:id/reject
        [ ] Role guard: hanya PE_SECTION_HEAD atau PE_DEPT_HEAD
        [ ] Validasi: comment wajib ada (tidak boleh empty string)
        [ ] Kirim notifikasi "Revision Rejected" ke PIC

[ ] B2.4 — Notifikasi Approval
    [ ] notifyDeptHeads(approval) — kirim ke semua user Dept Head
    [ ] notifyRevisionApproved(approval) — kirim ke PIC submitter
    [ ] notifyRevisionRejected(approval, comment) — kirim ke PIC submitter
    [ ] Semua notifikasi tersimpan ke tabel Notification
```

---

## 📦 Seed Data dari Excel

```typescript
// prisma/seed.ts
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('../JIG & FIXTURE DESIGN MASTER LIST.xlsx');
  const sheet = workbook.getWorksheet('MASTER LIST');

  const items = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < 7) return; // skip header rows

    const lineProduct = row.getCell('B').value?.toString();
    if (!lineProduct) return;

    items.push({
      lineProduct,
      process: row.getCell('C').value?.toString() || '',
      type: row.getCell('D').value?.toString() || 'JF',
      noItemAssy: row.getCell('E').value?.toString() || '',
      assyPartName: row.getCell('F').value?.toString() || '',
      noReg: row.getCell('H').value?.toString() || '',
      qty: row.getCell('J').value?.toString() || '0',
      designDateLast: row.getCell('K').value instanceof Date ? row.getCell('K').value : null,
      designDateNew: row.getCell('L').value instanceof Date ? row.getCell('L').value : null,
      revStatus: row.getCell('M').value?.toString() || null,
      docLocation2D: row.getCell('N').value?.toString() || null,
      docLocation3D: row.getCell('O').value?.toString() || null,
      minimumStock: 0,
      actualStock: 0,
    });
  });

  // Upsert semua item berdasarkan noReg (idempotent)
  for (const item of items) {
    if (!item.noReg) continue;
    await prisma.jigFixtureItem.upsert({
      where: { noReg: item.noReg },
      update: item,
      create: item,
    });
  }

  console.log(`Seeded ${items.length} items.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

> **Catatan:** Jalankan seed dari direktori `backend/`:  
> `npx ts-node prisma/seed.ts`

---

## 📝 Catatan Backend

> [!IMPORTANT]
> **Urutan pengerjaan:** Backend dimulai **setelah frontend selesai**. Kontrak API di dokumen ini adalah panduan agar frontend sudah membuat `lib/api/` yang sesuai dengan mock data.

> [!WARNING]
> **Approval Berjenjang:** Section Head reject → langsung final REJECTED (Dept Head tidak perlu review). Dept Head hanya bisa review jika Section Head sudah APPROVED. Pastikan validasi ini ada di service.

> [!NOTE]
> **Gambar Visual Design (65 foto 3D):** Perlu hosting ke cloud storage (Supabase Storage / AWS S3). URL hasil upload disimpan ke kolom `newVisualDesign` di `JigFixtureItem`. Sebaiknya dikerjakan bersamaan saat backend fase 1.

> [!TIP]
> **Seed Script:** Gunakan `exceljs` untuk baca langsung dari file Excel. Seed bersifat idempotent (upsert by `noReg`) sehingga aman dijalankan berkali-kali.
