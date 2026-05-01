describe('Public Portals & Gateways', () => {

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
    });

    it('should successfully book an appointment via the public unauthenticated widget', () => {
        const uniqueTestId = Date.now().toString().slice(-4);
        const testName = `CYPRESS CUSTOMER ${uniqueTestId}`;

        // ==========================================
        // 1. PUBLIC PORTAL: Booking Gateway
        // ==========================================
        cy.visit('/#/book');
        cy.url().should('include', '/book');

        // Form checks natively available in the PublicBookingPage
        cy.contains('h1', 'Find a Pro').should('be.visible');

        // Fill out standard customer details
        cy.contains('label', 'Name').parent().find('input').type(testName);
        cy.contains('label', 'Phone').parent().find('input').type(`555-019-${uniqueTestId}`);
        cy.contains('label', 'Email').parent().find('input').type(`booking${uniqueTestId}@tektrakker.com`);
        cy.contains('label', 'Service Address').parent().find('input').type('123 Cypress Automation Way');

        // Update trade & services
        cy.contains('label', 'Trade Needed').parent().find('select').select('HVAC');
        cy.contains('label', 'Service Type').parent().find('select').select('Installation');

        // Set date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextDate = tomorrow.toISOString().split('T')[0];
        cy.contains('label', 'Preferred Date').parent().find('input').type(nextDate);

        // Click no on 'Are you the property owner?'
        cy.contains('label', 'No').click();

        // Fill dynamic fields mapped conditionally
        cy.contains('label', 'Owner\'s Name').parent().find('input').type(`Owner ${testName}`);
        cy.contains('label', 'Owner\'s Phone').parent().find('input').type(`555-999-${uniqueTestId}`);

        cy.contains('label', 'Notes / Issues').parent().find('textarea').type('Automated Cypress Test Payload for dynamic injection checks.');

        // Consent Checkbox
        cy.get('input[type="checkbox"]').check();

        // Hit capture route
        cy.contains('button', 'Request Appointment').click();

        cy.get('body').then($body => {
            cy.log('BODY_PAYLOAD_BOOKING: ' + $body.text());
        });

        // System feedback assert
        cy.contains('Booking Received!', { timeout: 8000 }).should('be.visible');
    });

    it('should safely bounce invalid external document accesses', () => {
        // ==========================================
        // 2. EXTERNAL GATEWAYS: Security & Load checks
        // ==========================================
        cy.visit('/#/invoice/baddoc123123');
        cy.get('body', { timeout: 10000 }).then($body => {
            cy.writeFile('cypress_debug_invoice.txt', $body.text());
        });
        cy.contains('Invoice record not found.', { matchCase: false, timeout: 5000 }).should('be.visible');

        cy.visit('/#/proposal-view/baddoc123123');
        cy.get('body', { timeout: 10000 }).then($body => {
            cy.writeFile('cypress_debug_proposal.txt', $body.text());
        });
        cy.contains('Proposal not found.', { matchCase: false, timeout: 5000 }).should('be.visible');
    });

});
