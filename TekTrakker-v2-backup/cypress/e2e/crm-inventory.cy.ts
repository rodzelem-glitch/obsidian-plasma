describe('CRM & Inventory Workflows', () => {
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

    it('should securely manage customers, link assets, and log inventory parts', () => {
        const uniqueTestId = Date.now().toString().slice(-6);
        const customerName = `CYPRESS ASSET CUSTOMER ${uniqueTestId}`;

        // ==========================================
        // 1. CRM: Create Customer
        // ==========================================
        cy.contains('nav a', 'Customer Center').click();
        cy.url().should('include', '/customers');
        
        cy.contains('button', 'Quick Add').click();
        cy.get('input[placeholder="Name *"]').type(customerName);
        cy.contains('button', 'Add Customer').click();
        
        // Wait for Quick Add to vanish
        cy.get('input[placeholder="Name *"]', { timeout: 10000 }).should('not.exist');
        
        // Ensure customer synced
        cy.contains(customerName, { timeout: 15000 }).should('be.visible');

        // Close the Patient/Customer Modal that pops up immediately
        cy.contains('button', '×').click({ force: true });

        // ==========================================
        // 2. CRM: Open Modal and Add Asset/Equipment
        // ==========================================
        // Click the customer in the table to open the modal
        cy.contains(customerName).click();
        cy.contains('h2', customerName, { timeout: 10000 }).should('be.visible');

        // Navigate to the Equipment Tab (It may be labeled 'Equipment' or 'Equipment & Assets')
        cy.contains('button', 'Equipment', { matchCase: false }).click();

        // Click Add Equipment
        cy.contains('button', 'Add Equipment').click();

        // Fill Asset Details
        cy.contains('label', 'Brand').parent().find('input').type('CYPRESS CORP');
        cy.contains('label', 'Model').parent().find('input').type(`CY-MOD-${uniqueTestId}`);
        cy.contains('label', 'Serial').parent().find('input').type(`SN-${uniqueTestId}`);
        
        // Hit Save
        cy.contains('button', 'Save Asset', { matchCase: false }).click();

        // Assert it saved properly into the table
        cy.contains('CYPRESS CORP', { timeout: 10000 }).should('be.visible');
        cy.contains(`CY-MOD-${uniqueTestId}`).should('be.visible');

        // Close the Customer Modal
        cy.contains('button', '×').click({ force: true });

        // ==========================================
        // 3. INVENTORY: Log a New Part
        // ==========================================
        cy.visit('/#/admin/records');
        cy.url().should('include', '/records');

        cy.contains('button', 'Add New Item').click();

        // Fill Inventory Form
        // We look for the inputs by label or placeholders based on Inventory.tsx
        cy.contains('label', 'Item Name').parent().find('input').type(`CYPRESS COMPRESSOR ${uniqueTestId}`);
        cy.contains('label', 'SKU').parent().find('input').type(`C-COMP-${uniqueTestId}`);
        cy.contains('label', 'Barcode').parent().find('input').type(`BC-${uniqueTestId}`);
        
        cy.contains('label', 'Quantity').parent().find('input').clear().type('45');
        cy.contains('label', 'Min Alert Qty').parent().find('input').clear().type('10');
        cy.contains('label', 'Unit Cost').parent().find('input').clear().type('150.00');
        cy.contains('label', 'Retail Price').parent().find('input').clear().type('499.99');

        // Save Inventory
        cy.contains('button', 'Save Inventory').click();

        // Wait to disappear
        cy.contains('Save Inventory').should('not.exist');

        // Search the newly added item to ensure it populated 
        cy.get('input[placeholder="Search Parts, SKU, or Barcode..."]').type(`C-COMP-${uniqueTestId}`);

        // Verify it is visible in the data table with correct quantities
        cy.contains(`CYPRESS COMPRESSOR ${uniqueTestId}`, { timeout: 10000 }).should('be.visible');
        cy.contains('45').should('be.visible'); 
        cy.contains('$499.99').should('be.visible');
    });
});
