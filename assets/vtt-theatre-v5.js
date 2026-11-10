// SHINOBI CHRONICLES — Teatro: elenco fixo, imagens integrais, escala coerente e direção explícita.
export function createTheatre({stage,panel,onChange,isAdmin,publishPortrait,previewPortrait}){
  const css=document.createElement('style');
  css.textContent=String.raw`
#sc-theatre{position:absolute;inset:0;z-index:4;overflow:hidden;pointer-events:none;display:none;align-items:flex-end;justify-content:space-around;gap:0;padding:76px 2.2% 0;background:linear-gradient(180deg,transparent 45%,#040b0a20 75%,#03090870)}
#sc-theatre.open{display:flex}
#sc-theatre .stage-character{position:relative;height:100%;flex:1 1 0;min-width:0;max-width:450px;isolation:isolate;pointer-events:none}
#sc-theatre .stage-character img{display:block;position:absolute;max-width:none;max-height:none;pointer-events:none;user-select:none;object-fit:fill;opacity:0;filter:drop-shadow(0 11px 14px #010604aa);transition:opacity .18s ease}
#sc-theatre .stage-character img.ready{opacity:1}
#sc-theatre .stage-name{position:absolute;bottom:76%;left:50%;transform:translateX(-50%);white-space:nowrap;max-width:95%;overflow:hidden;text-overflow:ellipsis;border-radius:99px;padding:5px 11px;font:600 11px/1.2 Inter,system-ui,sans-serif;letter-spacing:.02em;color:#fff4dc;background:#15241ce8;border:1px solid #a8926f99;box-shadow:0 4px 15px #0007;z-index:2}
#sc-theatre button.stage-name{pointer-events:auto;cursor:pointer}
#sc-theatre button.stage-name:hover,#sc-theatre button.stage-name:focus-visible{background:#5b523a;border-color:#e0c18b}
#sc-theatre .placeholder{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:min(75%,170px);height:min(39%,285px);border-radius:70px 70px 0 0;display:grid;place-items:center;background:linear-gradient(150deg,#4c5b4b,#283d33);font:600 54px Georgia,serif;color:#dfcca9;box-shadow:0 15px 32px #0006}
.theatre-controls{color:#eee6d4}
.theatre-controls .theatre-info{margin:10px 0 15px;padding:12px;background:#21342c;border:1px solid #4c6655;border-radius:10px}
.theatre-controls .theatre-info p{margin:0}
.theatre-controls .cast-row{padding:12px;margin:9px 0;background:#24382f;border:1px solid #516b58;border-radius:12px}
.theatre-controls .cast-row .cast-head{display:flex;align-items:center;gap:7px;margin-bottom:8px}
.theatre-controls .cast-row strong{font-size:12px;color:#f0e8d4;flex:1}
.theatre-controls .cast-row small{font-size:10px;color:#c4d0bd}
.theatre-controls .cast-row select{margin:4px 0 0;padding:9px;font-size:11px}
.theatre-controls .cast-row .cast-check{display:flex;align-items:center;gap:8px;padding:9px 0;font-weight:500}
.theatre-controls .cast-check input{width:auto;accent-color:#c7aa7b}
.theatre-controls .cast-row button{padding:7px 11px;border:1px solid #718b74;background:#344b3c;color:#fff0dc;border-radius:7px;font-size:11px;cursor:pointer}
.theatre-controls [hidden]{display:none!important}
@media(max-width:700px){#sc-theatre{padding:55px 1.5% 0}#sc-theatre .stage-name{font-size:9px;padding:4px 6px}}
@media(prefers-reduced-motion:reduce){#sc-theatre img{transition:none!important}}
`;
  document.head.append(css);
  const overlay=document.createElement('div');overlay.id='sc-theatre';overlay.setAttribute('aria-label','Palco dos personagens');stage.append(overlay);
  const controls=document.createElement('section');controls.className='theatre-controls';
  controls.innerHTML=`<h3>Modo Teatro</h3>
  <div class="theatre-info"><p>Elenco compacto: personagens com a mesma altura visual e espaço para vários no palco. Clique no nome para abrir os controles. As artes são exibidas inteiras, sem recorte automático e sem movimentação ao clicar.</p></div>
  <div id="sc-theatre-director">
    <button class="btn primary" id="sc-theatre-toggle">Mostrar Teatro</button>
    <label for="sc-theatre-category">Elenco</label>
    <select id="sc-theatre-category"><option value="player">Fichas dos jogadores</option><option value="npc">NPCs do mestre</option></select>
    <label for="sc-theatre-actor">Personagem</label><select id="sc-theatre-actor"></select>
    <label for="sc-theatre-variant">Visual inicial</label><select id="sc-theatre-variant"></select>
    <button class="btn" id="sc-theatre-add">Adicionar ao palco</button>
    <h3>Direção do elenco</h3><div id="sc-theatre-cast-list"></div>
    <button class="btn" id="sc-theatre-clear">Retirar todos</button>
    <p class="hint" id="sc-theatre-status" role="status"></p>
  </div>
  <p class="hint" id="sc-theatre-viewer-note" hidden>O mestre escolhe o elenco e os visuais. As condições de ferimento acompanham a Vitalidade das fichas.</p>`;
  panel.append(controls);
  const $=id=>document.getElementById(id);
  const variants=['casual','ninja','triste','ferido','grave'];
  const labels={casual:'Casual',ninja:'Traje ninja',triste:'Triste',ferido:'Ferido',grave:'Gravemente ferido'};
  const validImage=s=>typeof s==='string'&&(/^https:\/\/[^\s"'<>]+$/i.test(s)||/^data:image\/(png|jpeg|webp);base64,/i.test(s));
  let state={enabled:false,cast:[]},actors=[],adding=false,activeEdit='';
  const portraits=new Map(),vitals=new Map(),figures=new Map(),boundsCache=new Map(),publishing=new Set();
  const norm=s=>({
    enabled:!!s?.enabled,
    cast:(Array.isArray(s?.cast)?s.cast:[]).filter(x=>x&&typeof x.id==='string').slice(0,6).map(x=>({
      id:x.id.slice(0,110),name:String(x.name||'Shinobi').slice(0,70),
      variant:variants.includes(x.variant)?x.variant:'ninja',auto:x.auto!==false
    }))
  });
  const notify=msg=>{$('sc-theatre-status').textContent=msg||''};
  function persist(patch){
    if(!isAdmin())return;
    const previous=state;state=norm({...state,...patch});render();
    void Promise.resolve().then(()=>onChange({enabled:state.enabled,cast:state.cast})).catch(e=>{
      state=previous;render();notify('Não foi possível salvar no Firebase: '+e.message);
    });
  }
  const available=id=>actors.find(a=>a.id===id)?.variants||[];
  function wanted(actor){
    if(!actor.auto)return actor.variant;
    const v=vitals.get(actor.id);
    if(!v||!(v.max>0))return actor.variant;
    const fraction=v.current/v.max;
    if(fraction<=.25)return 'grave';
    if(fraction<=.5)return 'ferido';
    return actor.variant;
  }
  function artwork(actor){
    const data=portraits.get(actor.id);
    const byVariant=data?.variants||{};
    const preferred=wanted(actor);
    const choices=[preferred,actor.variant,'ninja','casual','ferido','grave','triste'];
    for(const name of choices)if(validImage(byVariant[name]))return {source:byVariant[name],variant:name};
    // Retrocompatibilidade com os retratos de Teatro publicados antes desta versão.
    if(validImage(data?.image))return {source:data.image,variant:data.variant||actor.variant};
    if(isAdmin())for(const name of choices){
      const img=previewPortrait?.(actor.id,name);
      if(validImage(img))return {source:img,variant:name};
    }
    return {source:'',variant:preferred};
  }
  // Mede somente a área com alfa visível. NÃO recorta, NÃO converte e NÃO mascara a imagem.
  function visibleBounds(img,source){
    if(boundsCache.has(source))return boundsCache.get(source);
    const w=img.naturalWidth,h=img.naturalHeight;
    const full={left:0,top:0,right:w-1,bottom:h-1,width:w,height:h};
    try{
      const factor=Math.min(1,480/Math.max(w,h));
      const sw=Math.max(1,Math.round(w*factor)),sh=Math.max(1,Math.round(h*factor));
      const c=document.createElement('canvas');c.width=sw;c.height=sh;
      const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,sw,sh);
      const data=g.getImageData(0,0,sw,sh).data;
      let l=sw,t=sh,r=-1,b=-1;
      for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
        if(data[(y*sw+x)*4+3]<22)continue;
        l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);
      }
      if(r>=l&&b>=t){
        const out={left:l*w/sw,top:t*h/sh,right:(r+1)*w/sw-1,bottom:(b+1)*h/sh-1,
          width:(r-l+1)*w/sw,height:(b-t+1)*h/sh};
        boundsCache.set(source,out);return out;
      }
    }catch(e){/* Canvas remoto sem CORS: usa as dimensões originais, sem alterar a imagem. */}
    boundsCache.set(source,full);
    if(boundsCache.size>50)boundsCache.delete(boundsCache.keys().next().value);
    return full;
  }
  // Um único tamanho visual compartilhado: compacto mesmo com apenas 1 ou 2 personagens.
  // A largura disponível para o elenco pode reduzir o tamanho de TODOS por igual.
  // Não recorta, não estica e preserva a proporção original de cada imagem.
  function fit(){
    const stageHeight=stage.clientHeight;
    if(!stageHeight||!state.cast.length)return;
    const figuresOnStage=state.cast.map(actor=>figures.get(actor.id)).filter(Boolean);
    const measured=figuresOnStage.map(figure=>{
      const img=figure.querySelector('img.ready');
      if(!img?.naturalWidth||!figure.clientWidth)return null;
      return {figure,img,bounds:visibleBounds(img,figure._imageSource)};
    }).filter(Boolean);

    // O palco não deve ser dominado por tokens gigantes.
    const desiredHeight=Math.min(stageHeight*.39,285);
    // Reserva largura para até seis personagens, sem sobrepor personagens vizinhos.
    const widthFactor=state.cast.length>=4?1.05:1.13;
    const commonHeight=Math.min(desiredHeight,...measured.map(item=>
      item.figure.clientWidth*widthFactor*item.bounds.height/Math.max(1,item.bounds.width)
    ));
    if(!Number.isFinite(commonHeight)||commonHeight<=0)return;

    for(const figure of figuresOnStage){
      const name=figure.querySelector('.stage-name');
      if(name)name.style.bottom=Math.min(stageHeight-30,commonHeight+12)+'px';
      const placeholder=figure.querySelector('.placeholder');
      if(placeholder)placeholder.style.height=commonHeight+'px';

      const img=figure.querySelector('img.ready');
      if(!img?.naturalWidth)continue;
      const geometry=visibleBounds(img,figure._imageSource);
      const scale=commonHeight/Math.max(1,geometry.height);
      img.style.width=(img.naturalWidth*scale)+'px';
      img.style.height=(img.naturalHeight*scale)+'px';
      img.style.left=(figure.clientWidth/2-(geometry.left+geometry.width/2)*scale)+'px';
      img.style.bottom=(-((img.naturalHeight-geometry.bottom-1)*scale))+'px';
    }
  }
  function load(figure,actor){
    const {source,variant}=artwork(actor);
    const name=figure.querySelector('.stage-name');
    if(name){name.textContent=actor.name;name.title=isAdmin()?'Editar visual de '+actor.name:actor.name;}
    figure.dataset.variant=variant;
    if(!source){figure._imageSource='';figure.replaceChildren(name||document.createElement('span'));if(!figure.querySelector('.placeholder')){
      const placeholder=document.createElement('span');placeholder.className='placeholder';placeholder.textContent='忍';figure.prepend(placeholder);
    }return;}
    if(figure._imageSource===source){fit(figure);return;}
    if(figure._pendingSource===source)return;
    figure._pendingSource=source;
    const next=document.createElement('img');next.alt='Arte integral de '+actor.name;next.draggable=false;next.decoding='async';
    next.onload=()=>{
      if(figure._pendingSource!==source||figures.get(actor.id)!==figure)return;
      const previous=figure.querySelectorAll('img,.placeholder');
      figure._imageSource=source;figure._pendingSource='';
      figure.prepend(next);next.classList.add('ready');fit(figure);
      for(const old of previous)if(old!==next)old.remove();
    };
    next.onerror=()=>{if(figure._pendingSource===source){figure._pendingSource='';notify('Falha ao carregar retrato de '+actor.name)}};
    next.src=source;
  }
  function focusActor(actor){
    if(!isAdmin())return;
    const workspace=document.getElementById('workspace');
    if(workspace?.classList.contains('panel-hidden'))document.getElementById('vtt-toggle-panel')?.click();
    document.querySelector('.tabs [data-tab="theatre"]')?.click();
    activeEdit=actor.id;
    const record=actors.find(a=>a.id===actor.id);
    if(record){$('sc-theatre-category').value=record.category;menu();$('sc-theatre-actor').value=actor.id;}
    const row=Array.from(document.querySelectorAll('#sc-theatre-cast-list .cast-row')).find(x=>x.dataset.actor===actor.id);
    row?.scrollIntoView({block:'nearest',behavior:'smooth'});row?.querySelector('select')?.focus();
  }
  function makeFigure(actor){
    const figure=document.createElement('div');figure.className='stage-character';figure.dataset.actor=actor.id;
    const label=document.createElement(isAdmin()?'button':'span');label.className='stage-name';
    if(label.tagName==='BUTTON'){label.type='button';label.onclick=()=>focusActor(actor);}
    figure.append(label);return figure;
  }
  function render(){
    menu();
    overlay.classList.toggle('open',state.enabled);
    const active=new Set(state.cast.map(a=>a.id));
    for(const [id,figure] of figures)if(!active.has(id)){figure.remove();figures.delete(id)}
    if(!state.enabled)return;
    for(const actor of state.cast){
      let figure=figures.get(actor.id);
      if(!figure){figure=makeFigure(actor);figures.set(actor.id,figure);}
      overlay.append(figure); // a ordem de cadastro determina posições fixas e altura igualada
      load(figure,actor);
    }
    requestAnimationFrame(fit);
  }
  function menu(){
    $('sc-theatre-director').hidden=!isAdmin();$('sc-theatre-viewer-note').hidden=isAdmin();
    $('sc-theatre-toggle').textContent=state.enabled?'Ocultar Teatro':'Mostrar Teatro';
    const actorSelect=$('sc-theatre-actor');
    const group=$('sc-theatre-category').value,old=activeEdit||actorSelect.value;
    actorSelect.replaceChildren();
    for(const a of actors.filter(a=>a.category===group)){const opt=new Option(a.name,a.id);actorSelect.append(opt);}
    if(actors.some(a=>a.id===old&&a.category===group))actorSelect.value=old;
    const selected=actors.find(a=>a.id===actorSelect.value),variantSelect=$('sc-theatre-variant'),oldVariant=variantSelect.value;
    variantSelect.replaceChildren();
    for(const key of variants.filter(x=>selected?.variants.includes(x)))variantSelect.append(new Option(labels[key],key));
    if(selected?.variants.includes(oldVariant))variantSelect.value=oldVariant;
    else if(selected?.variants.includes('ninja'))variantSelect.value='ninja';
    $('sc-theatre-add').disabled=!isAdmin()||adding||state.cast.length>=6||!selected?.variants.length||state.cast.some(x=>x.id===actorSelect.value);
    const list=$('sc-theatre-cast-list');list.replaceChildren();
    if(!state.cast.length){const p=document.createElement('p');p.className='hint';p.textContent='Nenhum personagem no palco.';list.append(p);}
    for(const actor of state.cast){
      const row=document.createElement('div');row.className='cast-row';row.dataset.actor=actor.id;
      const head=document.createElement('div');head.className='cast-head';
      const name=document.createElement('strong');name.textContent=actor.name;
      const v=vitals.get(actor.id),small=document.createElement('small');
      small.textContent=v?'HP '+v.current+'/'+v.max:'HP aguardando ficha';
      head.append(name,small);
      const variantSelect=document.createElement('select');variantSelect.setAttribute('aria-label','Visual de '+actor.name);
      for(const key of variants.filter(k=>available(actor.id).includes(k)))variantSelect.append(new Option(labels[key],key));
      if(!Array.from(variantSelect.options).some(o=>o.value===actor.variant))variantSelect.append(new Option(labels[actor.variant],actor.variant));
      variantSelect.value=actor.variant;variantSelect.disabled=!isAdmin();
      variantSelect.onchange=()=>persist({cast:state.cast.map(a=>a.id===actor.id?{...a,variant:variantSelect.value,auto:false}:a)});
      const checkLabel=document.createElement('label');checkLabel.className='cast-check';
      const check=document.createElement('input');check.type='checkbox';check.checked=actor.auto;check.disabled=!isAdmin();
      check.onchange=()=>persist({cast:state.cast.map(a=>a.id===actor.id?{...a,auto:check.checked}:a)});
      checkLabel.append(check,document.createTextNode('Visual automático conforme HP (≤50% ferido; ≤25% grave)'));
      const actions=document.createElement('div');
      const reload=document.createElement('button');reload.textContent='Atualizar artes';reload.disabled=!isAdmin()||publishing.has(actor.id);
      reload.onclick=async()=>{publishing.add(actor.id);reload.disabled=true;try{await publishPortrait(actor.id,actor.variant);notify('Retratos atualizados: '+actor.name);}catch(e){notify(e.message)}finally{publishing.delete(actor.id);menu()}};
      const remove=document.createElement('button');remove.textContent='Retirar';remove.style.marginLeft='6px';remove.onclick=()=>persist({cast:state.cast.filter(x=>x.id!==actor.id)});
      actions.append(reload,remove);
      row.append(head,variantSelect,checkLabel,actions);list.append(row);
    }
  }
  async function add(){
    if(!isAdmin()||adding||state.cast.length>=6)return;
    const id=$('sc-theatre-actor').value,variant=$('sc-theatre-variant').value,actor=actors.find(a=>a.id===id);
    if(!actor||!actor.variants.includes(variant)||state.cast.some(a=>a.id===id))return;
    adding=true;menu();notify('Publicando retratos integrais...');
    try{
      await publishPortrait(id,variant);
      persist({enabled:true,cast:[...state.cast,{id,name:actor.name,variant,auto:true}]});
      notify('');
    }catch(e){notify('Não foi possível adicionar: '+e.message)}finally{adding=false;menu()}
  }
  $('sc-theatre-category').onchange=()=>{activeEdit='';menu()};
  $('sc-theatre-actor').onchange=()=>{activeEdit=$('sc-theatre-actor').value;menu()};
  $('sc-theatre-toggle').onclick=()=>persist({enabled:!state.enabled});
  $('sc-theatre-add').onclick=()=>void add();
  $('sc-theatre-clear').onclick=()=>persist({cast:[]});
  new ResizeObserver(()=>{if(state.enabled)requestAnimationFrame(fit)}).observe(stage);
  return {
    setState(value){const next=norm(value||{});if(JSON.stringify(state)===JSON.stringify(next))return;state=next;render()},
    setActors(value){actors=(Array.isArray(value)?value:[]).filter(a=>a?.id).map(a=>({
      id:String(a.id),name:String(a.name||'Shinobi'),category:a.category==='npc'?'npc':'player',
      variants:Array.isArray(a.variants)?a.variants.filter(k=>variants.includes(k)):[]
    }));render()},
    setPortrait(id,data,variant){
      if(data&&typeof data==='object'&&!Array.isArray(data)){
        const images=Object.fromEntries(Object.entries(data).filter(([k,v])=>variants.includes(k)&&validImage(v)));
        portraits.set(id,{variants:images,variant});
      }else if(validImage(data))portraits.set(id,{image:data,variant,variants:{[variant]:data}});
      else portraits.delete(id);
      render();
    },
    setVital(id,value){
      if(value&&Number.isFinite(Number(value.current))&&Number(value.max)>0)
        vitals.set(id,{current:Number(value.current),max:Number(value.max)});
      else vitals.delete(id);
      render();
    },
    refresh:render
  };
}
