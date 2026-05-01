describe('Billing Gate Access Controls', () => {

    before(() => {
        // Ensure we always start from a clean, active state in case a previous run crashed
        cy.exec('node cypress/scripts/restore.mjs');
    });

    after(() => {
        // Always immediately restore the org at the end to prevent side effects on other tests
        cy.exec('node cypress/scripts/restore.mjs');
    });

    it('should completely block non-admin users from accessing the system when suspended', () => {
        // First, suspend the dummy organization
        cy.exec('node cypress/scripts/suspend.mjs');

        // Clear Persistence
        cy.clearAllLocalStorage();
        cy.clearAllSessionStorage();
        cy.clearCookies();
        cy.window().then((win) => win.indexedDB.deleteDatabase('firebaseLocalStorageDb'));

        // Visit Login
        cy.visit('/#/login');
        cy.contains('Email Address', { timeout: 15000 }).should('be.visible');

        // Login as the Cypress Tech User (Non-Admin)
        cy.get('input[type="email"]').type(Cypress.env('TECH_EMAIL') || 'cypress-tech@tektrakker.com');
        cy.get('input[type="password"]').type(Cypress.env('TEST_PASSWORD') || 'password123');
        cy.contains('button', 'Sign In', { matchCase: false }).click();

        // Should NOT land in Briefing, should hit the Billing Gate blocked screen
        cy.contains('Access Suspended', { timeout: 15000 }).should('be.visible');
        
        // Assert we see the correct prompt telling them to contact admin
        cy.contains('Please contact your administrator').should('be.visible');
        
        // Make sure there is NO escape hatch button
        cy.contains('View Billing Settings').should('not.exist');
    });

    it('should block admin users from the dashboard but grant them an escape hatch', () => {
        // Clear Persistence
        cy.clearAllLocalStorage();
        cy.clearAllSessionStorage();
        cy.clearCookies();
        cy.window().then((win) => win.indexedDB.deleteDatabase('firebaseLocalStorageDb'));

        // Visit Login
        cy.visit('/#/login');
        cy.contains('Email Address', { timeout: 15000 }).should('be.visible');

        // Login as the Cypress Admin User
        cy.get('input[type="email"]').type(Cypress.env('TEST_EMAIL') || 'cypress-admin@tektrakker.com');
        cy.get('input[type="password"]').type(Cypress.env('TEST_PASSWORD') || 'password123');
        cy.contains('button', 'Sign In', { matchCase: false }).click();

        // Should see the suspended gate
        cy.contains('Access Suspended', { timeout: 15000 }).should('be.visible');

        // Note: Admin gets differing verbage
        cy.contains('Please update your billing preferences').should('be.visible');

        // Click the escape hatch
        cy.contains('button', 'View Billing Settings').click();

        // Verify we securely bypassed the gate but ONLY into the Settings
        cy.url().should('include', '/admin/settings');
        
        // Verify Settings UI loaded
        cy.contains('Company Settings').should('be.visible');

        // Ensure we CANNOT magically circumvent the block via Navigation
        cy.visit('/#/admin');
        cy.contains('Access Suspended', { timeout: 10000 }).should('be.visible');
    });
});
