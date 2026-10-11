import { editableSnapshot } from '../src/lib/revision-save.ts';
import { defaults, type Project } from '../src/lib/types.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MediaCredentials, unsignedMediaPath, assetMediaPath, syncMediaSource } from '../src/lib/media-credentials.ts';
const id='11111111-1111-4111-8111-111111111111';
test('saved signatures and origins are replaced by the current media route', () => {
 assert.equal(unsignedMediaPath(`https://old.example/api/projects/${id}/assets/a/file?t=expired&owner=old&key=old&quality=high`),`/api/projects/${id}/assets/a/file?quality=high`);
 assert.equal(unsignedMediaPath('https://other.example/unrelated'),'');
 assert.equal(assetMediaPath(id,'primary'),`/api/projects/${id}/media`);
});
test('tokens are reused, refreshed before expiry, and never returned expired',async()=>{
 let now=0,calls=0;
 const cache=new MediaCredentials(async()=>({token:`token-${++calls}`,expiresIn:7200}),()=>now);
 assert.equal(await cache.ensure(id),'token-1');
 assert.equal(await cache.ensure(id),'token-1');assert.equal(calls,1);
 now=6400*1000;assert.equal(await cache.ensure(id),'token-2');
 now+=7201*1000;assert.equal(cache.token(id),'');
 assert.equal(await cache.ensure(id),'token-3');
});
test('concurrent refreshes share a request and a failed mint can be retried',async()=>{
 let calls=0;
 const cache=new MediaCredentials(async()=>{if(++calls===1)throw Error('offline');return {token:'fresh',expiresIn:7200}});
 await assert.rejects(cache.ensure(id));
 assert.deepEqual(await Promise.all([cache.ensure(id),cache.ensure(id)]),['fresh','fresh']);assert.equal(calls,2);
});
test('sign-out invalidates pending mint and cannot erase a new account request',async()=>{
 const resolve: ((v:{token:string;expiresIn:number})=>void)[]=[];
 const cache=new MediaCredentials(()=>new Promise(r=>resolve.push(r)));
 const old=cache.ensure(id);cache.clear();const fresh=cache.ensure(id);
 resolve[0]({token:'old-account',expiresIn:7200});assert.equal(await old,'');
 assert.equal(cache.token(id),'');assert.equal(cache.ensure(id),fresh);
 resolve[1]({token:'new-account',expiresIn:7200});assert.equal(await fresh,'new-account');
 cache.clear();assert.equal(cache.token(id),'');
});

test('cached media sources reload once for fresh credentials and wait for initial authorization',()=>{
 let value='old-token',writes=0;
 const media={getAttribute:()=>value,get src(){return value},set src(v:string){value=v;writes++}};
 assert.equal(syncMediaSource(media,''),false);
 assert.equal(syncMediaSource(media,'fresh-token'),true);
 assert.equal(syncMediaSource(media,'fresh-token'),false);
 assert.equal(value,'fresh-token');assert.equal(writes,1);
});

test('autosave stores an unsigned asset route instead of a transient signed URL',()=>{
 const project={id,name:'Test',words:[],settings:defaults,mediaType:'video',canvasElements:[{id:'overlay',assetId:'primary',url:'https://old.invalid/api/projects/'+id+'/media?t=expired',x:50,y:50}]} as unknown as Project;
 assert.equal(editableSnapshot(project).canvasElements[0].url,assetMediaPath(id,'primary'));
 assert.ok(project.canvasElements![0].url.includes('expired'),'saving does not mutate the open project');
});
