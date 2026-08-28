import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    console.log('REQUEST:', request.url());
    request.continue();
  });
  page.on('response', response => {
    console.log('RESPONSE:', response.url(), response.status());
  });
  await page.goto('http://localhost:3000');
  await page.evaluate(() => {
    localStorage.setItem('edunova_user_profile', JSON.stringify({
      id: 'test-id',
      email: 'jackito46@gmail.com',
      role: 'SUPER_ADMIN',
      school_id: 'test-school'
    }));
  });
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
