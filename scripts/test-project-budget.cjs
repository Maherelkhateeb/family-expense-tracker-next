'use strict';
// Browser regression of the CURRENT independent Budgets page (not retired
// Expected/Analytics tab selectors or removed projectBudgetMetrics helper).
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const url=process.env.APP_URL||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,430]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',locale:'ar-EG'});
   const page=await context.newPage();
   const response=await page.goto(url+'?budgetTest=1',{waitUntil:'domcontentloaded',timeout:60000});
   assert.ok(response?.ok(),'Budget app HTTP error');
   await page.locator('#navTabBudgets').click();
   await page.locator('#btnBudgetSubProjects').click();
   await page.locator('#panelProjectBudgets button[onclick="openNewBudgetPlanModal(true)"]').first().click();
   await page.locator('#newBudgetPlanModal').waitFor({state:'visible'});
   await page.locator('#newPlanProjectInput').fill('مشروع الاختبار');
   await page.locator('#newPlanMonthInput').fill('2026-11');
   await page.locator('button[onclick="submitNewBudgetPlan()"]').click();
   await page.waitForFunction(()=>{
    const plans=JSON.parse(localStorage.getItem('family_monefy_monthly_budgets')||'[]');
    return plans.some(p=>p.project==='مشروع الاختبار'&&p.month==='2026-11');
   });
   await page.locator('#btnBudgetSubCurrent').click();
   await page.evaluate(()=>{
    const form=document.getElementById('budgetAddFormCollapsible');
    if(form && getComputedStyle(form).display==='none') toggleAddBudgetItemForm();
   });
   await page.locator('#inpBudgetItemAmount').fill('1000');
   await page.locator('button[onclick="addBudgetItemToCurrentPlan()"]').click();
   await page.locator('button[onclick="saveMonthlyBudget()"]').click();
   const plan=await page.evaluate(()=>{
    const plans=JSON.parse(localStorage.getItem('family_monefy_monthly_budgets')||'[]');
    return plans.find(p=>p.project==='مشروع الاختبار'&&p.month==='2026-11');
   });
   assert.ok(plan,'Plan not saved');
   assert.equal(plan.items.length,1);
   assert.equal(plan.items[0].amount,1000);
   await page.locator('#btnBudgetSubProjects').click();
   await page.evaluate(()=>{
     window.selectedProjectBudgetName='مشروع الاختبار';
     // Isolated test-only transactions; never touch persistent family records.
     state.transactions=[
       {id:'qa-expense',type:'expense',category:'food',project:'مشروع الاختبار',amount:400,member:'ماهر',date:'2026-11-01'},
       {id:'qa-other',type:'expense',category:'food',project:'مشروع آخر',amount:500,member:'ماهر',date:'2026-11-01'}
     ];
     renderProjectBudgetsPanel();
   });
   const stats=await page.locator('#panelProjectBudgets').innerText();
   assert.match(stats,/الملخص التراكمي: مشروع الاختبار/);
   assert.match(stats,/1,000/,'Planned total missing');
   assert.match(stats,/400/,'Project spend missing');
   assert.match(stats,/600/,'Remaining amount missing');
   await page.locator('#projectBudgetSelector').selectOption('مشروع الاختبار');
   const fits=await page.locator('#panelProjectBudgets').evaluate(e=>e.scrollWidth<=e.clientWidth+2);
   assert.ok(fits,'Project budget panel horizontally overflows '+width);
   await page.reload({waitUntil:'domcontentloaded'});
   assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('family_monefy_monthly_budgets')||'[]').some(
      p=>p.project==='مشروع الاختبار'&&p.month==='2026-11'&&p.items[0]?.amount===1000
   )),'Project budget did not persist across reload');
   await page.locator('#navTabBudgets').click();
   await page.locator('#btnBudgetSubProjects').click();
   assert.ok(await page.locator('#projectBudgetSelector option').evaluateAll(options=>options.some(o=>o.value==='مشروع الاختبار')),'Saved project is not selectable');
   console.log('PASS: project budget creation, item, current project filters, expected/actual totals and persistence',width);
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error('PROJECT_BUDGET_QA_FAILED',e.stack||e);process.exitCode=1});
