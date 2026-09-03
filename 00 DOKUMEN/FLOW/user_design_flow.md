# 🖥️ User Design & Interaction Flow: Jig Fixture Management System

This document outlines the step-by-step User Experience (UX), layout designs, screen transition flows, and page behaviors of the **Jig Fixture Management System**. Use this document as a guide or prompt for Gemini Banana to implement the UI frontend, client-side routing, and UX behaviors.

---

## 🔑 1. Authentication Screen (`/login`)
The entry point of the application for all users.

### 🖼️ Layout & UI Components
- **Card-based container:** Centered layout with clean, modern branding.
- **Inputs:** Username/NPK field, password field (with show/hide eye toggle).
- **Submit Button:** "Sign In" with micro-animations and loading spinners during API validation.

### 🔄 Step-by-Step Flow
1.  **Entry:** User navigates to `/login`.
2.  **Input Verification:** Frontend performs schema verification (e.g., NPK must not be empty, password min length).
3.  **Authentication:** Click **Sign In** -> POST request to `/api/auth/login`.
4.  **Role Identification & Cookies:** Backend returns a JWT token. The frontend stores it and extracts the user's role from the token payload.
5.  **Redirect Routing:**
    -   If the role is valid, redirect to the Design Catalog page (`/design`).
    -   If login fails, render a toast notification: `"NPK atau Password salah."`

---

## 🧭 2. Global Navigation Layout (Shell)
Every page under the `(dashboard)` group inherits the shared global Shell layout containing:
-   **Sidebar (Vertical):** Navigation links to **Design Catalog**, **Inventory Management**, **Abnormality Log**, and **Approval Center** (visible only to Section/Dept Heads).
-   **Navbar (Horizontal):** Shows the current page title, the logged-in user's profile dropdown (Name, NPK, Logout button), and the **Notification Bell**.
-   **Notification Bell Component:**
    -   Renders a red badge indicating unread notifications count.
    -   Clicking the bell opens a floating popover showing the 5 most recent notifications.
    -   Clicking any notification item marks it as read and redirects the user to the corresponding item page (e.g., `/design/[id]` or `/approval-center/[id]`).

---

## 📁 3. Design Catalog Screen (`/design`)
Serves as the main workspace where users can browse, search, and manage Jig & Fixture CAD records.

