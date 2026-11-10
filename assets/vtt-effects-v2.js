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
    '@media(prefers-reduced-motion:reduce){.scfx *{animation-duration:.2s!important}}'
  ].join('\n');
  document.head.append(style);
  const seen=new Set(),activeLayers=[];
  function play(kind,point){
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
    layer.append(source);stage.append(layer);
    setTimeout(()=>{layer.remove();const i=activeLayers.indexOf(layer);if(i!==-1)activeLayers.splice(i,1)},1750);
    return true;
  }
  function seenEvent(key){if(seen.has(key))return true;seen.add(key);if(seen.size>150){const first=seen.values().next().value;seen.delete(first)}return false}
  return {play,seenEvent,definitions:EFFECTS};
}
