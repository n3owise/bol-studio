import test from 'node:test';
import assert from 'node:assert/strict';
import { pinAccepted } from '../server/control/pin';
test('PIN gate fails closed and accepts only the configured four-digit secret',()=>{
 assert.equal(pinAccepted('2468','2468'),true);
 for(const value of [undefined,['2468'],'2469','24680',' 2468','2468\n']) assert.equal(pinAccepted(value,'2468'),false);
 assert.equal(pinAccepted('2468',''),false);
});
import { handle } from '../server/control/handler';
import type { IncomingMessage, ServerResponse } from 'node:http';
test('analytics API requires verified owner and PIN; header spoofing cannot unlock it',async()=>{
 const keys=['BOL_SUPABASE_URL','BOL_SUPABASE_ANON_KEY','BOL_ADMIN_USER_IDS','BOL_ADMIN_PIN'];
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const originalFetch=globalThis.fetch;
 const owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';let verified=owner;
 Object.assign(process.env,{BOL_SUPABASE_URL:'https://example.supabase.co',BOL_SUPABASE_ANON_KEY:'public',BOL_ADMIN_USER_IDS:owner,BOL_ADMIN_PIN:'2468'});
 globalThis.fetch=(async()=>Response.json({id:verified})) as typeof fetch;
 async function run(headers:Record<string,string>,access=false){let body='';const res={statusCode:0,setHeader(){},end(value:string){body=value;}};await handle({method:'GET',url:'/api/admin/analytics',headers} as IncomingMessage,res as unknown as ServerResponse,access);return {status:res.statusCode,body:JSON.parse(body)};}
 try {
  assert.equal((await run({'x-bol-admin-pin':'2468','x-bol-owner':owner})).status,401);
  assert.equal((await run({authorization:'Bearer valid'})).status,403);
  assert.equal((await run({authorization:'Bearer valid','x-bol-admin-pin':'0000'})).status,403);
  assert.equal((await run({authorization:'Bearer valid','x-bol-admin-pin':'2468'},true)).body.unlocked,true);
  verified='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  assert.equal((await run({authorization:'Bearer valid','x-bol-admin-pin':'2468','x-bol-owner':owner})).status,403);
  assert.equal((await run({authorization:'Bearer valid','x-bol-admin-pin':'2468'},true)).body.unlocked,false);
 } finally {globalThis.fetch=originalFetch;for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});
