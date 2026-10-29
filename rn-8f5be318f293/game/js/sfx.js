/* Rosado Nights sound effects (v0.2.0)
   Original WebAudio SFX, generated live. Own AudioContext so the effects keep working
   when the theme music is switched off (RosadoTheme.pause() suspends the music context).
   API: RosadoSFX.unlock() (call inside a tap), .clank(), .strain(level), .thump(power), .whiff(),
        .sting(), .blip(), .combo(n), .rack(), .fanfare(), .tick(), .setPaused(bool)
   Level 1 (drive): .engine(level,boost) (continuous electric hum, 0 = off), .crash(v), .bump(), .puff(), .boost(), .chime(), .pickup(), .squelch(), .warn(), .clunk() */
(function(){
"use strict";
var ctx=null,out=null,nb=null,paused=false;
function unlock(){
 if(ctx){if(!paused&&ctx.state!=='running')ctx.resume();return true}
 var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
 try{ctx=new AC()}catch(e){return false}
 var comp=ctx.createDynamicsCompressor();comp.threshold.value=-10;comp.ratio.value=8;comp.attack.value=0.002;comp.release.value=0.12;
 out=ctx.createGain();out.gain.value=0.9;out.connect(comp);comp.connect(ctx.destination);
 nb=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);var d=nb.getChannelData(0);for(var i=0;i<d.length;i++)d[i]=Math.random()*2-1;
 var sb=ctx.createBufferSource();sb.buffer=ctx.createBuffer(1,1,22050);sb.connect(ctx.destination);sb.start(0);
 window.__rosadoSfxCtx=ctx;return true;
}
function ok(){return ctx&&!paused}
function G(v){var g=ctx.createGain();g.gain.value=v;return g}
function F(type,f,q){var b=ctx.createBiquadFilter();b.type=type;b.frequency.value=f;if(q!=null)b.Q.value=q;return b}
function env(g,t,a,peak,dec){g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec)}
function noise(t,dur){var s=ctx.createBufferSource();s.buffer=nb;s.start(t,Math.random()*0.5);s.stop(t+dur);return s}
function osc(type,f,t,dur){var o=ctx.createOscillator();o.type=type;o.frequency.value=f;o.start(t);o.stop(t+dur);return o}
function chain(){for(var i=0;i<arguments.length-1;i++)arguments[i].connect(arguments[i+1]);return arguments[arguments.length-1]}
function now(){return ctx.currentTime+0.005}

/* heavy iron clank: inharmonic metal partials + a gritty noise hit */
function clank(v){if(!ok())return;v=v||1;var t=now();
 [[210,0.5],[523,0.35],[1307,0.22],[2141,0.14],[3380,0.08]].forEach(function(p){var o=osc('sine',p[0]*(0.98+Math.random()*0.04),t,0.9),g=G(0);env(g,t,0.002,p[1]*v,0.25+0.4*Math.random());chain(o,g,out)});
 var n=noise(t,0.12),ng=G(0);env(ng,t,0.001,0.5*v,0.08);chain(n,F('bandpass',2600,1.4),ng,out);
 var k=osc('triangle',120,t,0.2),kg=G(0);k.frequency.exponentialRampToValueAtTime(55,t+0.15);env(kg,t,0.002,0.6*v,0.15);chain(k,kg,out);
}
/* strain whoosh: short filtered-noise push that climbs with the bar height (no voice) */
function strain(level){if(!ok())return;var t=now(),l=Math.max(0,Math.min(1,level||0));
 var n=noise(t,0.2),bp=F('bandpass',300+l*900,2.5),g=G(0);bp.frequency.setValueAtTime(260+l*700,t);bp.frequency.exponentialRampToValueAtTime(700+l*1800,t+0.14);
 env(g,t,0.01,0.32,0.15);chain(n,bp,g,out);
 var o=osc('sawtooth',55+l*40,t,0.16),lp=F('lowpass',400),og=G(0);o.frequency.exponentialRampToValueAtTime(70+l*60,t+0.12);env(og,t,0.005,0.16,0.12);chain(o,lp,og,out);
}
/* heavy-bag thump: deep body + leather slap */
function thump(power){if(!ok())return;var t=now(),p=power||1;
 var o=osc('sine',110,t,0.5),g=G(0);o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(42,t+0.25);env(g,t,0.003,0.9*p,0.3);chain(o,g,out);
 var n=noise(t,0.15),ng=G(0);env(ng,t,0.001,0.7*p,0.09);chain(n,F('lowpass',1800+p*800),ng,out);
 var s=noise(t,0.05),sg=G(0);env(sg,t,0.001,0.35*p,0.03);chain(s,F('highpass',2500),sg,out);
}
function whiff(){if(!ok())return;var t=now(),n=noise(t,0.22),bp=F('bandpass',1800,1.2),g=G(0);
 bp.frequency.setValueAtTime(2600,t);bp.frequency.exponentialRampToValueAtTime(500,t+0.2);env(g,t,0.02,0.3,0.18);chain(n,bp,g,out)}
