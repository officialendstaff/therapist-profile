(function(){
'use strict';
const config={rate:1.04,pitch:1.70,volume:1};
let lastSpokenAt=0,lastKey='',lastUtterance=null;
function say(message,key){
 if(!window.speechSynthesis||!window.SpeechSynthesisUtterance)return false;
 const now=Date.now();
 if(key===lastKey&&now-lastSpokenAt<60000)return true;
 const repeat=key===lastKey&&lastSpokenAt>0;
 const text=repeat?'はよー見なはれ！はよー見なはれ！':message;
 const engine=window.speechSynthesis;
 engine.cancel();
 const utterance=new SpeechSynthesisUtterance(text);
 utterance.lang='ja-JP';utterance.rate=config.rate;utterance.pitch=config.pitch;utterance.volume=config.volume;
 const voices=engine.getVoices();
 utterance.voice=voices.find(v=>v.name.includes('Microsoft Sayaka'))||voices.find(v=>v.lang==='ja-JP')||null;
 lastKey=key;lastSpokenAt=now;lastUtterance=utterance;
 engine.speak(utterance);
 return true;
}
window.interviewVoiceAlert={
 play:function(type,key){return say(type==='line'?'ラインだよ！ラインだよ！':type==='interview'?'２時間前だよ！２時間前だよ！':'はよー見なはれ！はよー見なはれ！',key||type)},
 stop:function(){if(window.speechSynthesis)window.speechSynthesis.cancel();lastUtterance=null},
 reset:function(){lastKey='';lastSpokenAt=0}
};
})();