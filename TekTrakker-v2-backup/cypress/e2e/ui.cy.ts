describe('Field Proposal UI', () => {
    beforeEach(() => {
        // Authenticate into interactive demo
        cy.visit('/');
        cy.contains('Free Interactive Demo').click();
        cy.contains('View as Technician').click();
        cy.url().should('include', '/briefing');
    });

    it('should be able to open the manual entry modal and verify fields', () => {
        // --- NAVIGATE TO ESTIMATOR HUB ---
        cy.contains('nav a', 'Estimator', { matchCase: false }).click();
        cy.url().should('include', '/briefing/proposal');
        
        cy.contains('New Proposal').should('be.visible');
        
        // Wait for customers to populate from demo context
        cy.get('select').find('option').should('have.length.greaterThan', 1);
        
        // Select the first customer from the dropdown safely using its actual value
        cy.get('select').find('option').eq(1).then($option => {
            cy.get('select').first().select($option.val() as string);
        });
        
        // Click Start Building
        cy.contains('button', 'Start Building').click();
        
        // Open Manual Entry mode
        cy.contains('button', 'Manual Entry').click();
        
        // Verify Manual Entry fields exist
        cy.get('input[placeholder="Service Description"]').should('be.visible');
        cy.get('select').last().should('be.visible'); // Type select (last select on page)
        cy.get('input[type="number"]').first().should('be.visible'); // Qty
    });
});