### 🖼️ Layout & UI Components
-   **Header:** Title and description + "Request Revision" action button (visible only to `PE_JIG_FIXTURE` role).
-   **Filter & Search Bar:**
    -   Text search box (queries Reg No, Assy Part Name).
    -   Dropdown filters: **Production Line** (e.g., Auto Assy Steering Stem), **Process** (e.g., OP#1, OP#2), and **Type** (`JF` or `EQ`).
-   **Catalog Table / Grid:** Displays registration code, assembly name, line, process, revision status, and a "View Details" button.

### 🔄 Step-by-Step Flow
1.  User enters `/design`. The catalog initiates an API fetch for all designs, applying default line/process parameters.
2.  User adjusts filters. The component updates the URL search query parameters (e.g., `?line=steering_stem&process=OP10`), triggering a data refetch.
3.  User clicks **View Details** -> Navigates to `/design/[id]`.

---

## 🔍 4. Design Detail Screen (`/design/[id]`)
Provides in-depth file previews, revision audits, and administrative logs.

### 🖼️ Layout & UI Components
-   **Top Bar:** Back button to `/design` + edit action triggers.
-   **CAD Model Panel (StepViewer):**
    -   Embedded WebGL canvas using Three.js to preview the `.step`/`.stp` 3D file.
    -   Features controls for orbiting, wireframe mode toggle, and background brightness adjustments.
-   **Tabs Section:**
    -   **2D Drawing Tab:** Renders an embedded PDF reader/image viewer for 2D engineering sheets.
    -   **Revision History Tab:** Vertically stacked timeline of all revisions showing: Rev Code, Change Date, Description, PO Number, Cost, Lead Time, and Vendor Name.
    -   **Abnormalities Tab:** Displays a list of logged breakdowns/wear records specifically associated with this Jig.

---

## 📈 5. Inventory Management Screen (`/inventory` & `/inventory/[id]`)
Enables the PIC to monitor and update stock quantities, triggering system warnings.

### 🖼️ Layout & UI Components
-   **Overview Cards:** Grid of 3 summary cards showing total counts of **GREEN** (Good), **YELLOW** (Low Stock), and **RED** (Out of Stock) items.
-   **Status Indicator Badge:** Dynamic pills with a pulse animation for RED indicators.
-   **Edit Form (on `/inventory/[id]`):** Simple page containing inputs for `Minimum Stock` and `Actual Stock`.

### 🔄 Step-by-Step Flow
1.  User navigates to `/inventory`.
2.  User searches/filters for an item and clicks **Update Stock** -> Navigates to `/inventory/[id]`.
3.  User inputs new values in the **Minimum Stock** or **Actual Stock** fields.
4.  **Live Indicator Preview:** As the user types, the UI calculates and displays the preview indicator status (RED if Actual is 0, YELLOW if Actual < Min, GREEN if Actual >= Min).
5.  User clicks **Save Inventory**:
    -   If the change lowers stock to RED, a warning modal triggers: `"Stok Jig Kritis (0)! Kirim Notifikasi Warning ke Tim?"`.
    -   Saves changes via a PATCH call, logs changes in the database, and redirects back to `/inventory` with a success toast.

---

## 🛡️ 6. Approval Center Screen (`/approval-center` & `/approval-center/[id]`)
Facilitates multi-stage approvals for design revisions and inventory corrections.

### 🖼️ Layout & UI Components
-   **Approval Queue Table (`/approval-center`):** Displays pending approval requests. The rows displayed are dynamically filtered based on the active user role:
    -   `PE_SECTION_HEAD` sees items where `sectionStatus == WAITING`.
    -   `PE_DEPT_HEAD` sees items where `sectionStatus == APPROVED` and `deptStatus == WAITING`.
-   **Approval Timeline Component:** A vertical stepper tracking approval milestones (Submitted by PIC -> Reviewed by Section Head -> Finalized by Dept Head).
-   **Action Form (on `/approval-center/[id]`):** Bottom action panel with **Approve** (green) and **Reject** (red) buttons.
-   **Comment Modal:** Pop-up dialog triggered by both actions. If rejecting, a comment is **mandatory** (submit button remains disabled until text is typed).

### 🔄 Step-by-Step Flow
1.  Approver opens `/approval-center` and selects a pending request -> Navigates to `/approval-center/[id]`.
2.  Approver reviews the change request, checking the revision logs, note, or new drawings.
3.  Approver clicks **Reject**:
    -   System opens the Comment Modal.
    -   User types a rejection reason and submits.
    -   Frontend PATCHes approval status to `REJECTED`, marks final status as `REJECTED`, and redirects with a warning toast. The PIC is immediately notified.
4.  Approver clicks **Approve**:
    -   System opens the Comment Modal (comment is optional).
    -   User submits.
    -   Frontend updates the status to `APPROVED`.
    -   If Section Head approved, the workflow advances status to `Dept Head Review`.
    -   If Dept Head approved, the workflow concludes, final status changes to `APPROVED`, changes are permanently merged into the Design record, and a new revision history log is created.

---

## ⚠️ 7. Abnormality Management Screen (`/update-abnormality`)
Allows PICs to record wear, breakdowns, or structural issues on active jigs.

### 🖼️ Layout & UI Components
-   **Abnormality Form:**
    -   Dropdown for type (`RUSAK`, `AUS`, `DEFORMASI`, `LAINNYA`).
    -   Text inputs for Root Cause analysis, Temporary Action, and Permanent Corrective Action.
    -   PIC assignment field.
    -   Checkbox triggers: `linkToRevision` (requires a design drawing edit) and `linkToSpare` (requires ordering spare parts).
-   **Log Table:** Displays reported dates, breakdown type, current status, and resolution date.

### 🔄 Step-by-Step Flow
1.  PIC navigates to `/update-abnormality`.
2.  PIC fills out the abnormality report form, select the related Jig Registration No., and clicks **Submit**.
3.  Frontend posts data to `/api/abnormality`.
4.  If `linkToRevision` is checked, the frontend prompts: `"Buat pengajuan revisi desain sekarang?"` and redirects directly to `/design` with the edit draft loaded.
5.  To close an abnormality, the PIC edits the log, switches status to `CLOSED`, inputs the resolution date, and submits.
