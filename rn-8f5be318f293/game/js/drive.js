/* Rosado Nights · Level 1 "Causeway Chase" (v0.2.0)
   Richie drives his grey electric fastback across a rainy neon bridge to Shred Zeppelin while a masked biker gang
   and a black armored van try to stop him. Lane-based pseudo-3D chase, drawn on the same low-res 225 px tall canvas
   as the gym level. Cartoon action only: bumped bikers spin out in a puff of smoke and stars; nobody gets hurt.
   Art: game/assets/drive-*.webp (built by build/build_drive.py); every sprite has a canvas-drawn fallback.
   API (window.RosadoDrive): reset(), intro(), spawnIntro(), go(), retry(), steer(dir), boost(), update(dt), render(g,W,t,pulse),
        on(evt,fn), snap(), portrait(canvas), loadSprites(map,cb), spriteMode(), CFG, dev.* (test hooks). No network. */
(function(){
"use strict";
var H=225,HY=80,PY=203,DZ=10,ZFAR=150;
var SFX=window.RosadoSFX||{};function sfx(n,a,b){if(SFX[n])SFX[n](a,b)}
/* ---------- tuning ---------- */
var CFG={dist:3000,checkpoints:[2000,1000],kmh:[150,178],boostKmh:72,zk:0.6,health:100,
 dmg:{ram:12,spikes:12,oil:8},boostDur:2.5,boostMin:0.2,regen:0.045,nitro:0.45,invuln:1.4,
 bikerEvery:[3.8,2.0],bikerMax:[1,3],warn:[1.2,0.75],cruise:[[1.6,2.8],[0.9,1.8]],hazEvery:[4.4,2.3],nitroEvery:[7,10],vanAt:0.05,
 hitZ:[-0.7,1.5]};
/* ---------- sprites ---------- */
var SPR={},CORE=['car','biker','biker-lean','van','oil','spikes','nitro','sky','gym'],SLOTS=CORE.concat(['biker-portrait']);
function loadSprites(map,cb){var ks=Object.keys(map||{}).filter(function(k){return SLOTS.indexOf(k)>=0});
 return Promise.all(ks.map(function(k){return new Promise(function(res){var im=new Image();im.decoding='async';
  im.onload=function(){SPR[k]=im;skyCache=null;if(cb)cb(k);res(true)};im.onerror=function(){delete SPR[k];res(false)};im.src=map[k]})}))}
function spriteMode(){for(var i=0;i<CORE.length;i++)if(!SPR[CORE[i]])return false;return true}
/* ---------- helpers ---------- */
function lerp(a,b,t){return a+(b-a)*t}function clamp(v,a,b){return v<a?a:v>b?b:v}function rnd(a,b){return a+Math.random()*(b-a)}
function rng(seed){var s=seed>>>0;return function(){s=(s*1664525+1013904223)>>>0;return s/4294967296}}
var EV={};function on(n,f){EV[n]=f}function emit(n,a){if(EV[n])EV[n](a)}
/* ---------- state ---------- */
var D=null,SELF=false,selfT=0;
function reset(dist,keepStats){
 var st=keepStats&&D?D.stats:{bumps:0,hits:0,dodged:0,nitro:0,smashed:0,retries:0,time:0,boosts:0};
 D={st:'intro',t:0,dist:dist==null?CFG.dist:dist,cp:dist==null?CFG.dist:dist,lane:1,u:-0.5,vu:0,camU:-0.3,tilt:0,
  health:CFG.health,boost:0,meter:0.7,kmh:CFG.kmh[0],scroll:0,invuln:0,spin:0,slow:0,shake:0,flash:0,
  bikers:[],haz:[],van:null,fx:[],rain:[],bikerT:1.6,nitroT:5,arriveT:0,wreckT:0,fade:0,finished:false,calm:true,runT:0,stats:st,warned:0};
 for(var i=0;i<80;i++)D.rain.push({x:Math.random(),y:Math.random(),l:rnd(4,10),v:rnd(150,240)});
}
reset();
function prog(){return clamp(1-D.dist/CFG.dist,0,1)}
function laneU(l){return l-1.5}
function bikerAt(lane,ex){for(var i=0;i<D.bikers.length;i++){var b=D.bikers[i];if(b!==ex&&b.st!=='spin'&&b.st!=='leave'&&(b.lane===lane||b.tgt===lane))return b}return null}
/* ---------- flow ---------- */
function intro(){reset();D.st='intro';SELF=false}
function spawnIntro(){[0,3].forEach(function(l,i){if(l===D.lane)l=2;D.bikers.push(newBiker(l,-3.5-i*0.8,0.5+i*0.5))})}
function go(){D.st='run';D.calm=false;D.runT=0;D.bikers.forEach(function(b,i){if(b.st==='cruise')b.t=0.8+i*1.4})}
function retry(){var cp=D.cp;D.stats.retries++;reset(cp,true);D.st='run';D.calm=false;D.meter=0.8;D.bikerT=2.2}
function newBiker(lane,z,zt){return {lane:lane,tgt:lane,home:lane,u:laneU(lane),z:z,zt:zt,st:'approach',t:0,tries:0,rot:0,vu:0,wob:Math.random()*6,warnT:0}}
function spawnBiker(){
 var p=prog(),cands=[D.lane-1,D.lane+1,D.lane-2,D.lane+2].filter(function(l){return l>=0&&l<4&&!bikerAt(l)});
 if(!cands.length)return;var l=Math.random()<0.75?cands[0]:cands[Math.floor(Math.random()*cands.length)];
 if(cands.length>1&&Math.random()<0.5&&Math.abs(cands[1]-D.lane)===1)l=cands[1];
 D.bikers.push(newBiker(l,-3.8,rnd(0.1,1.2)));
}
function steer(dir){if(!D||(D.st!=='run'&&D.st!=='intro'))return false;var n=clamp(D.lane+dir,0,3);if(n===D.lane){D.shake=Math.max(D.shake,0.25);return false}D.lane=n;return true}
/* ---------- SELF DRIVE: Richie's car drives itself (kid-friendly assist) ----------
   Every ~0.12 s: dodge hazards in my lane, step out of a biker's swerve or bump it first when that lane is clear,
   grab nitro cans, boost when the tank is full (boost = immune), and boost as a last resort when boxed in. */
function setSelf(on){SELF=!!on;selfT=0;return SELF}
function selfTick(){
 var danger=[0,0,0,0],want=[0,0,0,0],occ=[0,0,0,0],L=D.lane;
 D.haz.forEach(function(h){if(h.done)return;if(h.k==='nitro'){if(h.z>0&&h.z<35)want[h.lane]++}else if(h.z>-0.5&&h.z<28)danger[h.lane]+=h.z<12?2:1});
 D.bikers.forEach(function(b){if(b.st!=='spin'&&b.st!=='leave'&&b.z>-1.2&&b.z<1.8)occ[b.lane]=1});
 function free(l){return l>=0&&l<4&&!danger[l]}
 var wb=null;D.bikers.forEach(function(b){if((b.st==='warn'||b.st==='ram')&&b.tgt===L&&b.z>-0.7&&b.z<1.5)wb=b});
 if(wb){if(free(wb.lane)&&Math.abs(wb.lane-L)===1){steer(wb.lane-L);return}
  var away=L+(L>wb.lane?1:-1);if(free(away)&&!occ[away]){steer(away-L);return}if(boost())return}
 if(danger[L]){var opts=[L-1,L+1].filter(function(l){return free(l)});
  if(opts.length){opts.sort(function(a,b){return (occ[a]-occ[b])||(want[b]-want[a])});steer(opts[0]-L);return}
  if(danger[L]>1&&boost())return}
 for(var i=0;i<2;i++){var wl=[L-1,L+1][i];if(free(wl)&&want[wl]&&!occ[wl]){steer(wl-L);return}}
 if(D.meter>0.95)boost();
}
function boost(){if(!D||D.st!=='run'||D.boost>0||D.meter<CFG.boostMin)return false;D.boost=CFG.boostDur*Math.min(1,D.meter);D.stats.boosts++;sfx('boost');emit('boost');
 D.bikers.forEach(function(b){if(b.st==='warn'||b.st==='ram'){b.st='approach';b.tgt=b.lane}});return true}
/* ---------- fx ---------- */
function fxStars(x,y,n){for(var i=0;i<n;i++){var a=i/n*Math.PI*2+Math.random()*0.4;D.fx.push({k:'star',x:x,y:y,vx:Math.cos(a)*rnd(30,60),vy:Math.sin(a)*rnd(20,45)-15,life:0.9,max:0.9,s:rnd(2,3.5),r:Math.random()*3})}}
function fxPuff(x,y,n,sz){for(var i=0;i<n;i++)D.fx.push({k:'puff',x:x+rnd(-8,8)*sz,y:y+rnd(-4,4)*sz,vx:rnd(-14,14),vy:rnd(-18,-4),life:rnd(0.6,1),max:1,s:rnd(4,8)*sz})}
function fxSpark(x,y,n,c){for(var i=0;i<n;i++){var a=-Math.PI*rnd(0.1,0.9);D.fx.push({k:'spark',x:x,y:y,vx:Math.cos(a)*rnd(40,110),vy:Math.sin(a)*rnd(40,90),life:0.4,max:0.4,c:c||'#ffd23a'})}}
/* ---------- projection (filled by render; update uses the last frame's values for fx positions) ---------- */
var LW=80,CX=200;
function sOf(z){return DZ/(DZ+Math.max(z,-DZ*0.8))}function yOf(z){return HY+(PY-HY)*sOf(z)}function xOf(u,z){return CX+(u-D.camU)*LW*sOf(z)}
/* ---------- damage ---------- */
function hurt(kind){
 if(D.invuln>0||D.boost>0||D.st!=='run')return false;
 D.health=Math.max(0,D.health-CFG.dmg[kind]);D.invuln=CFG.invuln;D.shake=1.2;D.flash=1;D.stats.hits++;
 if(kind==='oil'){D.spin=0.9;D.slow=0.9;sfx('squelch')}else sfx('crash',kind==='ram'?1:0.8);
 if(kind==='spikes')fxSpark(xOf(D.u,0),PY-4,16);else fxPuff(xOf(D.u,0),PY-10,5,0.8);
 emit('hit',kind);
 if(D.health<=0)wreck();return true;
}
function wreck(){D.st='wreck';D.wreckT=0;D.spin=1.6;sfx('crash',1.4);sfx('puff');fxPuff(xOf(D.u,0),PY-20,14,1.3);fxStars(xOf(D.u,0),PY-50,8);
 D.bikers.forEach(function(b){if(b.st!=='spin')b.st='leave'});emit('wrecking')}
function bumpBiker(b){b.st='spin';b.t=0;b.vu=(b.u>=D.u?1:-1)*2.2;D.stats.bumps++;D.shake=Math.max(D.shake,0.6);
 var x=xOf(b.u,b.z),y=yOf(b.z)-LW*sOf(b.z)*0.55;fxStars(x,y,9);fxPuff(x,y+10,6,0.9);sfx('bump');setTimeout(function(){sfx('puff')},90);emit('bump',D.stats.bumps)}
/* ---------- update ---------- */
function update(dt){
 if(!D)return;D.t+=dt;var p=prog(),run=D.st==='run';
 var base=lerp(CFG.kmh[0],CFG.kmh[1],p),target;
 if(D.st==='arrive')target=Math.max(0,base*(1-D.arriveT/1.5));else if(D.st==='wreck')target=25;else if(D.st==='done')target=0;
 else target=base+(D.boost>0?CFG.boostKmh:0)-(D.slow>0?45:0);
 D.kmh+=(target-D.kmh)*Math.min(1,dt*(D.boost>0?3.2:2));
 var zr=D.kmh/3.6*CFG.zk;D.scroll+=zr*dt;
 /* player */
 var tu=laneU(D.lane),du=tu-D.u,step=dt*7.5,nu=Math.abs(du)<=step?tu:D.u+Math.sign(du)*step;
 D.vu=(nu-D.u)/Math.max(dt,1e-4);D.u=nu;D.camU+=(D.u*0.6-D.camU)*Math.min(1,dt*5);D.tilt+=(clamp(D.vu*0.012,-0.09,0.09)-D.tilt)*Math.min(1,dt*12);
 D.invuln=Math.max(0,D.invuln-dt);D.spin=Math.max(0,D.spin-dt);D.slow=Math.max(0,D.slow-dt);D.shake=Math.max(0,D.shake-dt*3);D.flash=Math.max(0,D.flash-dt*3);
 if(D.boost>0){D.boost=Math.max(0,D.boost-dt);D.meter=Math.max(0,D.meter-dt/CFG.boostDur);if(D.boost===0){D.meter=Math.max(0,D.meter);emit('boostEnd')}}
 else if(run)D.meter=Math.min(1,D.meter+CFG.regen*dt);
 if(run&&SELF){selfT-=dt;if(selfT<=0){selfT=0.12;selfTick()}}
 if(run){
  D.runT+=dt;D.stats.time+=dt;var prev=D.dist;D.dist=Math.max(0,D.dist-D.kmh/3.6*dt);
  CFG.checkpoints.forEach(function(c){if(prev>c&&D.dist<=c){D.cp=c;sfx('chime');emit('checkpoint',c)}});
  /* spawns */
  if(D.runT>1.2){D.bikerT-=dt;if(D.bikerT<=0){var alive=D.bikers.filter(function(b){return b.st!=='spin'&&b.st!=='leave'}).length;
   if(alive<Math.round(lerp(CFG.bikerMax[0],CFG.bikerMax[1],p)))spawnBiker();D.bikerT=lerp(CFG.bikerEvery[0],CFG.bikerEvery[1],p)*rnd(0.8,1.2)}}
  if(!D.van&&p>=CFG.vanAt){D.van={lane:Math.floor(Math.random()*4),u:0,z:ZFAR+10,t:3,drop:3.2,blink:0,leave:false};D.van.u=laneU(D.van.lane);emit('van')}
  D.nitroT-=dt;if(D.nitroT<=0){var nl=Math.floor(Math.random()*4);if(!D.haz.some(function(h){return h.lane===nl&&h.z>ZFAR-30}))D.haz.push({k:'nitro',lane:nl,u:laneU(nl),z:ZFAR});D.nitroT=rnd(CFG.nitroEvery[0],CFG.nitroEvery[1])}
  if(D.dist<=0)arrive();
 }
 /* van */
 var v=D.van;
 if(v){
  if(v.leave){v.z+=45*dt;if(v.z>ZFAR+40)D.van=null}
  else{var tz=D.boost>0?30:62;v.z+=(tz-v.z)*Math.min(1,dt*0.9);
   v.t-=dt;if(v.t<=0){v.lane=Math.random()<0.55?D.lane:Math.floor(Math.random()*4);v.t=rnd(2.2,4)}
   var vu=laneU(v.lane)-v.u;v.u+=Math.sign(vu)*Math.min(Math.abs(vu),dt*1.6);
   if(run){v.drop-=dt;v.blink=v.drop<0.6?1:0;
    if(v.drop<=0&&v.z<95&&Math.abs(vu)<0.05){var k=Math.random()<0.58?'oil':'spikes';
     if(!D.haz.some(function(h){return h.lane===v.lane&&Math.abs(h.z-v.z)<12}))D.haz.push({k:k,lane:v.lane,u:laneU(v.lane),z:v.z-3});
     sfx('clunk');v.drop=lerp(CFG.hazEvery[0],CFG.hazEvery[1],p)*rnd(0.85,1.15)}}
  }
 }
 /* hazards + pickups (stationary on the road) */
 for(var i=D.haz.length-1;i>=0;i--){var h=D.haz[i];h.z-=zr*dt;
  if(!h.done&&run&&h.z<CFG.hitZ[1]&&h.z>CFG.hitZ[0]&&Math.abs(h.u-D.u)<0.55){h.done=true;
   if(h.k==='nitro'){D.meter=Math.min(1,D.meter+CFG.nitro);D.stats.nitro++;sfx('pickup');fxSpark(xOf(h.u,h.z),yOf(h.z)-8,10,'#29d6ff');emit('nitro');h.gone=true}
   else if(D.boost>0){D.stats.smashed++;sfx('puff');fxPuff(xOf(h.u,h.z),yOf(h.z)-4,6,0.8);emit('smash',h.k);h.gone=true}
   else if(!hurt(h.k))h.gone=h.k==='spikes'?false:false;
  }
  if(!h.done&&h.z<CFG.hitZ[0]){h.done=true;if(h.k!=='nitro'&&run){D.stats.dodged++;emit('dodge',h.k)}}
  if(h.z<-4||h.gone)D.haz.splice(i,1)}
 /* bikers */
 for(i=D.bikers.length-1;i>=0;i--){var b=D.bikers[i];b.wob+=dt*5;
  if(b.st==='spin'){b.t+=dt;b.rot+=dt*15;b.u+=b.vu*dt;b.z-=4*dt;if(b.t>1.3){D.bikers.splice(i,1)}continue}
  if(b.st==='leave'){b.z-=(D.st==='arrive'?5:3.5)*dt;b.u+=(laneU(b.lane)-b.u)*Math.min(1,dt*4);if(b.z<-4.5)D.bikers.splice(i,1);continue}
  if(D.boost>0){b.z-=5*dt;if(b.st==='warn'||b.st==='ram'||b.st==='back'){b.st='approach';b.tgt=b.lane}}
  if(b.st==='approach'){
   if(b.lane===D.lane&&b.z<-0.8){var alt=[b.lane-1,b.lane+1].filter(function(l){return l>=0&&l<4&&!bikerAt(l,b)});if(alt.length){b.lane=alt[0];b.tgt=b.lane}}
   if(D.boost<=0){var dz=b.zt-b.z;b.z+=Math.sign(dz)*Math.min(Math.abs(dz),2.6*dt);if(Math.abs(dz)<0.02){b.st='cruise';b.t=rnd.apply(null,cruiseR())}}
   if(b.z<-4.6){D.bikers.splice(i,1);continue}
  }else if(b.st==='cruise'){b.t-=dt;
   if(b.t<=0&&!D.calm&&run){var tg=b.lane+Math.sign(D.lane-b.lane);
    if(tg!==b.lane&&!bikerAt(tg,b)){b.st='warn';b.warnT=lerp(CFG.warn[0],CFG.warn[1],p);b.tgt=tg;sfx('warn');D.warned++}else b.t=0.5}
  }else if(b.st==='warn'){b.warnT-=dt;if(b.warnT<=0)b.st='ram'}
  else if(b.st==='ram'){var rd=laneU(b.tgt)-b.u;b.u+=Math.sign(rd)*Math.min(Math.abs(rd),dt*3.4);
   if(Math.abs(rd)<0.01){if(b.tgt===D.lane&&Math.abs(D.u-b.u)<0.6){b.st='back'}else{b.home=b.lane;b.lane=b.tgt;b.tries++;b.st=b.tries>=3?'leave':'cruise';b.t=rnd.apply(null,cruiseR())}}}
  else if(b.st==='back'){var bd=laneU(b.lane)-b.u;b.u+=Math.sign(bd)*Math.min(Math.abs(bd),dt*2.6);if(Math.abs(bd)<0.01){b.tgt=b.lane;b.tries++;b.st=b.tries>=3?'leave':'cruise';b.t=rnd.apply(null,cruiseR())}}
  if(b.st!=='ram'&&b.st!=='back'&&b.st!=='warn')b.u+=(laneU(b.lane)+Math.sin(b.wob)*0.05-b.u)*Math.min(1,dt*6);
  /* collisions with Richie's car */
  if(run&&b.z>CFG.hitZ[0]&&b.z<CFG.hitZ[1]&&Math.abs(b.u-D.u)<0.62&&b.st!=='back'){
   var toward=D.vu*(b.u-D.u)>0.8;
   if(b.st==='ram'&&!toward&&D.boost<=0){if(!hurt('ram')){}b.st='back'}
   else if(b.st!=='back')bumpBiker(b);
  }
 }
 /* wreck / arrive */
 if(D.st==='wreck'){D.wreckT+=dt;if(D.wreckT>1.8&&!D.wreckDone){D.wreckDone=true;emit('wreck')}}
 if(D.st==='arrive'){D.arriveT+=dt;D.fade=clamp((D.arriveT-1.2)/0.7,0,1);if(D.arriveT>4.4&&!D.finished){D.finished=true;D.st='done';emit('finish',D.stats)}}
 /* fx + rain */
 for(i=D.fx.length-1;i>=0;i--){var f=D.fx[i];f.life-=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;if(f.k==='spark')f.vy+=160*dt;else if(f.k==='star'){f.vy+=40*dt;f.r+=dt*8}else{f.s+=dt*10;f.vx*=0.96}if(f.life<=0)D.fx.splice(i,1)}
 D.rain.forEach(function(r){r.y+=r.v*dt/H;r.x-=dt*0.05;if(r.y>1){r.y-=1;r.x=Math.random()}if(r.x<0)r.x+=1});
}
function cruiseR(){var p=prog();return [lerp(CFG.cruise[0][0],CFG.cruise[1][0],p),lerp(CFG.cruise[0][1],CFG.cruise[1][1],p)]}
function arrive(){D.st='arrive';D.arriveT=0;D.boost=0;D.bikers.forEach(function(b){if(b.st!=='spin')b.st='leave'});if(D.van)D.van.leave=true;D.haz=D.haz.filter(function(h){return h.z<0});sfx('chime');emit('arrive')}

/* ---------- render ---------- */
var skyCache=null,skyW=0;
function makeSky(W){
 var c=document.createElement('canvas');c.width=W+24;c.height=H;var g=c.getContext('2d');
 if(SPR.sky){var im=SPR.sky,k=(W+24)/im.width,h=im.height*k,oy=Math.min(0,HY-0.76*h);g.imageSmoothingEnabled=true;g.drawImage(im,0,oy,W+24,h);
  var bot=oy+h;if(bot<H){g.fillStyle='#050416';g.fillRect(0,bot-1,W+24,H-bot+1)}}
 else{var gr=g.createLinearGradient(0,0,0,HY);gr.addColorStop(0,'#05061e');gr.addColorStop(0.7,'#1a0b3e');gr.addColorStop(1,'#3a0f55');g.fillStyle=gr;g.fillRect(0,0,W+24,HY);
  var r=rng(7);for(var i=0;i<40;i++){g.fillStyle='rgba(255,255,255,'+(0.3+r()*0.5)+')';g.fillRect(Math.floor(r()*(W+24)),Math.floor(r()*HY*0.6),1,1)}
  for(var x=0;x<W*0.8;){var bw=6+Math.floor(r()*12),bh=10+Math.floor(r()*40);g.fillStyle=r()<0.5?'#140a2e':'#1c0d3a';g.fillRect(x,HY-bh,bw,bh);
   for(var wy=HY-bh+3;wy<HY-2;wy+=3)for(var wx=x+1;wx<x+bw-1;wx+=2)if(r()<0.35){g.fillStyle=r()<0.5?'#ff3ad8':'#29d6ff';g.fillRect(wx,wy,1,1)}x+=bw+1}
  var bx=W*0.8;g.strokeStyle='#29d6ff';g.lineWidth=1;g.beginPath();g.moveTo(bx,HY-26);g.lineTo(bx,HY);g.moveTo(bx+30,HY-26);g.lineTo(bx+30,HY);
  g.moveTo(bx-30,HY-6);g.quadraticCurveTo(bx+15,HY-4,bx,HY-26);g.moveTo(bx,HY-26);g.quadraticCurveTo(bx+15,HY-6,bx+30,HY-26);g.quadraticCurveTo(bx+45,HY-4,bx+70,HY-6);g.stroke();
  g.fillStyle='#050416';g.fillRect(0,HY,W+24,H-HY)}
 var wg=g.createLinearGradient(0,HY,0,H);wg.addColorStop(0,'rgba(5,4,22,0.15)');wg.addColorStop(0.5,'rgba(5,4,22,0.7)');wg.addColorStop(1,'rgba(4,3,16,0.95)');g.fillStyle=wg;g.fillRect(0,HY,W+24,H-HY);
 return c;
}
function spr(g,im,cx,by,w,rot,flip,alpha){var h=w*im.height/im.width;g.save();if(alpha!=null)g.globalAlpha=alpha;g.translate(cx,by-h/2);if(rot)g.rotate(rot);if(flip)g.scale(-1,1);g.drawImage(im,-w/2,-h/2,w,h);g.restore();return h}
/* wet-road reflection: soft vertical light smears below a light source (one centred, or a pair at +-dx) */
function streaks(g,x,y,dx,w,len,rgb,a){var gr=g.createLinearGradient(0,y,0,y+len);gr.addColorStop(0,'rgba('+rgb+','+a+')');gr.addColorStop(1,'rgba('+rgb+',0)');g.fillStyle=gr;
 (dx?[x-dx,x+dx]:[x]).forEach(function(cx){for(var i=0;i<3;i++){var ww=w*(1-i*0.3);g.globalAlpha=0.5;g.fillRect(cx-ww/2,y,ww,len*(1-i*0.25))}});g.globalAlpha=1}
function glow(g,x,y,r,col,a){var gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(0,0,0,0)');g.globalAlpha=a==null?1:a;g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);g.globalAlpha=1}
function rr(g,x,y,w,h,r,c){g.fillStyle=c;g.beginPath();if(g.roundRect)g.roundRect(x,y,w,h,r);else g.rect(x,y,w,h);g.fill()}
/* canvas fallbacks */
function carCanvas(g,cx,by,w){var h=w*0.8,x=cx-w/2,y=by-h;
 glow(g,cx,by-2,w*0.55,'rgba(41,214,255,0.8)',0.7);
 rr(g,x+w*0.04,y+h*0.72,w*0.16,h*0.26,3,'#0c0c12');rr(g,x+w*0.8,y+h*0.72,w*0.16,h*0.26,3,'#0c0c12');
 var gr=g.createLinearGradient(0,y,0,by);gr.addColorStop(0,'#c9ccd6');gr.addColorStop(0.5,'#9aa0ae');gr.addColorStop(1,'#5d6270');
 rr(g,x+w*0.02,y+h*0.36,w*0.96,h*0.5,w*0.12,gr);rr(g,x+w*0.16,y+h*0.04,w*0.68,h*0.4,w*0.14,'#a6abb8');rr(g,x+w*0.22,y+h*0.1,w*0.56,h*0.3,w*0.08,'#141a2c');
 g.fillStyle='rgba(41,214,255,0.35)';g.fillRect(x+w*0.26,y+h*0.12,w*0.48,1);
 rr(g,x+w*0.06,y+h*0.5,w*0.88,h*0.06,2,'#ff2040');rr(g,x+w*0.38,y+h*0.62,w*0.24,h*0.1,1,'#c8ccd4');
}
function bikerCanvas(g,cx,by,w,rot){var h=w*1.9;g.save();g.translate(cx,by-h/2);if(rot)g.rotate(rot);g.translate(-cx,-(by-h/2));
 rr(g,cx-w*0.16,by-h*0.32,w*0.32,h*0.32,w*0.12,'#101014');rr(g,cx-w*0.5,by-h*0.62,w,h*0.36,w*0.25,'#1b1b22');rr(g,cx-w*0.42,by-h*0.85,w*0.84,h*0.3,w*0.3,'#202028');
 g.fillStyle='#0a0a0e';g.beginPath();g.arc(cx,by-h*0.86,w*0.3,0,Math.PI*2);g.fill();rr(g,cx-w*0.14,by-h*0.4,w*0.28,h*0.06,1,'#ff2a3a');g.restore()}
function vanCanvas(g,cx,by,w){var h=w*1.02,x=cx-w/2,y=by-h;glow(g,cx,by-2,w*0.6,'rgba(255,30,60,0.9)',0.6);
 rr(g,x+w*0.02,y+h*0.78,w*0.22,h*0.22,4,'#0a0a0c');rr(g,x+w*0.76,y+h*0.78,w*0.22,h*0.22,4,'#0a0a0c');rr(g,x,y+h*0.06,w,h*0.78,w*0.05,'#1d1d22');
 rr(g,x+w*0.1,y+h*0.2,w*0.8,h*0.48,3,'#26262e');g.fillStyle='#111';g.fillRect(cx-0.5,y+h*0.2,1,h*0.48);rr(g,x+w*0.18,y+h*0.25,w*0.24,h*0.12,2,'#0b0f1c');rr(g,x+w*0.58,y+h*0.25,w*0.24,h*0.12,2,'#0b0f1c');
 for(var i=0;i<6;i++)rr(g,x+w*(0.18+i*0.12),y+h*0.09,w*0.06,h*0.03,1,'#ff2a3a');rr(g,x+w*0.03,y+h*0.5,w*0.06,h*0.12,1,'#ff2a3a');rr(g,x+w*0.91,y+h*0.5,w*0.06,h*0.12,1,'#ff2a3a')}
function hazCanvas(g,k,cx,by,w,t){var h=w*0.45;
 if(k==='oil'){g.fillStyle='#0a0810';g.beginPath();g.ellipse(cx,by-h/2,w/2,h/2,0,0,Math.PI*2);g.fill();g.strokeStyle='#8a5cff';g.lineWidth=1;g.stroke();g.fillStyle='rgba(41,214,255,.5)';g.fillRect(cx-w*0.2,by-h*0.7,w*0.15,1)}
 else if(k==='spikes'){for(var i=0;i<6;i++){g.fillStyle=i%2?'#111':'#ffd23a';g.fillRect(cx-w/2+i*w/6,by-h*0.5,w/6+0.5,h*0.4)}g.fillStyle='#dfe4ee';for(i=0;i<4;i++){var sx=cx-w*0.36+i*w*0.24;g.beginPath();g.moveTo(sx-w*0.05,by-h*0.5);g.lineTo(sx,by-h*1.2);g.lineTo(sx+w*0.05,by-h*0.5);g.fill()}}
 else{var ch=w*1.4;rr(g,cx-w/2,by-ch,w,ch,w*0.25,'#1e7bff');rr(g,cx-w*0.25,by-ch-w*0.2,w*0.5,w*0.3,2,'#29d6ff');g.fillStyle='#ffd23a';g.beginPath();g.moveTo(cx+w*0.1,by-ch*0.85);g.lineTo(cx-w*0.25,by-ch*0.45);g.lineTo(cx,by-ch*0.45);g.lineTo(cx-w*0.1,by-ch*0.12);g.lineTo(cx+w*0.25,by-ch*0.55);g.lineTo(cx,by-ch*0.55);g.fill()}}
function neonText(g,txt,x,y,size,col){g.save();g.font='900 '+size+'px "Arial Black","Arial Narrow",Impact,sans-serif';g.textAlign='center';g.textBaseline='middle';
 g.shadowColor=col;g.shadowBlur=8;g.fillStyle=col;g.fillText(txt,x,y);g.shadowBlur=2;g.fillStyle='#fff';g.globalAlpha=0.8;g.fillText(txt,x,y);g.restore()}
function drawArrival(g,W,t){
 var k,ox,oy,iw=800,ih=450;
 if(SPR.gym){k=Math.max(W/iw,H/ih);ox=(W-iw*k)/2;oy=(H-ih*k)/2;g.imageSmoothingEnabled=true;g.drawImage(SPR.gym,ox,oy,iw*k,ih*k);g.imageSmoothingEnabled=false}
 else{k=Math.max(W/iw,H/ih);ox=(W-iw*k)/2;oy=(H-ih*k)/2;var gr=g.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#070826');gr.addColorStop(1,'#1a0b30');g.fillStyle=gr;g.fillRect(0,0,W,H);
  g.fillStyle='#3a1e22';g.fillRect(ox+200*k,oy+80*k,420*k,330*k);g.fillStyle='#2a1418';for(var yy=oy+80*k;yy<oy+410*k;yy+=4)g.fillRect(ox+200*k,yy,420*k,1);
  g.fillStyle='#ffcf7a';g.fillRect(ox+360*k,oy+280*k,100*k,130*k);g.strokeStyle='#ff3ad8';g.lineWidth=2;g.strokeRect(ox+315*k,oy+109*k,197*k,71*k);
  g.fillStyle='#0a0718';g.fillRect(0,oy+410*k,W,H)}
 /* the sign: original text, drawn in code */
 var sx=ox+413*k,sy=oy+144*k,fs=Math.max(9,Math.round(27*k*1.1)),fl=(Math.sin(t*7.3)+Math.sin(t*2.1))>1.9?0.55:1;
 g.globalAlpha=fl;neonText(g,'SHRED',sx,sy-fs*0.55,fs,'#ff3ad8');neonText(g,'ZEPPELIN',sx,sy+fs*0.55,fs,'#ff3ad8');g.globalAlpha=1;
 /* Richie's car rolls into the spot */
 var a=clamp((D.arriveT-1.5)/2.2,0,1),e=1-Math.pow(1-a,3),w=lerp(W*0.34,W*0.2,e),by=lerp(H+W*0.3,H-6,e);
 if(SPR.car)spr(g,SPR.car,sx,by,w);else carCanvas(g,sx,by,w);
 var tl=by-w*(SPR.car?SPR.car.height/SPR.car.width:0.8)*0.48;g.globalCompositeOperation='lighter';glow(g,sx-w*0.36,tl,w*0.12,'rgba(255,40,70,0.9)');glow(g,sx+w*0.36,tl,w*0.12,'rgba(255,40,70,0.9)');g.globalCompositeOperation='source-over';
}
function render(g,W,t,pulse){
 if(!D)return;LW=clamp(W*0.18,50,88);CX=W/2;
 if(!skyCache||skyW!==W){skyCache=makeSky(W);skyW=W}
 var sh=D.shake*2.2;g.save();g.translate(Math.round((Math.random()-0.5)*sh),Math.round((Math.random()-0.5)*sh));
 if(D.fade<1){
  g.drawImage(skyCache,-12-Math.round(D.camU*5),0);
  if(pulse>0){var pg=g.createLinearGradient(0,0,0,HY);pg.addColorStop(0,'rgba(255,58,216,0)');pg.addColorStop(1,'rgba(255,58,216,'+(pulse*0.12)+')');g.fillStyle=pg;g.fillRect(0,0,W,HY)}
  /* road */
  for(var y=HY+1;y<H;y++){var s=(y-HY)/(PY-HY),z=DZ/s-DZ,cx=CX-D.camU*LW*s,lw=LW*s,zz=z+D.scroll;
   g.fillStyle=((zz%14)+14)%14<7?'#17132b':'#1b1631';g.fillRect(Math.floor(cx-2.15*lw),y,Math.ceil(4.3*lw),1);
   var ew=Math.max(1,lw*0.05);g.fillStyle='rgba(255,210,58,.85)';g.fillRect(cx-2*lw-ew/2,y,ew,1);g.fillRect(cx+2*lw-ew/2,y,ew,1);
   if(((zz%9)+9)%9<4){g.fillStyle='rgba(225,230,255,.8)';for(var l=-1;l<=1;l++)g.fillRect(cx+l*lw-ew/2,y,ew,1)}}
  /* wet sheen: neon smears on the road */
  g.globalCompositeOperation='lighter';
  var off=((D.scroll%30)+30)%30,lamps=[];for(var n=0;n<7;n++){var lz=n*30-off+4;if(lz>-2&&lz<ZFAR)lamps.push(lz)}
  lamps.forEach(function(lz,i){var s=sOf(lz),y0=yOf(lz);[-1,1].forEach(function(sd){var x=xOf(sd*1.75,lz),col=sd<0?'rgba(41,214,255,':'rgba(255,58,216,';
   var gr=g.createLinearGradient(0,y0,0,y0+60*s);gr.addColorStop(0,col+'0.35)');gr.addColorStop(1,col+'0)');g.fillStyle=gr;g.fillRect(x-5*s,y0,10*s,60*s)})});
  g.globalCompositeOperation='source-over';
  /* barriers */
  [-1,1].forEach(function(sd){g.fillStyle='#29223f';g.beginPath();var zs=[ZFAR,100,70,50,35,25,18,12,8,5,3,1.5,0,-1.5,-2.5];
   zs.forEach(function(z,i){var x=xOf(sd*2.2,z),y=yOf(z)-9*sOf(z);if(i)g.lineTo(x,y);else g.moveTo(x,y)});for(var i=zs.length-1;i>=0;i--)g.lineTo(xOf(sd*2.2,zs[i]),yOf(zs[i]));g.fill();
   g.strokeStyle=sd<0?'#29d6ff':'#ff3ad8';g.lineWidth=1;g.beginPath();zs.forEach(function(z,i){var x=xOf(sd*2.2,z),y=yOf(z)-9*sOf(z);if(i)g.lineTo(x,y);else g.moveTo(x,y)});g.stroke();
   var po=((D.scroll%6)+6)%6;g.fillStyle='#15112a';for(var pz=-po+6;pz<ZFAR;pz+=6){var s=sOf(pz);if(s<0.08)break;g.fillRect(xOf(sd*2.2,pz)-Math.max(1,s*1.5),yOf(pz)-9*s,Math.max(1,s*3),9*s)}});
  /* street lamps */
  lamps.slice().reverse().forEach(function(lz,i){var s=sOf(lz);[-1,1].forEach(function(sd){var x=xOf(sd*2.3,lz),y0=yOf(lz)-9*s,top=y0-100*s,ax=xOf(sd*1.85,lz);
   g.fillStyle='#3a3552';g.fillRect(x-Math.max(0.5,s*1.2),top,Math.max(1,s*2.4),y0-top);g.fillRect(Math.min(x,ax),top,Math.abs(ax-x),Math.max(1,s*2));
   g.globalCompositeOperation='lighter';glow(g,ax,top+2*s,4+16*s,sd<0?'rgba(170,240,255,0.95)':'rgba(255,190,240,0.95)');g.globalCompositeOperation='source-over';
   g.fillStyle='#fff';g.fillRect(ax-Math.max(1,s*3),top,Math.max(2,s*6),Math.max(1,s*2))})});
  /* entities, far to near */
  var list=[];D.haz.forEach(function(h){list.push({z:h.z+0.6,f:function(){drawHaz(g,h,t)}})});
  if(D.van)list.push({z:D.van.z,f:function(){drawVan(g,D.van,t)}});
  D.bikers.forEach(function(b){list.push({z:b.z,f:function(){drawBiker(g,b,t)}})});
  list.push({z:0.05,f:function(){drawCar(g,t)}});
  list.sort(function(a,b){return b.z-a.z}).forEach(function(o){if(o.z>-4.5&&o.z<ZFAR+40)o.f()});
  /* boost speed lines */
  if(D.boost>0){g.strokeStyle='rgba(200,245,255,0.55)';g.lineWidth=1;g.beginPath();for(var q=0;q<14;q++){var a=Math.random()*Math.PI*2,r1=rnd(60,90),r2=r1+rnd(30,70);g.moveTo(CX+Math.cos(a)*r1*1.6,HY+20+Math.sin(a)*r1);g.lineTo(CX+Math.cos(a)*r2*1.6,HY+20+Math.sin(a)*r2)}g.stroke()}
 }
 if(D.fade>0){g.globalAlpha=D.fade;drawArrival(g,W,t);g.globalAlpha=1}
 /* fx */
 D.fx.forEach(function(f){var a=clamp(f.life/f.max,0,1);
  if(f.k==='star'){g.save();g.globalAlpha=a;g.translate(f.x,f.y);g.rotate(f.r);g.fillStyle='#ffd23a';g.beginPath();for(var i=0;i<8;i++){var r=i%2?f.s*0.4:f.s,an=i*Math.PI/4;g.lineTo(Math.cos(an)*r,Math.sin(an)*r)}g.fill();g.fillStyle='#fff';g.fillRect(-0.5,-0.5,1,1);g.restore()}
  else if(f.k==='puff'){g.globalAlpha=a*0.75;g.fillStyle='#cfc8e6';g.beginPath();g.arc(f.x,f.y,f.s,0,Math.PI*2);g.fill();g.globalAlpha=1}
  else{g.globalAlpha=a;g.fillStyle=f.c;g.fillRect(f.x,f.y,2,1);g.globalAlpha=1}});
 /* rain */
 g.strokeStyle='rgba(170,200,255,0.35)';g.lineWidth=1;g.beginPath();D.rain.forEach(function(r){var x=r.x*W,y=r.y*H;g.moveTo(x,y);g.lineTo(x-1.5,y+r.l)});g.stroke();
 if(D.flash>0){g.fillStyle='rgba(255,40,80,'+(D.flash*0.25)+')';g.fillRect(0,0,W,H)}
 g.restore();
}
function drawCar(g,t){
 var s=1,w=LW*0.95,x=xOf(D.u,0),by=PY+1,rot=D.tilt+(D.spin>0?Math.sin(D.spin*18)*0.22*Math.min(1,D.spin):0);
 if(D.st==='wreck')rot=D.wreckT*9;
 if(D.invuln>0&&Math.floor(D.invuln*12)%2===0&&D.st==='run')return;
 var bob=Math.sin(t*22)*0.4;
 g.globalCompositeOperation='lighter';glow(g,x,by+2,w*0.62,D.boost>0?'rgba(255,90,230,0.9)':'rgba(41,214,255,0.75)',0.8);
 streaks(g,x,by,w*0.36,w*0.07,30,'255,40,70',0.4);g.globalCompositeOperation='source-over';
 var h;if(SPR.car)h=spr(g,SPR.car,x,by+bob,w,rot);else{g.save();g.translate(x,by-w*0.4);g.rotate(rot);g.translate(-x,-(by-w*0.4));carCanvas(g,x,by+bob,w);g.restore();h=w*0.8}
 if(D.st!=='wreck'){var ty=by-h*0.47+bob,br=D.slow>0||D.st==='arrive'?1:0.65;g.globalCompositeOperation='lighter';
  glow(g,x-w*0.36,ty,w*0.13,'rgba(255,40,70,'+br+')');glow(g,x+w*0.36,ty,w*0.13,'rgba(255,40,70,'+br+')');g.fillStyle='rgba(255,60,90,'+(0.45*br)+')';g.fillRect(x-w*0.4,ty-1,w*0.8,2);
  if(D.boost>0){for(var i=-1;i<=1;i+=2){var fx=x+i*w*0.22,fy=by-h*0.12,fl=rnd(7,13);glow(g,fx,fy+fl*0.4,fl,'rgba(80,220,255,0.95)');glow(g,fx,fy+fl*0.2,fl*0.5,'rgba(255,255,255,0.9)')}}
  g.globalCompositeOperation='source-over'}
}
function drawBiker(g,b,t){
 var s=sOf(b.z),w=LW*0.42*s,x=xOf(b.u,b.z),by=yOf(b.z),lean=0,useLean=false,flip=false;
 if(b.st==='warn'||b.st==='ram'){var dir=Math.sign(laneU(b.tgt)-b.u)||Math.sign(D.u-b.u);useLean=true;flip=dir>0}
 var rot=b.st==='spin'?b.rot:(useLean?0:Math.sin(b.wob)*0.04);
 g.globalCompositeOperation='lighter';streaks(g,x,by,0,w*0.16,20*s,'255,30,60',0.45);g.globalCompositeOperation='source-over';
 var im=useLean&&SPR['biker-lean']?SPR['biker-lean']:SPR.biker,h;
 if(im)h=spr(g,im,x,by,useLean?w*1.15:w,rot,flip);else{bikerCanvas(g,x,by,w,rot+(useLean?(flip?0.25:-0.25):0));h=w*1.9}
 if(b.st!=='spin'){g.globalCompositeOperation='lighter';glow(g,x,by-h*0.42,w*0.3,'rgba(255,30,50,0.9)');g.globalCompositeOperation='source-over'}
 if(b.st==='warn'&&Math.floor(t*8)%2===0){var wy=by-h-8*s-4,r=Math.max(4,7*s);g.fillStyle='#ff2a4a';g.beginPath();g.arc(x,wy,r,0,Math.PI*2);g.fill();g.strokeStyle='#fff';g.lineWidth=1;g.stroke();
  g.fillStyle='#fff';g.font='900 '+Math.round(r*1.6)+'px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('!',x,wy+0.5)}
}
function drawVan(g,v,t){var s=sOf(v.z),w=LW*1.15*s,x=xOf(v.u,v.z),by=yOf(v.z);if(s<0.05)return;
 g.globalCompositeOperation='lighter';glow(g,x,by,w*0.7,'rgba(255,20,50,0.8)',0.8);g.globalCompositeOperation='source-over';
 var h;if(SPR.van)h=spr(g,SPR.van,x,by,w);else{vanCanvas(g,x,by,w);h=w*1.02}
 g.globalCompositeOperation='lighter';var bl=v.blink&&Math.floor(t*10)%2===0?1:0.55;glow(g,x-w*0.4,by-h*0.42,w*0.12,'rgba(255,40,60,'+bl+')');glow(g,x+w*0.4,by-h*0.42,w*0.12,'rgba(255,40,60,'+bl+')');g.globalCompositeOperation='source-over'}
function drawHaz(g,h,t){var s=sOf(h.z),x=xOf(h.u,h.z),by=yOf(h.z);if(s<0.06)return;
 if(h.k==='nitro'){var w=LW*0.34*s,b=by-Math.abs(Math.sin(t*4))*6*s;g.globalCompositeOperation='lighter';glow(g,x,b-w*0.6,w*1.3,'rgba(41,214,255,0.8)');g.globalCompositeOperation='source-over';
  if(SPR.nitro)spr(g,SPR.nitro,x,b,w);else hazCanvas(g,'nitro',x,b,w,t);return}
 var w2=LW*(h.k==='oil'?0.85:0.9)*s,im=SPR[h.k];
 if(im){var hh=w2*im.height/im.width*0.75;g.drawImage(im,x-w2/2,by-hh,w2,hh)}else hazCanvas(g,h.k,x,by,w2,t);
}
function portrait(cv){var g=cv.getContext('2d');g.setTransform(1,0,0,1,0,0);var gr=g.createLinearGradient(0,0,0,cv.height);gr.addColorStop(0,'#3a0a18');gr.addColorStop(1,'#0a0618');g.fillStyle=gr;g.fillRect(0,0,cv.width,cv.height);
 if(SPR['biker-portrait']){g.imageSmoothingEnabled=true;g.drawImage(SPR['biker-portrait'],0,0,cv.width,cv.height);return}
 var W=cv.width;g.fillStyle='#16161c';g.fillRect(W*0.1,W*0.7,W*0.8,W*0.3);g.fillStyle='#0c0c10';g.beginPath();g.arc(W/2,W*0.45,W*0.3,0,Math.PI*2);g.fill();
 g.fillStyle='#ff2a3a';g.shadowColor='#ff2a3a';g.shadowBlur=10;g.fillRect(W*0.26,W*0.4,W*0.48,W*0.12);g.shadowBlur=0}
function snap(){var p=prog();return {st:D.st,dist:D.dist,cp:D.cp,health:D.health,kmh:D.kmh,meter:D.meter,boost:D.boost,lane:D.lane,u:D.u,invuln:D.invuln,progress:p,
 bikers:D.bikers.map(function(b){return {lane:b.lane,tgt:b.tgt,u:+b.u.toFixed(2),z:+b.z.toFixed(2),st:b.st}}),
 haz:D.haz.map(function(h){return {k:h.k,lane:h.lane,z:+h.z.toFixed(1),done:!!h.done}}),van:D.van?{lane:D.van.lane,z:+D.van.z.toFixed(1)}:null,
 stats:JSON.parse(JSON.stringify(D.stats)),fade:D.fade,warned:D.warned,selfDrive:SELF}}
var dev={setDist:function(m){D.dist=m;var cp=CFG.dist;CFG.checkpoints.forEach(function(c){if(c>=m&&c<cp)cp=c});D.cp=cp},
 ram:function(lane){var b=newBiker(lane,0.6,0.6);b.st='warn';b.warnT=0.4;b.tgt=D.lane;D.bikers.push(b)},
 haz:function(k,lane,z){D.haz.push({k:k,lane:lane,u:laneU(lane),z:z==null?30:z})},
 biker:function(lane,z,st){var b=newBiker(lane,z==null?0.6:z,z==null?0.6:z);b.st=st||'cruise';b.t=st==='cruise'?99:0;D.bikers.push(b);return D.bikers.length},
 clear:function(){D.bikers=[];D.haz=[];D.bikerT=999;D.nitroT=999;if(D.van)D.van.drop=999},
 hold:function(on){D.calm=!!on},health:function(v){D.health=v}};
window.RosadoDrive={CFG:CFG,reset:reset,intro:intro,spawnIntro:spawnIntro,go:go,retry:retry,steer:steer,boost:boost,update:update,render:render,on:on,snap:snap,
 setSelf:setSelf,self:function(){return SELF},portrait:portrait,loadSprites:loadSprites,spriteMode:spriteMode,sprites:SPR,SLOTS:SLOTS,dev:dev,state:function(){return D}};
})();
