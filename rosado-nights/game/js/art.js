/* Rosado Nights · Level 1 art (v0.1.0)
   All original pixel-style art, drawn in code on a low-res canvas (225 px tall) that the game scales up
   with smoothing off. No image files. Characters are made up: Richie (seated lifter) and Apollo (spotter). */
(function(){
"use strict";
var H=225,FLOOR=120;
var PAL={
 richie:{skin:'#d9a07a',shade:'#b47b58',hair:'#1c1418',tank:'#f4f1ec',tankS:'#c9c4c0',pants:'#272631',pantsS:'#1a1922',shoe:'#0f0d12'},
 apollo:{skin:'#8a5a3c',shade:'#6a4229',hair:'#120d0c',tank:'#f2f0ee',tankS:'#c5c0bd',pants:'#2b2a38',pantsS:'#1c1b26',shoe:'#0e0c10'}
};
function rng(seed){var s=seed>>>0;return function(){s=(s*1664525+1013904223)>>>0;return s/4294967296}}
function R(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
function limb(g,x1,y1,x2,y2,w,c){g.strokeStyle=c;g.lineWidth=w;g.lineCap='round';g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke()}
function poly(g,pts,c){g.fillStyle=c;g.beginPath();g.moveTo(pts[0],pts[1]);for(var i=2;i<pts.length;i+=2)g.lineTo(pts[i],pts[i+1]);g.closePath();g.fill()}
function ell(g,x,y,rx,ry,c){g.fillStyle=c;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill()}
/* two-bone IK: elbow bends outward (side = -1 left, +1 right) */
function elbow(sx,sy,hx,hy,a,b,side){
 var dx=hx-sx,dy=hy-sy,d=Math.max(1,Math.min(a+b-0.01,Math.hypot(dx,dy)));
 var cosA=(a*a+d*d-b*b)/(2*a*d),ang=Math.atan2(dy,dx)-side*Math.acos(Math.max(-1,Math.min(1,cosA)));
 return [sx+Math.cos(ang)*a,sy+Math.sin(ang)*a];
}
function neonText(g,txt,x,y,size,col,align){
 g.save();g.font='900 '+size+'px "Arial Black","Arial Narrow",Impact,sans-serif';g.textAlign=align||'center';g.textBaseline='middle';
 g.shadowColor=col;g.shadowBlur=8;g.fillStyle=col;g.fillText(txt,x,y);g.shadowBlur=3;g.fillStyle='#fff';g.globalAlpha=0.75;g.fillText(txt,x,y);g.restore();
}
function neonRect(g,x,y,w,h,col){
 g.save();g.shadowColor=col;g.shadowBlur=9;g.strokeStyle=col;g.lineWidth=2;g.strokeRect(x,y,w,h);
 g.shadowBlur=2;g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=0.7;g.strokeRect(x,y,w,h);g.restore();
}
var PINK='#ff3ad8',BLUE='#2f7bff',CYAN='#29d6ff',YEL='#ffd23a';

/* ---------- image art (game/assets/*.webp) with the canvas art as fallback ----------
   The sprite scene is used only when every CORE image has loaded; otherwise the canvas-drawn scene below is used.
   Layout is in background-image pixels (gym-bg is 1280x720, cover-fitted to the W x 225 scene; visible x range is
   about 224..1056 on the narrowest (portrait) screens, so keep important things inside it).
   To swap art later: replace the files (same names) and, if sizes change, tweak LAY below. */
var SPR={},CORE=['bg','bench','bag','richie-idle','richie-punch','richie-bench-bar','richie-bench-arms','richie-bench-body','apollo-cross','apollo-lean'],
 SLOT_NAMES=CORE.concat(['richie-portrait','apollo-portrait']);
var LAY={IW:1280,IH:720,
 bench:[540,280],                       /* bench patch (original pixels of the empty bench) drawn at its place in the bg */
 bag:{x:284,y:132,px:342,py:0,max:0.11},/* bag sprite top-left + chain pivot; swing clamp (rad) */
 sR:0.82,sRb:0.86,sAx:1.25,sAy:1.0,              /* Richie scale; Apollo scale (wider = bulkier, Richie stays a bit taller) */
 press:{x:540,bottom:592,D:55,slices:{barY:84,plateY:124,armY:190},head:[617,399]},
 lean:{right:612,bottom:560},
 stand:{richie:[800,640],apollo:[965,616]},
 box:{bottom:640,fistX:398,back:14},
 apolloBag:[965,616]};
function spriteMode(){for(var i=0;i<CORE.length;i++)if(!SPR[CORE[i]])return false;return true}
function loadSprites(map,onChange){
 var keys=Object.keys(map||{}).filter(function(k){return SLOT_NAMES.indexOf(k)>=0&&map[k]});
 return Promise.all(keys.map(function(k){return new Promise(function(res){var im=new Image();im.decoding='async';
  im.onload=function(){SPR[k]=im;if(onChange)onChange(k);res(true)};im.onerror=function(){delete SPR[k];res(false)};im.src=map[k]})}));
}
function fit(W){var k=Math.max(W/LAY.IW,H/LAY.IH);return {k:k,ox:(W-LAY.IW*k)/2,oy:(H-LAY.IH*k)/2}}
function drawSpriteScene(g,bg,S){
 var W=bg.width,F=fit(W),k=F.k;
 g.drawImage(bg,0,0);
 if(S.pulse>0){var pg=g.createLinearGradient(0,0,0,H*0.5);pg.addColorStop(0,'rgba(255,58,216,'+(S.pulse*0.10)+')');pg.addColorStop(1,'rgba(255,58,216,0)');g.fillStyle=pg;g.fillRect(0,0,W,H*0.5)}
 g.save();g.translate(Math.round(S.shakeX||0),Math.round(S.shakeY||0));
 g.translate(F.ox,F.oy);g.scale(k,k);g.imageSmoothingEnabled=false;
 var L=S.layout||'press';
 function img(n,x,y,sx,sy,flip){var im=SPR[n],w=im.naturalWidth*sx,h=im.naturalHeight*(sy||sx);if(flip){g.save();g.translate(x+w,y);g.scale(-1,1);g.drawImage(im,0,0,w,h);g.restore()}else g.drawImage(im,x,y,w,h);return [w,h]}
 function shadow(x,y,rx){g.fillStyle='rgba(0,0,0,.38)';g.beginPath();g.ellipse(x,y,rx,rx*0.16,0,0,Math.PI*2);g.fill()}
 /* heavy bag + chain (swings around the chain top) */
 var B=LAY.bag,bi=SPR.bag,ang=Math.max(-B.max,Math.min(B.max,(S.bagAng||0)*0.3));
 g.save();g.translate(B.px,B.py);g.rotate(ang);
 g.strokeStyle='#8d8a96';g.lineWidth=5;g.beginPath();g.moveTo(0,0);g.lineTo(0,70);g.moveTo(0,70);g.lineTo(B.x-B.px+14,B.y-B.py+12);g.moveTo(0,70);g.lineTo(B.x-B.px+bi.naturalWidth-14,B.y-B.py+12);g.stroke();
 g.strokeStyle='#3a3842';g.lineWidth=2;g.setLineDash([5,5]);g.beginPath();g.moveTo(0,0);g.lineTo(0,70);g.stroke();g.setLineDash([]);
 var sq=1+(S.bagSquash||0)*0.04;g.drawImage(bi,B.x-B.px-(sq-1)*bi.naturalWidth/2,B.y-B.py,bi.naturalWidth*sq,bi.naturalHeight);
 if(S.bagFlash>0){g.globalCompositeOperation='lighter';g.globalAlpha=Math.min(1,S.bagFlash)*0.35;g.drawImage(bi,B.x-B.px,B.y-B.py);g.globalAlpha=1;g.globalCompositeOperation='source-over'}
 g.restore();
 var ci=SPR['apollo-cross'];
 if(L==='press'){
  var P=LAY.press,bb=SPR['richie-bench-body'],sw=bb.naturalWidth,sh=bb.naturalHeight,s=LAY.sRb,top=P.bottom-sh*s,d=(1-(S.barH||0))*P.D,sl=P.slices,dip=(S.dip||0)*2;
  var li=SPR['apollo-lean'],lw=li.naturalWidth*LAY.sAx,lh=li.naturalHeight*LAY.sAy;
  shadow(LAY.lean.right-lw*0.5,LAY.lean.bottom-4,lw*0.42);
  g.drawImage(li,LAY.lean.right-lw,LAY.lean.bottom-lh-(1-(S.barH||0))*10,lw,lh);
  shadow(P.x+sw*s*0.5,P.bottom-6,sw*s*0.46);
  g.drawImage(bb,P.x,top,sw*s,sh*s);
  var ai=SPR['richie-bench-arms'],ah=sl.armY-sl.barY;
  g.drawImage(ai,0,sl.barY,sw,ah,P.x,top+(sl.barY+d)*s,sw*s,Math.max(1,(ah-d))*s);
  g.drawImage(SPR['richie-bench-bar'],P.x,top+(d+dip)*s,sw*s,sh*s);
 }else{
  g.drawImage(SPR.bench,LAY.bench[0],LAY.bench[1]);
  if(L==='stand'){
   var r=SPR['richie-idle'],rw=r.naturalWidth*LAY.sR,rh=r.naturalHeight*LAY.sR,A=LAY.stand;
   var aw=ci.naturalWidth*LAY.sAx,ah2=ci.naturalHeight*LAY.sAy;
   shadow(A.apollo[0],A.apollo[1]-4,aw*0.5);g.drawImage(ci,A.apollo[0]-aw/2,A.apollo[1]-ah2,aw,ah2);
   shadow(A.richie[0],A.richie[1]-4,rw*0.5);g.drawImage(r,A.richie[0]-rw/2,A.richie[1]-rh,rw,rh);
  }else{
   var aw3=ci.naturalWidth*LAY.sAx,ah3=ci.naturalHeight*LAY.sAy,hop=S.apolloArms==='fist'?Math.abs(Math.sin((S.t||0)*9))*14:0;
   shadow(LAY.apolloBag[0],LAY.apolloBag[1]-4,aw3*0.5);g.drawImage(ci,LAY.apolloBag[0]-aw3/2,LAY.apolloBag[1]-ah3-hop,aw3,ah3);
  }
 }
 if(L==='bag'){
  var X=LAY.box,p=S.punch||0,useP=S.boxPose==='punch';
  if(useP){var pi=SPR['richie-punch'],pw=pi.naturalWidth*LAY.sR,ph=pi.naturalHeight*LAY.sR;shadow(X.fistX+pw*0.6,X.bottom-4,pw*0.38);img('richie-punch',X.fistX+X.back*(1-p),X.bottom-ph,LAY.sR,LAY.sR,true)}
  else{var ri=SPR['richie-idle'],iw=ri.naturalWidth*LAY.sR,ih=ri.naturalHeight*LAY.sR;shadow(X.fistX+90,X.bottom-4,iw*0.5);img('richie-idle',X.fistX+90-iw/2,X.bottom-ih,LAY.sR,LAY.sR,true)}
 }
 g.restore();
 /* particles are in scene (logical) coords */
 g.save();g.translate(Math.round(S.shakeX||0),Math.round(S.shakeY||0));particles(g,S.parts||[]);g.restore();
}
function spriteAnchors(W){var F=fit(W),k=F.k,m=function(x,y){return [F.ox+x*k,F.oy+y*k]},im=m(LAY.box.fistX+4,LAY.box.bottom-330);
 return {head:m(LAY.press.head[0],LAY.press.head[1]),bagX:im[0]-18,impact:im}}
/* ---------- static background (wall, ceiling, signs, racks, floor) ---------- */
function makeBg(W){
 var c=document.createElement('canvas');c.width=W;c.height=H;var g=c.getContext('2d'),r=rng(77),cx=W/2,bx=cx+30;
 if(spriteMode()){var im=SPR.bg,k=Math.max(W/im.naturalWidth,H/im.naturalHeight),dw=im.naturalWidth*k,dh=im.naturalHeight*k;g.imageSmoothingEnabled=true;g.drawImage(im,(W-dw)/2,(H-dh)/2,dw,dh);c.__img=true;return c}
 /* brick wall */
 R(g,0,0,W,FLOOR,'#1d1426');
 for(var y=16,row=0;y<FLOOR;y+=6,row++){
  for(var x=-(row%2)*7;x<W;x+=14){var v=r();var col=v<0.15?'#3e2230':v<0.5?'#331c29':'#2b1823';R(g,x,y,13,5,col);if(r()<0.25)R(g,x+2+r()*8,y+1,2,1,'#311a24')}
 }
 /* depth: darken edges and top, back of the warehouse */
 var vg=g.createLinearGradient(0,0,0,FLOOR);vg.addColorStop(0,'rgba(5,2,10,.6)');vg.addColorStop(0.45,'rgba(5,2,10,.08)');vg.addColorStop(1,'rgba(5,2,10,.3)');g.fillStyle=vg;g.fillRect(0,0,W,FLOOR);
 var hg=g.createLinearGradient(0,0,W,0);hg.addColorStop(0,'rgba(0,0,0,.28)');hg.addColorStop(0.2,'rgba(0,0,0,0)');hg.addColorStop(0.8,'rgba(0,0,0,0)');hg.addColorStop(1,'rgba(0,0,0,.28)');g.fillStyle=hg;g.fillRect(0,0,W,FLOOR);
 /* ceiling + beams + strip lights */
 R(g,0,0,W,15,'#07050b');R(g,0,14,W,2,'#1a1422');
 for(var bxm=10;bxm<W;bxm+=46)R(g,bxm,0,3,15,'#110d17');
 for(var lx=cx-150;lx<W;lx+=60){if(lx<-20)continue;
  var cone=g.createLinearGradient(0,8,0,FLOOR);cone.addColorStop(0,'rgba(255,240,200,.16)');cone.addColorStop(1,'rgba(255,240,200,0)');
  g.fillStyle=cone;g.beginPath();g.moveTo(lx,9);g.lineTo(lx+18,9);g.lineTo(lx+40,FLOOR);g.lineTo(lx-22,FLOOR);g.closePath();g.fill();
  g.save();g.shadowColor='#fff1c8';g.shadowBlur=8;R(g,lx,7,18,2,'#fff6dc');g.restore();}
 /* neon rectangles along the wall */
 var cols=[PINK,BLUE,BLUE,PINK,BLUE,PINK,BLUE];
 for(var i=0,nx=cx-130;nx<W-20;nx+=34,i++){if(nx<6)continue;if(Math.abs(nx+10-cx)<40||nx+20>W-56||nx<48)continue;neonRect(g,nx,44,20,13,cols[i%cols.length])}
 /* signs: kid-safe */
 neonRect(g,8,24,36,24,PINK);neonText(g,'20K',26,36.5,12,PINK);
 neonText(g,'SHRED ZEPPELIN',cx,28,12,PINK);
 g.save();g.shadowColor=CYAN;g.shadowBlur=6;R(g,cx-60,36,120,1,CYAN);g.restore();
 neonRect(g,W-52,22,44,28,CYAN);neonText(g,'NO PAIN',W-30,30,7.5,CYAN);neonText(g,'NO GAIN',W-30,42,7.5,PINK);
 /* dumbbell rack (left) */
 var rx0=4,rx1=Math.max(46,cx-112);
 R(g,rx0,80,rx1-rx0,3,'#2c2a33');R(g,rx0,96,rx1-rx0,3,'#2c2a33');R(g,rx0,112,rx1-rx0,3,'#2c2a33');
 for(var py=rx0;py<=rx1;py+=Math.max(10,(rx1-rx0)/3))R(g,py,78,2,42,'#25232b');
 [[74,4],[90,4.5],[106,5]].forEach(function(s){for(var dx=rx0+5;dx<rx1-4;dx+=9){ell(g,dx,s[0]+3,s[1],s[1],'#1b1a20');ell(g,dx-1,s[0]+2,s[1]*0.5,s[1]*0.5,'#3a3843')}});
 /* arcade cabinet (original, no logos) */
 var ax=cx-64;
 poly(g,[ax,72,ax+20,72,ax+22,120,ax-2,120],'#1d1730');R(g,ax,72,20,6,YEL);R(g,ax+2,73,16,4,'#ff8a2b');
 g.save();g.shadowColor=CYAN;g.shadowBlur=8;R(g,ax+3,81,14,11,'#1a5cff');g.restore();
 R(g,ax+5,84,3,2,PINK);R(g,ax+11,86,2,2,YEL);R(g,ax+4,89,12,1,CYAN);
 R(g,ax+1,95,18,5,'#2a2240');R(g,ax+5,96,2,2,'#ff3a3a');R(g,ax+12,96,2,2,'#ffd23a');R(g,ax+15,97,2,2,'#29d6ff');
 R(g,ax-2,100,24,1,'#3a2f55');
 /* far weight plates leaning */
 for(var k=0;k<4;k++)ell(g,cx-38+k*5,112,6,8,'#16151b');
 /* power cages (right) */
 var c0=bx+68;
 for(var cg=c0;cg<W-6;cg+=26){
  R(g,cg,58,2,62,'#3a3842');R(g,cg+18,62,2,58,'#2d2b34');R(g,cg,58,20,2,'#3a3842');R(g,cg,88,20,1,'#2a2830');
  for(var hk=66;hk<116;hk+=8)R(g,cg+2,hk,1,1,'#55525e');
 }
 /* small bags hanging at the back right */
 for(var sb=c0+12,j=0;sb<W-10;sb+=30,j++){R(g,sb+3,15,1,52,'#2e2c34');var sc=j%2?'#1e1d24':'#5a1a1d';R(g,sb,66,8,24,sc);R(g,sb+1,67,2,22,j%2?'#2c2b34':'#7a2a2a')}
 /* clutter on the back floor line */
 for(var q=0;q<W;q+=7)if(r()<0.35)R(g,q,117+r()*3,2+r()*4,2,'#1b1820');
 /* floor */
 var fl=g.createLinearGradient(0,FLOOR,0,H);fl.addColorStop(0,'#221c28');fl.addColorStop(1,'#16121b');g.fillStyle=fl;g.fillRect(0,FLOOR,W,H-FLOOR);
 /* tile speckle */
 for(var s2=0;s2<W*4;s2++){var sx=r()*W,sy=FLOOR+r()*(H-FLOOR);R(g,sx,sy,1,1,r()<0.5?'#2a2431':'#18141d')}
 /* perspective tile grid */
 var vpY=40;g.strokeStyle='rgba(62,54,72,.9)';g.lineWidth=1;g.beginPath();
 for(var n=-14;n<=14;n++){var xb=cx+n*34,t0=(FLOOR-vpY)/(H-vpY);g.moveTo(cx+(xb-cx)*t0,FLOOR);g.lineTo(xb,H)}
 for(var m=0;m<9;m++){var yy=FLOOR+(H-FLOOR)*Math.pow(m/8,1.7);g.moveTo(0,Math.round(yy)+0.5);g.lineTo(W,Math.round(yy)+0.5)}
 g.stroke();
 /* neon reflections */
 [[26,PINK,40],[cx,PINK,60],[W-30,CYAN,40]].forEach(function(p){var rg=g.createRadialGradient(p[0],FLOOR+16,1,p[0],FLOOR+16,p[2]);rg.addColorStop(0,p[1]+'33');rg.addColorStop(1,p[1]+'00');g.fillStyle=rg;g.fillRect(p[0]-p[2],FLOOR,p[2]*2,40)});
 /* yellow dashed lines */
 function dash(x1,y1,x2,y2){var len=Math.hypot(x2-x1,y2-y1),seg=Math.floor(len/7);for(var d=0;d<seg;d+=2){var a=d/seg,b=(d+1)/seg;limb(g,x1+(x2-x1)*a,y1+(y2-y1)*a,x1+(x2-x1)*b,y1+(y2-y1)*b,1+a*1.5,'#c9a222')}}
 g.lineCap='butt';dash(cx-118,FLOOR+3,cx-330,H+10);dash(cx+150,FLOOR+3,cx+360,H+10);
 limb(g,cx-118,FLOOR+3,cx+150,FLOOR+3,1,'rgba(201,162,34,.5)');
 /* bottom vignette */
 g.save();g.globalCompositeOperation='screen';g.fillStyle='rgba(70,45,95,.16)';g.fillRect(0,0,W,H);g.restore();
 var bv=g.createLinearGradient(0,H-40,0,H);bv.addColorStop(0,'rgba(0,0,0,0)');bv.addColorStop(1,'rgba(0,0,0,.3)');g.fillStyle=bv;g.fillRect(0,H-40,W,40);
 return c;
}

/* ---------- heads ---------- */
function headFront(g,x,top,w,h,P,expr,style){
 var l=x-w/2;
 R(g,l-1,top+h*0.38,2,4,P.shade);R(g,l+w-1,top+h*0.38,2,4,P.shade);/* ears */
 R(g,l,top+2,w,h-4,P.skin);R(g,l+1,top+h-3,w-2,2,P.skin);R(g,l+2,top+h-1,w-4,1,P.shade);/* jaw */
 R(g,l+w-2,top+3,2,h-6,P.shade);
 if(style==='buzz'){R(g,l,top,w,3,P.hair);R(g,l,top+2,1,3,P.hair);R(g,l+w-1,top+2,1,3,P.hair)}
 else{R(g,l-1,top-1,w+2,4,P.hair);R(g,l-1,top+2,2,4,P.hair);R(g,l+w-1,top+2,2,3,P.hair);R(g,l+2,top+3,4,1,P.hair)}
 var ey=top+Math.round(h*0.45);
 R(g,l+2,ey-2,3,1,P.hair);R(g,l+w-5,ey-2,3,1,P.hair);/* brows */
 if(expr==='strain'){R(g,l+2,ey,3,1,'#2a1a14');R(g,l+w-5,ey,3,1,'#2a1a14');R(g,l+3,ey-3,2,1,P.hair);R(g,l+w-5,ey-3,2,1,P.hair)}
 else{R(g,l+2,ey,2,2,'#fff');R(g,l+w-4,ey,2,2,'#fff');R(g,l+3,ey,1,2,'#221510');R(g,l+w-4,ey,1,2,'#221510')}
 R(g,x-0.5,ey+1,1,3,P.shade);/* nose */
 var my=top+h-4;
 if(expr==='strain'){R(g,x-3,my-1,6,2,'#f4f0ea');R(g,x-3,my-1,6,0.6,'#5a2a22')}
 else if(expr==='smile'||expr==='cheer'){R(g,x-3,my-1,6,1,'#5a2a22');R(g,x-3,my-2,1,1,'#5a2a22');R(g,x+2,my-2,1,1,'#5a2a22');if(expr==='cheer')R(g,x-2,my,4,1,'#f4f0ea')}
 else R(g,x-2,my-1,4,1,'#5a2a22');
}
function headSideL(g,x,top,P,expr){/* faces left; x = center */
 R(g,x-5,top+2,11,11,P.skin);R(g,x-6,top+6,1,3,P.skin);/* nose */R(g,x-4,top+12,8,2,P.skin);R(g,x+3,top+3,3,9,P.shade);
 R(g,x-5,top,11,3,P.hair);R(g,x+2,top+2,4,5,P.hair);R(g,x+2,top+7,2,2,P.shade);/* ear */
 R(g,x-3,top+5,2,1,P.hair);
 if(expr==='strain'){R(g,x-4,top+6,2,1,'#2a1a14')}else{R(g,x-4,top+6,2,2,'#fff');R(g,x-4,top+6,1,2,'#221510')}
 if(expr==='cheer'||expr==='strain'){R(g,x-5,top+10,3,1,'#f4f0ea')}else R(g,x-5,top+10,3,1,'#5a2a22');
}

/* ---------- Apollo, standing spotter (front view) ---------- */
function apolloFront(g,x,foot,S){
 var P=PAL.apollo,hy=foot-128,sh=hy+22;
 ell(g,x,foot+1,26,4,'rgba(0,0,0,.45)');
 /* legs */
 R(g,x-15,sh+44,13,foot-(sh+44)-3,P.pants);R(g,x+2,sh+44,13,foot-(sh+44)-3,P.pants);R(g,x-3,sh+44,2,30,P.pantsS);R(g,x+12,sh+46,3,foot-sh-50,P.pantsS);
 R(g,x-17,foot-4,15,4,P.shoe);R(g,x+2,foot-4,15,4,P.shoe);
 /* torso: big shoulders, tank */
 poly(g,[x-21,sh+2,x+21,sh+2,x+16,sh+46,x-16,sh+46],P.skin);
 poly(g,[x-14,sh+1,x+14,sh+1,x+15,sh+46,x-15,sh+46],P.tank);
 poly(g,[x-7,sh,x+7,sh,x+4,sh+8,x-4,sh+8],P.skin);/* neckline */
 R(g,x+12,sh+10,2,34,P.tankS);R(g,x-15,sh+42,30,4,P.pantsS);
 R(g,x-5,sh-6,10,8,P.skin);R(g,x+2,sh-6,3,8,P.shade);
 ell(g,x-19,sh+5,6,6,P.skin);ell(g,x+19,sh+5,6,6,P.skin);ell(g,x+21,sh+6,3,4,P.shade);
 headFront(g,x,hy,14,16,P,S.apolloExpr||'smile','buzz');
 /* arms */
 var arms=S.apolloArms;
 if(arms==='cross'){
  limb(g,x-20,sh+7,x-22,sh+22,8,P.skin);limb(g,x+20,sh+7,x+22,sh+22,8,P.skin);
  limb(g,x-22,sh+22,x+12,sh+20,7,P.skin);limb(g,x+22,sh+22,x-12,sh+24,7,P.shade);
 }else if(arms==='fist'){
  limb(g,x-20,sh+7,x-24,sh+24,8,P.skin);limb(g,x-24,sh+24,x-18,sh+34,7,P.skin);
  limb(g,x+20,sh+6,x+30,sh-6,8,P.skin);limb(g,x+30,sh-6,x+28,sh-26,7,P.skin);R(g,x+24,sh-32,8,7,P.skin);R(g,x+24,sh-32,8,2,P.shade);
 }else if(arms){
  [[-1,arms.l],[1,arms.r]].forEach(function(a){var s=a[0],sx=x+s*20,sy=sh+7,h=a[1],e=elbow(sx,sy,h[0],h[1],18,18,-s);
   limb(g,sx,sy,e[0],e[1],8,P.skin);limb(g,e[0],e[1],h[0],h[1],7,s>0?P.shade:P.skin);R(g,h[0]-3,h[1]-2,6,5,P.skin)});
 }
}

/* ---------- bench press (side view): Richie lies on the bench, head at the left; Apollo spots behind his head ---------- */
var BENCH_TOP=156;
function mirror(g,x,fn){g.save();g.translate(x,0);g.scale(-1,1);g.translate(-x,0);fn();g.restore()}
function uprights(g,bx){/* rack posts + J-hooks at the head end of the bench */
 var ux=bx-36;R(g,ux-1,112,3,66,'#3a3842');R(g,ux+1,112,1,66,'#55525e');R(g,ux-8,176,18,3,'#2e2b36');
 R(g,ux-1,116,7,2,'#55525e');R(g,ux+4,113,2,4,'#55525e');
}
function flatBench(g,bx){
 ell(g,bx-8,181,44,4,'rgba(0,0,0,.5)');
 R(g,bx-42,BENCH_TOP+5,3,19,'#2e2b36');R(g,bx+16,BENCH_TOP+5,3,19,'#2e2b36');R(g,bx-46,177,10,3,'#2e2b36');R(g,bx+12,177,10,3,'#2e2b36');
 R(g,bx-44,BENCH_TOP+3,64,3,'#24222b');
 R(g,bx-48,BENCH_TOP-2,70,6,'#3a1f2a');R(g,bx-48,BENCH_TOP-2,70,2,'#5a2e3c');R(g,bx-48,BENCH_TOP+3,70,1,'#22121a');
}
function headUp(g,x,y,P,expr){/* lying face-up: crown at left, chin at right, nose up */
 R(g,x-5,y-10,11,10,P.skin);R(g,x+5,y-8,2,6,P.skin);/* chin */R(g,x-5,y-2,11,2,P.shade);
 R(g,x-7,y-10,4,10,P.hair);R(g,x-5,y-11,5,2,P.hair);R(g,x-7,y-1,6,1,P.hair);
 R(g,x,y-5,2,3,P.shade);/* ear */
 R(g,x-2,y-12,3,1,P.hair);/* brow */
 if(expr==='strain'){R(g,x-2,y-10,3,1,'#2a1a14');R(g,x+4,y-10,2,2,'#f4f0ea')}
 else{R(g,x-2,y-11,2,2,'#fff');R(g,x-1,y-11,1,1,'#221510');R(g,x+4,y-10,2,1,expr==='cheer'?'#f4f0ea':'#5a2a22')}
 R(g,x+1,y-13,2,2,P.skin);/* nose */
}
function richieLying(g,bx,barX,barY,S){
 var P=PAL.richie,top=BENCH_TOP-1;
 /* far leg + far arm (darker, behind) */
 limb(g,bx+8,top-6,bx+30,top-16,9,P.pantsS);limb(g,bx+30,top-16,bx+37,178,8,P.pantsS);R(g,bx+34,176,10,4,P.shoe);
 var fs=[bx-24,top-12],fe=elbow(fs[0],fs[1],barX+2,barY+2,24,24,-1);limb(g,fs[0],fs[1],fe[0],fe[1],6,P.shade);limb(g,fe[0],fe[1],barX+2,barY+2,5,P.shade);
 /* torso on the pad */
 poly(g,[bx-28,top,bx+12,top,bx+12,top-11,bx-6,top-13,bx-20,top-15,bx-28,top-12],P.skin);
 poly(g,[bx-23,top,bx+12,top,bx+12,top-11,bx-6,top-13,bx-19,top-14,bx-23,top-11],P.tank);
 R(g,bx-23,top-2,35,2,P.tankS);
 R(g,bx+6,top-11,8,11,P.pants);R(g,bx+6,top-11,2,11,'#111');
 R(g,bx-33,top-9,6,7,P.skin);/* neck */
 headUp(g,bx-38,top,P,S.richieExpr||'calm');
 /* near leg: thigh up to the knee, shin down to the floor */
 limb(g,bx+10,top-5,bx+32,top-13,10,P.pants);limb(g,bx+32,top-13,bx+39,178,9,P.pants);R(g,bx+35,177,12,4,P.shoe);
 /* near arm */
 var ns=[bx-22,top-10],ne=elbow(ns[0],ns[1],barX,barY,24,24,-1);
 ell(g,ns[0],ns[1],5,4,P.skin);limb(g,ns[0],ns[1],ne[0],ne[1],7,P.skin);limb(g,ne[0],ne[1],barX,barY+1,6,P.skin);R(g,ne[0]-1,ne[1],2,2,P.shade);
 R(g,barX-3,barY-3,6,6,P.skin);
}
function apolloSpot(g,bx,barX,barY,h,S){/* side view facing right, behind Richie's head */
 var P=PAL.apollo,fx=bx-62,foot=178,lean=(1-h);
 var hip=[fx+2,foot-62],sh=[fx+10+lean*8,foot-104+lean*14];
 /* legs */
 limb(g,hip[0]-2,hip[1],fx-6,foot-3,11,P.pantsS);R(g,fx-10,foot-4,15,4,P.shoe);
 limb(g,hip[0]+2,hip[1],fx+6,foot-3,11,P.pants);R(g,fx+2,foot-4,16,4,P.shoe);
 /* far arm */
 var fe=elbow(sh[0]-2,sh[1]+4,barX-4,barY+4,26,26,1);limb(g,sh[0]-2,sh[1]+4,fe[0],fe[1],8,P.shade);limb(g,fe[0],fe[1],barX-4,barY+4,7,P.shade);
 /* torso */
 poly(g,[hip[0]-9,hip[1]+2,hip[0]+9,hip[1]+2,sh[0]+12,sh[1]+2,sh[0]-10,sh[1]-2],P.tank);
 poly(g,[sh[0]-11,sh[1]-2,sh[0]-4,sh[1]-3,hip[0]-4,hip[1],hip[0]-9,hip[1]],P.tankS);
 R(g,hip[0]-10,hip[1]-2,20,6,P.pants);
 ell(g,sh[0]+3,sh[1]+3,8,7,P.skin);
 R(g,sh[0]-2,sh[1]-10,8,9,P.skin);
 /* head facing right (mirrored side head) */
 var hx=sh[0]+4,hy=sh[1]-24;
 mirror(g,hx,function(){g.save();g.translate(hx,hy);g.scale(1.25,1.25);g.translate(-hx,-hy);headSideL(g,hx,hy,P,S.apolloExpr||'smile');g.restore()});
 R(g,hx-6,hy-1,13,3,P.hair);
 /* near arm reaching to the bar */
 var hx2=barX-2,hy2=barY+5,ne=elbow(sh[0]+3,sh[1]+4,hx2,hy2,26,26,1);
 limb(g,sh[0]+3,sh[1]+4,ne[0],ne[1],9,P.skin);limb(g,ne[0],ne[1],hx2,hy2,8,P.skin);R(g,hx2-4,hy2-3,7,6,P.skin);
}
function plateEnd(g,x,y,r){/* barbell seen end-on: near plates with "400" */
 ell(g,x+2,y+1.5,r,r,'#0c1020');
 ell(g,x,y,r,r,'#1a2240');ell(g,x,y,r-1,r-1,'#222c52');
 g.strokeStyle='#4a5c96';g.lineWidth=1;g.beginPath();g.arc(x,y,r-1.5,Math.PI*1.05,Math.PI*1.6);g.stroke();
 g.strokeStyle='#121830';g.beginPath();g.arc(x,y,r*0.62,0,Math.PI*2);g.stroke();
 ell(g,x,y,3.2,3.2,'#9ca0aa');ell(g,x-0.6,y-0.6,1.4,1.4,'#e0e3ea');
 g.save();g.font='900 6px "Arial Black",Impact,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#ffd23a';g.shadowColor='#ffd23a';g.shadowBlur=3;
 g.fillText('400',x,y-r*0.55+1);g.restore();
}
function rackedBar(g,bx){var ux=bx-36;plateEnd(g,ux+3,113,15)}
/* ---------- heavy bag on a chain ---------- */
function heavyBag(g,x,ang,flash,squash){
 g.save();g.translate(x,-2);g.rotate(ang);
 for(var cy=0;cy<30;cy+=4){R(g,cy%8?-1:-2,cy,cy%8?2:4,3,cy%8?'#6c6a74':'#9a98a4');R(g,-0.5,cy+1,1,1,'#2a2830')}
 limb(g,0,30,-15,40,1.4,'#55535e');limb(g,0,30,15,40,1.4,'#55535e');limb(g,0,30,-6,40,1.2,'#46444f');limb(g,0,30,6,40,1.2,'#46444f');
 R(g,-2,28,4,4,'#a8a6b2');
 var w=18*(1-squash*0.12),top=40,bot=152;
 R(g,-w,top,w*2,bot-top,'#6e1c20');
 R(g,-w+3,top+2,5,bot-top-4,'#9a3330');R(g,-w+4,top+4,2,bot-top-10,'#b8504a');
 R(g,w-7,top,7,bot-top,'#4a1114');R(g,w-3,top,3,bot-top,'#350b0e');
 R(g,-w,top,w*2,6,'#2a1416');R(g,-w,top+5,w*2,1,'#521418');
 R(g,-w,bot-7,w*2,7,'#2a1416');R(g,-w+2,bot,w*2-4,2,'#1e0e10');
 for(var sy=top+18;sy<bot-10;sy+=26){R(g,-w,sy,w*2,1,'#561519');for(var sx=-w+2;sx<w-2;sx+=3)R(g,sx,sy+2,1,1,'#7e2a28')}
 R(g,-w+9,top+44,3,2,'#82302c');R(g,w-12,top+70,4,1,'#3a0c0e');R(g,-w+12,top+92,2,3,'#8a3430');
 if(flash>0){g.globalAlpha=Math.min(1,flash)*0.6;ell(g,w-5,top+50,6,14,'#ffe0d0');ell(g,w-3,top+50,3,8,'#fff');g.globalAlpha=1}
 g.restore();
}

/* ---------- Richie boxing stance, side view facing left ---------- */
function richieBoxer(g,x0,foot,punch,S){
 var P=PAL.richie,hip=foot-40,sh=foot-74,p=punch;
 ell(g,x0,foot+1,20,3.5,'rgba(0,0,0,.5)');
 /* legs */
 limb(g,x0+2,hip,x0+10,hip+20,9,P.pantsS);limb(g,x0+10,hip+20,x0+13,foot-3,8,P.pantsS);R(g,x0+10,foot-4,11,4,P.shoe);
 limb(g,x0-2,hip,x0-9-p*2,hip+19,9,P.pants);limb(g,x0-9-p*2,hip+19,x0-14-p*2,foot-3,8,P.pants);R(g,x0-22-p*2,foot-4,12,4,P.shoe);
 /* rear arm (behind) */
 var rs=[x0+3,sh+3],rg=[x0-9,sh-4];var re=elbow(rs[0],rs[1],rg[0],rg[1],15,14,1);
 limb(g,rs[0],rs[1],re[0],re[1],6,P.shade);limb(g,re[0],re[1],rg[0],rg[1],5,P.shade);
 R(g,rg[0]-4,rg[1]-4,8,8,'#9a1a20');
 /* torso (lean in on the punch) */
 var lean=p*4;
 poly(g,[x0-7-lean,sh,x0+7-lean,sh,x0+6,hip+2,x0-6,hip+2],P.skin);
 poly(g,[x0-6-lean,sh+2,x0+5-lean,sh+2,x0+6,hip+2,x0-6,hip+2],P.tank);
 R(g,x0+2,sh+6,4,hip-sh-6,P.tankS);R(g,x0-7,hip-1,14,5,P.pants);R(g,x0-7,hip-1,14,1,'#111');
 R(g,x0-3-lean,sh-6,6,7,P.skin);
 headSideL(g,x0-1-lean,sh-20,P,S.richieExpr||'calm');
 /* lead arm: guard -> jab */
 var ls=[x0-4-lean,sh+3],gx=x0-15+(-34+15)*p,gy=sh-3+p*3,le=elbow(ls[0],ls[1],gx,gy,15,15,1);
 limb(g,ls[0],ls[1],le[0],le[1],6.5,P.skin);limb(g,le[0],le[1],gx,gy,5.5,P.skin);
 R(g,gx-5,gy-4,9,9,'#d6262e');R(g,gx-4,gy-3,4,3,'#ff6a6a');R(g,gx+2,gy-4,2,9,'#9a1a20');R(g,gx+3,gy+2,3,3,'#f0f0f0');
}

function particles(g,list){
 for(var i=0;i<list.length;i++){var p=list[i];g.globalAlpha=Math.max(0,Math.min(1,p.life*2));R(g,p.x,p.y,p.s||1,(p.s||1)*(p.tall||1),p.c)}
 g.globalAlpha=1;
}

/* ---------- whole scene ---------- */
var BAR0=139,BAR1=100,SC=1.2;
function big(g,x,y,fn){g.save();g.translate(x,y);g.scale(SC,SC);g.translate(-x,-y);fn();g.restore()}
function drawScene(g,bg,S){
 if(spriteMode()&&bg.__img)return drawSpriteScene(g,bg,S);
 var W=bg.width,cx=W/2,bx=cx+30,bagX=cx-95;
 g.drawImage(bg,0,0);
 /* neon flicker + music pulse */
 if(S.flicker){g.fillStyle='rgba(10,4,16,.55)';g.fillRect(W-54,20,48,32)}
 if(S.pulse>0){var pg=g.createLinearGradient(0,15,0,FLOOR);pg.addColorStop(0,'rgba(255,58,216,'+(S.pulse*0.12)+')');pg.addColorStop(1,'rgba(255,58,216,0)');g.fillStyle=pg;g.fillRect(0,15,W,FLOOR-15)}
 g.save();g.translate(Math.round(S.shakeX||0),Math.round(S.shakeY||0));
 var barY=BAR0-(S.barH||0)*(BAR0-BAR1),dip=S.dip||0;
 if(S.phase==='bag'||S.phase==='bagEnd'){
  /* bench empty, barbell resting on the floor, Apollo coaching */
  big(g,bx,180,function(){uprights(g,bx);flatBench(g,bx);rackedBar(g,bx)});
  big(g,bx+44,180,function(){apolloFront(g,bx+44,176,{apolloArms:S.apolloArms||'cross',apolloExpr:S.apolloExpr})});
 }else{
  var barX=bx-10;
  big(g,bx,180,function(){
  uprights(g,bx);apolloSpot(g,bx,barX,barY,S.barH||0,S);flatBench(g,bx);richieLying(g,bx,barX,barY+dip*0.4,S);plateEnd(g,barX,barY+dip,16);});
 }
 /* the heavy bag hangs in the foreground */
 ell(g,bagX+Math.sin(S.bagAng||0)*120,200,24,4,'rgba(0,0,0,.45)');
 heavyBag(g,bagX,S.bagAng||0,S.bagFlash||0,S.bagSquash||0);
 if(S.phase==='bag'||S.phase==='bagEnd')big(g,bagX+58,196,function(){richieBoxer(g,bagX+58,196,S.punch||0,S)});
 particles(g,S.parts||[]);
 g.restore();
}

/* ---------- dialogue portraits ---------- */
function portrait(cv,who,expr){
 var g=cv.getContext('2d'),P=PAL[who];g.imageSmoothingEnabled=false;
 g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);
 var pim=SPR[who+'-portrait'];if(pim){var gr=g.createLinearGradient(0,0,0,cv.height);gr.addColorStop(0,who==='apollo'?'#3a1248':'#12224a');gr.addColorStop(1,'#0a0618');g.fillStyle=gr;g.fillRect(0,0,cv.width,cv.height);g.imageSmoothingEnabled=who==='richie';g.drawImage(pim,0,0,cv.width,cv.height);return}
 var k=cv.width/24;g.setTransform(k,0,0,k,0,0);
 R(g,0,0,24,24,who==='apollo'?'#2a0e33':'#0e1a3a');
 for(var y=0;y<24;y+=3)R(g,0,y,24,1,'rgba(255,255,255,.04)');
 poly(g,[2,24,22,24,20,19,4,19],P.skin);poly(g,[6,24,18,24,17,19,7,19],P.tank);R(g,10,16,4,4,P.skin);
 headFront(g,12,4,12,14,P,expr||'smile',who==='apollo'?'buzz':'short');
}

function anchors(W,barH){if(spriteMode())return spriteAnchors(W);var cx=W/2,bx=cx+30,bagX=cx-95,f=function(x,y,ax,ay){return [ax+(x-ax)*SC,ay+(y-ay)*SC]};
 var by=BAR0-(barH||0)*(BAR0-BAR1);
 return {head:f(bx-38,BENCH_TOP-12,bx,180),bar:f(bx-10,by,bx,180),bagX:bagX,bagHit:[bagX+18,95],boxerHead:f(bagX+58-2,196-90,bagX+58,196),bench:f(bx,150,bx,180)}}
window.RosadoArt={anchors:anchors,loadSprites:loadSprites,sprites:SPR,SLOTS:SLOT_NAMES,spriteMode:spriteMode,LAY:LAY,H:H,makeBg:makeBg,drawScene:drawScene,portrait:portrait,PAL:PAL};
})();
