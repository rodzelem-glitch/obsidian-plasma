describe('Authentication Flow', () => {
  it('should load the landing page successfully', () => {
    cy.visit('/');
    cy.contains('Stop Being a Slave to').should('be.visible');
  });

  it('should be able to log in using the Interactive Demo mode as Admin', () => {
    cy.visit('/');
    
    // Click Interactive Demo
    cy.contains('Free Interactive Demo').click();
    
    // Select Admin role
    cy.contains('View as Admin').click();
    
    // Verify we land on the dashboard
    cy.url().should('include', '/admin');
    cy.contains('Admin Dashboard').should('be.visible');
  });

  it('should be able to log in using the Interactive Demo mode as Field Technician', () => {
    cy.visit('/');
    cy.contains('Free Interactive Demo').click();
    
    // Select Field Tech role
    cy.contains('View as Technician').click();
    
    // Verify we land in the mobile view
    cy.url().should('include', '/briefing');
    cy.contains("Today's Schedule").should('be.visible');
  });
});
