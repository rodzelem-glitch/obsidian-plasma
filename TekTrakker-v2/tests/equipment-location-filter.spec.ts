import { test, expect } from '@playwright/test';

test.describe('Equipment Location Filtering & Spec Fields', () => {
  test('should filter linkable equipment by location and allow adding SEER/filter specs', async ({ page }) => {
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

    // Set localStorage bypass and navigate in admin mode
    await page.goto('/');
    try {
      await page.waitForURL('**/login', { timeout: 5000 });
    } catch (e) {
      // Ignore
    }
    await page.evaluate(() => {
      try {
        window.localStorage.setItem('onboarding_complete_apex-sales-manager-id', 'true');
        window.localStorage.setItem('onboarding_complete_undefined', 'true');
      } catch (e) {
        // Ignore
      }
    });

    // Auto-login as admin
    await page.goto('/?demo=admin');

    // Wait for the admin dashboard
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 });

    // Navigate to customers page
    await page.evaluate(() => { window.location.hash = '#/admin/customers'; });

    // Click on Sterling Residences
    const customerRow = page.getByText('Sterling Residences').first();
    await expect(customerRow).toBeVisible({ timeout: 10000 });
    await customerRow.click();

    // Wait for the Customer Master Modal to load and open the Equipment tab
    const equipmentTab = page.locator('button').filter({ hasText: 'Equipment' }).first();
    await expect(equipmentTab).toBeVisible({ timeout: 10000 });
    await equipmentTab.click();

    // 1. Add Location A
    console.log('Adding Location A...');
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.getByPlaceholder('e.g. Main Campus, Building A').fill('Location A');
    await page.getByRole('button', { name: 'Save Location' }).click();
    await page.waitForTimeout(500);

    // 2. Add Location B
    console.log('Adding Location B...');
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.getByPlaceholder('e.g. Main Campus, Building A').fill('Location B');
    await page.getByRole('button', { name: 'Save Location' }).click();
    await page.waitForTimeout(500);

    // 3. Add Equipment A at Location A
    console.log('Adding Equipment A at Location A...');
    await page.getByRole('button', { name: 'Add Equipment' }).first().click();
    await page.getByPlaceholder('e.g. RTU-1, Freezer Condenser').fill('Equipment A');
    await page.getByPlaceholder('e.g. Trane').fill('Brand A');
    await page.getByPlaceholder('Model #').fill('Model A');
    await page.getByPlaceholder('Serial #').fill('SN-A');
    
    // Select Location A
    await page.locator('select').filter({ hasText: '-- Unassigned --' }).selectOption({ label: 'Location A (Building)' });
    
    // Save Equipment A
    await page.getByRole('button', { name: 'Save Equipment' }).click();
    await page.waitForTimeout(500);

    // 4. Add Equipment B at Location B and check filtering
    console.log('Adding Equipment B at Location B...');
    await page.getByRole('button', { name: 'Add Equipment' }).first().click();
    await page.getByPlaceholder('e.g. RTU-1, Freezer Condenser').fill('Equipment B');
    await page.getByPlaceholder('e.g. Trane').fill('Brand B');
    await page.getByPlaceholder('Model #').fill('Model B');
    await page.getByPlaceholder('Serial #').fill('SN-B');
    
    // Select Location B
    await page.locator('select').filter({ hasText: '-- Unassigned --' }).selectOption({ label: 'Location B (Building)' });

    // Verify Equipment A is NOT listed in the "Link to other Equipment" section since it's at a different location
    const linkSectionText = await page.locator('.max-h-32').innerText();
    expect(linkSectionText).not.toContain('Equipment A');

    // Switch Parent Location to Location A
    await page.locator('select').filter({ hasText: 'Location B' }).selectOption({ label: 'Location A (Building)' });

    // Verify Equipment A IS now listed in the "Link to other Equipment" section since the locations match
    await page.waitForTimeout(500);
    const updatedLinkSectionText = await page.locator('.max-h-32').innerText();
    expect(updatedLinkSectionText).toContain('Equipment A');

    // Switch back to Location B
    await page.locator('select').filter({ hasText: 'Location A' }).selectOption({ label: 'Location B (Building)' });

    // Fill in the new SEER Rating and Filter Size & Type inputs
    console.log('Entering SEER and Filter specs...');
    await page.getByPlaceholder('e.g. 16, 21').fill('18.5');
    await page.getByPlaceholder('e.g. 20x25x1 MERV 11').fill('16x20x1 MERV 8');

    // Save Equipment B
    await page.getByRole('button', { name: 'Save Equipment' }).click();
    await page.waitForTimeout(500);

    // Expand Location B in the hierarchy tree to see the new asset
    await page.getByText('Location B').first().click();

    // Verify SEER and Filter specs are displayed on the equipment card
    console.log('Verifying specs are rendered in the tree node...');
    await expect(page.getByText('SEER: 18.5')).toBeVisible();
    await expect(page.getByText('Filter: 16x20x1 MERV 8')).toBeVisible();
  });
});
