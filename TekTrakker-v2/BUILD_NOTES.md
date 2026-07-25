# Build Notes - Version 8.21 (Build 92)
**Date:** June 9, 2026

This release brings enhancements to the technician asset hierarchy alignment, dynamic form configurations, and live-sync behaviors between admin scheduling and mobile briefing dashboards.

---

## 🚀 Key Improvements & Features

### 1. Unified Asset Form & Admin Parity (Technician Briefing)
- **Dynamic Asset Types:** Replaced the hardcoded asset type options in the technician's briefing modal with dynamic, organization-level industry options (e.g. HVAC: Furnaces, Chillers, Condensers, Split Systems; Plumbing: Tankless Water Heaters, Sump Pumps, etc.).
- **Unit Technical Specifications:** Technicians can now capture technical data directly in the field. Added fields for:
  - **Year of Manufacture** (`year`)
  - **Tonnage / Capacity** (`tonnage`)
  - **Refrigerant Type** (`refrigerantType`, e.g. R410A, R22, R454B)
  - **Heat Type** (`heatType`, e.g. Gas, Electric, Heat Pump)
  - **Electricity Specs** (`electricityType`, e.g. 230V / 1ph)
- **Legacy Equipment Linkages:** Enabled the checklist to select and link native equipment components together directly from the mobile briefing interface.

### 2. Upgraded Field Dashboard Visualization
- Updated the **Equipment On Site** list cards to display the newly integrated technical specifications (Year, Tons, Refrigerant, Heat, and Elec type) directly on the summary cards, eliminating the need to drill down into each asset to view specs.

### 3. Bidirectional Customer Profile Live-Sync
- Automated sync so editing customer details (Email, Phone, Name, Address) from either the **Customer Master Modal** or the **Tech Job Briefing** propagates changes instantly across:
  - All active, scheduled, and uncompleted jobs.
  - Admin Dispatch Boards, Job List Tables, and Timeline blocks.
  - Technician Dashboard widgets.

---

## 🛠️ Build & Deployment Details

- **React App Production Bundle:** Built successfully with `vite build`.
- **Hosting Deployment:** Deployed successfully to Firebase Hosting (Production URL: https://tektrakker.web.app).
- **Mobile Assets Sync:** Synchronized all finalized web assets to the native platforms using `npx cap sync`.
- **Android App Bundle:** Compiled successfully using Gradle release scripts:
  - **Target File:** `android/app/build/outputs/bundle/release/app-release.aab`
  - **Version Code:** `92`
  - **Version Name:** `"8.21"`
