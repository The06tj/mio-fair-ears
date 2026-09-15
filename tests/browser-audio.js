import { ListeningEngine } from '../src/engine.js';
const results=[];
async function render({a=0.1,b=0.1,adjustments=[0,0],switchAt=0.2,offset=0,loop=false}={}) {
  const rate=48000, offline=new OfflineAudioContext(2,rate*0.7,rate);
  const engine=new ListeningEngine();
  engine.context=new Proxy(offline,{get(target,key){if(key==='resume')return async()=>{};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}});
  engine.master=offline.createGain();engine.master.gain.value=1;engine.master.connect(offline.destination);
  const buffers=[a,b].map(value=>{const buffer=offline.createBuffer(2,rate*0.5,rate);for(let c=0;c<2;c++){const channel=buffer.getChannelData(c);for(let i=0;i<channel.length;i++)channel[i]=typeof value==='function'?value(i/rate):value}return buffer});
  engine.configure(buffers,{duration:0.5,adjustments,headroom:0});
  engine.position=offset;
  if(loop){engine.loop=true;engine.loopStart=0.1;engine.loopEnd=0.2;engine.position=0.1}
  await engine.play();
  const suspended=offline.suspend(switchAt).then(()=>{engine.select(1);return offline.resume()});
  const rendered=await offline.startRendering();await suspended;
  return rendered.getChannelData(0);
}
async function check(name,fn){try{const detail=await fn();results.push({name,passed:true,...detail})}catch(e){results.push({name,passed:false,error:e.message})}}
function assert(condition,message){if(!condition)throw new Error(message)}
await check('Correlated A/B switching has no level bump or gap',async()=>{
  const signal=await render();let worst=0;for(let i=2400;i<23000;i++)worst=Math.max(worst,Math.abs(signal[i]-.1));assert(worst<1e-6,`error ${worst}`);return {maxSampleError:worst}
});
await check('6.0206 dB compensation produces equal output across switching',async()=>{
  const signal=await render({a:.1,b:.2,adjustments:[0,-20*Math.log10(2)]});let worst=0;for(let i=2400;i<23000;i++)worst=Math.max(worst,Math.abs(signal[i]-.1));assert(worst<1e-6,`error ${worst}`);return {maxSampleError:worst}
});
await check('A shared content offset is respected, including through a switch',async()=>{
  const signal=await render({a:t=>t/10,b:t=>t/10,offset:.1});let worst=0;for(let i=2400;i<19000;i++)worst=Math.max(worst,Math.abs(signal[i]-(i/48000-.025+.1)/10));assert(worst<1e-5,`error ${worst}`);return {maxSampleError:worst}
});
await check('Both sources loop the same region without drifting',async()=>{
  const signal=await render({a:t=>t/10,b:t=>t/10,loop:true});let worst=0;for(let i=2500;i<33000;i++){const t=i/48000-.025;const phase=(t%0.1+0.1)%0.1;if(phase<.0001||phase>.0999)continue;worst=Math.max(worst,Math.abs(signal[i]-(.1+phase)/10))}assert(worst<1e-5,`error ${worst}`);return {maxSampleError:worst}
});
await check('Playback ends at the shared duration',async()=>{const signal=await render();const tail=signal.slice(Math.ceil(.53*48000));assert(tail.every(x=>x===0),'Nonzero tail');return {tailSamples:tail.length}});
document.getElementById('result').textContent=JSON.stringify({passed:results.every(r=>r.passed),checks:results},null,2);
