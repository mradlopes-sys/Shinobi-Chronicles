// Shinobi Chronicles — diretor de cena v2: atmosféra cinematográfica em canvas.
// Não toca no canvas do mapa, nos tokens, na câmera ou nos dados do Firestore.
const PRESET_SET=new Set(['none','rain','storm','mist','night','chakra']);
const CUE_SET=new Set(['shake','flash','pulse','transition']);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const ease=t=>t*t*(3-2*t);
const rand=(a,b)=>a+Math.random()*(b-a);
const rgba=(r,g,b,a)=>'rgba('+r+','+g+','+b+','+clamp(a,0,1)+')';
const mobile=()=>window.matchMedia('(max-width:690px)').matches;

export function createCinematicSceneFX({stage,host}){
  if(!stage||!host)return {setAtmosphere(){},cue(){},reset(){},destroy(){}};
  const canvas=document.createElement('canvas');
  canvas.className='sc-scene-fx-canvas';
  canvas.setAttribute('aria-hidden','true');
  host.appendChild(canvas);
  const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
  if(!ctx)return {setAtmosphere(){},cue(){},reset(){canvas.remove()},destroy(){canvas.remove()}};
  const reduceQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
  let width=0,height=0,dpr=1;
  let preset='none',strength=.6,oldPreset='none',oldStrength=.6,changeAt=0;
  let running=false,frame=0,lastFrame=0,lastPaint=0,dead=false;
  let rain=[],fog=[],motes=[],stars=[];
  let lightning=null,nextLightning=0;
  const cues=new Map();
  const stateKey=()=>preset+'|'+strength;

  function newRain(){
    const area=width*height;
    const count=clamp(Math.round(area/3400),45,mobile()?125:230);
    rain=Array.from({length:count},()=>({
      x:rand(-60,width+60),y:rand(-40,height+40),z:rand(.25,1),
      speed:rand(300,680),len:rand(5,21),twinkle:rand(.65,1.25),
      drift:rand(38,84)
    }));
  }
  function newFog(){
    fog=Array.from({length:mobile()?7:11},(_,i)=>({
      x:rand(-.2,1.2),y:rand(-.15,1.15),
      r:rand(.28,.56),stretch:rand(.48,.9),speed:rand(.006,.019),
      phase:rand(0,Math.PI*2),dir:i%2?1:-1
    }));
  }
  function newMotes(){
    const count=mobile()?37:88;
    motes=Array.from({length:count},()=>({
      angle:rand(0,Math.PI*2),radius:rand(.03,.43),phase:rand(0,6.28),
      size:rand(.65,2),speed:rand(.12,.62),glow:rand(.3,1),
      drift:rand(-.45,.45)
    }));
    stars=Array.from({length:mobile()?20:46},()=>({
      x:Math.random(),y:Math.random(),size:rand(.3,1.15),phase:rand(0,6.28)
    }));
  }
  function resize(){
    const bounds=host.getBoundingClientRect();
    const w=Math.max(0,Math.floor(bounds.width)),h=Math.max(0,Math.floor(bounds.height));
    if(!w||!h)return;
    const ratio=Math.min(window.devicePixelRatio||1,1.6);
    if(w===width&&h===height&&dpr===ratio)return;
    width=w;height=h;dpr=ratio;
    canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    newRain();newFog();newMotes();
  }
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
  observer?.observe(host);
  window.addEventListener('resize',resize,{passive:true});
  resize();

  function drawRain(t,dt,opacity,storm=false){
    if(opacity<.005)return;
    const wind=storm?1.7:1;
    ctx.save();
    ctx.lineCap='round';
    for(const p of rain){
      if(!reduceQuery.matches){
        p.x+=p.drift*wind*dt;
        p.y+=p.speed*(storm?1.24:1)*dt;
        if(p.y>height+38){p.y=rand(-65,-10);p.x=rand(-30,width)}
        if(p.x>width+55){p.x=rand(-50,-5)}
      }
      const z=p.z;
      const alpha=opacity*(storm?.32:.23)*(.36+z*.65)*p.twinkle;
      ctx.strokeStyle=rgba(storm?194:180,storm?210:211,storm?235:220,alpha);
      ctx.lineWidth=.5+z*.85;
      ctx.beginPath();
      ctx.moveTo(p.x,p.y);
      ctx.lineTo(p.x-(p.len*(storm?.65:.37)),p.y+p.len*(.45+z*.45));
      ctx.stroke();
      if(z>.81&&p.y>height*.22&&p.y<height*.88&&(Math.floor((t*.06+p.phase||p.x)/20)%17===0)){
        ctx.fillStyle=rgba(206,227,235,opacity*.12);
        ctx.fillRect(p.x,p.y,1,1);
      }
    }
    ctx.restore();
  }
  function ellipseMist(x,y,rad,stretch,opacity,hue,glaze){
    ctx.save();ctx.translate(x,y);ctx.scale(1,stretch);
    const grad=ctx.createRadialGradient(0,0,rad*.03,0,0,rad);
    grad.addColorStop(0,rgba(hue[0],hue[1],hue[2],opacity*.40));
    grad.addColorStop(.42,rgba(hue[0],hue[1],hue[2],opacity*.24));
    grad.addColorStop(.76,rgba(hue[0],hue[1],hue[2],opacity*.085));
    grad.addColorStop(1,rgba(hue[0],hue[1],hue[2],0));
    ctx.fillStyle=grad;
    ctx.beginPath();ctx.arc(0,0,rad,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function drawMist(t,dt,opacity,kind='mist'){
    if(opacity<.005)return;
    const haze=kind==='mist'?[168,187,179]:[92,117,128];
    const faint=kind==='mist'?.65:.35;
    for(const f of fog){
      if(!reduceQuery.matches){
        f.x+=f.dir*f.speed*dt;
        if(f.x>1.36)f.x=-.36;
        if(f.x<-.36)f.x=1.36;
      }
      const drift=Math.sin(t*.00012+f.phase)*height*.045;
      ellipseMist(f.x*width,f.y*height+drift,f.r*Math.max(width,height),
        f.stretch,opacity*faint,haze);
    }
  }
  function drawNight(t,opacity){
    if(opacity<.005)return;
    // Noite: poucos reflexos no lugar de cobrir a ilustração com preto chapado.
    const lamp=ctx.createRadialGradient(width*.65,height*.38,5,
      width*.65,height*.38,Math.max(width,height)*.65);
    lamp.addColorStop(0,rgba(114,146,175,opacity*.10));
    lamp.addColorStop(.42,rgba(67,87,132,opacity*.055));
    lamp.addColorStop(1,rgba(5,12,32,0));
    ctx.fillStyle=lamp;ctx.fillRect(0,0,width,height);
    for(const s of stars){
      const alpha=opacity*(.04+.06*Math.sin(t*.00055+s.phase));
      ctx.fillStyle=rgba(200,213,224,Math.max(.014,alpha));
      ctx.beginPath();ctx.arc(s.x*width,s.y*height,s.size,0,Math.PI*2);ctx.fill();
    }
  }
  function drawChakra(t,opacity){
    if(opacity<.005)return;
    const cx=width*.5,cy=height*.55,span=Math.min(width,height);
    const halo=ctx.createRadialGradient(cx,cy,span*.04,cx,cy,span*.47);
    halo.addColorStop(0,rgba(74,191,181,opacity*.085));
    halo.addColorStop(.5,rgba(51,137,143,opacity*.04));
    halo.addColorStop(1,rgba(53,131,140,0));
    ctx.fillStyle=halo;ctx.fillRect(0,0,width,height);
    ctx.save();
    ctx.globalCompositeOperation='screen';
    for(let j=0;j<3;j++){
      const radius=span*(.20+j*.085)+(reduceQuery.matches?0:Math.sin(t*.0012+j*1.8)*3);
      ctx.strokeStyle=rgba(100,198,184,opacity*(.09-j*.015));
      ctx.lineWidth=1.2;
      ctx.beginPath();
      ctx.ellipse(cx,cy,radius,radius*.58,-.22,Math.PI*.22+j*.51,Math.PI*1.3+j*.48);
      ctx.stroke();
    }
    for(const p of motes){
      const angle=p.angle+(reduceQuery.matches?0:t*.00012*p.speed);
      const orbit=span*p.radius;
      const x=cx+Math.cos(angle)*orbit+Math.sin(t*.00022+p.phase)*15;
      const y=cy+Math.sin(angle*1.28+p.phase)*orbit*.64-(reduceQuery.matches?0:t*.005*p.speed%35);
      const alpha=opacity*(.14+.29*p.glow)*(0.75+.25*Math.sin(t*.0018+p.phase));
      const rad=Math.max(.7,p.size);
      ctx.fillStyle=rgba(106,240,217,alpha);
      ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fill();
      if(p.glow>.75){
        ctx.fillStyle=rgba(71,194,198,alpha*.16);
        ctx.beginPath();ctx.arc(x,y,rad*3.2,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();
  }
  function boltPoints(seed=rand(.16,.84)){
    const pts=[],branches=[];
    let x=seed*width,y=-25;
    for(let i=0;i<9;i++){
      const nx=x+rand(-width*.105,width*.105),ny=(i+1)*height*.11;
      pts.push([x,y,nx,ny]);
      if(i>1&&i<7&&Math.random()<.4){
        branches.push([x,y,x+rand(-width*.19,width*.19),ny+rand(18,height*.14)]);
      }
      x=clamp(nx,15,width-15);y=ny;
    }
    return {pts,branches,born:performance.now()};
  }
  function drawBolt(now,opacity){
    if(!lightning)return;
    const age=now-lightning.born;
    if(age>530){lightning=null;return}
    const flicker=age<90?1:age<160?.08:age<215?.72:Math.max(0,.25-(age-215)/1150);
    if(flicker<.002)return;
    const alpha=opacity*flicker;
    ctx.save();
    ctx.globalCompositeOperation='screen';
    const glow=ctx.createLinearGradient(0,0,width,height);
    glow.addColorStop(0,rgba(117,154,210,alpha*.065));
    glow.addColorStop(1,rgba(200,218,244,alpha*.085));
    ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    ctx.lineJoin='round';ctx.lineCap='round';
    for(const [pass,w,a] of [[0,11,.05],[1,5,.16],[2,1.2,.65]]){
      ctx.strokeStyle=rgba(192,219,246,alpha*a);
      ctx.lineWidth=w;ctx.beginPath();
      for(const [x,y,nx,ny] of lightning.pts){ctx.moveTo(x,y);ctx.lineTo(nx,ny)}
      ctx.stroke();
    }
    ctx.strokeStyle=rgba(177,205,238,alpha*.23);ctx.lineWidth=.8;
    ctx.beginPath();
    for(const [x,y,nx,ny] of lightning.branches){ctx.moveTo(x,y);ctx.lineTo(nx,ny)}
    ctx.stroke();
    ctx.restore();
  }
  function paintTransition(now){
    const start=cues.get('transition');
    if(!start)return;
    const a=clamp((now-start)/1070,0,1);
    if(a>=1){cues.delete('transition');return}
    const enter=ease(clamp(a/.44,0,1));
    const leave=1-ease(clamp((a-.38)/.62,0,1));
    const alpha=Math.min(enter,leave)*.78;
    if(alpha<.003)return;
    ctx.save();ctx.globalAlpha=alpha;
    const spread=Math.max(width,height);
    const centerX=width*(.24+.36*ease(a)),centerY=height*.54;
    for(let i=0;i<8;i++){
      const angle=i*2.399;
      const x=centerX+Math.cos(angle)*spread*(.05+.065*i);
      const y=centerY+Math.sin(angle)*height*(.11+.022*i);
      const radius=spread*(.13+.05*(i%3)+.17*enter);
      const g=ctx.createRadialGradient(x,y,radius*.07,x,y,radius);
      g.addColorStop(0,rgba(15,30,25,.83));
      g.addColorStop(.48,rgba(29,44,34,.72));
      g.addColorStop(.78,rgba(39,57,43,.35));
      g.addColorStop(1,rgba(39,57,43,0));
      ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
    }
    ctx.restore();
  }
  function drawPulse(now){
    const start=cues.get('pulse');
    if(!start)return;
    const p=(now-start)/1250;
    if(p>=1){cues.delete('pulse');return}
    const span=Math.min(width,height),x=width*.5,y=height*.54;
    const rad=span*(.07+.6*ease(p));
    const alpha=Math.pow(1-p,1.5)*.50;
    ctx.save();
    ctx.globalCompositeOperation='screen';
    ctx.strokeStyle=rgba(111,233,207,alpha);
    ctx.lineWidth=1.7+3*(1-p);
    ctx.beginPath();ctx.ellipse(x,y,rad,rad*.72,0,0,Math.PI*2);ctx.stroke();
    const g=ctx.createRadialGradient(x,y,0,x,y,rad);
    g.addColorStop(0,rgba(94,214,203,alpha*.24));
    g.addColorStop(.55,rgba(95,204,196,alpha*.065));
    g.addColorStop(1,rgba(94,204,195,0));
    ctx.fillStyle=g;ctx.fillRect(x-rad,y-rad,rad*2,rad*2);
    ctx.restore();
  }
  function draw(now,dt){
    ctx.clearRect(0,0,width,height);
    const progress=clamp((now-changeAt)/1600,0,1);
    const blend=ease(progress);
    const paint=(kind,alpha)=>{
      if(kind==='rain') {drawRain(now,dt,alpha,false);drawMist(now,dt,alpha*.3,'rain')}
      else if(kind==='storm'){drawRain(now,dt,alpha,true);drawMist(now,dt,alpha*.5,'storm')}
      else if(kind==='mist')drawMist(now,dt,alpha,'mist');
      else if(kind==='night')drawNight(now,alpha);
      else if(kind==='chakra')drawChakra(now,alpha);
    };
    if(oldPreset!==preset&&progress<1)paint(oldPreset,oldStrength*(1-blend));
    paint(preset,strength*(oldPreset===preset?1:blend));
    if(preset==='storm'&&!reduceQuery.matches&&now>nextLightning){
      lightning=boltPoints();nextLightning=now+rand(6500,12800);
    }
    if(lightning)drawBolt(now,preset==='storm'?strength:1);
    drawPulse(now);paintTransition(now);
  }
  function tick(now){
    if(dead){running=false;return}
    if(document.hidden){running=false;return}
    if(!width||!height)resize();
    if(!width||!height){running=false;return}
    if(lastFrame===0)lastFrame=now;
    const dt=clamp((now-lastFrame)/1000,0,.05);
    lastFrame=now;
    if(now-lastPaint>=28||reduceQuery.matches){
      draw(now,reduceQuery.matches?0:dt);
      lastPaint=now;
    }
    const animating=preset!=='none'||oldPreset!==preset&&(now-changeAt<1650)||
      cues.size>0||!!lightning;
    if(animating){frame=requestAnimationFrame(tick)}
    else {running=false;ctx.clearRect(0,0,width,height)}
  }
  function kick(){
    if(dead||running||document.hidden)return;
    resize();lastFrame=0;lastPaint=0;running=true;frame=requestAnimationFrame(tick);
  }
  function setAtmosphere(value,percent=60){
    const next=PRESET_SET.has(value)?value:'none';
    const amount=clamp(Number(percent)/100||.6,.15,1);
    if(next===preset&&Math.abs(amount-strength)<.005)return;
    oldPreset=preset;oldStrength=strength;preset=next;strength=amount;
    changeAt=performance.now();
    host.dataset.preset=next;
    host.style.setProperty('--sc-atm-strength',String(amount));
    if(next==='storm')nextLightning=performance.now()+rand(3000,7500);
    if(next==='none')lightning=null;
    kick();
  }
  function cue(kind){
    if(!CUE_SET.has(kind))return;
    const now=performance.now();
    if(kind==='shake'){
      if(!reduceQuery.matches){
        stage.classList.remove('sc-scene-shake');void stage.offsetWidth;
        stage.classList.add('sc-scene-shake');
        setTimeout(()=>stage.classList.remove('sc-scene-shake'),780);
      }
    } else if(kind==='flash'){
      lightning=boltPoints();lightning.born=now;
    } else cues.set(kind,now);
    kick();
  }
  function onVisibility(){if(!document.hidden)kick()}
  document.addEventListener('visibilitychange',onVisibility,{passive:true});
  function reset(){
    oldPreset='none';preset='none';strength=.6;oldStrength=.6;
    host.dataset.preset='none';host.style.setProperty('--sc-atm-strength','.6');
    cues.clear();lightning=null;nextLightning=0;
    cancelAnimationFrame(frame);running=false;lastFrame=0;
    ctx.clearRect(0,0,width,height);
    stage.classList.remove('sc-scene-shake');
  }
  function destroy(){
    reset();dead=true;observer?.disconnect();
    window.removeEventListener('resize',resize);
    document.removeEventListener('visibilitychange',onVisibility);
    canvas.remove();
  }
  return {setAtmosphere,cue,reset,destroy};
}
