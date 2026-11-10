// Efeitos visuais sincronizáveis do VTT. Nenhuma alteração automática em HP/chakra.
export const EFFECTS=[
 {id:'chakra',name:'Chakra',description:'Aura de chakra concentrando energia',color:'#50d7d6',symbol:'✧',motion:'aura'},
 {id:'katon',name:'Katon · Fogo',description:'Explosão de fogo, brasas e calor',color:'#ff6b2c',symbol:'✦',motion:'embers'},
 {id:'suiton',name:'Suiton · Água',description:'Ondas e anéis de água',color:'#58bcf7',symbol:'≈',motion:'waves'},
 {id:'fuuton',name:'Fūton · Vento',description:'Rajada de vento em espiral',color:'#b2f0d8',symbol:'〰',motion:'wind'},
 {id:'doton',name:'Doton · Terra',description:'Impacto com poeira e fragmentos',color:'#c99b60',symbol:'◆',motion:'debris'},
 {id:'raiton',name:'Raiton · Relâmpago',description:'Descarga elétrica com raios',color:'#a3caff',symbol:'ϟ',motion:'lightning'},
 {id:'mokuton',name:'Mokuton · Madeira',description:'Raízes e crescimento vegetal',color:'#70ca83',symbol:'❧',motion:'roots'},
 {id:'hyoton',name:'Hyōton · Gelo',description:'Gelo e cristais de neve',color:'#a9ecff',symbol:'❄',motion:'snow'},
 {id:'genjutsu',name:'Genjutsu',description:'Distorção ilusória de energia',color:'#b88eff',symbol:'◈',motion:'illusion'},
 {id:'iryo',name:'Iryō Ninjutsu · Cura',description:'Luz esmeralda de recuperação',color:'#7ff6a1',symbol:'✚',motion:'healing'},
 {id:'taijutsu',name:'Taijutsu · Impacto',description:'Choque físico e ondas de impacto',color:'#ffe2a4',symbol:'✸',motion:'impact'},
 {id:'shunshin',name:'Shunshin · Movimento',description:'Rastro instantâneo de deslocamento',color:'#f0e0c4',symbol:'◉',motion:'teleport'},
 {id:'smoke',name:'Bomba de Fumaça',description:'Cortina de fumaça cinza',color:'#b2b6b4',symbol:'☁',motion:'smoke'},
 {id:'explosion',name:'Explosão',description:'Clarão e estilhaços de explosão',color:'#ffb33f',symbol:'✹',motion:'explosion'},
 {id:'kekkai',name:'Kekkai · Barreira',description:'Cúpula de proteção translúcida',color:'#9bb8ff',symbol:'⬡',motion:'barrier'}
];
export function createVisualEffects(stage){
  const style=document.createElement('style');
  style.textContent=[
    '.scfx{position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden}',
    '.scfx .source{position:absolute;left:var(--fx-x);top:var(--fx-y);transform:translate(-50%,-50%);width:185px;height:185px;filter:drop-shadow(0 0 12px var(--fx-c));animation:scfx-flash 750ms ease-out forwards}',
    '.scfx .disc{position:absolute;left:50%;top:50%;border-radius:50%;width:45%;height:45%;transform:translate(-50%,-50%);background:radial-gradient(circle,var(--fx-c),transparent 71%);opacity:.78;animation:scfx-pulse 1250ms ease-out forwards}',
    '.scfx .ring{position:absolute;left:50%;top:50%;width:106px;height:106px;border:2px solid var(--fx-c);border-radius:50%;transform:translate(-50%,-50%) scale(.12);box-shadow:0 0 16px var(--fx-c);animation:scfx-ring 1020ms ease-out forwards}',
    '.scfx .spark{position:absolute;left:50%;top:50%;font-size:var(--fx-size);font-weight:800;color:var(--fx-c);text-shadow:0 0 9px var(--fx-c);animation:scfx-spark 1050ms ease-out forwards;transform-origin:center;user-select:none}',
    '.scfx .jutsu-caption{position:absolute;left:var(--fx-x);top:calc(var(--fx-y) + 102px);transform:translateX(-50%);max-width:min(72vw,360px);padding:9px 13px;border:1px solid #d6c59a9c;background:#11231edc;color:#f5eddb;font:600 13px/1.4 Georgia,serif;text-align:center;overflow-wrap:anywhere;box-shadow:0 8px 20px #08130ba8;animation:scfx-caption-show 1550ms ease-out both}',
    '@keyframes scfx-caption-show{0%,8%{opacity:0;filter:blur(3px)}30%,72%{opacity:1;filter:none}100%{opacity:0}}',
    '.scfx.aura .source{animation:scfx-aura 1450ms ease-out forwards}.scfx.waves .ring{border-width:2px;animation-duration:1600ms}.scfx.wind .spark{animation-name:scfx-orbit}.scfx.lightning .spark{font-size:40px;animation-name:scfx-lightning}.scfx.smoke .disc{filter:grayscale(1);opacity:.9;animation-name:scfx-smoke}.scfx.illusion .ring{border-style:dashed;animation-name:scfx-illusion}.scfx.teleport .disc{animation-name:scfx-teleport}.scfx.barrier .ring{border-width:7px;animation-name:scfx-barrier}.scfx.snow .spark{animation-name:scfx-snow}',
    '@keyframes scfx-flash{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}18%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.3)}}',
    '@keyframes scfx-pulse{0%{opacity:.05;transform:translate(-50%,-50%) scale(.24)}38%{opacity:.85}100%{opacity:0;transform:translate(-50%,-50%) scale(2.3)}}',
    '@keyframes scfx-ring{0%{opacity:.95;transform:translate(-50%,-50%) scale(.18)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.65)}}',
    '@keyframes scfx-spark{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(0) scale(.1)}22%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(var(--fx-dist)) scale(1.3)}}',
    '@keyframes scfx-orbit{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(-20px)}50%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) rotate(calc(var(--fx-angle) + 230deg)) translateY(-110px)}}',
    '@keyframes scfx-lightning{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(-6px)}10%,24%,40%{opacity:1}16%,33%,70%{opacity:.05}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(var(--fx-dist))}}',
    '@keyframes scfx-aura{0%{opacity:0;transform:translate(-50%,-50%) scale(.55)}30%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.9)}}',
    '@keyframes scfx-smoke{0%{opacity:0;transform:translate(-50%,-50%) scale(.25)}45%{opacity:.8}100%{opacity:0;transform:translate(-50%,-60%) scale(2.9)}}',
    '@keyframes scfx-illusion{0%{opacity:0;transform:translate(-50%,-50%) rotate(0deg) scale(.2)}35%{opacity:.8}100%{opacity:0;transform:translate(-50%,-50%) rotate(170deg) scale(2.4)}}',
    '@keyframes scfx-teleport{0%{opacity:0;transform:translate(-50%,-50%) scale(.3)}35%{opacity:1}60%{opacity:.2}100%{opacity:0;transform:translate(-50%,-50%) scale(0)}}',
    '@keyframes scfx-barrier{0%{opacity:0;transform:translate(-50%,-50%) scale(.3)}36%{opacity:.9}70%{opacity:.7;transform:translate(-50%,-50%) scale(1.5)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.65)}}',
    '@keyframes scfx-snow{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(-100px)}30%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(105px)}}',
    /* Cada natureza de chakra tem silhueta e ritmo próprios, não apenas mudança de cor. */
    '.scfx.embers .disc{background:radial-gradient(ellipse at 50% 72%,#fff0b8 0%,#ff872c 22%,#c93526 45%,transparent 70%);filter:blur(3px);animation:scfx-flame-crest 1350ms ease-out forwards}.scfx.embers .spark{filter:drop-shadow(0 0 6px #ff8f3b);animation:scfx-ember-flight 1450ms ease-out forwards}',
    '.scfx.waves .disc{background:radial-gradient(ellipse at 50% 65%,#d3f8ff9a 0%,#4cbbfa99 36%,transparent 70%);animation:scfx-water-rise 1450ms ease-out forwards}.scfx.waves .ring{border-style:double;border-width:4px;animation:scfx-water-ripple 1500ms ease-out forwards}',
    '.scfx.wind .source::before,.scfx.wind .source::after{content:"";position:absolute;inset:21%;border:4px solid #b2f0d8a8;border-left-color:transparent;border-bottom-color:transparent;border-radius:50%;animation:scfx-vortex 1450ms ease-out forwards}.scfx.wind .source::after{inset:7%;animation-direction:reverse;animation-duration:1200ms}',
    '.scfx.debris .spark{font-size:24px;animation:scfx-stone-shards 1500ms ease-out forwards;text-shadow:2px 3px 1px #614a30}.scfx.debris .disc{background:radial-gradient(circle,#ac8b58bd,transparent 68%);animation:scfx-dust 1400ms ease-out forwards}',
    '.scfx.lightning .source::after{content:"";position:absolute;inset:7%;background:#e5f2ff;clip-path:polygon(49% 0,43% 39%,57% 37%,38% 100%,44% 52%,33% 55%);filter:drop-shadow(0 0 17px #b4dfff);animation:scfx-bolt 800ms steps(3,end) forwards}.scfx.lightning .ring{border-style:dotted;animation-duration:800ms}',
    '.scfx.roots .source::before,.scfx.roots .source::after{content:"";position:absolute;bottom:21%;left:50%;width:13px;height:79px;border:4px solid #80d893;border-top-color:transparent;border-right-color:transparent;border-radius:0 0 0 100%;transform-origin:bottom;animation:scfx-roots 1400ms ease-out forwards}.scfx.roots .source::after{left:41%;height:105px;animation-delay:100ms;transform:rotate(-32deg)}.scfx.roots .spark{animation:scfx-leaves 1450ms ease-out forwards}',
    '.scfx.snow .spark{color:#e5fdff;filter:drop-shadow(0 0 7px #b0efff);animation:scfx-crystal 1550ms ease-out forwards}.scfx.snow .ring{border:2px dashed #dbfcff;border-radius:16%;transform:translate(-50%,-50%) rotate(45deg);animation:scfx-frost-ring 1300ms ease-out forwards}',
    '.scfx.illusion .source{filter:drop-shadow(0 0 22px #d5b0fc)}.scfx.illusion .disc{background:conic-gradient(from 15deg,transparent,#ad7bdd9c,transparent,#eac0ff88,transparent);animation:scfx-mirage 1350ms ease-out forwards}.scfx.illusion .spark{animation:scfx-mirage-fragments 1500ms ease-out forwards}',
    '.scfx.healing .spark{animation:scfx-healing-orbs 1480ms ease-out forwards}.scfx.healing .disc{background:radial-gradient(circle,#f0ffe99c,#74f1a16b,transparent 74%);animation:scfx-bloom 1600ms ease-out forwards}',
    '.scfx.impact .source::before,.scfx.impact .source::after{content:"";position:absolute;inset:16% 49%;width:7px;background:linear-gradient(180deg,transparent,#fff9da,transparent);transform:rotate(51deg);animation:scfx-impact-slash 900ms ease-out forwards}.scfx.impact .source::after{transform:rotate(-51deg);animation-delay:90ms}.scfx.impact .ring{animation-duration:690ms}',
    '.scfx.teleport .source::before,.scfx.teleport .source::after{content:"";position:absolute;top:35%;left:12%;height:10px;width:78%;background:linear-gradient(90deg,transparent,#fff6df88,transparent);transform:skewY(-16deg);animation:scfx-afterimage 950ms ease-out forwards}.scfx.teleport .source::after{top:57%;animation-delay:80ms}',
    '.scfx.smoke .disc{background:radial-gradient(ellipse at 40% 60%,#c9ceceeb,#6d7976c9,transparent 73%)}.scfx.smoke .spark{color:#bfc5c2;animation:scfx-smoke-puffs 1580ms ease-out forwards}',
    '.scfx.explosion .disc{background:radial-gradient(circle,#fffddd,#ffc253 30%,#e65e28ad 55%,transparent 75%);animation:scfx-burst 950ms ease-out forwards}.scfx.explosion .ring{border:4px dashed #ffc35a;animation-duration:830ms}',
    '.scfx.barrier .source::before{content:"";position:absolute;inset:11%;border:3px solid #afc8ff9c;clip-path:polygon(25% 5%,75% 5%,98% 50%,75% 95%,25% 95%,2% 50%);background:radial-gradient(circle,#9bb8ff22,transparent 70%);animation:scfx-dome 1450ms ease-out forwards}.scfx.barrier .spark{animation:scfx-barrier-marks 1400ms ease-out forwards}',
    '@keyframes scfx-flame-crest{0%{opacity:0;transform:translate(-50%,-20%) scale(.2) rotate(-12deg)}25%{opacity:1}100%{opacity:0;transform:translate(-50%,-87%) scale(1.6) rotate(13deg)}}',
    '@keyframes scfx-ember-flight{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(0) scale(.3)}22%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(var(--fx-dist)) scale(.5)}}',
    '@keyframes scfx-water-rise{0%{opacity:0;transform:translate(-50%,-50%) scale(.3,.1)}35%{opacity:.86}100%{opacity:0;transform:translate(-50%,-50%) scale(2,.7)}}',
    '@keyframes scfx-water-ripple{0%{opacity:.9;transform:translate(-50%,-50%) scale(.25,.12)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.4,.9)}}',
    '@keyframes scfx-vortex{0%{opacity:0;transform:scale(.2) rotate(-140deg)}25%{opacity:.95}100%{opacity:0;transform:scale(1.6) rotate(270deg)}}',
    '@keyframes scfx-stone-shards{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(0) scale(.2)}22%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(var(--fx-dist)) scale(.7)}}',
    '@keyframes scfx-dust{0%{opacity:0;transform:translate(-50%,-50%) scale(.2,.12)}40%{opacity:.62}100%{opacity:0;transform:translate(-50%,-65%) scale(2.7,.9)}}',
    '@keyframes scfx-bolt{0%,18%{opacity:0;transform:scale(.2)}20%,37%,54%{opacity:.95;transform:scale(1)}29%,45%{opacity:.18}100%{opacity:0;transform:scale(1.2)}}',
    '@keyframes scfx-roots{0%{opacity:0;scale:.08}35%{opacity:1}100%{opacity:0;scale:1.5}}',
    '@keyframes scfx-leaves{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(0)}28%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(var(--fx-dist)) scale(.5)}}',
    '@keyframes scfx-crystal{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(-110px) scale(.5)}30%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) rotate(calc(var(--fx-angle) + 130deg)) translateY(115px) scale(.9)}}',
    '@keyframes scfx-frost-ring{0%{opacity:.6;transform:translate(-50%,-50%) rotate(45deg) scale(.25)}100%{opacity:0;transform:translate(-50%,-50%) rotate(90deg) scale(1.9)}}',
    '@keyframes scfx-mirage{0%{opacity:0;transform:translate(-50%,-50%) rotate(-140deg) scale(.2)}50%{opacity:.85}100%{opacity:0;transform:translate(-50%,-50%) rotate(200deg) scale(1.4)}}',
    '@keyframes scfx-mirage-fragments{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(0)}34%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(var(--fx-dist)) scale(1.2)}}',
    '@keyframes scfx-healing-orbs{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(50px) scale(.3)}32%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(-80px) scale(.85)}}',
    '@keyframes scfx-bloom{0%{opacity:0;transform:translate(-50%,-50%) scale(.3)}52%{opacity:.85}100%{opacity:0;transform:translate(-50%,-50%) scale(1.7)}}',
    '@keyframes scfx-impact-slash{0%{opacity:0;scale:.3}36%{opacity:1}100%{opacity:0;scale:1.3}}',
    '@keyframes scfx-afterimage{0%{opacity:0;transform:translateX(-60px) skewY(-16deg)}33%{opacity:.9}100%{opacity:0;transform:translateX(65px) skewY(-16deg)}}',
    '@keyframes scfx-smoke-puffs{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(0) scale(.25)}45%{opacity:.7}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(var(--fx-dist)) scale(2)}}',
    '@keyframes scfx-burst{0%{opacity:0;transform:translate(-50%,-50%) scale(.1)}16%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(2.7)}}',
    '@keyframes scfx-dome{0%{opacity:0;transform:scale(.4)}45%{opacity:1}100%{opacity:0;transform:scale(1.5)}}',
    '@keyframes scfx-barrier-marks{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(0)}45%{opacity:.8}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--fx-angle)) translateY(-85px)}}',
    '@media(prefers-reduced-motion:reduce){.scfx *{animation-duration:.2s!important}}'
  ].join('\n');
  document.head.append(style);
  const seen=new Set(),activeLayers=[];
  function play(kind,point,techniqueName=''){
    const def=EFFECTS.find(e=>e.id===kind);if(!def)return false;
    const rect=stage.getBoundingClientRect();
    const px=Number.isFinite(point?.x)?Math.max(5,Math.min(rect.width-5,point.x)):rect.width/2;
    const py=Number.isFinite(point?.y)?Math.max(5,Math.min(rect.height-5,point.y)):rect.height/2;
    // Evita empilhar dezenas de efeitos e encobrir o mapa durante o combate.
    while(activeLayers.length>=3)activeLayers.shift()?.remove();
    const layer=document.createElement('div');layer.className='scfx '+def.motion;
    activeLayers.push(layer);
    layer.style.setProperty('--fx-x',px+'px');layer.style.setProperty('--fx-y',py+'px');layer.style.setProperty('--fx-c',def.color);
    const source=document.createElement('div');source.className='source';
    const disc=document.createElement('div');disc.className='disc';source.append(disc);
    if(!['smoke','teleport'].includes(def.motion))for(let i=0;i<(def.motion==='waves'?2:1);i++){
      const ring=document.createElement('span');ring.className='ring';ring.style.animationDelay=(i*155)+'ms';source.append(ring);
    }
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
    const n=reduced?3:['waves','barrier'].includes(def.motion)?5:9;
    for(let i=0;i<n;i++){
      const p=document.createElement('span');p.className='spark';
      p.textContent=(i%3===0?def.symbol:'·');p.style.setProperty('--fx-angle',(360*i/n+((i%3)*7))+'deg');
      p.style.setProperty('--fx-dist',-(70+i%4*19)+'px');
      p.style.setProperty('--fx-size',(16+i%3*6)+'px');
      p.style.animationDelay=(i%5*36)+'ms';
      source.append(p);
    }
    layer.append(source);
    if(techniqueName){
      const caption=document.createElement('div');caption.className='jutsu-caption';
      caption.textContent=String(techniqueName).slice(0,80);
      layer.append(caption);
    }
    stage.append(layer);
    window.SHINOBI_JUTSU_FX?.audio?.(kind,String(techniqueName||def.name));
    setTimeout(()=>{layer.remove();const i=activeLayers.indexOf(layer);if(i!==-1)activeLayers.splice(i,1)},1750);
    return true;
  }
  function seenEvent(key){if(seen.has(key))return true;seen.add(key);if(seen.size>150){const first=seen.values().next().value;seen.delete(first)}return false}
  return {play,seenEvent,definitions:EFFECTS};
}
