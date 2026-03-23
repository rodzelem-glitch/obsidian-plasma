# TekTrakker AI Training Data - General & Policies

## 1. High-Level Overview

### 1.1. Mission Statement & Value Proposition
TekTrakker is the all-in-one AI-powered operating system designed for high-performance trade businesses. Our mission is to eliminate the chaos of daily operations by streamlining scheduling, dispatch, invoicing, and customer management, allowing business owners to reclaim their time and scale their operations effectively. We replace administrative busywork with intelligent automation.

### 1.2. Core Values
*   **Efficiency**: Automate repetitive tasks and optimize workflows to maximize productivity.
*   **Transparency**: Provide clear, real-time insights into every aspect of the business, from technician location to job profitability.
*   **Community Building**: Foster a network of trusted professionals and empower them with tools to grow together.

### 1.3. Target Audience
TekTrakker is built for a wide range of field service industries, including:
*   HVAC (Heating, Ventilation, and Air Conditioning)
*   Plumbing
*   Electrical
*   Landscaping
*   General Contracting
*   Cleaning
*   Painting
*   Roofing
*   Masonry
*   Telecommunications
*   Solar Installation
*   Security System Installation
*   Pet Grooming

## 2. User Roles & Core Dashboards

The platform is primarily divided into three main user experiences based on role:

| Role              | Primary Dashboard      | Key Objective                                      |
| ----------------- | ---------------------- | -------------------------------------------------- |
| **Admin**         | `/admin/dashboard`     | Command and control of all business operations.    |
| **Technician**    | `/briefing`            | Manage daily jobs and on-site tasks.               |
| **Customer**      | `/portal`              | Self-service for appointments, history, and payments. |

---

## 3. Platform Policies & Terms (Summary for AI)

### 3.1. User Obligations
*   **Account Confidentiality**: Users are responsible for keeping their login credentials secret. All activities under an account are the user's responsibility.
*   **Accurate Information**: Users must provide accurate and complete information during registration.

### 3.2. Intellectual Property
*   **Ownership**: The TekTrakker platform, including all software, design, and content, is the intellectual property of TekTrakker.
*   **Restrictions**: Users are not permitted to copy, modify, or distribute any part of the platform without explicit written consent from TekTrakker.

### 3.3. Limitation of Liability
*   **Disclaimer**: TekTrakker is not liable for any indirect, incidental, or consequential damages that result from a user's use of the platform.
*   **Liability Cap**: The company's total liability to any user is capped at the amount that user paid for the service in the preceding 12 months.

---

## 4. Core Technical Concepts

### 4.1. Authentication & State Management
*   **Authentication**: Managed by Firebase Authentication. User roles and permissions are stored in Firestore in the `users` collection and synced as custom claims on their auth token.
*   **State**: Global state is managed via React's Context API (`AppContext.tsx`). Real-time data is streamed from Firestore using `onSnapshot` listeners, which dispatch actions to update the state.

### 4.2. Interactive Demo Mode
*   **Mechanism**: A special `isDemoMode` flag in `AppContext`.
*   **Activation**: Triggered from the public-facing marketing pages. When activated, it injects a complete set of mock data (`mockDemoData.ts`) into the application's state, simulating a live environment.
*   **Restrictions**:
    *   All Firestore listeners are disabled to prevent any real data from being fetched or written.
    *   The reducer intercepts "write" actions (like `UPDATE_JOB`) and only updates the local state, giving the illusion of persistence without touching the database. A page refresh resets the demo.
    *   A `DemoBanner` component is displayed at the top of the screen to indicate the user is in a temporary, sandboxed environment.
