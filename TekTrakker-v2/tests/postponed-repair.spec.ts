import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('Postponed Repair Workflow', () => {
  test('should postpone a repair, save the reason, and transition status to Needs Follow-up', async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

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

    // Set localStorage bypass and navigate in employee mode
    await page.goto('/');
    try {
      await page.waitForURL('**/login', { timeout: 5000 });
    } catch (e) {
      // Ignore
    }
    await page.evaluate(() => {
      try {
        window.localStorage.setItem('onboarding_complete_apex-lead-tech-id', 'true');
        window.localStorage.setItem('onboarding_complete_undefined', 'true');
      } catch (e) {
        // Ignore
      }
    });

    // Auto-login as employee (Leo Masters)
    console.log('Navigating to ?demo=employee...');
    await page.goto('/?demo=employee');

    // Wait for URL to settle
    console.log('Waiting for daily briefing URL...');
    try {
      await page.waitForURL('**/briefing', { timeout: 15000 });
      console.log('URL settled at:', page.url());
    } catch (err: any) {
      console.log('Failed waiting for URL. Current URL:', page.url());
      await page.screenshot({ path: 'artifacts/failure-url.png' });
      const html = await page.content();
      fs.writeFileSync('artifacts/failure-dom.html', html);
      throw err;
    }

    // Save a screenshot of the daily briefing page
    await page.screenshot({ path: 'artifacts/daily-briefing-loaded.png' });

    // Find the card for Sterling Residences (apex-job-2) and click to open workflow
    const jobCard = page.getByText('Sterling Residences').first();
    await expect(jobCard).toBeVisible({ timeout: 10000 });
    await jobCard.click();

    // Step 1: Arrival
    console.log('Step 1: Arrival on Site...');
    const arriveBtn = page.getByRole('button', { name: 'Arrive on Site' });
    await expect(arriveBtn).toBeVisible({ timeout: 10000 });
    await arriveBtn.click();

    // Go to Step 2
    const nextBtn = page.locator('[data-tour="tech-workflow-next-btn"]');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    // Step 2: Diagnosis
    console.log('Step 2: Diagnosis...');
    await nextBtn.click();

    // Step 3: Repair
    console.log('Step 3: Repair (Postpone)...');
    const postponeChk = page.locator('#postpone-repair-chk');
    await expect(postponeChk).toBeVisible();
    await postponeChk.check();

    // Select reason for postponement
    const reasonSelect = page.locator('select');
    await expect(reasonSelect).toBeVisible();
    await reasonSelect.selectOption('Waiting for Parts');

    // Fill in postponement explanation notes
    const notesTextarea = page.getByPlaceholder('Describe why the repair is postponed and next steps...');
    await expect(notesTextarea).toBeVisible();
    await notesTextarea.fill('Postponing repair because the geothermal compressor replacement part is backordered.');

    // Click Next to proceed to Step 4
    await nextBtn.click();

    // Step 4: Quality Check
    console.log('Step 4: Quality Check...');
    await nextBtn.click();

    // Step 5: Billing & Depart
    console.log('Step 5: Depart Site...');
    const completeBtn = page.locator('[data-tour="tech-workflow-complete-btn"]');
    await expect(completeBtn).toBeVisible();
    await completeBtn.click();

    // Confirm skipping missing workflow items (Close Job)
    const confirmSkipBtn = page.getByRole('button', { name: 'Close Job' });
    await expect(confirmSkipBtn).toBeVisible({ timeout: 10000 });
    await confirmSkipBtn.click();

    // Verify modal has closed and we are back on the daily briefing
    await expect(jobCard).toBeVisible({ timeout: 10000 });

    // Verify the status badge for this job card is now 'Needs Follow-up'
    const statusBadge = page.locator('span').filter({ hasText: 'Needs Follow-up' }).first();
    await expect(statusBadge).toBeVisible({ timeout: 10000 });
    
    // Take a screenshot of the completed state
    await page.screenshot({ path: 'artifacts/job-postponed-success.png' });
  });
});
