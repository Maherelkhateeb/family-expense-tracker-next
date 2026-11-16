'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const URL=process.env.APP_URL||'http://127.0.0.1:8765/';
const sourceGold21=(ounce,egp=50)=>ounce*egp/31.1034768*21/24;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,430,1365]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   let ounce=3000;
   await page.route('https://api.binance.com/**',r=>r.fulfill({json:{
     lastPrice:String(ounce),openPrice:'2990',priceChange:String(ounce-2990),
     priceChangePercent:String((ounce/2990-1)*100)
   }}));
   await page.route('https://cdn.jsdelivr.net/**/usd.json*',r=>r.fulfill({json:{usd:{egp:50,sar:3.75,eur:0.91,aed:3.67}}}));
   await page.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('#btnOpenGold').click();
   await page.waitForFunction(()=>document.getElementById('tvUpdateTime')?.dataset.status==='fresh',null,{timeout:20000});
   const starting=await page.evaluate(()=>state.market?.gold21);
   assert.ok(Math.abs(starting-sourceGold21(3000))<1e-5,'Gold 21 must reflect real FX+ounce input');
   for(const mode of ['light','dark']){
     await page.evaluate(mode=>setAppColorMode(mode,false),mode);
     const layout=await page.locator('#goldDrawerPanel').evaluate(e=>({
       width:e.clientWidth,scroll:e.scrollWidth,count:e.querySelectorAll('.market-box').length,
       sections:[...e.querySelectorAll('.gold-grid-cards,.fx-grid-cards')].map(x=>x.scrollWidth<=x.clientWidth+2)
     }));
     assert.ok(layout.scroll<=layout.width+2,'Gold drawer overflows '+width+' '+mode+' '+JSON.stringify(layout));
     assert.equal(layout.count,9);
     assert.ok(layout.sections.every(Boolean));
     await page.locator('#goldDrawerPanel').screenshot({path:'screenshots/gold-'+width+'-'+mode+'.png'});
   }
   await page.getByText('حاسبة الذهب والمصنعية',{exact:true}).click();
   await page.locator('#calcQty').fill('2');
   await page.locator('#calcWorkmanshipPerGram').fill('100');
   const total=await page.locator('#calcFinalTotal').innerText();
   assert.ok(total.includes('ج.م') && total.includes('8,639'),'Calculator total must use current ounce feed; got '+total);
   ounce=3050;
   await page.locator('#btnRefreshTv').click();
   await page.waitForFunction(expected=>Math.abs((state.market?.gold21||0)-expected)<1e-5,sourceGold21(3050),{timeout:20000});
   assert.deepEqual(errors,[],'Gold UI generated JS errors');
   console.log('PASS: quote source, responsive gold drawer, calculator and refresh '+width);
   await context.close();
  }
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  // Isolated outage: block all external feeds while allowing the local app.
  await page.route('**/*',r=>{
    if(r.request().url().startsWith('http://127.0.0.1:8765/')) r.continue();
    else r.abort();
  });
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.locator('#btnOpenGold').click();
  await page.waitForFunction(()=>document.getElementById('tvUpdateTime')?.dataset.status==='stale',null,{timeout:25000});
  assert.equal(await page.locator('#tvGold21Val').innerText(),'—');
  assert.ok((await page.locator('#calcFinalTotal').textContent()).includes('غير متاح'));
  console.log('PASS: complete network outage does not invent financial quotes');
  await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error('GOLD_MARKET_QA_FAILED',e.stack||e);process.exitCode=1});
