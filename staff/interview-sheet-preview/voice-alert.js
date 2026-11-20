(function(){
'use strict';
const config={rate:1.04,pitch:1.70,volume:1};
let lastSpokenAt=0,lastKey='',lastUtterance=null,activeAudio=null,activeContext=null;
const lineSoundUrl='./vivant_line_5s.mp3';
function interviewTone(){
 try{
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)return false;
  const ctx=new Audio();activeContext=ctx;
  if(ctx.state==='suspended')void ctx.resume();
  const t=ctx.currentTime;
  const master=ctx.createDynamicsCompressor();
  master.threshold.value=-18;master.knee.value=8;master.ratio.value=6;
  master.attack.value=0.003;master.release.value=0.16;
  master.connect(ctx.destination);
  [0,0.31].forEach((offset)=>{
   const osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type='sawtooth';
   osc.frequency.setValueAtTime(440,t+offset);
   osc.frequency.exponentialRampToValueAtTime(300,t+offset+0.23);
   gain.gain.setValueAtTime(0.0001,t+offset);
   gain.gain.exponentialRampToValueAtTime(0.28,t+offset+0.015);
   gain.gain.setValueAtTime(0.28,t+offset+0.17);
   gain.gain.exponentialRampToValueAtTime(0.0001,t+offset+0.26);
   osc.connect(gain);gain.connect(master);
   osc.start(t+offset);osc.stop(t+offset+0.27);
  });
  setTimeout(()=>{if(activeContext===ctx){activeContext=null;ctx.close().catch(()=>{})}},1100);
  return true;
 }catch(error){console.warn('面接通知音を再生できません',error);return false}
}
function lineTone(key){
 try{
  const sound=new Audio(lineSoundUrl);
  sound.preload='auto';sound.volume=1;
  sound.addEventListener('error',()=>{console.warn('LINE通知音ファイルを読み込めません');say('新着通知がありまっせ！新着通知がありまっせ！',key+'-fallback')});
  const playback=sound.play();
  if(playback&&typeof playback.catch==='function')playback.catch(error=>{console.warn('LINE通知音の再生がブロックされました',error);say('新着通知がありまっせ！新着通知がありまっせ！',key+'-fallback')});
  if(activeAudio){activeAudio.pause();activeAudio.currentTime=0}
  activeAudio=sound;lastKey=key;lastSpokenAt=Date.now();
  return true;
 }catch(error){console.warn('LINE通知音を再生できません',error);return false}
}
function say(message,key){
 if(!window.speechSynthesis||!window.SpeechSynthesisUtterance)return false;
 const now=Date.now();
 if(key===lastKey&&now-lastSpokenAt<60000)return true;
 const engine=window.speechSynthesis;
 engine.cancel();
 const utterance=new SpeechSynthesisUtterance(message);
 utterance.lang='ja-JP';utterance.rate=config.rate;utterance.pitch=config.pitch;utterance.volume=config.volume;
 const voices=engine.getVoices();
 utterance.voice=voices.find(v=>v.name.includes('Microsoft Sayaka'))||voices.find(v=>v.lang==='ja-JP')||null;
 lastKey=key;lastSpokenAt=now;lastUtterance=utterance;
 engine.speak(utterance);
 return true;
}
window.interviewVoiceAlert={
 play:function(type,key){
  const k=key||type;
  if(k===lastKey)return true; // Same event must not trigger reminder sounds
  if(type==='line')return lineTone(k);
  if(type==='interview'){
   if(interviewTone()){lastKey=k;lastSpokenAt=Date.now();return true}
   return false;
  }
  return say(type==='line'?'新着通知がありまっせ！新着通知がありまっせ！':'はよー見なはれ！はよー見なはれ！',k);
 },
 stop:function(){
  if(window.speechSynthesis)window.speechSynthesis.cancel();
  if(activeAudio){activeAudio.pause();activeAudio.currentTime=0;activeAudio=null}
  if(activeContext){const ctx=activeContext;activeContext=null;ctx.close().catch(()=>{})}
  lastUtterance=null;
 },
 reset:function(){lastKey='';lastSpokenAt=0}
};
})();
