import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPages } from '../src/lib/pages.ts';
import { editCaptionGroup } from '../src/lib/caption-edit.ts';
import { linkedCaptionSize } from '../src/lib/caption-settings.ts';
import { defaults, type Word } from '../src/lib/types.ts';
const word = (text: string, start: number, end: number): Word => ({ id:text+start,text,original:text,start,end,confidence:.93,emphasis:false,emphasisScore:.6 });

test('overlong joins respect every requested ceiling and preserve words once', () => {
  for(let limit=1;limit<=7;limit++) for(let count=limit+1;count<=30;count++) {
    const words=Array.from({length:count},(_,i)=>({...word(`w${i}`,i*.15,i*.15+.1),lineBreak:false}));
    const pages=buildPages(words,limit);
    assert.ok(pages.every(p=>p.words.length<=limit));
    assert.deepEqual(pages.flatMap(p=>p.words),words);
    assert.deepEqual(buildPages(words,limit),pages);
  }
});
test('spelling correction preserves irregular timing and all recognition and editorial metadata', () => {
  const words=[{...word('Hello',.123456,.31123),emoji:'👋',posX:34,spotlight:true,fromGlossary:true,lineBreak:false},
    {...word('wrold',.447891,1.12987),confidenceApproximate:true,timingApproximate:false,lineBreak:true}];
  const edited=editCaptionGroup(words,'Hello world',words[0].start,words[1].end);
  assert.deepEqual(edited,[words[0],{...words[1],text:'world'}]);
});
test('insertions use only available gaps, preserve matched words, and label estimates', () => {
  const words=[word('Hello',0,.3),{...word('world',.8,1.2),emoji:'🌎'}];
  const result=editCaptionGroup(words,'Hello brave world',0,1.2);
  assert.deepEqual(result[0],words[0]);assert.deepEqual(result[2],words[1]);
  assert.equal(result[1].timingApproximate,true);assert.ok(result[1].start>=.3 && result[1].end<=.8);
  assert.throws(()=>editCaptionGroup([word('Hello',0,.3),word('world',.3,1)],'Hello brave world',0,1),/not enough time/);
});
test('deleting words retains remaining word IDs and times; explicit retiming stays local', () => {
  const words=[word('Hello',.1,.3),word('brave',.4,.7),{...word('world',.8,1.2),lineBreak:true}];
  assert.deepEqual(editCaptionGroup(words,'Hello world',.1,1.2),[words[0],words[2]]);
  const timed=editCaptionGroup(words,'Hello brave world',.2,2.4);
  assert.equal(timed[0].start,.2);assert.equal(timed.at(-1)?.end,2.4);
  assert.ok(timed.every(w=>w.timingApproximate));assert.equal(timed[2].original,'world');
  assert.throws(()=>editCaptionGroup(words,'  ',.1,1.2),/blank/);
});
test('linked size changes stay within both API bounds at extreme ratios', () => {
  for(const fontSize of [20,50,100]) for(const heroFontSize of [20,100,200]) for(const requested of [20,40,92,100]) {
    const result=linkedCaptionSize({...defaults,fontSize,heroFontSize},requested,true);
    assert.ok(result.fontSize!>=20 && result.fontSize!<=100);
    assert.ok(result.heroFontSize!>=20 && result.heroFontSize!<=200);
  }
});
