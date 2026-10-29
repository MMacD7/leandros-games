/* Rosado Nights · v0.2.0
   Level 1 "Causeway Chase": drive Richie across the rainy neon bridge to Shred Zeppelin (js/drive.js).
   Level 2 "Reps for Jesus" (the gym):
   Phase 1: bench press 400 lbs × 3 (tap PUSH fast; each rep needs more taps and the bar sinks faster).
   Phase 2: heavy bag timing (tap PUNCH while the marker is in the pink zone; 12 good hits before time runs out).
   No network, no tracking. localStorage only keeps level-1-done + best combo / best bag time. */
(function(){
"use strict";
var VERSION='0.2.0';
var T=window.RosadoTheme,SFX=window.RosadoSFX,ART=window.RosadoArt,DRIVE=window.RosadoDrive;
var $=function(id){return document.getElementById(id)};
var app=$('app'),cv=$('scene'),g=cv.getContext('2d'),buf=document.createElement('canvas'),bg=null,bgW=0;
var LH=ART.H;
/* Optional art: put images in game/assets/ and list them here to replace the canvas art (slot boxes are documented in art.js).
   Leave a slot out (or let the file fail to load) and the built-in canvas art is used. Example:
   var SPRITES={'bg':'assets/gym-bg.webp?v=0.1.0','apollo-spot':'assets/apollo-spot.webp?v=0.1.0','richie-bench-down':'assets/richie-bench-down.webp?v=0.1.0'}; */
var AV='?v=0.2.0',SPRITES={bg:'assets/gym-bg.webp'+AV,bench:'assets/bench.webp'+AV,bag:'assets/bag.webp'+AV,
 'richie-idle':'assets/richie-idle.webp'+AV,'richie-punch':'assets/richie-punch.webp'+AV,
 'richie-bench-body':'assets/richie-bench-body.webp'+AV,'richie-bench-arms':'assets/richie-bench-arms.webp'+AV,'richie-bench-bar':'assets/richie-bench-bar.webp'+AV,
 'apollo-cross':'assets/apollo-cross.webp'+AV,'apollo-lean':'assets/apollo-lean.webp'+AV,
 'richie-portrait':'assets/richie-portrait.webp'+AV,'apollo-portrait':'assets/apollo-portrait.webp'+AV};
var DSPRITES={car:'assets/drive-car.webp'+AV,biker:'assets/drive-biker.webp'+AV,'biker-lean':'assets/drive-biker-lean.webp'+AV,van:'assets/drive-van.webp'+AV,
 oil:'assets/drive-oil.webp'+AV,spikes:'assets/drive-spikes.webp'+AV,nitro:'assets/drive-nitro.webp'+AV,sky:'assets/drive-sky.webp'+AV,gym:'assets/drive-gym.webp'+AV,'biker-portrait':'assets/biker-portrait.webp'+AV};

/* ---------- difficulty ---------- */
/* taps: taps needed with no drain; drain: bar sink per second while tapping; idle: extra sink multiplier after IDLE seconds without a tap */
var REPS=[{taps:8,drain:0.12},{taps:11,drain:0.20},{taps:14,drain:0.28}],IDLE=0.35,IDLE_MULT=2.5;
var BAG={target:12,time:45,every:3,
 speed:[0.75,0.95,1.2,1.45],   /* marker sweeps per second across the track */
 zone:[0.13,0.115,0.10,0.09],  /* half-width of the pink zone (track = 1) */
 center:[0.5,0.6,0.42,0.55],perfect:0.035,cdGood:0.18,cdMiss:0.45};

/* ---------- state ---------- */
var S,musicOn=true,paused=false,started=false,last=0,clock=0,level=1,dsnap=null;
function fresh(){return {phase:'intro',rep:0,h:0,hDisp:0,peak:0,lastTap:-9,taps:0,tapsPerRep:[],timer:0,
 hits:0,combo:0,bestCombo:0,misses:0,perfects:0,timeLeft:BAG.time,m:0,cd:0,punchT:-1,bagAng:0,bagVel:0,bagFlash:0,bagSquash:0,
 parts:[],shake:0,shout:'',shoutT:0,apolloExpr:'smile',richieExpr:'calm',apolloArms:'cross',fistT:0,bagStart:0,record:false}}
S=fresh();
var store={get:function(){try{return JSON.parse(localStorage.getItem('rosadoNights.l1')||'{}')||{}}catch(e){return {}}},
 set:function(o){try{var c=store.get();for(var k in o)c[k]=o[k];localStorage.setItem('rosadoNights.l1',JSON.stringify(c))}catch(e){}}};

/* ---------- layout ---------- */
var W=400,scale=1,ox=0,oy=0,dpr=1;
function resize(){
 var v=$('view'),cw=v.clientWidth,ch=v.clientHeight;if(!cw||!ch)return;
 dpr=Math.min(window.devicePixelRatio||1,2);
 W=Math.max(ch>cw*0.9?260:300,Math.min(500,Math.round(cw/ch*LH)));
 scale=Math.min(cw/W,ch/LH);ox=(cw-W*scale)/2;oy=(ch-LH*scale)/2;
 cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr);
 if(W!==bgW){bg=ART.makeBg(W);bgW=W;buf.width=W;buf.height=LH}
 render();
}

/* ---------- UI helpers ---------- */
function setMode(m){app.dataset.mode=m||''}
function hud(on){app.dataset.hud=on?'1':'0'}
function ctl(on){app.dataset.ctl=on?'1':'0'}
function shout(txt,dur){var el=$('shout');if(S.shout===txt&&S.shoutT>0){S.shoutT=dur||1.2;return}S.shout=txt;S.shoutT=dur||1.2;el.textContent=txt;el.classList.add('on')}
function pop(txt,cls){var el=$('pop');el.className='';void el.offsetWidth;el.textContent=txt;el.className=cls+' go'}
function updHud(){
 $('rep').textContent='REP '+Math.min(S.rep+1,3)+'/3';
 $('hits').textContent='HITS '+S.hits+'/'+BAG.target;
 $('time').textContent='TIME '+Math.ceil(Math.max(0,S.timeLeft));
 $('combo').textContent='COMBO x'+S.combo;
}

/* ---------- dialogue ---------- */
var DQ=null;
function talk(lines,done){
 DQ={lines:lines,i:-1,done:done,typed:0,full:'',shownAt:0};ctl(false);$('dialog').hidden=false;nextLine();
}
function nextLine(){
 DQ.i++;if(DQ.i>=DQ.lines.length){var d=DQ.done;DQ=null;$('dialog').hidden=true;if(d)d();return}
 var L=DQ.lines[DQ.i],who=$('who');who.textContent=L.who==='richie'?'RICHIE':L.who==='biker'?'BIKER GANG':'APOLLO';who.className='who '+L.who;
 if(L.on)L.on();
 face(L.who,L.expr||'smile');DQ.full=L.text;DQ.typed=0;DQ.shownAt=clock;$('line').textContent='';
 if(L.who==='apollo')S.apolloExpr=L.expr||'smile';
}
function face(who,expr){if(who==='biker')DRIVE.portrait($('face'));else ART.portrait($('face'),who,expr)}
function tapDialog(){
 if(!DQ||paused)return;if(clock-DQ.shownAt<0.25)return;
 if(DQ.typed<DQ.full.length){DQ.typed=DQ.full.length;$('line').textContent=DQ.full;return}
 SFX.blip();nextLine();
}
function typeTick(dt){if(!DQ||DQ.typed>=DQ.full.length)return;var n=Math.min(DQ.full.length,DQ.typed+dt*48);if(Math.floor(n)!==Math.floor(DQ.typed))$('line').textContent=DQ.full.slice(0,Math.floor(n));DQ.typed=n;if(n>=DQ.full.length)$('line').textContent=DQ.full}

var A=function(t,e){return {who:'apollo',text:t,expr:e||'smile'}},Rc=function(t,e){return {who:'richie',text:t,expr:e||'smile'}},Bk=function(t,f){return {who:'biker',text:t,on:f}};
var DLINES={
 intro:[Rc('Gotta get to Shred Zeppelin. Big lift tonight.','calm'),
  Bk('There he is! Get him!',function(){DRIVE.spawnIntro()}),
  Rc('Not tonight, fellas. Hold on tight!','strain'),
  Rc('Tap \u25C0 \u25B6 to switch lanes. Swerve into the bikers to bump them off. Tap BOOST to zoom!','smile')],
 wreck:[Rc('Whoa! That was close. Back to the checkpoint. Let\u2019s go again!','smile')],
 arrive:[Rc('Made it to Shred Zeppelin! Those bikers couldn\u2019t keep up.','smile'),Rc('Now let\u2019s go lift something heavy.','calm')]
};
var LINES={
 intro:[A('Time to smash that record before you go back on the streets!','cheer'),
  Rc('400 pounds. Three reps. Here at Shred Zeppelin. Let\u2019s do this.','calm'),
  A('I\u2019m right behind you. Tap PUSH fast to drive the bar up. If you stop, it sinks!')],
 between:[[A('That\u2019s one! Strong and steady. Two more!','cheer')],[A('One more! Push! This one\u2019s for the record!','cheer')]],
 record:[A('NEW RECORD! 400 pounds, three times!','cheer'),Rc('Thanks for the spot, brother.','smile'),
  A('Now the heavy bag. Tap PUNCH when the marker is in the pink zone. 12 good hits!')],
 timeout:[A('Time! So close. Shake it off and go again!','smile')],
 bagDone:[A('That\u2019s the Richie I know! Fast hands, strong heart.','cheer'),Rc('The streets need me. Let\u2019s go.','calm')]
};

/* ---------- flow ---------- */
function begin(lv){
 SFX.unlock();if(musicOn&&T&&T.supported)T.play();
 started=true;$('intro').hidden=true;if(lv===2)startLevel();else startDrive();
}
function setLevel(lv){level=lv;app.dataset.level=String(lv);document.title=lv===1?'Rosado Nights \u00B7 Level 1: Causeway Chase':'Rosado Nights \u00B7 Level 2: Reps for Jesus \u00B7 Shred Zeppelin';
 var a=$('scene');a.setAttribute('aria-label',lv===1?'Causeway Chase: Richie drives to Shred Zeppelin':'Shred Zeppelin: Richie and Apollo')}
function cards(){['done','done1'].forEach(function(id){$(id).hidden=true})}
/* ---------- level 1: the drive ---------- */
function startDrive(){
 setLevel(1);S=fresh();S.phase='drive';cards();$('record').hidden=true;setMode('');hud(true);dctl(false);DRIVE.intro();setSelf(false);
 talk(DLINES.intro,function(){DRIVE.go();dctl(true);shout('GO! GO! GO!',1.2)});
}
function dctl(on){app.dataset.dctl=on?'1':'0'}
DRIVE.on('hit',function(k){shout(k==='oil'?'SLIPPERY!':k==='spikes'?'OUCH! SPIKES!':'HEY! WATCH IT!',0.9)});
DRIVE.on('bump',function(n){shout(['BUMPED!','SEE YA!','BOING!','SPIN OUT!','BYE BYE!'][n%5],0.9)});
DRIVE.on('checkpoint',function(){shout('CHECKPOINT!',1.3)});
DRIVE.on('van',function(){shout('ARMORED VAN AHEAD!',1.5)});
DRIVE.on('boost',function(){shout('N2O BOOST!',0.8)});
DRIVE.on('nitro',function(){shout('+N2O',0.6)});
DRIVE.on('smash',function(){shout('SMASHED IT!',0.7)});
DRIVE.on('wrecking',function(){dctl(false);shout('WHOA!',1.2)});
DRIVE.on('wreck',function(){if(DRIVE.self())setTimeout(function(){if(DQ&&DRIVE.self()&&!paused){DQ.typed=DQ.full.length;nextLine()}},1800);talk(DLINES.wreck,function(){DRIVE.retry();dctl(true);shout('FROM THE CHECKPOINT!',1.3)})});
DRIVE.on('arrive',function(){dctl(false);shout('SHRED ZEPPELIN AHEAD!',1.6)});
DRIVE.on('finish',function(st){SFX.fanfare();store.set({l1done:true});talk(DLINES.arrive,function(){showDone1(st)})});
function showDone1(st){
 S.phase='done1';hud(false);SFX.engine(0);
 $('stats1').innerHTML='Bikers bumped: <b>'+st.bumps+'</b> \u00B7 Oil &amp; spikes dodged: <b>'+st.dodged+'</b><br>Time: <b>'+st.time.toFixed(1)+'s</b> \u00B7 Health left: <b>'+Math.round(DRIVE.snap().health)+'%</b>'+(st.retries?' \u00B7 retries: '+st.retries:'');
 $('done1').hidden=false;
}
var dh={};function setTxt(id,v){if(dh[id]!==v){dh[id]=v;$(id).textContent=v}}function setW(id,v){v=Math.round(v*1000)/10;if(dh[id]!==v){dh[id]=v;$(id).style.width=v+'%'}}
function driveHud(){var d=DRIVE.snap();dsnap=d;
 var seg=Math.ceil(d.health/10);if(dh.seg!==seg){dh.seg=seg;var c=$('hpbar').children;for(var i=0;i<c.length;i++)c[i].className=i<seg?(seg<=3?'on low':'on'):''}
 setTxt('dist',(d.dist/1000).toFixed(2));setW('distFill',1-d.dist/DRIVE.CFG.dist);
 setTxt('kmh',String(Math.round(d.kmh)));setTxt('gear',String(Math.max(1,Math.min(6,Math.floor(d.kmh/38)+1))));setW('n2oFill',d.meter);
 var rdy=d.meter>=DRIVE.CFG.boostMin&&d.boost<=0&&d.st==='run';if(dh.rdy!==rdy){dh.rdy=rdy;$('boost').classList.toggle('off',!rdy)}
 if(dh.on!==(d.boost>0)){dh.on=d.boost>0;app.classList.toggle('boosting',dh.on)}
}
/* ---------- level 2: the gym ---------- */
function startLevel(){
 setLevel(2);dctl(false);SFX.engine(0);setSelf(false);cards();app.classList.remove('boosting');
 S=fresh();S.phase='talk';$('record').hidden=true;setMode('press');hud(true);updHud();
 talk(LINES.intro,startRep);
}
function startRep(){S.pressStarted=true;S.phase='press';S.h=0;S.peak=0;S.taps=0;S.lastTap=clock;setMode('press');updHud();ctl(true);$('action').textContent='PUSH!';shout('TAP FAST!',1.2)}
function repDone(){
 S.tapsPerRep.push(S.taps);S.phase='lockout';S.timer=0;ctl(false);SFX.clank(1);S.shake=1.2;shout('REP '+(S.rep+1)+'!',1)}
function afterLower(){
 S.rep++;
 if(S.rep<3){S.phase='talk';updHud();talk(LINES.between[S.rep-1],startRep)}
 else{S.phase='record';S.timer=0;S.record=true;$('record').hidden=false;SFX.rack();setTimeout(function(){if(S.phase==='record')SFX.sting()},180);confetti(70);S.apolloExpr='cheer'}
}
function startBag(){
 S.phase='bag';S.hits=0;S.combo=0;S.misses=0;S.perfects=0;S.timeLeft=BAG.time;S.m=0;S.cd=0;S.bagStart=clock;S.apolloArms='cross';S.richieExpr='calm';
 setMode('bag');updHud();ctl(true);$('action').textContent='PUNCH!';shout('12 GOOD HITS!',1.4);
}
function bagLevel(){return Math.min(BAG.speed.length-1,Math.floor(S.hits/BAG.every))}
function bagDone(){
 S.phase='bagEnd';ctl(false);S.apolloArms='fist';S.apolloExpr='cheer';SFX.fanfare();confetti(40);
 var used=BAG.time-S.timeLeft,b=store.get(),o={bestCombo:Math.max(b.bestCombo||0,S.bestCombo),bestBagTime:b.bestBagTime?Math.min(b.bestBagTime,used):used,record:'400 LBS x 3'};
 store.set(o);S.result={used:used,best:o};
 setTimeout(function(){if(S.phase==='bagEnd')talk(LINES.bagDone,showDone)},900);
}
function showDone(){
 S.phase='done';hud(false);setMode('');var r=S.result;
 $('stats').innerHTML='Bench press: <b>400 LBS × 3</b> · NEW RECORD<br>Heavy bag: <b>'+S.hits+' hits</b> in '+r.used.toFixed(1)+'s · best combo <b>x'+S.bestCombo+'</b> ('+S.perfects+' perfect)<br><small>Your best: combo x'+r.best.bestCombo+' · fastest bag '+r.best.bestBagTime.toFixed(1)+'s</small>';
 $('done').hidden=false;
}

/* ---------- actions ---------- */
function action(){
 if(paused)return;SFX.unlock();
 if(S.phase==='press'){
  var c=REPS[S.rep];S.h=Math.min(1,S.h+1/c.taps);S.taps++;S.lastTap=clock;S.peak=Math.max(S.peak,S.h);
  SFX.strain(S.h);S.shake=Math.max(S.shake,0.35+S.rep*0.25);
  if(S.h>=1)repDone();else if(S.h>0.72)shout('LOCK IT OUT!',0.8);else if(S.rep===2&&S.h>0.4)shout('ONE MORE! PUSH!',0.8);
  pressBtn();
 }else if(S.phase==='bag'){
  if(S.cd>0)return;var L=bagLevel(),now=performance.now()/1000,pos=markerPos(S.m+BAG.speed[L]*Math.min(0.05,Math.max(0,now-last/1000))),d=Math.abs(pos-BAG.center[L]);
  S.punchT=0;S.lastPunch=clock;pressBtn();
  if(d<=BAG.perfect||d<=BAG.zone[L]){
   var perf=d<=BAG.perfect;S.hits++;S.combo++;S.bestCombo=Math.max(S.bestCombo,S.combo);if(perf)S.perfects++;
   S.cd=BAG.cdGood;S.bagVel-=perf?1.9:1.3;S.bagFlash=1;S.bagSquash=1;S.shake=perf?1:0.6;
   setTimeout(function(){SFX.thump(perf?1.3:1);if(S.combo>1&&S.combo%5===0)SFX.combo(S.combo/5)},40);
   pop(perf?'PERFECT!':'GOOD!',perf?'perfect':'good');impact(perf);
   if(S.combo>=3){S.apolloArms='fist';S.fistT=0.8}
   if(S.hits>=BAG.target){updHud();bagDone();return}
   if(S.hits%BAG.every===0)shout('FASTER!',1);
  }else{S.combo=0;S.misses++;S.cd=BAG.cdMiss;SFX.whiff();pop('MISS','miss')}
  updHud();
 }
}
function pressBtn(){var b=$('action');b.classList.add('hit');clearTimeout(pressBtn.t);pressBtn.t=setTimeout(function(){b.classList.remove('hit')},70)}
function markerPos(m){m=m%2;return m<1?m:2-m}

/* ---------- particles ---------- */
function sweat(){var a=ART.anchors(W,S.hDisp).head;S.parts.push({x:a[0]+(Math.random()*10-4),y:a[1]-6,vx:(Math.random()-0.5)*16,vy:-18-Math.random()*16,life:0.9,c:'#bfeaff',s:1.2,tall:1.6,grav:120})}
function impact(perf){var an=ART.anchors(W,0),x=an.impact?an.impact[0]:an.bagX+18+Math.sin(S.bagAng)*80,y=an.impact?an.impact[1]:112;for(var i=0;i<(perf?14:8);i++){var a=Math.random()*Math.PI-Math.PI/2;S.parts.push({x:x,y:y+Math.random()*10-5,vx:Math.cos(a)*80+30,vy:Math.sin(a)*80,life:0.35,c:perf?'#ffd23a':'#ffffff',s:1.6,grav:0})}}
function confetti(n){var C=['#ff3ad8','#29d6ff','#ffd23a','#ffffff'];for(var i=0;i<n;i++)S.parts.push({x:Math.random()*W,y:-5-Math.random()*40,vx:(Math.random()-0.5)*30,vy:30+Math.random()*40,life:2.6,c:C[i%4],s:2,grav:20})}

/* ---------- update ---------- */
function update(dt){
 clock+=dt;typeTick(dt);
 if(S.shoutT>0){S.shoutT-=dt;if(S.shoutT<=0)$('shout').classList.remove('on')}
 if(level===1){DRIVE.update(dt);driveHud();var d=dsnap;SFX.engine(S.phase==='drive'&&d.st!=='done'?Math.max(0.05,d.kmh/200):0,d.boost>0);return}
 if(S.phase==='press'){
  var c=REPS[S.rep],idle=clock-S.lastTap>IDLE,dr=c.drain*(idle?IDLE_MULT:1);
  S.h=Math.max(0,S.h-dr*dt);
  if(idle&&S.peak>0.25&&S.h<S.peak-0.15)shout('DON\u2019T STOP! PUSH!',0.9);
  S.richieExpr=S.h>0.03?'strain':'calm';S.apolloExpr='cheer';
  if(!idle&&Math.random()<dt*(1.5+S.rep*2.5)*(0.4+S.h))sweat();
  app.classList.toggle('strain',!idle);
 }else app.classList.remove('strain');
 if(S.phase==='lockout'){S.timer+=dt;S.h=1;if(S.timer>0.55){if(S.rep===2){afterLower()}else{S.phase='lower';S.timer=0}}}
 else if(S.phase==='lower'){S.timer+=dt;S.h=Math.max(0,1-S.timer/0.9);S.richieExpr='calm';if(S.timer>=0.9){S.h=0;afterLower()}}
 else if(S.phase==='record'){S.timer+=dt;S.h=1;S.richieExpr='smile';if(S.timer>2.8){S.phase='talk';$('record').hidden=true;talk(LINES.record,startBag)}}
 if(S.phase==='bag'){
  var L=bagLevel();S.m=(S.m+BAG.speed[L]*dt)%2;S.cd=Math.max(0,S.cd-dt);
  var prev=Math.ceil(S.timeLeft);S.timeLeft-=dt;if(Math.ceil(S.timeLeft)!==prev){updHud();if(S.timeLeft<=10&&S.timeLeft>0)SFX.tick()}
  if(S.timeLeft<=0){S.timeLeft=0;S.phase='talk';ctl(false);updHud();talk(LINES.timeout,startBag)}
  var z=BAG.zone[L],cc=BAG.center[L];$('zone').style.left=((cc-z)*100)+'%';$('zone').style.width=(z*200)+'%';
  $('perfect').style.left=((cc-BAG.perfect)*100)+'%';$('perfect').style.width=(BAG.perfect*200)+'%';
  $('marker').style.left=(markerPos(S.m)*100)+'%';
  if(S.fistT>0){S.fistT-=dt;if(S.fistT<=0)S.apolloArms='cross'}
  S.richieExpr=S.punchT>=0?'strain':'calm';
 }
 /* display smoothing */
 S.hDisp+=(S.h-S.hDisp)*Math.min(1,dt*18);
 $('meterFill').style.width=(S.h*100)+'%';
 /* bag physics */
 S.bagVel+=(-20*S.bagAng-1.3*S.bagVel)*dt;S.bagAng+=S.bagVel*dt;S.bagAng=Math.max(-0.6,Math.min(0.6,S.bagAng));
 if(S.phase!=='bag'&&S.phase!=='bagEnd')S.bagAng+=Math.sin(clock*0.9)*0.0004;
 S.bagFlash=Math.max(0,S.bagFlash-dt*6);S.bagSquash=Math.max(0,S.bagSquash-dt*8);
 if(S.punchT>=0){S.punchT+=dt;if(S.punchT>0.22)S.punchT=-1}
 S.shake=Math.max(0,S.shake-dt*3);
 for(var i=S.parts.length-1;i>=0;i--){var p=S.parts[i];p.vy+=(p.grav||0)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)S.parts.splice(i,1)}
}

