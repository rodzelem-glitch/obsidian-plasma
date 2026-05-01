import { User } from '../../src/types';

describe('HR & Communications Workflows', () => {
    const uniqueTestId = Date.now().toString().slice(-4);
    const testEmployeeFirstName = `Alice-${uniqueTestId}`;
    const testEmployeeLastName = `Worker`;
    const testEmployeeEmail = `alice${uniqueTestId}@tektrakker.com`;
    const testMessageString = `CYPRESS_MSG_${uniqueTestId}`;

    beforeEach(() => {
        // Start from a clean, unauthenticated state
        cy.clearAllLocalStorage();
        cy.clearAllSessionStorage();
        cy.clearCookies();
        cy.window().then((win) => {
            win.indexedDB.deleteDatabase('firebaseLocalStorageDb');
        });

        // Ensure we handle uncaught exceptions without failing if harmless
        Cypress.on('uncaught:exception', (err, runnable) => false);

        // Login securely
        cy.visit('/#/login');
        cy.contains('Email Address', { timeout: 15000 }).should('be.visible');
        
        cy.get('input[type="email"]').type(Cypress.env('TEST_EMAIL') || 'cypress-admin@tektrakker.com');
        cy.get('input[type="password"]').type(Cypress.env('TEST_PASSWORD') || 'password123');
        cy.contains('button', 'Sign In', { matchCase: false }).click();

        // Ensure dashboard actually loads
        cy.url({ timeout: 15000 }).should('include', '/admin');
    });

    it('should securely manage workforce, post chat messages, and search the training hub', () => {
        // ==========================================
        // 1. HR: Workforce / Identity Access
        // ==========================================
        cy.visit('/#/admin/workforce');
        cy.url().should('include', '/workforce');

        // Add Employee
        cy.contains('button', 'Add Employee', { matchCase: false }).click({ force: true });
        
        // Modal Input logic -- wait for the exact 'New Employee' title 
        cy.contains('New Employee', { matchCase: false }).should('be.visible');

        cy.contains('label', 'First Name').parent().find('input').type(testEmployeeFirstName);
        cy.contains('label', 'Last Name').parent().find('input').type(testEmployeeLastName);
        cy.contains('label', 'Email Address').parent().find('input').type(testEmployeeEmail);

        cy.contains('button', 'Save Profile', { matchCase: false }).click({ force: true });
        
        // Assert creation by seeing it in the list
        cy.contains(testEmployeeFirstName).should('be.visible');

        // ==========================================
        // 2. COMMS: Internal Messaging
        // ==========================================
        cy.visit('/#/admin/messages');
        cy.url().should('include', '/messages');

        // We assume the broadcast channel or team list is loaded
        cy.get('input[placeholder="Type a message..."]').should('be.visible').type(testMessageString);
        cy.get('button[type="submit"]').click({ force: true });

        // Verify the message populates
        cy.contains(testMessageString).should('be.visible');

        // ==========================================
        // 3. TRAINING: Search the Video Hub
        // ==========================================
        cy.visit('/#/admin/training');
        cy.url().should('include', '/training');

        cy.get('input[placeholder="How do I dispatch a job?..."]').should('be.visible').type("Dispatch");
        
        // Verify Video / Semantic Search renders the correct module (e.g. Dispatch Module)
        cy.contains('Dispatch', { matchCase: false }).should('be.visible');
    });
});
