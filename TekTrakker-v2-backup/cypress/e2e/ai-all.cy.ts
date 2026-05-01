describe('Platform-Wide Live AI Integrations', () => {

    before(() => {
        cy.exec('node cypress/scripts/restore.mjs');
    });

    beforeEach(() => {
        cy.clearAllLocalStorage();
        cy.clearAllSessionStorage();
        cy.clearCookies();
        cy.window().then((win) => win.indexedDB.deleteDatabase('firebaseLocalStorageDb'));
        
        // Login as Master Admin
        cy.visit('/#/login');
        cy.get('input[type="email"]').type(Cypress.env('TEST_EMAIL') || 'cypress-admin@tektrakker.com');
        cy.get('input[type="password"]').type(Cypress.env('TEST_PASSWORD') || 'password123');
        cy.contains('button', 'Sign In', { matchCase: false }).click();
        cy.contains('Admin Dashboard', { matchCase: false }).should('be.visible');
    });

    after(() => {
        cy.exec('node cypress/scripts/restore.mjs');
    });

    it('TEST 1: Document Creator AI', { defaultCommandTimeout: 90000 }, () => {
        cy.visit('/#/admin/records?tab=documents');
        cy.contains('button', 'Write New').click();
        
        // Wait for modal to open
        cy.contains('button', 'AI Generator').click();
        
        cy.contains('AI Content Generator').should('be.visible');
        cy.get('textarea').eq(0).type('Create an internal memo template for holiday schedules.');
        cy.contains('button', 'Generate Content').click();
        cy.contains('button', 'Generating...').should('not.exist');
        
        // The text should be injected into the ProseMirror/contentEditable
        cy.get('div.prose[contentEditable]').should(($editor) => {
             expect($editor.text().length).to.be.greaterThan(30);
        });
        
        // Ensure "Save Document" or "Save" button is clicked correctly
        cy.contains('button', 'Save').click();
    });

    it('TEST 2: Gov Bid Helper AI (RFP Analysis)', { defaultCommandTimeout: 90000 }, () => {
        cy.visit('/#/admin/contracts');
        // Click "New Bid" and create one so the workspace opens
        cy.contains('button', 'New Bid').click();
        cy.get('input[placeholder="e.g., HVAC Upgrade for City Hall"]').type('City Hall HVAC replacement');
        cy.contains('button', 'Start').click();
        
        // Ensure we are in the Setup Tab where the file input is
        cy.contains('RFP Document & Analysis').should('be.visible');
        
        // The user pointed out this test has many steps. We will verify just the AI ingestion part.
        cy.get('input[type="file"]').selectFile('cypress/fixtures/dummy.txt', { force: true });
        cy.contains('button', 'Analyze 1 RFP(s)').click();
        
        cy.contains('button', 'Analyzing...').should('not.exist');
        
        // After processing, AI returns extracted requirements or deliverables
        cy.contains('Requirements').should('be.visible');
    });

    it('TEST 3: Form Builder Generative AI', { defaultCommandTimeout: 90000 }, () => {
        cy.visit('/#/admin/records?tab=forms');
        cy.contains('Forms & Checklists').should('be.visible');
        cy.contains('button', 'AI Assistant').click();
        cy.contains('AI Checklist Assistant', { matchCase: false }).should('be.visible');
        cy.get('textarea').last().type('Create an HVAC Spring Maintenance checklist.');
        cy.contains('button', 'Generate Checklist').click();
        cy.contains('button', 'Processing...').should('not.exist');
        
        // Assert that new fields were added to the FormBuilder!
        // Using length > 0 on input fields containing labels
        cy.get('input[placeholder="Field Label"]').should('have.length.greaterThan', 2);
    });

    it('TEST 4: Marketing ROI AI Insights', { defaultCommandTimeout: 90000 }, () => {
        cy.visit('/#/admin/marketing');
        
        // The generate insights button doesn't have text, just an icon. It's next to "Marketing Strategist"
        cy.contains('h3', 'Marketing Strategist').parent().find('button').click();
        
        // AI component returns markdown wrapper
        cy.get('div.prose, .markdown-body, .text-slate-800').should('be.visible');
    });
});
