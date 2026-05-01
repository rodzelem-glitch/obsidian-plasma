describe('Live AI Integrations', () => {

    before(() => {
        cy.exec('node cypress/scripts/restore.mjs');
    });

    beforeEach(() => {
        cy.clearAllLocalStorage();
        cy.clearAllSessionStorage();
        cy.clearCookies();
        cy.window().then((win) => win.indexedDB.deleteDatabase('firebaseLocalStorageDb'));
    });

    after(() => {
        cy.exec('node cypress/scripts/restore.mjs');
    });

    it('should successfully interface with the Gemini API to generate content in Document Creator', { defaultCommandTimeout: 30000 }, () => {
        cy.visit('/#/login');
        
        // Login as Master Admin
        cy.get('input[type="email"]').type(Cypress.env('TEST_EMAIL') || 'cypress-admin@tektrakker.com');
        cy.get('input[type="password"]').type(Cypress.env('TEST_PASSWORD') || 'password123');
        cy.contains('button', 'Sign In', { matchCase: false }).click();

        // Wait for dashboard to load
        cy.contains('Admin Dashboard', { matchCase: false }).should('be.visible');

        // Go to Records -> Documents Hub
        cy.visit('/#/admin/records?tab=documents');
        
        // Ensure Document Creator loaded
        cy.contains('Document Center').should('be.visible');

        // Target the master template write flow
        cy.contains('button', 'Write New').click();

        // Look for the AI Generator button in the modal
        cy.contains('button', 'AI Generator').click();

        // Give it a prompt
        cy.get('textarea').last().type('A 3-sentence company policy regarding safety protocol.', { delay: 0 });

        // Trigger the live cloud function hitting the Google GenAI API
        cy.contains('button', 'Generate Content').click();

        // Wait for generation to finish. We extend timeout massively as AI inference takes ~10 seconds.
        cy.contains('Generating...').should('not.exist');
        
        // Document Editor content should now contain the words "safety" or "policy"
        // Cypress accesses contenteditable blocks through `.text()` or specific child tags
        cy.get('[contenteditable="true"]').should(($content) => {
             const text = $content.text().toLowerCase();
             expect(text).to.match(/(safety|company|policy|protocol)/);
        });
    });

});
