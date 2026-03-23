# TekTrakker AI Training Data - Admin Role

This document details the features and capabilities available to the **Admin** user role.

## 1. Admin Role Overview
*   **Primary Dashboard**: `/admin/dashboard`
*   **Key Objective**: To have complete command and control over all business operations, from scheduling and dispatch to financial tracking and customer management.

---

## 2. Feature Deep Dive: Admin Capabilities

### 2.1. Operations View (`/admin/operations`)
This is the central hub for daily job management.

*   **Dispatch Board (`DispatchBoard.tsx`)**
    *   **Purpose**: A visual, calendar-based overview of all scheduled and ongoing jobs.
    *   **Capabilities**:
        *   View jobs organized by day, week, or month.
        *   See which technician is assigned to each job.
        *   Drag and drop jobs to reschedule them or reassign them to different technicians.
        *   Click on a job event to open a modal with detailed job information.
        *   Quickly identify unassigned jobs.
    *   **How-To: Reschedule a Job**:
        1.  Navigate to the Operations page.
        2.  Find the job on the Dispatch Board calendar.
        3.  Click and drag the job to a new date or time slot.
        4.  Confirm the change. The technician will be notified automatically.

*   **Job List (`JobScheduling.tsx`)**
    *   **Purpose**: A detailed, list-based view of all active jobs.
    *   **Capabilities**:
        *   View a table of all jobs that are not yet "Completed" and "Paid".
        *   Filter the job list by the assigned technician.
        *   **On-the-fly Editing**: Admins can directly edit the `Appointment Time`, `Job Status`, and `Assigned Technician` from the table view.
        *   **Actions Menu**:
            *   **SMS Customer**: Opens a modal to send a pre-filled or custom text message to the customer (e.g., appointment confirmation).
            *   **Internal Notes**: Opens a modal to add or edit office-only notes for a job, visible to the assigned technician.
            *   **Documents & Checklists**: Opens a modal to attach required waivers or checklists (e.g., "Pre-Work Safety Checklist") to a job for the technician to complete.
            *   **Delete Job**: Permanently removes a job record.
    *   **Troubleshooting**:
        *   **Problem**: A technician doesn't appear in the "Assigned Technician" dropdown.
        *   **Solution**: Go to "Employee Management" and ensure the user's role is set to 'employee' or 'supervisor'.

### 2.2. Financials (`/admin/financials`)
*   **Purpose**: To track revenue, expenses, and overall profitability.
*   **Capabilities**:
    *   View a financial overview with key metrics (Total Revenue, Net Profit, Average Job Value).
    *   Manage and review all invoices.
    *   Log and categorize business expenses.
    *   View a Profit & Loss (P&L) statement for a selected date range.

### 2.3. Customer Management (`/admin/customers`)
*   **Purpose**: A complete CRM for all clients.
*   **Capabilities**:
    *   Search for customers by name, phone, or address.
    *   View a customer's complete service history, including all past jobs, invoices, and proposals.
    *   View and manage customer equipment (e.g., air conditioners, water heaters).
    *   Store important documents and photos related to a customer's property.
    *   Manage customer membership plans and service agreements.

### 2.4. AI-Powered Tools
*   **AI Diagnostics (Live Supervisor)**: In `LiveAssistModal.tsx`, an admin or technician can use a voice-activated AI to get real-time technical advice. The system uses a specialized prompt to act as a "master field technician coach".
    *   **How-To: Get AI Help**:
        1.  From the Technician's `Daily Briefing` workflow, open the "Live Assist" modal.
        2.  Click the microphone button and ask a technical question (e.g., "What are the common causes for a U4 error on a Daikin VRF system?").
        3.  The AI will respond with concise, actionable steps. The response can be read aloud.
*   **AI Field Proposals (`FieldProposal.tsx`)**: Technicians in the field can generate multi-option quotes instantly.
    *   **How-To: Create an AI Proposal**:
        1.  The technician enters a description of the problem (e.g., "AC unit not cooling, capacitor is bulging").
        2.  The system uses a generative AI model to create "Good," "Better," and "Best" repair options, pulling prices from pre-configured industry pricebooks.
        3.  The technician presents the options to the customer for on-site approval and signature capture.
