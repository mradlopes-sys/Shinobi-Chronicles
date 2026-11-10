// Teatro — retratos independentes da cena tática, alinhados pelo último pixel visível.
export function createTheatre({stage,panel,onChange,isAdmin,publishPortrait,previewPortrait}){
  const css=document.createElement('style');
  css.textContent=[
    '#sc-theatre{position:absolute;inset:0;z-index:4;overflow:hidden;pointer-events:none;display:none;background:linear-gradient(transparent 68%,#02080832)}',
    '#sc-theatre.open{display:block}',
    '#sc-theatre .stage-character{position:absolute;bottom:0;transform:translateX(-50%);width:min(36%,410px);height:min(84%,880px);display:flex;align-items:center;justify-content:flex-end;pointer-events:none;touch-action:none;user-select:none}',
    '#sc-theatre.directable .stage-character{pointer-events:auto;cursor:pointer}',
    '#sc-theatre .stage-character{isolation:isolate}',
    '#sc-theatre .stage-character img{position:absolute;inset:auto 0 0;width:100%;height:100%;max-width:none;max-height:none;display:block;object-fit:contain;object-position:center bottom;pointer-events:none;opacity:0;filter:drop-shadow(0 12px 13px #0008);transition:opacity .35s ease-out,filter .35s ease-out}',
    '#sc-theatre .stage-character img.ready{opacity:1}',
    '#sc-theatre.directable .stage-character:hover img.ready{filter:drop-shadow(0 14px 18px #0009) drop-shadow(0 0 8px #d1bc8255)}',
    '#sc-theatre .placeholder{width:55%;height:60%;display:grid;place-items:center;color:#d4c197;background:#293e33;font:600 52px Georgia,serif;border-radius:30px 30px 0 0}',
    '.theatre-controls .cast-row{display:flex;gap:8px;align-items:center;background:#253b2d;border:1px solid #567057;border-radius:9px;padding:9px;margin:7px 0}',
    '.theatre-controls .cast-row strong{font-size:12px;color:#eee4cd;flex:1}',
    '.theatre-controls .cast-row small{font-size:11px;color:#b9c6b4}',
    '.theatre-controls .cast-row button{background:#394c3f;color:#f0e0c6;border:1px solid #71876e;border-radius:7px;padding:7px;font-size:11px;cursor:pointer}',
    '.theatre-controls .director-only[hidden]{display:none}',
    '@media(max-width:700px){#sc-theatre .stage-character{width:40%;height:68%}}',
    '@media(prefers-reduced-motion:reduce){#sc-theatre img.swap{animation:none!important}}'
  ].join('\n');
  document.head.append(css);
  const overlay=document.createElement('div');overlay.id='sc-theatre';stage.append(overlay);
  const controls=document.createElement('section');controls.className='theatre-controls';
  controls.innerHTML='<h3>Modo Teatro</h3><p class="hint">As figuras ficam alinhadas pela base da imagem. Clique diretamente em um personagem para mudar de retrato; arraste para reposicioná-lo.</p><div class="director-only" id="sc-theatre-director"><button class="btn primary" id="sc-theatre-toggle">Mostrar Teatro</button><label for="sc-theatre-category">Elenco</label><select id="sc-theatre-category"><option value="player">Fichas dos jogadores</option><option value="npc">NPCs do mestre</option></select><label for="sc-theatre-actor">Personagem</label><select id="sc-theatre-actor"></select><label for="sc-theatre-variant">Retrato inicial</label><select id="sc-theatre-variant"></select><button class="btn" id="sc-theatre-add">Adicionar ao Teatro</button><h3>Elenco no palco</h3><div id="sc-theatre-cast-list"></div><button class="btn" id="sc-theatre-clear">Retirar todos</button><p class="hint" id="sc-theatre-status"></p></div><p class="hint" id="sc-theatre-viewer-note" hidden>O mestre posiciona os retratos e escolhe as imagens apresentadas.</p>';
  panel.append(controls);
  const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const variants=['casual','ninja','ferido','grave'],labels=['Casual','Ninja','Ferido','Gravemente ferido'];
  const isImage=s=>typeof s==='string'&&(/^https:\/\/[^\s"'<>]+$/.test(s)||/^data:image\/(png|jpeg|webp);base64,/.test(s));
  let state={enabled:false,cast:[]},actors=[],adding=false;
  const assets=new Map(),figures=new Map(),cache=new Map(),changing=new Set();
  const norm=input=>({enabled:!!input?.enabled,cast:(Array.isArray(input?.cast)?input.cast:[]).slice(0,6).filter(x=>x&&typeof x.id==='string').map(x=>({
    id:x.id.slice(0,110),name:String(x.name||'Shinobi').slice(0,70),
    variant:variants.includes(x.variant)?x.variant:'ninja',
    x:clamp(Number(x.x)||.5,.1,.9),legacyPortrait:typeof x.portrait==='string'?x.portrait:''
  }))});
  const status=s=>{$('sc-theatre-status').textContent=s};
  const commit=patch=>{if(!isAdmin())return;state=norm({...state,...patch});render();void Promise.resolve(onChange({enabled:state.enabled,cast:state.cast.map(({legacyPortrait,...v})=>v)})).catch(e=>status(e.message))};
  const options=actor=>variants.filter(v=>actors.find(a=>a.id===actor.id)?.variants.includes(v));
  // Em vez de esticar PNGs com margens transparentes, cria uma versão recortada somente
  // para exibição, preservando o arquivo original da ficha e a resolução de tela.
  function trim(source){
    if(cache.has(source))return cache.get(source);
    const task=new Promise(resolve=>{
      const img=new Image();
      if(source.startsWith('https://'))img.crossOrigin='anonymous';
      img.onload=()=>{
        try{
          const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
          if(!w||!h)return resolve(source);
          const scale=Math.min(1,840/Math.max(w,h));
          const sw=Math.max(1,Math.round(w*scale)),sh=Math.max(1,Math.round(h*scale));
          const sample=document.createElement('canvas');sample.width=sw;sample.height=sh;
          const ctx=sample.getContext('2d',{willReadFrequently:true});
          if(!ctx)return resolve(source);
          ctx.drawImage(img,0,0,sw,sh);
          const data=ctx.getImageData(0,0,sw,sh),rgba=data.data;
          const white=id=>{
            const k=id*4,r=rgba[k],g=rgba[k+1],b=rgba[k+2];
            return rgba[k+3]>10 && r>=227 && g>=227 && b>=223 && Math.max(r,g,b)-Math.min(r,g,b)<31;
          };
          // A remoção de fundo opaco só é tentada em imagens com bordas quase brancas.
          // Roupas claras no interior não são apagadas: apenas o branco ligado às bordas.
          let border=0,whites=0,clear=0;
          const sampleBorder=id=>{border++;if(white(id))whites++;if(rgba[id*4+3]<10)clear++};
          const step=Math.max(1,Math.floor(Math.min(sw,sh)/180));
          for(let x=0;x<sw;x+=step){sampleBorder(x);sampleBorder((sh-1)*sw+x)}
          for(let y=0;y<sh;y+=step){sampleBorder(y*sw);sampleBorder(y*sw+sw-1)}
          const matte=whites/border>.72&&clear/border<.08;
          if(matte){
            const seen=new Uint8Array(sw*sh),queue=new Uint32Array(sw*sh);
            let head=0,tail=0;
            const enqueue=id=>{
              if(id<0||id>=sw*sh||seen[id]||!white(id))return;
              seen[id]=1;queue[tail++]=id;
            };
            for(let x=0;x<sw;x++){enqueue(x);enqueue((sh-1)*sw+x)}
            for(let y=0;y<sh;y++){enqueue(y*sw);enqueue(y*sw+sw-1)}
            while(head<tail){
              const id=queue[head++],x=id%sw,y=(id/sw)|0;
              rgba[id*4+3]=0;
              if(x>0)enqueue(id-1);if(x<sw-1)enqueue(id+1);
              if(y>0)enqueue(id-sw);if(y<sh-1)enqueue(id+sw);
            }
          }
          let left=sw,top=sh,right=-1,bottom=-1;
          for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
            if(rgba[(y*sw+x)*4+3]<8)continue;
            if(x<left)left=x;if(x>right)right=x;
            if(y<top)top=y;if(y>bottom)bottom=y;
          }
          if(right<0||bottom<0)return resolve(source);
          const pad=Math.max(2,Math.floor(sw*.005));
          left=Math.max(0,left-pad);right=Math.min(sw-1,right+pad);
          top=Math.max(0,top-pad);bottom=Math.min(sh-1,bottom+pad);
          const noCrop=left===0&&top===0&&right===sw-1&&bottom===sh-1;
          if(noCrop&&!matte)return resolve(source);
          const origL=left*w/sw,origT=top*h/sh,origW=(right-left+1)*w/sw,origH=(bottom-top+1)*h/sh;
          const targetScale=Math.min(1,1750/Math.max(origW,origH));
          const out=document.createElement('canvas');
          out.width=Math.max(1,Math.round(origW*targetScale));
          out.height=Math.max(1,Math.round(origH*targetScale));
          const g=out.getContext('2d',{alpha:true});
          if(!g)return resolve(source);
          g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
          g.drawImage(img,origL,origT,origW,origH,0,0,out.width,out.height);
          if(matte){
            // A máscara em baixa resolução é suavizada ao ampliar; a arte é desenhada
            // diretamente da fonte original, sem reduzir detalhes ao tamanho da máscara.
            ctx.putImageData(data,0,0);
            g.globalCompositeOperation='destination-in';
            g.drawImage(sample,left,top,right-left+1,bottom-top+1,0,0,out.width,out.height);
            g.globalCompositeOperation='source-over';
          }
          const clean=out.toDataURL('image/webp',.96);
          resolve(clean.startsWith('data:image/webp;')?clean:out.toDataURL('image/png'));
        }catch(error){
          // URLs de outros domínios podem bloquear o canvas por CORS: mantém a imagem original.
          resolve(source);
        }
      };
      img.onerror=()=>resolve(source);
      img.src=source;
    });
    cache.set(source,task);
    if(cache.size>22)cache.delete(cache.keys().next().value);
    return task;
  }
  // Carrega e decodifica o novo retrato ANTES da troca. A imagem anterior continua
  // aparecendo até a transição; snapshots do Firebase não recriam as figuras.
  async function loadArt(actor){
    const element=figures.get(actor.id);if(!element)return;
    const record=assets.get(actor.id);
    const source=record?.variant===actor.variant?record.image:actor.legacyPortrait;
    if(!isImage(source))return;
    const key=actor.variant+':'+source.length+':'+source.slice(0,32)+':'+source.slice(-24);
    if(element.dataset.currentArt===key||element.dataset.pendingArt===key)return;
    element.dataset.pendingArt=key;
    const clean=await trim(source);
    if(figures.get(actor.id)!==element||element.dataset.pendingArt!==key||!clean)return;
    const next=document.createElement('img');
    next.alt=actor.name;next.draggable=false;next.decoding='async';next.src=clean;
    try{
      if(typeof next.decode==='function')await next.decode();
      else await new Promise((resolve,reject)=>{
        if(next.complete&&next.naturalWidth)return resolve();
        next.onload=resolve;next.onerror=reject;
      });
    }catch(error){if(element.dataset.pendingArt===key)element.dataset.pendingArt='';return}
    if(figures.get(actor.id)!==element||element.dataset.pendingArt!==key)return;
    element.append(next);
    element.dataset.currentArt=key;
    element.dataset.pendingArt='';
    const others=Array.from(element.querySelectorAll('img')).filter(image=>image!==next);
    const placeholders=Array.from(element.querySelectorAll('.placeholder'));
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>next.classList.add('ready'));
    else next.classList.add('ready');
    setTimeout(()=>{
      if(figures.get(actor.id)!==element||element.dataset.currentArt!==key)return;
      for(const previous of [...others,...placeholders])previous.remove();
    },400);
  }
  const warm=new Set();
  function prewarm(actor){
    if(!isAdmin()||warm.has(actor.id))return;
    warm.add(actor.id);
    const variants=options(actor),current=actor.variant;
    let i=0;
    function next(){
      if(!figures.has(actor.id)||i>=variants.length)return;
      const variant=variants[i++];
      const source=previewPortrait?.(actor.id,variant);
      if(variant!==current&&isImage(source))void trim(source);
      setTimeout(next,330);
    }
    setTimeout(next,550);
  }
  async function change(actor,variant){
    if(!isAdmin()||changing.has(actor.id)||variant===actor.variant||!options(actor).includes(variant))return;
    changing.add(actor.id);
    const previous=actor.variant;
    try{
      const preview=previewPortrait?.(actor.id,variant);
      if(isImage(preview))assets.set(actor.id,{image:preview,variant});
      // Troca imediatamente no navegador do mestre, sem aguardar a rede Firebase.
      commit({cast:state.cast.map(c=>c.id===actor.id?{...c,variant}:c)});
      await publishPortrait(actor.id,variant);
      status('');
    }catch(e){
      commit({cast:state.cast.map(c=>c.id===actor.id?{...c,variant:previous}:c)});
      status('Falha ao mudar retrato: '+e.message);
    }finally{changing.delete(actor.id)}
  }
  function cycle(actor){
    const list=options(actor);
    if(list.length<2)return status('Este personagem tem apenas uma imagem cadastrada.');
    const index=list.indexOf(actor.variant);
    void change(actor,list[(index+1)%list.length]);
  }
  function menu(){
    $('sc-theatre-director').hidden=!isAdmin();$('sc-theatre-viewer-note').hidden=isAdmin();
    $('sc-theatre-toggle').textContent=state.enabled?'Ocultar Teatro':'Mostrar Teatro';
    const actorSelect=$('sc-theatre-actor'),old=actorSelect.value,group=$('sc-theatre-category').value;
    actorSelect.replaceChildren();
    for(const a of actors.filter(a=>a.category===group)){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;actorSelect.append(o)}
    if(actors.some(a=>a.id===old&&a.category===group))actorSelect.value=old;
    const current=actors.find(a=>a.id===actorSelect.value),variantSelect=$('sc-theatre-variant'),selected=variantSelect.value;
    variantSelect.replaceChildren();
    for(const variant of variants.filter(v=>current?.variants.includes(v))){const o=document.createElement('option');o.value=variant;o.textContent=labels[variants.indexOf(variant)];variantSelect.append(o)}
    if(current?.variants.includes(selected))variantSelect.value=selected;
    else if(current?.variants.includes('ninja'))variantSelect.value='ninja';
    $('sc-theatre-add').disabled=adding||!isAdmin()||state.cast.length>=6||!current?.variants.length;
    const list=$('sc-theatre-cast-list');list.replaceChildren();
    for(const actor of state.cast)if(isAdmin()){
      const row=document.createElement('div');row.className='cast-row';
      const name=document.createElement('strong');name.textContent=actor.name;
      const label=document.createElement('small');label.textContent=labels[variants.indexOf(actor.variant)];
      const remove=document.createElement('button');remove.textContent='Retirar';remove.onclick=()=>commit({cast:state.cast.filter(x=>x.id!==actor.id)});
      row.append(name,label,remove);list.append(row)
    }
  }
  async function add(){
    if(!isAdmin()||adding||state.cast.length>=6)return;
    const id=$('sc-theatre-actor').value,variant=$('sc-theatre-variant').value,actor=actors.find(x=>x.id===id);
    if(!actor||!variant||state.cast.some(x=>x.id===id))return;
    adding=true;menu();status('Carregando retrato…');
    try{
      const preview=previewPortrait?.(id,variant);
      if(isImage(preview))assets.set(id,{image:preview,variant});
      await publishPortrait(id,variant);
      const cast=[...state.cast,{id,name:actor.name,variant,x:.5}];
      commit({enabled:true,cast:cast.map((x,i)=>({...x,x:cast.length===1?.5:.15+i*.7/(cast.length-1)}))});
      status('');
    }catch(e){status('Erro no retrato: '+e.message)}finally{adding=false;menu()}
  }
  $('sc-theatre-category').onchange=menu;
  $('sc-theatre-actor').onchange=menu;
  $('sc-theatre-toggle').onclick=()=>commit({enabled:!state.enabled});
  $('sc-theatre-add').onclick=()=>void add();
  $('sc-theatre-clear').onclick=()=>commit({cast:[]});
  function createFigure(actor){
    const figure=document.createElement('div');figure.className='stage-character';figure.dataset.id=actor.id;
    if(isAdmin()){
      figure.tabIndex=0;figure.setAttribute('role','button');figure.setAttribute('aria-label','Trocar retrato de '+actor.name);
      let drag=null,suppress=false;
      figure.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};figure.setPointerCapture(e.pointerId);e.stopPropagation()});
      figure.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>7)drag.moved=true;if(drag.moved){const rect=overlay.getBoundingClientRect();figure.style.left=(clamp((e.clientX-rect.left)/rect.width,.1,.9)*100)+'%'}});
      const finish=e=>{if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;suppress=true;setTimeout(()=>suppress=false,160);if(d.moved){const rect=overlay.getBoundingClientRect(),x=clamp((e.clientX-rect.left)/rect.width,.1,.9);commit({cast:state.cast.map(a=>a.id===actor.id?{...a,x}:a)})}else{const current=state.cast.find(a=>a.id===actor.id);if(current)cycle(current)}};
      figure.addEventListener('pointerup',finish);figure.addEventListener('pointercancel',finish);
      figure.addEventListener('click',()=>{if(suppress)return;const current=state.cast.find(a=>a.id===actor.id);if(current)cycle(current)});
      figure.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();const current=state.cast.find(a=>a.id===actor.id);if(current)cycle(current)}});
    }
    return figure;
  }
  function render(){
    menu();overlay.classList.toggle('open',state.enabled);overlay.classList.toggle('directable',isAdmin());
    const active=new Set(state.cast.map(a=>a.id));
    for(const [id,figure] of figures)if(!active.has(id)){figure.remove();figures.delete(id)}
    if(!state.enabled)return;
    for(let i=0;i<state.cast.length;i++){
      const actor=state.cast[i];let figure=figures.get(actor.id);
      if(!figure){figure=createFigure(actor);figures.set(actor.id,figure);overlay.append(figure)}
      figure.style.left=(actor.x*100)+'%';figure.style.zIndex=String(i+2);
      if(!figure.firstChild){const p=document.createElement('span');p.className='placeholder';p.textContent='忍';figure.append(p)}
      void loadArt(actor);
      prewarm(actor);
    }
  }
  return {
    setState(v){state=norm(v||{});render()},
    setActors(v){actors=(Array.isArray(v)?v:[]).filter(a=>a?.id).map(a=>({id:String(a.id),name:String(a.name||'Shinobi'),category:a.category==='npc'?'npc':'player',variants:Array.isArray(a.variants)?a.variants:[]}));render()},
    setPortrait(id,image,variant){if(isImage(image))assets.set(id,{image,variant});else assets.delete(id);render()},
    refresh:render
  };
}
