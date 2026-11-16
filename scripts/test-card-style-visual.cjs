/* Browser regression for actual card and list rendering, not just button state. */
'use strict';
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const appUrl = process.env.APP_URL || 'http://127.0.0.1:8765/';
const styles = ['glass','minimal','neumorphic','neon','clear','flat','elevated','outlined','gradient'];
(async()=>{
  const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    for (const viewport of [{width:360,height:780},{width:390,height:844},{width:1365,height:900}]) {
      const context = await browser.newContext({viewport,locale:'ar-SA',serviceWorkers:'block'});
      const page = await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const response=await page.goto(appUrl+'?cardStyleQa=1',{waitUntil:'domcontentloaded',timeout:60000});
      assert.ok(response?.ok(),'Page is not available');
      await page.waitForFunction(()=>typeof setAppDesignStyle==='function' && typeof setAppColorMode==='function');
      await page.waitForSelector('#catGrid .cat-card',{state:'attached',timeout:25000});
      await page.evaluate(()=>{
        const frame=document.getElementById('appFrame');
        if(!frame)throw new Error('App frame missing');
        let fixture=document.getElementById('qaOperationsListCard');
        if(!fixture){fixture=document.createElement('div');fixture.id='qaOperationsListCard';fixture.className='ops-tx-card-clean';fixture.style.position='absolute';fixture.style.left='-5000px';fixture.textContent='Test surface only';frame.append(fixture)}
      });
      for(const mode of ['dark','light']){
        await page.evaluate(mode=>setAppColorMode(mode,false),mode);
        const signatures={category:new Map(),list:new Map()};
        for(const style of styles){
          await page.evaluate(async style=>{
            setAppDesignStyle(style,false,false);
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          },style);
          const report=await page.evaluate(()=>{
            const targets={
              category:document.querySelector('#catGrid .cat-card'),
              list:document.querySelector('#qaOperationsListCard'),
              // The compact settings UI does not render the retired preview card.
            };
            const signature={};
            for(const [type,node] of Object.entries(targets)){
              if(!node)throw new Error('Missing '+type+' visual target');
              const cs=getComputedStyle(node);
              signature[type]=JSON.stringify({
                bg:cs.backgroundColor,img:cs.backgroundImage,border:cs.borderTopWidth+' '+cs.borderTopStyle+' '+cs.borderTopColor,
                radius:cs.borderTopLeftRadius,shadow:cs.boxShadow,backdrop:cs.backdropFilter
              });
            }
            return {style:document.body.dataset.cardStyle,signature};
          });
          assert.equal(report.style,style,'Card style did not activate '+style);
          for(const type of Object.keys(signatures)){
            const signature=report.signature[type];
            assert.ok(!signatures[type].has(signature),
              type+' visually identical for '+style+' and '+signatures[type].get(signature)+' / '+mode+' / '+viewport.width);
            signatures[type].set(signature,style);
          }
        }
        const counts=Object.fromEntries(Object.entries(signatures).map(([type,map])=>[type,map.size]));
        console.log('CARD_VISUAL '+viewport.width+' '+mode+' '+JSON.stringify(counts));
        assert.deepEqual(counts,{category:9,list:9});
      }
      await page.evaluate(()=>{
        setAppDesignStyle('outlined',false,true);
        setAppColorMode('light',false);
      });
      await page.reload({waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction(()=>document.body.dataset.cardStyle==='outlined',null,{timeout:30000});
      assert.equal(await page.evaluate(()=>localStorage.getItem('family_monefy_design_style')),'outlined');
      assert.deepEqual(errors,[],'Page errors in actual appearance styling');
      await context.close();
    }
    console.log('PASS: nine distinct visible card and list designs in 3 viewports, both color modes, and persistence');
  } finally { await browser.close(); }
})().catch(err=>{console.error('CARD_VISUAL_QA_FAILED',err.stack||err);process.exitCode=1});