/* ---------- render ---------- */
var flickT=0;
function render(){
 if(!bg)return;var b=buf.getContext('2d');
 if(level===1){b.imageSmoothingEnabled=false;b.fillStyle='#07040d';b.fillRect(0,0,W,LH);DRIVE.render(b,W,clock,T&&T.isPlaying()?T.level():0);blit();return}
 var strain=S.phase==='press'&&clock-S.lastTap<IDLE?1:0,amp=S.shake*(1+S.rep*0.5);
 flickT=(Math.sin(clock*7.3)+Math.sin(clock*2.1))>1.85;
 var lay=(S.phase==='bag'||S.phase==='bagEnd'||S.phase==='done'||(S.phase==='talk'&&S.tapsPerRep.length===3))?'bag':(!S.pressStarted&&(S.phase==='intro'||S.phase==='talk'))?'stand':'press';
 ART.drawScene(b,bg,{layout:lay,t:clock,boxPose:clock-(S.lastPunch||-9)<0.6?'punch':'idle',phase:S.phase==='bag'||S.phase==='bagEnd'||S.phase==='done'||(S.phase==='talk'&&S.tapsPerRep.length===3)?'bag':'press',
  barH:S.hDisp,dip:strain?Math.sin(clock*55)*0.8*(1+S.rep):0,strain:strain,richieExpr:S.richieExpr,apolloExpr:S.apolloExpr,apolloArms:S.apolloArms,
  bagAng:S.bagAng,bagFlash:S.bagFlash,bagSquash:S.bagSquash,punch:S.punchT>=0?Math.sin(Math.PI*Math.min(1,S.punchT/0.22)):0,
  parts:S.parts,shakeX:(Math.random()-0.5)*amp*2,shakeY:(Math.random()-0.5)*amp*1.5,flicker:flickT,pulse:T&&T.isPlaying()?T.level():0});
 blit();
}
function blit(){
 g.setTransform(1,0,0,1,0,0);g.fillStyle='#07040d';g.fillRect(0,0,cv.width,cv.height);g.imageSmoothingEnabled=false;
 g.drawImage(buf,Math.round(ox*dpr),Math.round(oy*dpr),Math.round(W*scale*dpr),Math.round(LH*scale*dpr));
}
function loop(ts){
 var dt=Math.min(0.05,Math.max(0,(ts-last)/1000));last=ts;
 if(!paused)update(dt);render();requestAnimationFrame(loop);
}

