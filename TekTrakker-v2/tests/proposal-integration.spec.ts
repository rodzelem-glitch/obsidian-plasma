import { test, expect } from '@playwright/test';

test.describe('Project Proposal Integration & Tech Workflow Linking', () => {
  test('should link, preview, and unlink a project-level proposal', async ({ page, context }) => {
    // Wait for services to boot
    console.log('Waiting for services...');
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const [rootRes] = await Promise.all([
          page.request.get('/')
        ]);
        if (rootRes.status() === 200) {
          ready = true;
          break;
        }
      } catch (e: any) {
        await page.waitForTimeout(2000);
      }
    }

    if (!ready) {
      throw new Error('Server failed to boot.');
    }

    // Set localStorage bypass and navigate directly as employee
    await page.goto('/');
    try {
      await page.waitForURL('**/login', { timeout: 5000 });
    } catch (e) {
      // Ignore
    }
    await page.evaluate(() => {
      try {
        window.localStorage.setItem('onboarding_complete_apex-sales-manager-id', 'true');
        window.localStorage.setItem('onboarding_complete_apex-lead-tech-id', 'true');
        window.localStorage.setItem('onboarding_complete_undefined', 'true');
      } catch (e) {
        // Ignore
      }
    });

    console.log('Navigating to employee/technician daily briefing...');
    await page.goto('/?demo=employee');
    await page.waitForURL('**/briefing', { timeout: 15000 });

    // Open Sterling Residences Job Card (apex-job-2)
    const jobCard = page.getByText('Sterling Residences').first();
    await expect(jobCard).toBeVisible({ timeout: 10000 });
    await jobCard.click();

    // Step 1: Arrival on Site
    console.log('Step 1: Arrival...');
    const arriveBtn = page.getByRole('button', { name: 'Arrive on Site' });
    await expect(arriveBtn).toBeVisible({ timeout: 10000 });
    await arriveBtn.click();

    // Go to Step 2 (Diagnosis)
    const nextBtn = page.locator('[data-tour="tech-workflow-next-btn"]');
    await expect(nextBtn).toBeVisible({ timeout: 10000 });
    await nextBtn.click();

    // Step 2: Load Proposal
    console.log('Step 2: Diagnosis - Loading Proposal...');
    const loadProposalBtn = page.getByRole('button', { name: 'Load Proposal' });
    await expect(loadProposalBtn).toBeVisible({ timeout: 10000 });
    await loadProposalBtn.click();

    // Select our seeded mock project proposal in the modal
    const proposalTitle = 'Rooftop HVAC Replacement Project';
    console.log(`Selecting proposal: ${proposalTitle}`);
    const proposalItemBtn = page.getByText(proposalTitle).first();
    await expect(proposalItemBtn).toBeVisible({ timeout: 10000 });
    await proposalItemBtn.click();

    // Verify it appears in the "Linked Proposals" section in Step 2
    console.log('Verifying proposal is linked...');
    const linkedProposalText = page.locator('#proposals').first();
    await expect(linkedProposalText).toBeVisible({ timeout: 10000 });
    await expect(linkedProposalText).toContainText(proposalTitle);

    // 3. Test Preview (clicking opens read-only view in a new tab)
    console.log('Testing preview click...');
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.getByText(proposalTitle).first().click()
    ]);
    
    // Wait for the popup page to load and verify it contains project proposal view URL
    await popup.waitForLoadState();
    expect(popup.url()).toContain('#/project-proposal-view/');
    console.log('Preview opened successfully at:', popup.url());
    await popup.close();

    // 4. Test Unlinking (Remove proposal from job)
    console.log('Testing unlinking proposal...');
    const proposalRow = page.locator('div.flex.items-center.gap-2.w-full', { hasText: proposalTitle });
    const unlinkBtn = proposalRow.getByTitle('Unlink Proposal');
    await expect(unlinkBtn).toBeVisible({ timeout: 10000 });
    await unlinkBtn.click();

    // Verify the proposal has been unlinked and no longer appears in the list
    console.log('Verifying proposal is unlinked...');
    await expect(proposalRow).not.toBeVisible();
    console.log('Proposal unlinked successfully!');
  });
});
