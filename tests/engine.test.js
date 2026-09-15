import test from 'node:test';
import assert from 'node:assert/strict';
import { ListeningEngine } from '../src/engine.js';
function setup() {
  const sources = [];
  const param = () => ({value:0,setValueAtTime(v){this.value=v},linearRampToValueAtTime(v){this.value=v},cancelAndHoldAtTime(){}});
  const node = () => ({gain:param(),connect(){return this},disconnect(){}});
  const context = {currentTime:10,state:'running',resume:async()=>{},createGain:node,createBufferSource:()=>{const source={...node(),start(...args){this.startArgs=args},stop(...args){this.stopArgs=args}};sources.push(source);return source}};
  const engine = new ListeningEngine(); engine.context=context; engine.master=node();
  engine.configure([{duration:4},{duration:6}],{duration:4,adjustments:[0,-6],headroom:0});
  return {engine,context,sources};
}
test('both sources start at exactly the same clock time and content offset', async () => {
  const {engine,sources}=setup(); engine.position=1.2; await engine.play();
  assert.deepEqual(sources[0].startArgs,sources[1].startArgs);
  assert.deepEqual(sources[0].startArgs,[10.025,1.2]);
  assert.deepEqual(sources[0].stopArgs,sources[1].stopArgs);
  assert.ok(Math.abs(sources[0].stopArgs[0]-12.825)<1e-10);
});
test('pausing while audio activation is pending cancels playback', async () => {
  const {engine,context,sources}=setup(); let resume;
  context.resume=()=>new Promise(resolve=>{resume=resolve});
  const playing=engine.play(); engine.pause(); resume(); await playing;
  assert.equal(engine.playing,false); assert.equal(sources.length,0);
});
test('loop boundaries and seek apply equally to both sources', async () => {
  const {engine,sources,context}=setup(); await engine.setLoop(true,1,2); await engine.play();
  assert.equal(engine.position,1); assert.ok(sources.every(s=>s.loop&&s.loopStart===1&&s.loopEnd===2));
  context.currentTime=11.775;
  assert.ok(Math.abs(engine.getPosition()-1.75)<1e-10);
  await engine.seek(1.4);
  assert.deepEqual(sources.at(-1).startArgs,sources.at(-2).startArgs);
  assert.equal(sources.at(-1).startArgs[1],1.4);
});
