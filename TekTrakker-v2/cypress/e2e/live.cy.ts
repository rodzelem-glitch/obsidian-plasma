describe('Live Database Workflows', () => {
    beforeEach(() => {
        // Clear Firebase Authentication Persistence so we start logged out
        cy.clearAllLocalStorage();
        cy.clearAllSessionStorage();
        cy.clearCookies();
        cy.window().then((win) => {
            win.indexedDB.deleteDatabase('firebaseLocalStorageDb');
        });

        // Here, the robot hits the actual physical login portal.
        cy.visit('/#/login');
        
        // Wait for Firebase to finish loading and the Login form to appear (bypass LoadingSpinner)
        cy.contains('Email Address', { timeout: 15000 }).should('be.visible');
        
        // Ensure you set these values in your cypress.env.json file!
        // It types real credentials instead of hitting the interactive demo
        cy.get('input[type="email"]').type(Cypress.env('TEST_EMAIL') || 'cypress-admin@tektrakker.com');
        cy.get('input[type="password"]').type(Cypress.env('TEST_PASSWORD') || 'password123');
        cy.contains('button', 'Sign In', { matchCase: false }).click();

        // Ensure we hit the real dashboard
        cy.url({ timeout: 10000 }).should('include', '/admin');
    });

    it('should successfully create and book a Job into the real Firestore Database', () => {
        // --- 1. CREATE A DUMMY CUSTOMER FIRST ---
        cy.contains('nav a', 'Customer Center').click();
        cy.url().should('include', '/customers');
        
        cy.contains('button', 'Quick Add').click();
        cy.get('input[placeholder="Name *"]').type('CYPRESS AUTOMATED TEST CUSTOMER');
        cy.contains('button', 'Add Customer').click();
        
        // Wait for Quick Add inputs to vanish (successful save)
        cy.get('input[placeholder="Name *"]', { timeout: 15000 }).should('not.exist');
        
        // Ensure the customer actually synced to the state
        cy.contains('CYPRESS AUTOMATED TEST CUSTOMER', { timeout: 10000 }).should('be.visible');

        // Close the Patient/Customer Modal that pops up aggressively after creation
        cy.contains('button', '×').click();

        // --- 2. BOOK A JOB ---
        // Navigate via sidebar to Operations 
        cy.contains('nav a', 'Operations').click({ force: true });
        cy.url().should('include', '/operations');
        
        // Click + Book
        cy.contains('button', '+ Book').click();
        
        // Fill out Job Appointment Modal Customer Dropdown
        cy.get('input[placeholder="Search..."]').type('CYPRESS AUTOMATED TEST CUSTOMER');
        
        // Wait for dropdown suggestion and click the customer
        cy.contains('.absolute', 'CYPRESS AUTOMATED TEST CUSTOMER').click();
        
        // Wait for the technicians to populate in the dropdown
        cy.contains('label', 'Lead Tech').parent().find('select').find('option').should('have.length.greaterThan', 1);
        
        // Select Technician dynamically without relying on brittle text searches
        cy.contains('label', 'Lead Tech').parent().find('select').then($select => {
            const val = $select.find('option').eq(1).val();
            cy.wrap($select).select(val as string);
        });

        // Add Notes
        cy.get('textarea').type('THIS IS AN AUTOMATED TEST JOB SUBMISSION BY CYPRESS');
        
        // Hit Dispatch
        cy.contains('button', 'Dispatch!').click();
        
        // Verify it was successfully written and closed the modal by looking for it on the Dispatch Board
        // Search inside the Desktop 'md:flex' wrapper because Cypress will otherwise match the hidden mobile element first
        cy.get('.md\\:flex').contains('CYPRESS AUTOMATED TEST CUSTOMER', { timeout: 15000 }).should('be.visible');
    });
});
