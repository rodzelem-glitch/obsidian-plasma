# TekTrakker Master TODO List

## Epics & Feature Requests

### 1. TekTrakker Contractor Bid Network (Internal RFP / Notice Board) ✅

**Description:** A whole sub-section of the platform where contractors can put up notices to request bids by other contractors or subcontractors.

**Key Requirements:**

- [x] **Notice Board:** Organizations active on TekTrakker can apply to the bids.
- [x] **Bid Helper Integration:** Users can apply directly from the Bid Helper Tool by linking the `noticeID`.
- [x] **Direct Notification:** The RFP originator can directly notify the winning organization through TekTrakker.
- [x] **Subcontractor Linking:** The winning organization is automatically linked in the originator's "Subcontractors" section.
- [x] **Project Linking:** Optionally, the winner is automatically added to the specific Project.
- [x] **Objective:** Provide a native, easily managed tool for users to find help and work.

### 2. AI Omni-Channel Preview Board

**Description:** A feature to visually inspect and format content for different social networks before publishing.

- [x] **6-Platform Preview Carousel:** Facebook, Instagram, TikTok, LinkedIn, X, Google Business — all with editable per-platform textareas.
- [x] **Safe Zone Overlays:** Visual guides for TikTok caption danger zones and IG tag areas.
- [x] **Backend Federation:** Cloud functions deployed for all platforms (`postToX`, `publishToGoogleBusiness`, `publishToTikTok`, `publishToLinkedIn`).
- [x] **OAuth Callback Handler:** `/auth/callback` route handles TikTok and LinkedIn token exchange.

### 2.1. Social Platform API Readiness Tracker

| Platform | Code Ready | API Status |
|---|---|---|
| Facebook | ✅ | ✅ Live (Graph API) |
| Instagram | ✅ | ✅ Live (via FB bridge) |
| Google Business | ✅ | ✅ Live |
| TikTok | ✅ | ⏳ Awaiting API approval |
| LinkedIn | ✅ | ⏳ Awaiting API approval |
| X (Twitter) | ✅ | ⏳ Needs payment method |

### 3. ServiceTitan-Level Integrations Marketplace

**Description:** Research and implement the 70+ third-party integrations that ServiceTitan currently supports for their platform to achieve feature-parity in the ecosystem.

**Key Requirements:**

- [x] **Research Phase:** Complete audit of 54 integrations (BYOK + Partnership). *(See integrations_wiring_audit.md)*
- [x] **Marketplace UI:** Self-service marketplace with filtering/sorting and partnership locking.
- [x] **Backend Implementation:**
  - [x] **Tier 1 (BYOK):** Mailchimp, Review Requests (Podium/Broadly/Birdeye), CallRail, Hearth Webhooks wired.
  - [x] **Tier 2 (BYOK):** HubSpot, Google Ads (Attribution Wired ✅), CompanyCam, Fleet GPS polling.
  - [x] **Tier 3 (BYOK):** Domo, Power BI, Shopify, ERP Sync (Acumatica/NetSuite).
  - [ ] **Tier 4 (Partnership):** Ongoing partnership applications for 28 providers.

### 4. Consumer-Facing Hosted Profiles & SEO Widgets

**Description:** Provide organizations with hosted consumer-facing web profiles and embeddable widgets that funnel SEO authority and traffic back to the TekTrakker ecosystem.

**Key Requirements:**

- [x] **Hosted Subdomains:** Organizations can host a profile/blog directly on TekTrakker infrastructure (e.g., `tektrakker.com/site/orgId`). (Hosted Profile & Blog integrated)
- [x] **Widgets / Embeds:** Provide iframe or JS widgets that organizations can embed on their own websites, with links pointing back to TekTrakker to build platform authority. (Blog widget completed)
- [x] **Content Management:** Everything is managed natively within the TekTrakker Social Hub. (Blog Manager completed)
- [ ] **Target Audience:** Homeowners, businesses (customers and sellers), franchises, and everyone in the line.