/* the "NEW RECORD" sting: big hit + rising E-major arpeggio + bright held chord (no crowd) */
function sting(){if(!ok())return;var t=now();clank(0.6);thump(1.4);
 [64,68,71,76,80,83,88].forEach(function(m,i){var f=440*Math.pow(2,(m-69)/12),tt=t+i*0.07;
  ['square','sawtooth'].forEach(function(ty,j){var o=osc(ty,f*(j?1.004:1),tt,0.5),g=G(0),lp=F('lowpass',3500);env(g,tt,0.005,0.12,0.35);chain(o,lp,g,out)})});
 var ct=t+0.5;[76,80,83,88].forEach(function(m){var f=440*Math.pow(2,(m-69)/12);[-8,8].forEach(function(dt){var o=osc('sawtooth',f,ct,1.8),g=G(0),lp=F('lowpass',2800);o.detune.value=dt;env(g,ct,0.02,0.07,1.6);chain(o,lp,g,out)})});
 var n=noise(ct,1.5),ng=G(0);env(ng,ct,0.003,0.18,1.3);chain(n,F('highpass',6000),ng,out);
}
function blip(){if(!ok())return;var t=now(),o=osc('square',880,t,0.06),g=G(0);o.frequency.setValueAtTime(1320,t+0.025);env(g,t,0.002,0.08,0.05);chain(o,F('lowpass',3000),g,out)}
function tick(){if(!ok())return;var t=now(),o=osc('square',1600,t,0.04),g=G(0);env(g,t,0.001,0.06,0.03);chain(o,g,out)}
function combo(n){if(!ok())return;var t=now(),m=72+Math.min(12,n||0),f=440*Math.pow(2,(m-69)/12);
 var o=osc('square',f,t,0.15),g=G(0);o.frequency.setValueAtTime(f*1.5,t+0.05);env(g,t,0.003,0.08,0.12);chain(o,F('lowpass',4000),g,out)}
function rack(){if(!ok())return;clank(0.8);var t=now()+0.12;var o=osc('sine',180,t,0.4),g=G(0);env(g,t,0.003,0.3,0.3);chain(o,g,out)}
function fanfare(){if(!ok())return;var t=now();
 [[64,0],[71,0.14],[76,0.28],[79,0.42],[83,0.56],[88,0.75]].forEach(function(p){var f=440*Math.pow(2,(p[0]-69)/12),tt=t+p[1];
  var o=osc('square',f,tt,0.7),o2=osc('sawtooth',f*1.005,tt,0.7),g=G(0),lp=F('lowpass',3200);env(g,tt,0.01,0.1,p[1]>0.7?1.2:0.3);o.connect(lp);o2.connect(lp);chain(lp,g,out)});
 thump(1.2);
}

