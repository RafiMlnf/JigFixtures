-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PE_JIG_FIXTURE', 'PE_SECTION_HEAD', 'PE_DEPT_HEAD', 'TAMU');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('DESIGN_REVISION', 'INVENTORY_UPDATE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('WAITING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JigFixtureItem" (
    "id" TEXT NOT NULL,
    "no" INTEGER,
    "lineProduct" TEXT NOT NULL,
    "process" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "noItemAssy" TEXT NOT NULL,
    "assyPartName" TEXT NOT NULL,
    "noReg" TEXT NOT NULL,
    "qty" TEXT NOT NULL,
    "designDateLast" TIMESTAMP(3),
    "designDateNew" TIMESTAMP(3),
    "revStatus" TEXT,
    "docLocation2D" TEXT,
    "docLocation3D" TEXT,
    "newVisualDesign" TEXT,
    "minimumStock" INTEGER NOT NULL DEFAULT 0,
    "actualStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JigFixtureItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLog" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "prevMinStock" INTEGER NOT NULL,
    "newMinStock" INTEGER NOT NULL,
    "prevActStock" INTEGER NOT NULL,
    "newActStock" INTEGER NOT NULL,
    "indicator" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "itemId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'WAITING',
    "itemId" TEXT NOT NULL,
    "revisionNote" TEXT,
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sectionHeadId" TEXT,
    "sectionStatus" "ApprovalStatus" NOT NULL DEFAULT 'WAITING',
    "sectionComment" TEXT,
    "sectionAt" TIMESTAMP(3),
    "deptHeadId" TEXT,
    "deptStatus" "ApprovalStatus" NOT NULL DEFAULT 'WAITING',
    "deptComment" TEXT,
    "deptAt" TIMESTAMP(3),
    "finalStatus" "ApprovalStatus" NOT NULL DEFAULT 'WAITING',
    "finalComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "JigFixtureItem_noReg_key" ON "JigFixtureItem"("noReg");

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "JigFixtureItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "JigFixtureItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "JigFixtureItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_sectionHeadId_fkey" FOREIGN KEY ("sectionHeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_deptHeadId_fkey" FOREIGN KEY ("deptHeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
