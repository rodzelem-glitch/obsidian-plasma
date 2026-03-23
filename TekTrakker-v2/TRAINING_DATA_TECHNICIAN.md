# TekTrakker AI Training Data - Technician Role

This document details the features and capabilities available to the **Technician** (employee) user role.

## 1. Technician Role Overview
*   **Primary Dashboard**: `/briefing`
*   **Key Objective**: To efficiently manage and execute daily jobs, document work, and handle on-site customer interactions. The interface is mobile-first.

---

## 2. Feature Deep Dive: Technician Capabilities

### 2.1. Daily Briefing (`/briefing`)
*   **Purpose**: The technician's main dashboard, showing all assigned jobs for the day in chronological order.
*   **Key Information**: Each job card displays the customer name, address, job status, and a list of tasks.

### 2.2. The Job Workflow (`JobWorkflowModal.tsx`)
This is the core of the technician experience. It's a step-by-step modal that guides the tech through a job from start to finish, ensuring all required steps are completed and documented.

*   **Step 1: Arrival**
    *   **Purpose**: To prepare for the job upon arrival.
    *   **Actions**:
        *   Confirm customer contact details (email, phone).
        *   Review any existing equipment assets on file for the customer.
        *   Log initial arrival notes.

*   **Step 2: Diagnosis**
    *   **Purpose**: To investigate the issue and document findings.
    *   **Actions**:
        *   Complete any required safety waivers or diagnostic checklists assigned by the admin.
        *   Take and upload photos of the problem area or equipment.
        *   Write pre-repair notes.
        *   **Launch AI Proposal Generator**: If a quote is needed, the technician can enter the problem description here to generate a "Good, Better, Best" proposal on the spot.

*   **Step 3: Repair**
    *   **Purpose**: To perform and document the actual work.
    *   **Actions**:
        *   Log detailed work notes.
        *   Take and upload photos of the completed repair.
        *   **Launch Live AI Supervisor**: If the technician is stuck, they can open a voice-activated AI assistant to get master-level technical advice and troubleshooting steps.

*   **Step 4: Quality Control**
    *   **Purpose**: To verify the work was completed correctly and gather feedback.
    *   **Actions**:
        *   Complete any required post-work quality checklists.
        *   Write job completion notes.
        *   (Optional) Record customer feedback.

*   **Step 5: Billing**
    *   **Purpose**: To finalize the job and collect payment.
    *   **Actions**:
        *   Open the Invoice Editor to add final parts or labor.
        *   Collect the customer's signature directly on the device.
        *   Process credit card payments or record other payment types.
        *   Mark the job as complete and "Leave Site," which stops the job timer.

### 2.3. How-To Guide for Technicians

*   **How-To: Complete a Standard Service Call**:
    1.  Log in to the app to view your `Daily Briefing`.
    2.  Tap the first job on your schedule to open the Job Workflow.
    3.  Follow the on-screen steps from Arrival to Diagnosis.
    4.  If a quote is needed, use the "Build Proposal" button in the Diagnosis step to generate options for the customer.
    5.  Once approved, complete the work and document it in the Repair step. Use the "Live Assist" button if you need technical help.
    6.  In the Quality Control step, complete any final checklists.
    7.  In the Billing step, present the final invoice to the customer, capture their signature, and process payment.
    8.  Tap "Leave Site" to clock out of the job. Your schedule will automatically update.

*   **Troubleshooting**:
    *   **Problem**: I can't find a required checklist.
    *   **Solution**: In the Diagnosis or Quality Control step, tap the "Import Checklist" button to see if the checklist can be added manually from the company's templates. If not, contact your office manager to have it assigned to the job.
