// Palco de interpretação independente da cena tática: não lê tokens do mapa.
// Retratos publicados separadamente pelo mestre, preservando a qualidade das fichas.
export function createTheatre({stage,panel,onChange,isAdmin,publishPortrait}){
  const css=document.createElement('style');
  css.textContent=[
    '#sc-theatre{position:absolute;inset:0;z-index:4;display:none;overflow:hidden;pointer-events:none;background:linear-gradient(180deg,transparent 62%,rgba(4,9,12,.43) 100%)}',
    '#sc-theatre.open{display:block}',
    '#sc-theatre .stage-character{position:absolute;bottom:0;transform:translateX(-50%);width:min(34%,395px);height:min(75%,780px);display:flex;align-items:center;justify-content:flex-end;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 9px 12px #0006)}',
    '#sc-theatre.directable .stage-character{pointer-events:auto;cursor:grab}',
    '#sc-theatre .stage-character.dragging{cursor:grabbing;z-index:7!important}',
    '#sc-theatre .stage-character img{display:block;width:auto;height:auto;max-height:100%;max-width:100%;object-fit:contain;object-position:center bottom;pointer-events:none;user-select:none}',
    '#sc-theatre .stage-character .placeholder{display:grid;place-items:center;width:55%;height:55%;font:500 45px Georgia,serif;color:#d6bb8e;background:#23372e90;border:1px dashed #baa17d70;border-radius:18px 18px 0 0}',
    '.theatre-controls h3{margin:14px 0 8px}',
    '.theatre-controls .cast-row{display:grid;grid-template-columns:1fr auto;gap:7px;margin:9px 0;padding:10px;border:1px solid #526b58;background:#263a2e;border-radius:10px}',
    '.theatre-controls .cast-row strong{font-size:12px;color:#f4e7d3}',
    '.theatre-controls .cast-row .cast-variant{grid-column:1;grid-row:2;margin:0;font-size:11px}',
    '.theatre-controls .cast-row button{grid-column:2;grid-row:1/3;align-self:center;border:1px solid #72866e;border-radius:8px;background:#334a3c;color:#f5e9d3;padding:8px;font-size:11px;cursor:pointer}',
    '.theatre-controls .director-only[hidden]{display:none}',
    '@media(max-width:720px){#sc-theatre .stage-character{height:min(62%,490px);width:40%}}',
    '@media(prefers-reduced-motion:reduce){#sc-theatre .stage-character{transition:none}}'
  ].join('\n');
  document.head.append(css);
  const overlay=document.createElement('div');
  overlay.id='sc-theatre';overlay.setAttribute('aria-label','Palco narrativo');stage.append(overlay);
  const controls=document.createElement('section');controls.className='theatre-controls';
  controls.innerHTML='<h3>Modo Teatro</h3><p class="hint">Personagens alinhados pela base da tela, sobre o mapa. Não precisam de tokens nem têm caixas de diálogo. Arraste os retratos para reorganizá-los.</p><div class="director-only" id="sc-theatre-director"><button class="btn primary" id="sc-theatre-toggle" type="button">Mostrar Teatro</button><label for="sc-theatre-category">Tipo de personagem</label><select id="sc-theatre-category"><option value="player">Fichas dos jogadores</option><option value="npc">NPCs do mestre</option></select><label for="sc-theatre-actor">Ficha</label><select id="sc-theatre-actor"></select><label for="sc-theatre-variant">Retrato da ficha</label><select id="sc-theatre-variant"></select><button class="btn primary" id="sc-theatre-add" type="button">Adicionar ao Teatro</button><h3>Personagens posicionados</h3><div id="sc-theatre-cast-list"></div><button type="button" class="btn" id="sc-theatre-clear">Retirar todos</button><p class="hint" id="sc-theatre-status" role="status"></p></div><p class="hint" id="sc-theatre-viewer-note" hidden>O mestre seleciona os retratos e organiza os personagens para todos.</p>';
  panel.append(controls);
  const $=id=>document.getElementById(id);
  const variants=[{id:'casual',name:'Casual'},{id:'ninja',name:'Ninja'},{id:'ferido',name:'Ferido'},{id:'grave',name:'Gravemente ferido'}];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  let state={enabled:false,cast:[]},actors=[],images=new Map(),busy=false;
  function norm(next){
    const cast=Array.isArray(next?.cast)?next.cast.filter(c=>c&&typeof c.id==='string').slice(0,6).map(c=>({
      id:c.id.slice(0,110),name:String(c.name||'Shinobi').slice(0,70),
      variant:variants.some(v=>v.id===c.variant)?c.variant:'ninja',
      x:clamp(Number(c.x)||.5,.10,.90),
      legacyPortrait:typeof c.portrait==='string'?c.portrait:''
    })):[];
    return {enabled:!!next?.enabled,cast};
  }
  function commit(patch){
    if(!isAdmin())return;
    state=norm({...state,...patch});render();
    Promise.resolve(onChange({enabled:state.enabled,cast:state.cast.map(({legacyPortrait,...c})=>c)})).catch(e=>setStatus(String(e)));
  }
  function setStatus(message){$('sc-theatre-status').textContent=message}
  function actorVariants(actor){return variants.filter(v=>actor?.variants?.includes(v.id))}
  function updateActorOptions(){
    const group=$('sc-theatre-category').value,selector=$('sc-theatre-actor'),old=selector.value;
    selector.replaceChildren();
    const list=actors.filter(a=>a.category===group);
    for(const a of list){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;selector.append(o)}
    if(list.some(a=>a.id===old))selector.value=old;
    updateVariantOptions();
  }
  function updateVariantOptions(){
    const actor=actors.find(a=>a.id===$('sc-theatre-actor').value),selector=$('sc-theatre-variant'),old=selector.value;
    selector.replaceChildren();
    const available=actorVariants(actor);
    for(const v of available){const o=document.createElement('option');o.value=v.id;o.textContent=v.name;selector.append(o)}
    if(available.some(v=>v.id===old))selector.value=old;
    else if(available.some(v=>v.id==='ninja'))selector.value='ninja';
    $('sc-theatre-add').disabled=!isAdmin()||busy||state.cast.length>=6||!available.length;
  }
  $('sc-theatre-category').onchange=updateActorOptions;
  $('sc-theatre-actor').onchange=updateVariantOptions;
  $('sc-theatre-toggle').onclick=()=>commit({enabled:!state.enabled});
  $('sc-theatre-add').onclick=async()=>{
    if(!isAdmin()||busy||state.cast.length>=6)return;
    const id=$('sc-theatre-actor').value,variant=$('sc-theatre-variant').value;
    if(!id||!variant||state.cast.some(a=>a.id===id))return setStatus('Esse personagem já está no palco.');
    busy=true;updateVariantOptions();setStatus('Preparando o retrato original…');
    try{
      const actor=actors.find(a=>a.id===id);
      await publishPortrait(id,variant);
      const previous=state.cast;
      const list=[...previous,{id,name:actor?.name||'Shinobi',variant,x:.5}];
      const placed=list.map((a,i)=>({...a,x:list.length===1?.5:.14+.72*i/(list.length-1)}));
      commit({enabled:true,cast:placed});setStatus('');
    }catch(e){setStatus('Falha ao publicar retrato: '+e.message)}
    finally{busy=false;updateVariantOptions()}
  };
  $('sc-theatre-clear').onclick=()=>commit({cast:[]});
  async function changeVariant(actor,variant){
    if(!isAdmin()||!actor||variant===actor.variant)return;
    setStatus('Carregando outro retrato…');
    try{await publishPortrait(actor.id,variant);commit({cast:state.cast.map(c=>c.id===actor.id?{...c,variant}:c)});setStatus('')}
    catch(e){setStatus('Não foi possível alterar a imagem: '+e.message)}
  }
  function render(){
    $('sc-theatre-director').hidden=!isAdmin();
    $('sc-theatre-viewer-note').hidden=isAdmin();
    $('sc-theatre-toggle').textContent=state.enabled?'Ocultar Teatro':'Mostrar Teatro';
    overlay.classList.toggle('open',state.enabled);
    overlay.classList.toggle('directable',isAdmin());
    updateActorOptions();
    const list=$('sc-theatre-cast-list');list.replaceChildren();
    if(!state.cast.length){const p=document.createElement('p');p.textContent='Nenhum personagem no Teatro.';list.append(p)}
    if(isAdmin())for(const a of state.cast){
      const row=document.createElement('div');row.className='cast-row';
      const name=document.createElement('strong');name.textContent=a.name;
      const selector=document.createElement('select');selector.className='cast-variant';selector.setAttribute('aria-label','Retrato de '+a.name);
      const actor=actors.find(x=>x.id===a.id);
      for(const v of variants){
        if(!actor?.variants?.includes(v.id)&&v.id!==a.variant)continue;
        const o=document.createElement('option');o.value=v.id;o.textContent=v.name;selector.append(o)
      }
      selector.value=a.variant;selector.onchange=()=>void changeVariant(a,selector.value);
      const remove=document.createElement('button');remove.textContent='Retirar';remove.onclick=()=>commit({cast:state.cast.filter(x=>x.id!==a.id)});
      row.append(name,selector,remove);list.append(row);
    }
    overlay.replaceChildren();
    if(!state.enabled)return;
    for(let i=0;i<state.cast.length;i++){
      const actor=state.cast[i],figure=document.createElement('div');figure.className='stage-character';
      figure.style.left=(actor.x*100)+'%';figure.style.zIndex=String(i+2);figure.setAttribute('aria-label',actor.name);
      const asset=images.get(actor.id),src=asset?.variant===actor.variant?asset.image:actor.legacyPortrait;
      if(typeof src==='string'&&(/^(https:\/\/)/.test(src)||/^data:image\/(png|jpeg|webp);base64,/.test(src))){
        const img=document.createElement('img');img.src=src;img.alt=actor.name;img.draggable=false;figure.append(img);
      }else{const placeholder=document.createElement('span');placeholder.className='placeholder';placeholder.textContent='忍';figure.append(placeholder)}
      if(isAdmin()){
        let dragging=null;
        figure.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging={id:e.pointerId};figure.setPointerCapture(e.pointerId);figure.classList.add('dragging');e.stopPropagation();e.preventDefault()});
        figure.addEventListener('pointermove',e=>{if(!dragging||dragging.id!==e.pointerId)return;const rect=overlay.getBoundingClientRect();dragging.x=clamp((e.clientX-rect.left)/rect.width,.1,.9);figure.style.left=(dragging.x*100)+'%'});
        const finish=e=>{if(!dragging||dragging.id!==e.pointerId)return;const x=dragging.x;dragging=null;figure.classList.remove('dragging');if(x!==undefined)commit({cast:state.cast.map(c=>c.id===actor.id?{...c,x}:c)})};
        figure.addEventListener('pointerup',finish);figure.addEventListener('pointercancel',finish);
      }
      overlay.append(figure);
    }
  }
  return {
    setState(value){state=norm(value||{});render()},
    setActors(items){actors=(Array.isArray(items)?items:[]).filter(a=>a&&a.id).map(a=>({id:String(a.id),name:String(a.name||'Shinobi'),category:a.category==='npc'?'npc':'player',variants:Array.isArray(a.variants)?a.variants:[]}));render()},
    setPortrait(id,image,variant){if(image)images.set(id,{image,variant});else images.delete(id);render()},
    refresh:render
  };
}
