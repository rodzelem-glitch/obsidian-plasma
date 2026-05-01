describe('Field Employee Workflows', () => {
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
        
        // Wait for Firebase to finish loading and the Login form to appear
        cy.contains('Email Address', { timeout: 15000 }).should('be.visible');
        
        // Login as the Cypress Tech User
        cy.get('input[type="email"]').type(Cypress.env('TECH_EMAIL') || 'cypress-tech@tektrakker.com');
        cy.get('input[type="password"]').type(Cypress.env('TEST_PASSWORD') || 'password123');
        cy.contains('button', 'Sign In', { matchCase: false }).click();

        // Ensure we hit the specific Employee Portal Route (Briefing)
        // Wait a little extra because the user context setup takes a moment
        cy.url({ timeout: 15000 }).should('include', '/briefing');
    });

    it('should successfully navigate and execute field technician interactions', () => {
        // --- 1. DAILY BRIEFING ---
        // Ensure the landing page loads successfully for the tech
        cy.contains('Hello, Cypress').should('be.visible');
        
        // --- 2. TIME & MILEAGE LOGGING ---
        // Click the Time Log icon on the Bottom Navigation
        cy.contains('nav a', 'Time Log', { matchCase: false }).click();
        cy.url().should('include', '/briefing/timelog');

        // Check if Time Logging UI rendered
        cy.contains('Time & Vehicle Logs').should('be.visible');
        
        // Verify 'Clock In' button is rendered inside the Time Log page
        cy.contains('button', 'Clock In').should('be.visible');
        
        // We will Clock In!
        cy.window().then((win) => {
            cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((cb) => {
                return cb({ coords: { latitude: 35.0, longitude: -80.0, accuracy: 5 }, timestamp: Date.now() });
            });
        });
        cy.contains('button', 'Clock In').click();
        cy.contains('Clocked In!', { timeout: 15000 }).should('be.visible');

        // --- 3. ESTIMATOR (PROPOSAL) HUB ---
        cy.contains('nav a', 'Estimator', { matchCase: false }).click();
        cy.url().should('include', '/briefing/proposal');
        
        cy.contains('New Proposal').should('be.visible');
        
        // Select the first customer from the dropdown
        cy.get('select').select(1); // Selects the second option (which is the first real customer, skipping "-- Choose Customer --")
        
        // Click Start Building ->
        cy.contains('button', 'Start Building').click();
        
        // Ensure Step 2 UI loads
        cy.contains('Manual Entry').should('be.visible');
        
        // Open Manual Entry mode
        cy.contains('button', 'Manual Entry').click();
        
        // Ensure manual entry UI functions
        cy.contains('button', 'Add').should('be.visible'); 
    });
});