/* ---------- pause ---------- */
function setPaused(p){
 if(p===paused)return;paused=p;$('pause').hidden=!p;
 if(p){if(T&&T.isPlaying())T.pause();SFX.setPaused(true);SFX.engine(0)}
 else{SFX.setPaused(false);if(musicOn&&T&&T.supported)T.play();S.lastTap=clock}
}
function musicUI(){var m=$('music');m.textContent=musicOn?'\u266B MUSIC: ON':'\u266B MUSIC: OFF';m.setAttribute('aria-pressed',musicOn?'true':'false')}

/* ---------- wiring ---------- */
$('start').addEventListener('click',function(){begin(1)});
$('startL2').addEventListener('click',function(){begin(2)});
$('next2').addEventListener('click',function(){SFX.unlock();if(musicOn&&T&&T.supported&&!T.isPlaying())T.play();startLevel()});
$('again1').addEventListener('click',function(){SFX.unlock();if(musicOn&&T&&T.supported&&!T.isPlaying())T.play();startDrive()});
$('toL1').addEventListener('click',function(){SFX.unlock();if(musicOn&&T&&T.supported&&!T.isPlaying())T.play();startDrive()});
function canPause(){return started&&S.phase!=='done'&&S.phase!=='done1'}
function dsteer(dir){if(paused||level!==1||app.dataset.dctl!=='1')return;SFX.unlock();if(DRIVE.self()){setSelf(false);shout('SELF DRIVE OFF',0.9)}if(DRIVE.steer(dir))SFX.blip()}
function setSelf(on){DRIVE.setSelf(on);var b=$('selfBtn');b.setAttribute('aria-pressed',on?'true':'false');$('selfState').textContent=on?'ON':'OFF';app.classList.toggle('selfdrive',!!on);$('selfInd').hidden=!on}
function toggleSelf(){if(paused||level!==1||app.dataset.dctl!=='1')return;SFX.unlock();SFX.blip();var on=!DRIVE.self();setSelf(on);shout(on?'SELF DRIVE ON':'SELF DRIVE OFF',0.9)}
function dboost(){if(paused||level!==1||app.dataset.dctl!=='1')return;SFX.unlock();DRIVE.boost()}
[['left',function(){dsteer(-1)}],['right',function(){dsteer(1)}],['boost',dboost],['selfBtn',toggleSelf]].forEach(function(b){var el=$(b[0]);
 el.addEventListener('pointerdown',function(e){e.preventDefault();el.classList.add('hit');setTimeout(function(){el.classList.remove('hit')},90);b[1]()});
 el.addEventListener('click',function(e){e.preventDefault()});el.addEventListener('contextmenu',function(e){e.preventDefault()})});
