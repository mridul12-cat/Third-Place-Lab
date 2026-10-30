import { test,expect } from '@playwright/test';

// Local-only synthetic client identities keep independent browser scenarios isolated.
test.beforeEach(async({context},testInfo)=>{await context.setExtraHTTPHeaders({'x-vercel-forwarded-for':`198.51.100.${testInfo.parallelIndex+1}`});});
test('venue to meaningful refinement and blueprint export',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:/Every little place/})).toBeVisible();
 await page.getByRole('button',{name:'Try a sample venue'}).click();
 await page.getByRole('textbox',{name:'What’s your space called?'}).fill('Our Little Bookshop');
 await page.getByRole('button',{name:'Keep going'}).click();await page.getByRole('button',{name:'Keep going'}).click();
 await page.getByRole('button',{name:'Find my gathering'}).click();
 await expect(page.getByRole('heading',{name:'Your next gathering could be…'})).toBeVisible();await expect(page.locator('.concept-card')).toHaveCount(3);
 await page.locator('.dna-card').first().locator('summary').click();await expect(page.locator('.dna-sources').first()).toContainText('Sample data');
 await page.getByRole('button',{name:/What do cultural connections add/}).click();await expect(page.getByText('GENERIC TEMPLATE BASELINE')).toBeVisible();
 await page.getByRole('button',{name:'Meet this idea'}).first().click();await page.getByRole('button',{name:/Why this works/}).click();await expect(page.getByText('FICTIONAL SAMPLE CONNECTIONS',{exact:false})).toBeVisible();
 const original=await page.locator('.budget-box h2').innerText();await page.getByRole('button',{name:'Make it cheaper'}).click();await expect(page.locator('.changes')).toContainText('Reduced the budget');await expect(page.locator('.budget-box h2')).not.toHaveText(original);
 await page.getByRole('button',{name:'Create my blueprint'}).click();await expect(page.getByRole('heading',{name:'02 / A little run of show'})).toBeVisible();
 const amount=page.getByRole('spinbutton',{name:'Materials & activity supplies budget in INR'});await amount.fill('200');await expect(amount).toHaveValue('200');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download plan'}).click();expect((await download).suggestedFilename()).toBe('third-place-event-plan.json');
 await page.evaluate(()=>{window.print=()=>{document.body.dataset.printed='true';};});await page.getByRole('button',{name:'Print blueprint'}).click();await expect(page.locator('body')).toHaveAttribute('data-printed','true');
 await expect(page.locator('body')).toHaveJSProperty('scrollWidth',await page.evaluate(()=>document.documentElement.clientWidth));
});

test('three consecutive refinements retain family delivery and expose honest missing evidence',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Try a sample venue'}).click();
 await page.getByRole('button',{name:'Keep going'}).click();await page.getByRole('button',{name:'Keep going'}).click();await page.getByRole('button',{name:'Find my gathering'}).click();
 await page.getByRole('button',{name:'Meet this idea'}).first().click();
 for(const label of ['Family-friendly','Make it cheaper','New cultural direction']){
  await page.getByRole('button',{name:label,exact:true}).click();await expect(page.locator('.activity').first()).toContainText(/caregiver|family/i);
 }
 await expect(page.locator('.revision-history summary')).toContainText('3 revisions');
 await page.getByRole('button',{name:'Create my blueprint'}).click();await expect(page.locator('.schedule-row')).toHaveCount(5);
 await expect(page.locator('.schedule-row')).toContainText([/Welcome/,/caregiver|family/i,/reference/i,/invitation/i,/Closing/]);
 await page.getByRole('button',{name:'Third Place Lab home'}).click();await page.getByRole('button',{name:'Try a sample venue'}).click();
 await page.getByRole('button',{name:'Keep going'}).click();
 for(const name of ['Studio Ghibli','Phoebe Bridgers','Haruki Murakami'])await page.getByRole('button',{name:`Remove ${name}`}).click();
 await page.getByRole('textbox',{name:'What do they love?'}).fill('Unknown Cultural Input');await page.getByRole('button',{name:'Add cultural interest'}).click();
 await page.getByRole('button',{name:'Keep going'}).click();await page.getByRole('button',{name:'Find my gathering'}).click();
 await expect(page.locator('.warning')).toContainText('No cultural recommendations available');await expect(page.locator('.concept-card')).toHaveCount(3);
 await page.getByRole('button',{name:'Meet this idea'}).first().click();await page.getByRole('button',{name:/Why this works/}).click();await expect(page.getByText('No recommendation evidence available.')).toBeVisible();
});

test('a failed planning response stays honest and preserves the editable venue',async({page})=>{
 await page.route('**/api/events',route=>route.fulfill({status:200,contentType:'application/x-ndjson',body:JSON.stringify({type:'error',error:'Synthetic provider failure. Please retry.'})+'\n'}));
 await page.goto('/');await page.getByRole('button',{name:'Try a sample venue'}).click();await page.getByRole('button',{name:'Keep going'}).click();await page.getByRole('button',{name:'Keep going'}).click();await page.getByRole('button',{name:'Find my gathering'}).click();
 await expect(page.locator('.error[role="alert"]')).toContainText('Synthetic provider failure');await expect(page.locator('.concept-card')).toHaveCount(0);await expect(page.getByRole('button',{name:'Find my gathering'})).toBeEnabled();await expect(page.getByText('Demo mode',{exact:true})).toBeVisible();
});

test('unavailable provider status is not mislabeled as demo or live',async({page})=>{
 await page.route('**/api/health',route=>route.fulfill({status:503,contentType:'application/json',body:'{"status":"unavailable"}'}));
 await page.goto('/');await expect(page.locator('main')).toHaveAttribute('data-hydrated','true');
 await expect(page.getByText('Checking mode',{exact:true})).toBeVisible();await expect(page.getByText('Demo mode',{exact:true})).toHaveCount(0);await expect(page.getByText('Live Qloo mode',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Try a sample venue'}).click();await expect(page.getByRole('textbox',{name:'What’s your space called?'})).toBeVisible();
});
