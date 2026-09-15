import test from 'node:test';
import assert from 'node:assert/strict';
import { shuffledOrder, summarizeVotes, makeReport } from '../src/session.js';
test('both random assignments are reachable', () => {
  assert.deepEqual(shuffledOrder(() => 0.2), [0, 1]);
  assert.deepEqual(shuffledOrder(() => 0.8), [1, 0]);
});
test('preference votes resolve through the hidden mapping and retain abstentions', () => {
  const result = summarizeVotes([{order:[1,0],choice:0}, {order:[0,1],choice:1}, {order:[1,0],choice:null}]);
  assert.deepEqual(result, {files:[0,2],ties:1});
});
test('report exports only metadata, correct votes and the frozen listening settings', () => {
  const track = { name:'Mix.wav', buffer:'NEVER EXPORT AUDIO', analysis:{duration:2,sampleRate:48000,channels:2,peak:0.1} };
  const report = makeReport({tracks:[track,track],plan:{lufs:[-23,-20],adjustments:[0,-3],matched:true,target:-23,duration:2,headroom:0},votes:[{order:[1,0],choice:0}],rounds:5,loop:{enabled:false,startSeconds:0,endSeconds:2},notes:'Warmer',volume:0.5,createdAt:'2026-09-15T00:00:00.000Z'});
  assert.equal(report.completedRounds,1); assert.equal(report.plannedRounds,5);
  assert.equal(report.results.files[1],1); assert.equal(report.files[1].adjustmentDb,-3);
  assert.ok(!JSON.stringify(report).includes('NEVER EXPORT AUDIO'));
});