/* swipe on the road to change lanes */
var sw=null;$('view').addEventListener('pointerdown',function(e){if(level===1)sw={x:e.clientX,y:e.clientY,t:performance.now(),done:false}});
$('view').addEventListener('pointermove',function(e){if(!sw||sw.done)return;var dx=e.clientX-sw.x;if(Math.abs(dx)>28&&Math.abs(dx)>Math.abs(e.clientY-sw.y)){sw.done=true;dsteer(dx<0?-1:1)}});
window.addEventListener('pointerup',function(){sw=null});window.addEventListener('pointercancel',function(){sw=null});
var act=$('action');
act.addEventListener('pointerdown',function(e){e.preventDefault();action()});
act.addEventListener('click',function(e){e.preventDefault()});
act.addEventListener('contextmenu',function(e){e.preventDefault()});
$('dialog').addEventListener('click',tapDialog);
$('pauseBtn').addEventListener('click',function(){if(canPause())setPaused(true)});
$('resume').addEventListener('click',function(){setPaused(false)});
$('restart').addEventListener('click',function(){setPaused(false);DQ=null;$('dialog').hidden=true;if(level===1)startDrive();else startLevel()});
$('music').addEventListener('click',function(){musicOn=!musicOn;musicUI()});
$('again').addEventListener('click',function(){SFX.unlock();if(musicOn&&T&&T.supported&&!T.isPlaying())T.play();startLevel()});
document.addEventListener('keydown',function(e){
 if(e.repeat)return;
 if(level===1&&app.dataset.dctl==='1'&&!paused&&!DQ){
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A'){e.preventDefault();dsteer(-1);return}
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D'){e.preventDefault();dsteer(1);return}
  if(e.key===' '||e.key==='ArrowUp'||e.key==='w'||e.key==='Enter'){e.preventDefault();dboost();return}}
 if(e.key===' '||e.key==='Enter'){if(app.dataset.ctl==='1'&&!paused){e.preventDefault();action()}else if(DQ&&!paused){e.preventDefault();tapDialog()}}
 else if(e.key==='Escape'||e.key==='p'){if(canPause())setPaused(!paused)}
});
document.addEventListener('visibilitychange',function(){if(document.hidden&&canPause())setPaused(true)});
document.addEventListener('gesturestart',function(e){e.preventDefault()});
window.addEventListener('resize',resize);window.addEventListener('orientationchange',function(){setTimeout(resize,150)});
if(!T||!T.supported){musicOn=false}
musicUI();hud(false);ctl(false);dctl(false);setLevel(1);resize();if(store.get().l1done)$('startL2').classList.add('unlocked');
ART.loadSprites(SPRITES,function(){bgW=0;resize();if(DQ)face(DQ.lines[DQ.i].who,DQ.lines[DQ.i].expr)});
DRIVE.loadSprites(DSPRITES,function(){if(DQ)face(DQ.lines[DQ.i].who,DQ.lines[DQ.i].expr)});requestAnimationFrame(function(ts){last=ts;loop(ts)});

/* test/debug hook (read-only snapshot, no network) */
window.__rosado={version:VERSION,REPS:REPS,BAG:BAG,IDLE:IDLE,IDLE_MULT:IDLE_MULT,
 snap:function(){var L=bagLevel();return {level:level,drive:DRIVE.snap(),phase:S.phase,rep:S.rep,h:S.h,taps:S.taps,tapsPerRep:S.tapsPerRep.slice(),hits:S.hits,combo:S.combo,bestCombo:S.bestCombo,misses:S.misses,
  timeLeft:S.timeLeft,marker:markerPos(S.m),dir:(S.m%2)<1?1:-1,zone:[BAG.center[L]-BAG.zone[L],BAG.center[L]+BAG.zone[L]],speed:BAG.speed[L],cd:S.cd,paused:paused,dialog:!!DQ,line:DQ?DQ.full:'',
  musicOn:musicOn,music:!!(T&&T.isPlaying()),W:W}},
 loadSprites:function(map){return ART.loadSprites(map,function(){bgW=0;resize()})},spriteMode:function(){return ART.spriteMode()},driveSpriteMode:function(){return DRIVE.spriteMode()},
 dev:DRIVE.dev,CFG:DRIVE.CFG};
})();
