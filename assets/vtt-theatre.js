// Palco narrativo, sem dependência dos tokens da cena tática.
export function createTheatre({stage,panel,onChange,isAdmin,resolveActor}){
  const style=document.createElement('style');
  style.textContent='#sc-theatre{position:absolute;inset:0;z-index:4;display:none;overflow:hidden;pointer-events:none;background:linear-gradient(180deg,#06110b16,#07140f55 58%,#06100bd0)}#sc-theatre.open{display:block}#sc-theatre .stage-character{position:absolute;transform:translate(-50%,-100%);width:min(30%,300px);height:min(68%,610px);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;opacity:.76;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none}#sc-theatre.directable .stage-character{pointer-events:auto;cursor:grab}#sc-theatre .stage-character.dragging{cursor:grabbing;z-index:6!important}#sc-theatre .stage-character.speaking{opacity:1}#sc-theatre .stage-character:not(.speaking){filter:saturate(.7) brightness(.8)}#sc-theatre .stage-character img{max-height:calc(100% - 26px);height:auto;width:auto;max-width:100%;object-fit:contain;object-position:center bottom;pointer-events:none;filter:drop-shadow(0 11px 16px #000a)}#sc-theatre .stand-in{width:66%;height:70%;display:grid;place-items:center;border-radius:80px 80px 7px 7px;background:linear-gradient(130deg,#4a5c4a,#21352b);font:500 60px Georgia,serif;color:#efddb0}#sc-theatre .nameplate{border:1px solid #b39c7777;border-radius:6px;background:#14221edc;font-size:11px;font-weight:700;color:#ffedcb;padding:5px 10px;text-shadow:0 2px 6px #000;max-width:95%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#sc-theatre .dialogue{position:absolute;bottom:2%;left:5%;right:5%;z-index:8;min-height:74px;padding:13px 19px;border:1px solid #c5ad81a8;border-radius:13px;background:linear-gradient(105deg,#15241ef3,#192e27f0);box-shadow:0 18px 44px #0008;pointer-events:none;backdrop-filter:blur(9px)}#sc-theatre .dialogue strong{display:block;color:#f8d7a2;font:600 15px Georgia,serif;margin-bottom:6px}#sc-theatre .dialogue p{margin:0;font-size:14px;line-height:1.5;color:#f4eee3;white-space:pre-wrap;overflow-wrap:anywhere}.theatre-controls h3{margin:15px 0 9px}.theatre-controls .cast-row{display:flex;gap:7px;align-items:center;padding:8px 9px;margin:7px 0;border-radius:8px;background:#293b30;border:1px solid #51654f}.theatre-controls .cast-row .name{min-width:0;flex:1;font-size:12px}.theatre-controls .cast-row button{background:#34473b;border:1px solid #758872;border-radius:7px;color:#ede2c8;padding:6px 9px;font-size:11px;cursor:pointer}.theatre-controls .director-only[hidden]{display:none}@media(max-width:700px){#sc-theatre .stage-character{width:34%;height:55%}#sc-theatre .dialogue{left:3%;right:3%;bottom:2%;padding:9px 12px;min-height:60px}#sc-theatre .dialogue p{font-size:12px}}';
  document.head.append(style);
  const overlay=document.createElement('div');overlay.id='sc-theatre';overlay.setAttribute('aria-live','polite');stage.append(overlay);
  const controls=document.createElement('section');controls.className='theatre-controls';
  controls.innerHTML='<h3>Modo Teatro</h3><p class="hint">Palco independente dos tokens no mapa. Escolha qualquer personagem das fichas e arraste a imagem dele pelo palco para definir a posição.</p><div id="sc-theatre-director" class="director-only"><button type="button" class="btn primary" id="sc-theatre-toggle">Abrir palco</button><label for="sc-theatre-actor">Personagem do elenco</label><select id="sc-theatre-actor"></select><button type="button" class="btn" id="sc-theatre-add">+ Colocar no palco</button><h3>Personagens no palco</h3><div id="sc-theatre-cast-list"></div><label for="sc-theatre-speaker">Quem está falando?</label><select id="sc-theatre-speaker"></select><label for="sc-theatre-text">Diálogo ou narração</label><textarea id="sc-theatre-text" maxlength="400" placeholder="Digite a fala..."></textarea><button type="button" class="btn primary" id="sc-theatre-speak">Exibir fala</button><button type="button" class="btn" id="sc-theatre-clear-dialogue">Limpar diálogo</button><button type="button" class="btn" id="sc-theatre-clear">Retirar todos</button></div><p class="hint" id="sc-theatre-viewer-note" hidden>O mestre controla o elenco, as posições e o diálogo para todos.</p>';
  panel.append(controls);
  const $=id=>document.getElementById(id);
  let state={enabled:false,cast:[],speaker:'',dialogue:''},actors=[],adding=false;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const validImage=s=>typeof s==='string'&&(/^https:\/\/[^\s"'<>]{1,1500}$/.test(s)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]{1,100000}$/.test(s));
  function normalize(next){
    const cast=Array.isArray(next?.cast)?next.cast.slice(0,6).filter(x=>x&&typeof x==='object'&&typeof x.id==='string').map(x=>({
      id:x.id.slice(0,100),name:String(x.name||'Shinobi').slice(0,70),
      portrait:validImage(x.portrait)?x.portrait:'',
      x:clamp(Number(x.x)||.5,.08,.92),y:clamp(Number(x.y)||.78,.3,.9)
    })):[];
    return {enabled:!!next?.enabled,cast,speaker:String(next?.speaker||''),dialogue:String(next?.dialogue||'').slice(0,400)};
  }
  function commit(patch){if(!isAdmin())return;state=normalize({...state,...patch});render();void onChange(state)}
  $('sc-theatre-toggle').onclick=()=>commit({enabled:!state.enabled});
  $('sc-theatre-add').onclick=async()=>{
    if(!isAdmin()||adding||state.cast.length>=6)return;
    const id=$('sc-theatre-actor').value;
    if(!id||state.cast.some(x=>x.id===id))return;
    adding=true;$('sc-theatre-add').disabled=true;
    try{
      const found=await resolveActor(id);
      if(!found||!isAdmin())return;
      const count=state.cast.length;
      const actor={id,name:String(found.name||'Shinobi').slice(0,70),portrait:validImage(found.portrait)?found.portrait:'',x:clamp(.24+count*.12,.09,.9),y:.77};
      commit({enabled:true,cast:[...state.cast,actor],speaker:state.speaker||id});
    }catch(e){console.warn('Falha ao inserir retrato no teatro:',e)}
    finally{adding=false;$('sc-theatre-add').disabled=false}
  };
  $('sc-theatre-speak').onclick=()=>commit({enabled:true,speaker:$('sc-theatre-speaker').value,dialogue:$('sc-theatre-text').value});
  $('sc-theatre-clear-dialogue').onclick=()=>commit({dialogue:''});
  $('sc-theatre-clear').onclick=()=>commit({cast:[],speaker:'',dialogue:''});
  function populate(select,options,previous,blank){
    select.replaceChildren();
    if(blank){const opt=document.createElement('option');opt.value='';opt.textContent=blank;select.append(opt)}
    for(const item of options){const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.name;select.append(opt)}
    if(options.some(item=>item.id===previous))select.value=previous;
  }
  function render(){
    $('sc-theatre-director').hidden=!isAdmin();
    $('sc-theatre-viewer-note').hidden=isAdmin();
    $('sc-theatre-toggle').textContent=state.enabled?'Ocultar palco':'Abrir palco';
    $('sc-theatre-add').disabled=!isAdmin()||adding||state.cast.length>=6;
    overlay.classList.toggle('open',state.enabled);
    overlay.classList.toggle('directable',isAdmin());
    const chosenActor=$('sc-theatre-actor').value,chosenSpeaker=$('sc-theatre-speaker').value;
    populate($('sc-theatre-actor'),actors,chosenActor,'Escolha uma ficha');
    populate($('sc-theatre-speaker'),state.cast,chosenSpeaker||state.speaker,'Narrador');
    if(state.cast.some(a=>a.id===state.speaker))$('sc-theatre-speaker').value=state.speaker;
    const castList=$('sc-theatre-cast-list');castList.replaceChildren();
    if(!state.cast.length){const hint=document.createElement('p');hint.textContent='Nenhum retrato no palco.';castList.append(hint)}
    for(const actor of state.cast){
      const row=document.createElement('div');row.className='cast-row';
      const name=document.createElement('span');name.className='name';name.textContent=actor.name;
      const remove=document.createElement('button');remove.textContent='Retirar';remove.onclick=()=>commit({cast:state.cast.filter(a=>a.id!==actor.id),speaker:state.speaker===actor.id?'':state.speaker});
      row.append(name,remove);castList.append(row);
    }
    overlay.replaceChildren();
    if(!state.enabled)return;
    for(let idx=0;idx<state.cast.length;idx++){
      const actor=state.cast[idx];
      const el=document.createElement('div');el.className='stage-character'+(state.speaker===actor.id?' speaking':'');
      el.style.left=(actor.x*100)+'%';el.style.top=(actor.y*100)+'%';el.style.zIndex=String(idx+2);
      el.setAttribute('aria-label',actor.name+' no palco');
      if(validImage(actor.portrait)){
        const img=document.createElement('img');img.src=actor.portrait;img.alt=actor.name;img.draggable=false;el.append(img);
      }else{
        const stand=document.createElement('div');stand.className='stand-in';stand.textContent='忍';el.append(stand);
      }
      const label=document.createElement('span');label.className='nameplate';label.textContent=actor.name;el.append(label);
      if(isAdmin()){
        let drag=null;
        el.addEventListener('pointerdown',e=>{
          if(e.button!==0)return;drag={id:e.pointerId};el.setPointerCapture(e.pointerId);el.classList.add('dragging');
          e.stopPropagation();e.preventDefault();
        });
        el.addEventListener('pointermove',e=>{
          if(!drag||drag.id!==e.pointerId)return;
          const rect=overlay.getBoundingClientRect(),x=clamp((e.clientX-rect.left)/rect.width,.08,.92),y=clamp((e.clientY-rect.top)/rect.height,.3,.9);
          drag.x=x;drag.y=y;el.style.left=(x*100)+'%';el.style.top=(y*100)+'%';
        });
        const finish=e=>{
          if(!drag||drag.id!==e.pointerId)return;
          const pos=drag;drag=null;el.classList.remove('dragging');
          if(pos.x!==undefined)commit({cast:state.cast.map(x=>x.id===actor.id?{...x,x:pos.x,y:pos.y}:x)});
        };
        el.addEventListener('pointerup',finish);el.addEventListener('pointercancel',finish);
      }
      overlay.append(el);
    }
    if(state.dialogue){
      const box=document.createElement('div');box.className='dialogue';
      const name=document.createElement('strong');name.textContent=state.cast.find(x=>x.id===state.speaker)?.name||'Narrador';
      const p=document.createElement('p');p.textContent=state.dialogue;box.append(name,p);overlay.append(box);
    }
  }
  return {
    setState(value){state=normalize(value||{});render()},
    setActors(items){actors=(Array.isArray(items)?items:[]).filter(x=>x&&typeof x.id==='string').map(x=>({id:x.id,name:String(x.name||'Shinobi')}));render()},
    refresh:render
  };
}