/* ---------- Level 1 drive ---------- */
/* electric-car hum: low motor tone + rising whine + soft road/rain hiss. engine(0) fades it out. */
var eng=null;
function engine(v,boost){
 if(!ctx)return;var t=ctx.currentTime;v=Math.max(0,Math.min(1.4,v||0));
 if(!eng){if(!v)return;
  eng={o1:ctx.createOscillator(),o2:ctx.createOscillator(),o3:ctx.createOscillator(),lp:F('lowpass',400,1.5),g:G(0),wg:G(0),n:ctx.createBufferSource(),ng:G(0),nf:F('bandpass',900,0.7)};
  eng.o1.type='sawtooth';eng.o2.type='triangle';eng.o3.type='sine';eng.o1.frequency.value=50;eng.o2.frequency.value=101;eng.o3.frequency.value=420;
  eng.o1.connect(eng.lp);eng.o2.connect(eng.lp);chain(eng.lp,eng.g,out);chain(eng.o3,eng.wg,out);
  eng.n.buffer=nb;eng.n.loop=true;chain(eng.n,eng.nf,eng.ng,out);
  [eng.o1,eng.o2,eng.o3,eng.n].forEach(function(o){o.start(t)});
 }
 var f=46+v*52+(boost?22:0);
 eng.o1.frequency.setTargetAtTime(f,t,0.12);eng.o2.frequency.setTargetAtTime(f*2.01,t,0.12);eng.o3.frequency.setTargetAtTime(300+v*520+(boost?380:0),t,0.15);
 eng.lp.frequency.setTargetAtTime(260+v*520+(boost?600:0),t,0.12);
 eng.g.gain.setTargetAtTime(v?0.10+(boost?0.05:0):0,t,0.12);eng.wg.gain.setTargetAtTime(v?0.012+v*0.012+(boost?0.02:0):0,t,0.15);
 eng.ng.gain.setTargetAtTime(v?0.035+v*0.03:0,t,0.2);
}
/* cartoon crash: crunchy noise + low thud + light metal ping */
function crash(v){if(!ok())return;v=v||1;var t=now();
 var n=noise(t,0.45),ng=G(0),lp=F('lowpass',2400);lp.frequency.setValueAtTime(3000,t);lp.frequency.exponentialRampToValueAtTime(400,t+0.4);env(ng,t,0.002,0.7*v,0.38);chain(n,lp,ng,out);
 var k=osc('sine',140,t,0.4),kg=G(0);k.frequency.exponentialRampToValueAtTime(40,t+0.3);env(kg,t,0.002,0.8*v,0.3);chain(k,kg,out);
 [[620,0.12],[1450,0.07]].forEach(function(p){var o=osc('square',p[0],t+0.03,0.3),g=G(0);env(g,t+0.03,0.002,p[1]*v,0.2);chain(o,F('lowpass',3000),g,out)});
}
/* bike bumped off: springy cartoon "boing" */
function bump(){if(!ok())return;var t=now();
 var o=osc('triangle',220,t,0.5),g=G(0),vib=osc('sine',18,t,0.5),vg=G(30);o.frequency.setValueAtTime(220,t);o.frequency.exponentialRampToValueAtTime(760,t+0.16);o.frequency.exponentialRampToValueAtTime(480,t+0.45);
 vib.connect(vg);vg.connect(o.frequency);env(g,t,0.004,0.28,0.42);chain(o,g,out);
 var k=osc('sine',120,t,0.18),kg=G(0);k.frequency.exponentialRampToValueAtTime(60,t+0.12);env(kg,t,0.002,0.5,0.12);chain(k,kg,out);
}
/* smoke puff */
function puff(){if(!ok())return;var t=now(),n=noise(t,0.5),bp=F('bandpass',1200,0.8),g=G(0);bp.frequency.setValueAtTime(1800,t);bp.frequency.exponentialRampToValueAtTime(300,t+0.45);env(g,t,0.01,0.35,0.42);chain(n,bp,g,out)}
/* N2O boost: rising whoosh + bright sweep */
function boost(){if(!ok())return;var t=now();
 var n=noise(t,1.1),bp=F('bandpass',400,1.1),g=G(0);bp.frequency.setValueAtTime(300,t);bp.frequency.exponentialRampToValueAtTime(3800,t+0.7);env(g,t,0.05,0.5,0.95);chain(n,bp,g,out);
 var o=osc('sawtooth',180,t,0.9),og=G(0),lp=F('lowpass',2400);o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(900,t+0.6);env(og,t,0.02,0.09,0.8);chain(o,lp,og,out);
}
/* checkpoint chime */
function chime(){if(!ok())return;var t=now();[76,83,88].forEach(function(m,i){var f=440*Math.pow(2,(m-69)/12),tt=t+i*0.09,o=osc('square',f,tt,0.4),g=G(0);env(g,tt,0.004,0.09,0.32);chain(o,F('lowpass',4200),g,out)})}
/* nitro pickup */
function pickup(){if(!ok())return;var t=now();[72,79,84,91].forEach(function(m,i){var f=440*Math.pow(2,(m-69)/12),tt=t+i*0.045,o=osc('square',f,tt,0.12),g=G(0);env(g,tt,0.002,0.08,0.09);chain(o,g,out)})}
/* oil slick: wobbly slide */
function squelch(){if(!ok())return;var t=now();
 var o=osc('sine',300,t,0.7),g=G(0),vib=osc('sine',9,t,0.7),vg=G(60);o.frequency.setValueAtTime(320,t);o.frequency.exponentialRampToValueAtTime(110,t+0.6);vib.connect(vg);vg.connect(o.frequency);env(g,t,0.01,0.3,0.6);chain(o,g,out);
 var n=noise(t,0.6),ng=G(0);env(ng,t,0.01,0.2,0.5);chain(n,F('lowpass',700),ng,out);
}
/* biker about to swerve: two quick beeps */
function warn(){if(!ok())return;var t=now();[0,0.12].forEach(function(d){var o=osc('square',990,t+d,0.07),g=G(0);env(g,t+d,0.002,0.05,0.05);chain(o,g,out)})}
/* van hatch drops something */
function clunk(){if(!ok())return;var t=now(),o=osc('square',90,t,0.2),g=G(0);o.frequency.exponentialRampToValueAtTime(50,t+0.15);env(g,t,0.002,0.25,0.15);chain(o,F('lowpass',600),g,out)}
function setPaused(p){paused=!!p;if(!ctx)return;if(paused)ctx.suspend();else ctx.resume()}
window.RosadoSFX={unlock:unlock,clank:clank,strain:strain,thump:thump,whiff:whiff,sting:sting,blip:blip,tick:tick,combo:combo,rack:rack,fanfare:fanfare,setPaused:setPaused,
 engine:engine,crash:crash,bump:bump,puff:puff,boost:boost,chime:chime,pickup:pickup,squelch:squelch,warn:warn,clunk:clunk};
})();
