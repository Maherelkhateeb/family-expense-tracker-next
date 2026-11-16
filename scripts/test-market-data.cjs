'use strict';
// Current MarketData public contract: load/valid/age/stamp.
// Test actual endpoints with deterministic stubs rather than removed estimate().
const assert=require('node:assert/strict');
const api=require('../market-data.js');
assert.equal(typeof api.load,'function');
assert.equal(typeof api.valid,'function');
assert.equal(typeof api.age,'function');
assert.equal(typeof api.stamp,'function');
const values=new Map();
const storage={
 getItem:k=>values.get(k)??null,
 setItem:(k,v)=>values.set(k,v)
};
const now=new Date().toISOString();
assert.equal(api.valid({checkedAt:now,currencies:{},gold:{}}),false);
assert.equal(api.stamp('2099-01-01T00:00:00.000Z'),null,'Reject future-dated quotes');
(async()=>{
 const originalFetch=global.fetch;
 try {
  const calls=[];
  global.fetch=async url=>{
    calls.push(String(url));
    if(String(url).includes('binance.com')){
      return {ok:true,json:async()=>({lastPrice:'3000',openPrice:'2990',priceChange:'10',priceChangePercent:'0.33'})};
    }
    if(String(url).includes('fawazahmed0/currency-api')){
      return {ok:true,json:async()=>({usd:{egp:50,sar:3.75,eur:0.91,aed:3.67}})};
    }
    throw Error('Unexpected network endpoint '+url);
  };
  const live=await api.load(storage,true);
  assert.ok(live&&!live.offline&&live.isLive&&!live.fromCache,'Live mocked data should be reported as live');
  assert.ok(api.valid(live.feed));
  assert.equal(live.feed.currencies.USD.sell,50);
  assert.ok(Math.abs(live.feed.gold.gold24.sell-3000*50/31.1034768)<1e-7);
  assert.ok(calls.length>=2,'Must request actual gold and FX endpoints');
  global.fetch=async()=>{throw Error('offline')};
  const cached=await api.load(storage,false);
  assert.equal(cached.fromCache,true);
  assert.equal(cached.feed.checkedAt,live.feed.checkedAt,'Fresh cache must preserve quote time');
  const oldFeed={...live.feed,checkedAt:new Date(Date.now()-180000).toISOString()};
  storage.setItem('family_market_feed_v2',JSON.stringify(oldFeed));
  const offline=await api.load(storage,false);
  assert.equal(offline.offline,true,'Stale cached quotes are not live');
  assert.equal(offline.fromCache,true);
  assert.equal(offline.feed.checkedAt,oldFeed.checkedAt);
  values.clear();
  const baseline=await api.load(storage,false);
  assert.equal(baseline.offline,true,'When all providers fail, never mark baseline as live');
  assert.equal(baseline.reason,'baseline');
  console.log('PASS: current market-data API, live mocked prices, freshness, cache and visibly offline fallback');
 }finally{global.fetch=originalFetch}
})().catch(e=>{console.error(e);process.exitCode=1});
