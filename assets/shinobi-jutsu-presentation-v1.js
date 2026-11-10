(function(global){
  'use strict';
  if(global.SHINOBI_JUTSU_FX)return;
  const SETTINGS_KEY='sc-jutsu-sound-v1';
  const DEFAULT={enabled:true,volume:55};
  const MAP=[
    ['raiton',/(raiton|relampag|raio|eletric|chidori|kirin|lightning)/,'雷','RAITON'],
    ['katon',/(katon|fogo|chama|incendi|goukaky|fire)/,'火','KATON'],
    ['suiton',/(suiton|agua|aquat|mizu|onda|hidro)/,'水','SUITON'],
    ['fuuton',/(fuuton|futon|vento|ar cortante|wind)/,'風','FŪTON'],
    ['doton',/(doton|terra|rocha|pedra|lama|earth)/,'土','DOTON'],
    ['mokuton',/(mokuton|madeira|raiz|arvore|floresta)/,'木','MOKUTON'],
    ['hyoton',/(hyoton|gelo|neve|congel|ice)/,'氷','HYŌTON'],
    ['genjutsu',/(genjutsu|ilusao|hipnose|tsukuyomi|sharingan|byakugan)/,'幻','GENJUTSU'],
    ['iryo',/(iryo|cura|curar|medicin|regener|healing)/,'癒','IRYŌ'],
    ['taijutsu',/(taijutsu|soco|chute|golpe|punho|impacto)/,'拳','TAIJUTSU'],
    ['shunshin',/(shunshin|velocidade|teleporte|deslocamento|teleport)/,'瞬','SHUNSHIN'],
    ['smoke',/(fumaca|bomba de fumaca|smoke)/,'煙','FUMAÇA'],
    ['explosion',/(explosao|detona|bomba de papel|explosion)/,'爆','EXPLOSÃO'],
    ['kekkai',/(kekkai|barreira|escudo|barrier)/,'結','KEKKAI'],
    ['chakra',/(chakra|ninpou|ninjutsu|poder|energia)/,'気','CHAKRA']
  ];
  const LABELS=Object.fromEntries(MAP.map(([id,rx,glyph,label])=>[id,{glyph,label}]));
  function classify(value){
    const text=String(typeof value==='string'?value:((value?.nome||value?.name||'')+' '+(value?.efeito||value?.descricao||'')))
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return MAP.find(([,regex])=>regex.test(text))?.[0]||'chakra';
  }
  function getSettings(){
    try{
      const raw=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null')||{};
      return {enabled:raw.enabled!==false,volume:Number.isFinite(Number(raw.volume))?
        Math.min(100,Math.max(0,Math.round(Number(raw.volume)))):DEFAULT.volume};
    }catch(e){return {...DEFAULT}}
  }
  function setSettings(next){
    const old=getSettings();
    const value={enabled:next?.enabled===undefined?old.enabled:!!next.enabled,
      volume:next?.volume===undefined?old.volume:Math.min(100,Math.max(0,Math.round(Number(next.volume)||0)))};
    try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(value))}catch(e){}
    return value;
  }
  const audioProfile={
    chakra:{base:175,wave:'sine',notes:[0,7,12],slide:1.18,noise:0.07},
    katon:{base:110,wave:'sawtooth',notes:[0,-5,-12],slide:.58,noise:.7},
    suiton:{base:260,wave:'sine',notes:[0,7,12,7],slide:1.25,noise:.28},
    fuuton:{base:170,wave:'triangle',notes:[0,5,12],slide:1.65,noise:.57},
    doton:{base:95,wave:'triangle',notes:[0,-12,-5],slide:.53,noise:.6},
    raiton:{base:430,wave:'square',notes:[0,12,19,-5],slide:1.8,noise:.6},
    mokuton:{base:220,wave:'triangle',notes:[0,3,7,12],slide:1.22,noise:.25},
    hyoton:{base:620,wave:'sine',notes:[0,7,19],slide:1.6,noise:.18},
    genjutsu:{base:235,wave:'sine',notes:[0,1,7,1],slide:.97,noise:.2},
    iryo:{base:370,wave:'sine',notes:[0,4,7,12],slide:1.12,noise:.07},
    taijutsu:{base:135,wave:'triangle',notes:[0,-12],slide:.48,noise:.7},
    shunshin:{base:225,wave:'sawtooth',notes:[0,12],slide:2.1,noise:.4},
    smoke:{base:145,wave:'triangle',notes:[0,-5],slide:.72,noise:.83},
    explosion:{base:78,wave:'sawtooth',notes:[0,-12,-5],slide:.33,noise:.86},
    kekkai:{base:315,wave:'sine',notes:[0,7,12,19],slide:1.15,noise:.12}
  };
  let context=null,noiseBuffer=null,lastSoundAt=0;
  function hash(text){let h=2166136261;for(const ch of String(text||'')){h=Math.imul(h^ch.charCodeAt(0),16777619)}return h>>>0}
  function contextReady(){
    const Engine=global.AudioContext||global.webkitAudioContext;
    if(!Engine)return null;
    if(!context)context=new Engine();
    if(context.state==='suspended')void context.resume().catch(()=>{});
    return context;
  }
  function audio(kind,name){
    const prefs=getSettings();if(!prefs.enabled||prefs.volume<=0)return false;
    let ctx;try{ctx=contextReady()}catch(e){return false}
    if(!ctx)return false;
    // A trilha é gerada no navegador: cada jutsu recebe uma variação determinística.
    const type=audioProfile[kind]||audioProfile.chakra;
    const id=hash(name||kind),variant=.91+((id%19)/100);
    const now=ctx.currentTime+.018,master=ctx.createGain();
    master.gain.value=Math.min(.14,prefs.volume/100*.125);
    master.connect(ctx.destination);
    const total=Math.min(1.45,.85+type.notes.length*.12);
    function tone(frequency,at,duration,wave,amount,glide){
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type=wave;osc.frequency.setValueAtTime(Math.max(35,frequency),at);
      osc.frequency.exponentialRampToValueAtTime(Math.max(35,frequency*glide),at+duration);
      gain.gain.setValueAtTime(.0001,at);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0002,amount),at+.015);
      gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
      osc.connect(gain);gain.connect(master);osc.onended=()=>{osc.disconnect();gain.disconnect()};
      osc.start(at);osc.stop(at+duration+.012);
    }
    try{
      const notes=type.notes;
      notes.forEach((offset,i)=>{
        const pct=i/Math.max(1,notes.length-1);
        const pitch=type.base*Math.pow(2,(offset+(id%5-2)*.33)/12)*variant;
        const delay=kind==='explosion'||kind==='taijutsu'?.065*i:.075*i;
        tone(pitch,now+delay,Math.min(.72,.31+(1-pct)*.28),type.wave,.27-pct*.08,
          type.slide*(i===0?1:1.03));
      });
      if(!noiseBuffer||noiseBuffer.sampleRate!==ctx.sampleRate){
        noiseBuffer=ctx.createBuffer(1,Math.round(ctx.sampleRate*1.55),ctx.sampleRate);
        const data=noiseBuffer.getChannelData(0);let seed=1971;
        for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=((seed>>>8)/8388608-1)}
      }
      if(type.noise>0){
        const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
        noise.buffer=noiseBuffer;filter.type=kind==='smoke'||kind==='fuuton'?'highpass':'bandpass';
        const startFreq=kind==='raiton'?1900:kind==='smoke'?420:kind==='explosion'?270:kind==='katon'?420:750;
        filter.frequency.setValueAtTime(startFreq*variant,now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(80,startFreq*(kind==='raiton'?2.2:.62)),now+total*.78);
        filter.Q.value=kind==='raiton'?3:.7;
        gain.gain.setValueAtTime(.0001,now);
        gain.gain.exponentialRampToValueAtTime(type.noise*.34,now+.03);
        gain.gain.exponentialRampToValueAtTime(.0001,now+total*.85);
        noise.connect(filter);filter.connect(gain);gain.connect(master);
        noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect()};
        noise.start(now);noise.stop(now+total*.87);
      }
      // Mantém somente as notas atuais, sem trilhas em loop nem arquivos externos.
      if(now-lastSoundAt>2.5)lastSoundAt=now;
      setTimeout(()=>{try{master.disconnect()}catch(e){}},Math.ceil((total+1)*1000));
      return true;
    }catch(error){try{master.disconnect()}catch(e){}return false}
  }
  function injectStyles(){
    if(document.getElementById('sc-jutsu-fx-style'))return;
    const tag=document.createElement('style');tag.id='sc-jutsu-fx-style';tag.textContent="\n.sc-jutsu-layer{position:fixed;inset:0;z-index:460;pointer-events:none;overflow:hidden}\n.sc-jutsu-core{position:absolute;left:var(--sc-jx,50%);top:var(--sc-jy,48%);width:min(240px,54vw);height:min(240px,54vw);transform:translate(-50%,-50%);isolation:isolate;--sc-jc:#a8d4ce}\n.sc-jutsu-core:before,.sc-jutsu-core:after{content:\"\";position:absolute;inset:13%;border:3px solid var(--sc-jc);border-radius:50%;box-shadow:0 0 24px var(--sc-jc),inset 0 0 24px #ffffff25;animation:sc-jutsu-ring 1.45s cubic-bezier(.16,.75,.2,1) both}\n.sc-jutsu-core:after{border-style:dashed;border-width:1px;inset:3%;animation-delay:.11s;animation-direction:reverse}\n.sc-jutsu-glow{position:absolute;inset:12%;border-radius:50%;background:radial-gradient(circle,var(--sc-jc),transparent 67%);mix-blend-mode:screen;opacity:.65;filter:blur(13px);animation:sc-jutsu-glow 1.4s ease-out both}\n.sc-jutsu-glyph{position:absolute;inset:0;display:grid;place-items:center;font:600 clamp(62px,10vw,104px)/1 'Yuji Boku','Noto Serif JP',serif;color:#fffdf6;text-shadow:0 0 16px var(--sc-jc),0 3px 12px #0b1716;animation:sc-jutsu-sign 1.4s cubic-bezier(.17,.75,.22,1) both}\n.sc-jutsu-speck{position:absolute;top:50%;left:50%;font:700 var(--sc-jsz,17px)/1 Georgia,serif;color:var(--sc-jc);text-shadow:0 0 9px var(--sc-jc);animation:sc-jutsu-speck 1.38s ease-out both;animation-delay:var(--sc-jdelay,0ms)}\n.sc-jutsu-banner{position:absolute;left:50%;top:calc(50% + min(143px,29vw));max-width:min(500px,88vw);width:max-content;transform:translate(-50%,-50%);padding:10px 21px 12px;background:linear-gradient(110deg,#14241eea,#1a2d25ec);border:1px solid #dec8a47d;color:#fff3dc;box-shadow:0 15px 32px #0b160db3;text-align:center;animation:sc-jutsu-banner 1.55s ease both}\n.sc-jutsu-banner strong{display:block;font:600 clamp(13px,2.6vw,18px)/1.25 Georgia,'Noto Serif JP',serif;overflow-wrap:anywhere}\n.sc-jutsu-banner small{display:block;margin-top:4px;font:700 9px/1.3 system-ui,sans-serif;letter-spacing:.14em;color:var(--sc-jc)}\n.sc-jutsu-core.katon{--sc-jc:#fb893c}.sc-jutsu-core.suiton{--sc-jc:#64cbec}\n.sc-jutsu-core.raiton{--sc-jc:#b2d8ff}.sc-jutsu-core.fuuton{--sc-jc:#9fe4cd}\n.sc-jutsu-core.doton{--sc-jc:#c09b6e}.sc-jutsu-core.mokuton{--sc-jc:#86cc91}\n.sc-jutsu-core.hyoton{--sc-jc:#d4f3fc}.sc-jutsu-core.genjutsu{--sc-jc:#c7a4f9}\n.sc-jutsu-core.iryo{--sc-jc:#9af0ad}.sc-jutsu-core.taijutsu{--sc-jc:#f0cb86}\n.sc-jutsu-core.shunshin{--sc-jc:#efd6ac}.sc-jutsu-core.smoke{--sc-jc:#c2c5bb}\n.sc-jutsu-core.explosion{--sc-jc:#ffad56}.sc-jutsu-core.kekkai{--sc-jc:#a3bdf3}\n.sc-jutsu-core.katon .sc-jutsu-glow,.sc-jutsu-core.explosion .sc-jutsu-glow{border-radius:43% 57% 38% 62%;animation:sc-jutsu-flame 1.4s ease-out both}\n.sc-jutsu-core.suiton:before{transform:scaleY(.53);border-width:5px;animation-name:sc-jutsu-ripple}\n.sc-jutsu-core.fuuton:before,.sc-jutsu-core.genjutsu:before{border-style:dashed;animation-name:sc-jutsu-vortex}\n.sc-jutsu-core.raiton:after{border-radius:13%;transform:rotate(45deg);animation-name:sc-jutsu-storm}\n.sc-jutsu-core.doton:before,.sc-jutsu-core.hyoton:before,.sc-jutsu-core.kekkai:before{border-radius:10%;transform:rotate(45deg)}\n.sc-jutsu-core.iryo .sc-jutsu-glow,.sc-jutsu-core.mokuton .sc-jutsu-glow{background:radial-gradient(circle,#d4ffe5,transparent 68%)}\n.sc-jutsu-core.shunshin:before{animation-duration:.7s}\n.sc-jutsu-core.taijutsu:after{border-radius:8%;animation-duration:.65s}\n.sc-jutsu-soundbar{display:flex;align-items:center;justify-content:flex-start;gap:10px;flex-wrap:wrap;margin:10px 0;padding:8px 12px;border:1px solid rgba(125,136,109,.29);border-radius:6px;background:rgba(154,161,133,.09)}\n.sc-jutsu-soundbar button{border:1px solid rgba(118,139,111,.5);border-radius:5px;padding:8px 11px;font:600 11px system-ui;background:rgba(47,72,51,.92);color:#f7f3e8;cursor:pointer}\n.sc-jutsu-soundbar button:focus-visible,.sc-jutsu-soundbar input:focus-visible{outline:2px solid #c2ad7e;outline-offset:2px}\n.sc-jutsu-soundbar label{font:600 11px system-ui;color:inherit;display:inline-flex;gap:8px;align-items:center}\n.sc-jutsu-soundbar input{width:90px;height:auto;accent-color:#829d7f;cursor:pointer}\n.sc-jutsu-soundbar output{font-size:11px;min-width:32px}\n.sc-jutsu-soundbar.is-muted{opacity:.8}\n@keyframes sc-jutsu-ring{0%{opacity:0;transform:scale(.18) rotate(-30deg)}24%{opacity:.95}100%{opacity:0;transform:scale(1.75) rotate(16deg)}}\n@keyframes sc-jutsu-glow{0%{opacity:0;transform:scale(.3)}27%{opacity:.75}100%{opacity:0;transform:scale(1.8)}}\n@keyframes sc-jutsu-sign{0%{opacity:0;transform:scale(.4) rotate(-16deg);filter:blur(6px)}35%{opacity:1;filter:none}72%{opacity:.85}100%{opacity:0;transform:scale(1.13) rotate(0deg)}}\n@keyframes sc-jutsu-speck{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--sc-ja)) translateY(0) scale(.25)}21%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--sc-ja)) translateY(var(--sc-jd)) scale(.78)}}\n@keyframes sc-jutsu-banner{0%,9%{opacity:0;transform:translate(-50%,15px)}24%{opacity:1;transform:translate(-50%,-50%)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-80%)}}\n@keyframes sc-jutsu-flame{0%{opacity:0;transform:scale(.2) translateY(20px)}32%{opacity:.85}100%{opacity:0;transform:scale(1.6) translateY(-43px)}}\n@keyframes sc-jutsu-ripple{0%{opacity:0;transform:scale(.2,.07)}30%{opacity:.9}100%{opacity:0;transform:scale(1.9,.92)}}\n@keyframes sc-jutsu-vortex{0%{opacity:0;transform:scale(.2) rotate(-130deg)}40%{opacity:.8}100%{opacity:0;transform:scale(1.55) rotate(240deg)}}\n@keyframes sc-jutsu-storm{0%{opacity:0;transform:scale(.2) rotate(25deg)}30%,55%{opacity:.95}45%{opacity:.1}100%{opacity:0;transform:scale(1.5) rotate(55deg)}}\n@media(prefers-reduced-motion:reduce){.sc-jutsu-layer *{animation:none!important;transition:none!important}.sc-jutsu-core:before,.sc-jutsu-core:after,.sc-jutsu-glow,.sc-jutsu-speck{display:none!important}.sc-jutsu-glyph{opacity:0!important}.sc-jutsu-banner{position:fixed;top:60px;left:50%;transform:translateX(-50%);opacity:1!important}}\n@media print{.sc-jutsu-layer,.sc-jutsu-soundbar{display:none!important}}\n";document.head.appendChild(tag);
  }
  function cast(kind,name,target,options){
    const type=LABELS[kind]?kind:classify(name);
    const title=String(name||'Técnica shinobi').slice(0,85);
    if(options?.sound!==false)audio(type,title);
    if(global.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return true;
    injectStyles();
    document.querySelectorAll('.sc-jutsu-layer').forEach(x=>x.remove());
    const rect=target?.getBoundingClientRect?.();
    let x=global.innerWidth/2,y=Math.min(global.innerHeight*.46,320);
    if(rect&&rect.bottom>0&&rect.top<global.innerHeight){
      x=Math.max(125,Math.min(global.innerWidth-125,rect.left+rect.width/2));
      y=Math.max(145,Math.min(global.innerHeight-155,rect.top+Math.min(rect.height/2,170)));
    }
    const layer=document.createElement('div');layer.className='sc-jutsu-layer';layer.setAttribute('aria-hidden','true');
    const core=document.createElement('div');core.className='sc-jutsu-core '+type;
    core.style.setProperty('--sc-jx',x+'px');core.style.setProperty('--sc-jy',y+'px');
    const glow=document.createElement('div');glow.className='sc-jutsu-glow';
    const glyph=document.createElement('div');glyph.className='sc-jutsu-glyph';
    glyph.textContent=(LABELS[type]||LABELS.chakra).glyph;
    core.append(glow,glyph);
    const seed=hash(title),pieces=type==='raiton'||type==='explosion'?17:12;
    for(let i=0;i<pieces;i++){
      const dot=document.createElement('i');dot.className='sc-jutsu-speck';
      dot.style.setProperty('--sc-ja',(i*360/pieces+seed%19)+'deg');
      dot.style.setProperty('--sc-jd',(-95-(i%4)*23)+'px');
      dot.style.setProperty('--sc-jsz',(12+i%4*4)+'px');
      dot.style.setProperty('--sc-jdelay',(i%5*34)+'ms');
      dot.textContent=type==='hyoton'?'✧':type==='mokuton'?'❧':type==='raiton'?'ϟ':'•';
      core.append(dot);
    }
    const label=document.createElement('div');label.className='sc-jutsu-banner';
    const strong=document.createElement('strong');strong.textContent=title;
    const small=document.createElement('small');small.textContent=(LABELS[type]||LABELS.chakra).label+' · SHINOBI CHRONICLES';
    label.append(strong,small);layer.append(core,label);document.body.append(layer);
    setTimeout(()=>layer.remove(),1660);
    return true;
  }
  function controls(){
    const s=getSettings();
    return '<div class="sc-jutsu-soundbar'+(s.enabled?'':' is-muted')+'" aria-label="Configurações dos efeitos sonoros dos jutsus">'+
      '<button type="button" data-action="jutsu-sound-toggle" aria-pressed="'+String(s.enabled)+'">'+(s.enabled?'🔊 Som dos jutsus: ligado':'🔇 Som dos jutsus: desligado')+'</button>'+
      '<label>Volume <input type="range" min="0" max="100" step="5" value="'+s.volume+'" data-jutsu-volume aria-label="Volume dos efeitos sonoros de jutsus"></label>'+
      '<output data-jutsu-volume-label>'+s.volume+'%</output></div>';
  }
  function syncControls(){
    const s=getSettings();
    document.querySelectorAll('[data-action="jutsu-sound-toggle"]').forEach(el=>{
      el.textContent=s.enabled?'🔊 Som dos jutsus: ligado':'🔇 Som dos jutsus: desligado';
      el.setAttribute('aria-pressed',String(s.enabled));
      el.closest('.sc-jutsu-soundbar')?.classList.toggle('is-muted',!s.enabled);
    });
    document.querySelectorAll('[data-jutsu-volume]').forEach(el=>{if(document.activeElement!==el)el.value=s.volume});
    document.querySelectorAll('[data-jutsu-volume-label]').forEach(el=>{el.textContent=s.volume+'%'});
  }
  function toggle(){const s=setSettings({enabled:!getSettings().enabled});syncControls();if(s.enabled)audio('chakra','Prévia de som');return s}
  function volume(value){const s=setSettings({volume:value});syncControls();return s}
  global.SHINOBI_JUTSU_FX={classify,cast,audio,controls,toggle,volume,getSettings,setSettings,syncControls,injectStyles};
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',injectStyles,{once:true})}
  else injectStyles();
})(window);