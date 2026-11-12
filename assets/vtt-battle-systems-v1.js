// Shinobi Chronicles · Combat 2.0, Jutsu targeting and visual fog
import {createWallTools} from './vtt-walls-v1.js?v=20261112-doors2';
// Uses only the already-permitted theatre field of the shared room.
export function createBattleSystems({
  getAdmin,getUid,getRoom,getSceneId,getRoomData,getSheets,getTokens,getCurrentTurn,
  setCombatTab,focusToken,playEffect,adjustHitPoints,saveFields,notify,redraw,getMap,getCell,getZoom,
  sendDoorRequest
}){
  const MAX_FOG=48,MAX_STROKES=100,MAX_POINTS=100,MAX_CONDITIONS=8,MAX_DURATION=99;
  const CONDITIONS=[
    {id:'atordoado',name:'Atordoado',icon:'✦'},
    {id:'envenenado',name:'Envenenado',icon:'☠'},
    {id:'imobilizado',name:'Imobilizado',icon:'⊗'},
    {id:'inconsciente',name:'Inconsciente',icon:'☾'},
    {id:'queimando',name:'Queimando',icon:'火'},
    {id:'sangrando',name:'Sangrando',icon:'血'},
    {id:'cego',name:'Cego',icon:'◉'},
    {id:'protegido',name:'Protegido',icon:'盾'},
    {id:'oculto',name:'Oculto',icon:'影'}
  ];
  const byId=Object.fromEntries(CONDITIONS.map(x=>[x.id,x]));
  const safeInt=(v,min,max,fallback=min)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Math.round(Number(v)))):fallback;
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const condPanel=document.getElementById('sc-combat-status-panel');
  const jutsuPanel=document.getElementById('sc-jutsu-target-panel');
  const fogPanel=document.getElementById('sc-fog-panel');
  const fogIndicator=document.getElementById('sc-fog-indicator');
  const stage=document.getElementById('stage');
  let conditions={},fogMap={},hiddenTokens=[],mode='',selectedSource='',selectedTarget='',selectedCondition='atordoado';
  let chosenJutsu='',actionType='visual',power=4,duration=2,shapeStart=null,shapeEnd=null;
  let brushPoints=[],brushSize=3,visibilityBusy=false,fogCanvas=null,fogCacheKey='';
  let busy=false,previewPointer=null,lastScene='';
  const currentScene=()=>getSceneId()||'';
  const canWrite=()=>getAdmin()&&!!getRoom();
  const getRoster=()=>getSheets().filter(x=>typeof x.id==='string'&&x.id);
  const getCurrentFog=()=>fogMap[currentScene()]||{enabled:false,reveals:[],strokes:[]};
  const isTokenHidden=id=>hiddenTokens.includes(id);
  const walls=createWallTools({
    getAdmin,getUid,getSceneId,getRoom,getMap,getCell,getZoom,getTokens,isHidden:isTokenHidden,
    saveFields,notify,redraw,sendDoorRequest,
    ensureFog:()=>getCurrentFog().enabled?Promise.resolve(true):
      setFog({...getCurrentFog(),enabled:true}),
    onModeActivated:()=>{mode='';shapeStart=null;shapeEnd=null;brushPoints=[];render()}
  });
  const getConditionList=id=>Array.isArray(conditions[id])?conditions[id]:[];
  const condNames=id=>getConditionList(id).map(x=>byId[x.id]?.name||'').filter(Boolean).join(', ');
  function validConditions(obj){
    const out={};if(!obj||typeof obj!=='object'||Array.isArray(obj))return out;
    for(const [id,list] of Object.entries(obj).slice(0,180)){
      if(typeof id!=='string'||id.length>120||!Array.isArray(list))continue;
      const seen=new Set(),clean=[];
      for(const c of list.slice(0,MAX_CONDITIONS)){
        if(!c||!byId[c.id]||seen.has(c.id))continue;
        seen.add(c.id);
        clean.push({id:c.id,remaining:safeInt(c.remaining,1,MAX_DURATION,1)});
      }
      if(clean.length)out[id]=clean;
    }
    return out;
  }
  const norm=n=>Math.max(0,Math.min(1,Number(n)||0));
  function validFog(obj){
    const out={};if(!obj||typeof obj!=='object'||Array.isArray(obj))return out;
    for(const [scene,val] of Object.entries(obj).slice(0,90)){
      if(typeof scene!=='string'||!scene||scene.length>120||!val||typeof val!=='object')continue;
      const reveals=(Array.isArray(val.reveals)?val.reveals:[]).slice(0,MAX_FOG)
        .filter(r=>r&&[r.x,r.y,r.w,r.h].every(v=>Number.isFinite(Number(v))))
        .map(r=>({x:norm(r.x),y:norm(r.y),w:norm(r.w),h:norm(r.h)}))
        .filter(r=>r.w>.002&&r.h>.002);
      const strokes=(Array.isArray(val.strokes)?val.strokes:[]).slice(-MAX_STROKES).map(v=>{
        if(!v||!['reveal','cover'].includes(v.op))return null;
        if(v.type==='rect'&&[v.x,v.y,v.w,v.h].every(n=>Number.isFinite(Number(n))))
          return {type:'rect',op:v.op,x:norm(v.x),y:norm(v.y),w:norm(v.w),h:norm(v.h)};
        if(v.type==='brush'&&Array.isArray(v.points)){
          const points=v.points.slice(0,MAX_POINTS).filter(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(Number(n))))
            .map(p=>[norm(p[0]),norm(p[1])]);
          if(points.length)return {type:'brush',op:v.op,r:Math.max(.006,Math.min(.12,Number(v.r)||.03)),points};
        }
        return null;
      }).filter(Boolean);
      out[scene]={enabled:val.enabled===true,reveals,strokes};
    }
    return out;
  }
  function setData(theatre){
    const scene=currentScene();
    if(scene!==lastScene){
      lastScene=scene;
      mode='';shapeStart=null;shapeEnd=null;walls.cancel();
    }
    if(!busy){
      conditions=validConditions(theatre?.conditions);
      fogMap=validFog(theatre?.fogMap);
      fogCacheKey='';
    }
    hiddenTokens=Array.isArray(theatre?.hiddenTokens)?[...new Set(theatre.hiddenTokens.filter(x=>typeof x==='string'&&x.length<150))].slice(0,250):[];
    walls.setData(theatre?.wallsMap);
    render();redraw();
  }
  function roundTick(before,next){
    if(!before||!next||!Number.isFinite(+before.round)||!Number.isFinite(+next.round))return null;
    const steps=Math.max(0,Math.min(99,Math.round(Number(next.round)-Number(before.round))));
    if(!steps)return null;
    const updated={};
    for(const [sheetId,list] of Object.entries(conditions)){
      const remaining=list.map(c=>({...c,remaining:c.remaining-steps})).filter(c=>c.remaining>0);
      if(remaining.length)updated[sheetId]=remaining;
    }
    return updated;
  }
  function applyRoundTick(newState){const changes=roundTick(getCurrentTurn(),newState);if(changes){conditions=changes;render();redraw()}return changes}
  async function commitConditions(next){
    if(!canWrite()||busy)return false;
    const before=conditions;conditions=validConditions(next);busy=true;render();redraw();
    try{await saveFields({'theatre.conditions':conditions});notify('Condições atualizadas na campanha.');return true}
    catch(e){conditions=before;notify('Não foi possível salvar as condições: '+e.message);return false}
    finally{busy=false;render();redraw()}
  }

  async function setTokenHidden(id,hide){
    if(!canWrite()||visibilityBusy||!getTokens().some(t=>t.id===id))return false;
    const before=hiddenTokens.slice();
    const next=hide?[...new Set([...before,id])].slice(-250):before.filter(x=>x!==id);
    hiddenTokens=next;visibilityBusy=true;redraw();
    try{await saveFields({'theatre.hiddenTokens':next});return true}
    catch(error){hiddenTokens=before;notify('Não foi possível alterar a visibilidade: '+error.message);return false}
    finally{visibilityBusy=false;redraw()}
  }
  async function toggleTokenHidden(id){return setTokenHidden(id,!isTokenHidden(id))}
  function chooseTarget(id){
    selectedTarget=id;render();
    if(id)focusToken(id);
  }
  function openForToken(id,tab='condition'){
    if(!canWrite())return;
    if(tab==='jutsu'){
      selectedSource=id;
      chosenJutsu='';
    }else selectedTarget=id;
    setCombatTab('combate');
    render();
    requestAnimationFrame(()=>{
      const element=tab==='jutsu'||tab==='target'?jutsuPanel:condPanel;
      element?.scrollIntoView({block:'nearest',behavior:'smooth'});
    });
  }
  function addCondition(id,condition,turns){
    const list=getConditionList(id).filter(c=>c.id!==condition);
    return commitConditions({...conditions,[id]:[...list,{id:condition,remaining:safeInt(turns,1,MAX_DURATION,1)}]});
  }
  function removeCondition(id,condition){
    const list=getConditionList(id).filter(c=>c.id!==condition);
    const next={...conditions};if(list.length)next[id]=list;else delete next[id];
    return commitConditions(next);
  }
  const photo=f=>{
    const src=f?.retratos?.ninja||f?.retratos?.casual||f?.foto||'';
    if(typeof src==='string'&&/^https:\/\/[^\s"'<>]+$/i.test(src)&&src.length<1500)return '<img alt="" src="'+escape(src)+'" loading="lazy">';
    return '<span aria-hidden="true">忍</span>';
  };
  function options(selected=''){
    return '<option value="">Escolher personagem</option>'+getRoster().map(f=>
      '<option value="'+escape(f.id)+'"'+(f.id===selected?' selected':'')+'>'+escape(f.nome||f.name||'Shinobi')+'</option>').join('');
  }
  function conditionsHTML(){
    if(!getAdmin())return '';
    const selected=getRoster().find(f=>f.id===selectedTarget);
    const current=selected?getConditionList(selected.id):[];
    return '<div class="sc-battle-head"><small>01 · ESTADOS DO COMBATE</small><h3>Condições & duração</h3>'+
      '<p>Marcadores sincronizados sobre os tokens. A duração diminui a cada rodada concluída.</p></div>'+
      '<label class="sc-battle-field">Personagem<select id="sc-condition-target">'+options(selectedTarget)+'</select></label>'+
      '<div class="sc-condition-current">'+(selected?
        (current.length?current.map(c=>'<div class="sc-condition-chip" title="'+escape(byId[c.id].name)+'"><span>'+byId[c.id].icon+'</span><b>'+byId[c.id].name+'</b><small>'+c.remaining+' rod.</small>'+
        '<button type="button" data-sc-cond-remove="'+escape(c.id)+'" aria-label="Remover '+escape(byId[c.id].name)+'">×</button></div>').join(''):
        '<p class="sc-battle-empty">Sem condições aplicadas.</p>'):
        '<p class="sc-battle-empty">Selecione uma ficha para gerenciar as condições.</p>')+'</div>'+
      '<div class="sc-battle-fields"><label class="sc-battle-field">Condição<select id="sc-condition-kind">'+CONDITIONS.map(c=>
        '<option value="'+c.id+'"'+(selectedCondition===c.id?' selected':'')+'>'+c.icon+' '+c.name+'</option>').join('')+
        '</select></label><label class="sc-battle-field small">Rodadas<input id="sc-condition-rounds" type="number" min="1" max="99" value="'+duration+'"></label></div>'+
      '<button class="sc-battle-submit" id="sc-condition-apply" type="button"'+(!selected||busy?' disabled':'')+'>+ Aplicar condição</button>';
  }
  function jutsuHTML(){
    if(!getAdmin())return '';
    const source=getRoster().find(f=>f.id===selectedSource);
    const target=getRoster().find(f=>f.id===selectedTarget);
    const techniques=[...(source?.jutsus||[]),...(source?.poderes||[])].filter(j=>j?.nome?.trim()).slice(0,90);
    if(chosenJutsu&&!techniques.some(j=>j.nome===chosenJutsu))chosenJutsu='';
    return '<div class="sc-battle-head"><small>02 · ARTE NINJA</small><h3>Jutsus no mapa</h3>'+
      '<p>Escolha a técnica, depois o alvo. Dano ou cura só serão aplicados após confirmar.</p></div>'+
      '<label class="sc-battle-field">Conjurador<select id="sc-jutsu-source">'+options(selectedSource)+'</select></label>'+
      '<label class="sc-battle-field">Técnica<select id="sc-jutsu-kind"><option value="">Escolha um jutsu</option>'+
        techniques.map((j,i)=>'<option value="'+i+'"'+(j.nome===chosenJutsu?' selected':'')+'>'+escape(j.nome)+'</option>').join('')+'</select></label>'+
      '<label class="sc-battle-field">Alvo<select id="sc-jutsu-target">'+options(selectedTarget)+'</select></label>'+
      '<button class="sc-battle-secondary" id="sc-jutsu-map-target" type="button"'+(!source||busy?' disabled':'')+'>'+
        (mode==='target'?'Clique no token de destino · ESC cancela':'◎ Escolher alvo clicando no mapa')+'</button>'+
      '<div class="sc-battle-fields"><label class="sc-battle-field">Resultado<select id="sc-jutsu-action">'+
        [['visual','Somente efeito visual'],['damage','Aplicar dano ao HP'],['heal','Recuperar HP'],['condition','Aplicar condição']].map(([v,label])=>
          '<option value="'+v+'"'+(v===actionType?' selected':'')+'>'+label+'</option>').join('')+
        '</select></label>'+
        (actionType==='damage'||actionType==='heal'?'<label class="sc-battle-field small">Pontos<input type="number" min="1" max="999" id="sc-jutsu-value" value="'+power+'"></label>':
        actionType==='condition'?'<label class="sc-battle-field small">Rodadas<input type="number" min="1" max="99" id="sc-jutsu-rounds" value="'+duration+'"></label>':'')+
      '</div>'+
      (actionType==='condition'?'<label class="sc-battle-field">Condição<select id="sc-jutsu-condition">'+CONDITIONS.map(c=>
        '<option value="'+c.id+'"'+(selectedCondition===c.id?' selected':'')+'>'+escape(c.name)+'</option>').join('')+'</select></label>':'')+
      '<button class="sc-battle-submit" id="sc-jutsu-cast" type="button"'+(!source||!chosenJutsu||!target||busy?' disabled':'')+'>'+
        '✦ Executar jutsu no alvo</button>'+
      '<p class="sc-battle-note">O mestre confirma os efeitos. O custo de Chakra não é descontado automaticamente nesta ferramenta.</p>';
  }
  function fogHTML(){
    if(!getAdmin())return '';
    const fog=getCurrentFog();
    const count=(fog.reveals?.length||0)+(fog.strokes?.length||0);
    const active=mode==='reveal'||mode==='brush-reveal'||mode==='brush-cover';
    return '<div class="sc-battle-head"><small>CONTROLE DO MESTRE · EXPLORAÇÃO</small><h3>Névoa de guerra</h3>'+
      '<p>Revele corredores com o pincel ou marque cômodos com um retângulo. Reoculte áreas sem apagar o restante da exploração.</p></div>'+
      '<div class="sc-fog-options"><button id="sc-fog-toggle" type="button" class="sc-battle-submit">'+
        (fog.enabled?'☾ Desativar névoa':'☾ Encobrir mapa')+'</button>'+
      '<button id="sc-fog-reveal" type="button" class="sc-battle-secondary'+(mode==='reveal'?' active':'')+'"'+(!fog.enabled?' disabled':'')+'>▤ Retângulo</button>'+
      '<button id="sc-fog-brush-reveal" type="button" class="sc-battle-secondary'+(mode==='brush-reveal'?' active':'')+'"'+(!fog.enabled?' disabled':'')+'>✎ Pincel revelar</button>'+
      '<button id="sc-fog-brush-cover" type="button" class="sc-battle-secondary'+(mode==='brush-cover'?' active':'')+'"'+(!fog.enabled?' disabled':'')+'>◼ Pincel ocultar</button></div>'+
      '<label class="sc-fog-brush-size">Tamanho do pincel <input id="sc-fog-brush-size" type="range" min="1" max="10" step="1" value="'+brushSize+'"><b>'+brushSize+'%</b></label>'+
      '<div class="sc-fog-options secondary"><button id="sc-fog-undo" type="button" class="sc-battle-secondary"'+(!count?' disabled':'')+'>↶ Desfazer última área</button>'+
      '<button id="sc-fog-clear" type="button" class="sc-battle-secondary"'+(!count?' disabled':'')+'>✕ Reocultar tudo</button></div>'+
      '<p class="sc-battle-note">'+(fog.enabled?'Névoa ativa · '+count+' marca(s) aplicadas. '+(active?'Arraste sobre o mapa. Esc cancela.':'Escolha uma ferramenta para pintar.'):'Névoa desligada.')+
      ' '+(walls.visionActive()?'Visão dinâmica ligada: paredes prevalecem sobre revelações manuais.':'')+
      ' Ocultação visual: o navegador ainda recebe o arquivo do mapa.</p>';
  }
  function render(){
    if(condPanel&&getAdmin())condPanel.innerHTML=conditionsHTML();
    if(jutsuPanel&&getAdmin())jutsuPanel.innerHTML=jutsuHTML();
    if(fogPanel&&getAdmin()){fogPanel.innerHTML=fogHTML()+'<div id="sc-walls-container">'+walls.panelHTML()+'</div>';walls.bind()}
    const active=!!getCurrentFog().enabled&&!!currentScene();
    if(fogIndicator){
      fogIndicator.hidden=!active;
      fogIndicator.textContent=getAdmin()?'☾ Névoa visual ativada':'☾ Área encoberta';
    }
    stage?.classList.toggle('sc-battle-target',mode==='target');
    stage?.classList.toggle('sc-battle-fog',['reveal','brush-reveal','brush-cover'].includes(mode));
    stage?.classList.toggle('sc-battle-walls',walls.active());
    refreshTimelineBadges();
    if(!getAdmin())return;
    const bind=(id,event,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener(event,fn)};
    bind('sc-condition-target','change',e=>{selectedTarget=e.target.value;render()});
    bind('sc-condition-kind','change',e=>{selectedCondition=e.target.value});
    bind('sc-condition-rounds','change',e=>{duration=safeInt(e.target.value,1,MAX_DURATION,1)});
    bind('sc-condition-apply','click',()=>void addCondition(selectedTarget,selectedCondition,
      document.getElementById('sc-condition-rounds')?.value||duration));
    condPanel?.querySelectorAll('[data-sc-cond-remove]').forEach(el=>el.onclick=()=>void removeCondition(selectedTarget,el.dataset.scCondRemove));
    bind('sc-jutsu-source','change',e=>{selectedSource=e.target.value;chosenJutsu='';render()});
    bind('sc-jutsu-kind','change',e=>{
      const f=getRoster().find(f=>f.id===selectedSource);
      const techniques=[...(f?.jutsus||[]),...(f?.poderes||[])].filter(j=>j?.nome?.trim()).slice(0,90);
      chosenJutsu=techniques[Number(e.target.value)]?.nome||'';render();
    });
    bind('sc-jutsu-target','change',e=>{chooseTarget(e.target.value)});
    bind('sc-jutsu-action','change',e=>{actionType=e.target.value;render()});
    bind('sc-jutsu-value','change',e=>{power=safeInt(e.target.value,1,999,1)});
    bind('sc-jutsu-rounds','change',e=>{duration=safeInt(e.target.value,1,MAX_DURATION,1)});
    bind('sc-jutsu-condition','change',e=>{selectedCondition=e.target.value});
    bind('sc-jutsu-map-target','click',()=>{walls.cancel();mode=mode==='target'?'':'target';render();redraw()});
    bind('sc-jutsu-cast','click',()=>void cast());
    bind('sc-fog-toggle','click',()=>void setFog({...getCurrentFog(),enabled:!getCurrentFog().enabled}));
    for(const [id,kind] of [['sc-fog-reveal','reveal'],['sc-fog-brush-reveal','brush-reveal'],['sc-fog-brush-cover','brush-cover']]){
      bind(id,'click',()=>{walls.cancel();mode=mode===kind?'':kind;shapeStart=null;brushPoints=[];render();redraw()});
    }
    bind('sc-fog-brush-size','input',event=>{
      brushSize=safeInt(event.target.value,1,10,3);
      const caption=event.target.parentElement?.querySelector('b');if(caption)caption.textContent=brushSize+'%';
    });
    bind('sc-fog-clear','click',()=>void setFog({...getCurrentFog(),reveals:[],strokes:[]}));
    bind('sc-fog-undo','click',()=>{
      const fog=getCurrentFog();
      if(fog.strokes?.length)void setFog({...fog,strokes:fog.strokes.slice(0,-1)});
      else if(fog.reveals?.length)void setFog({...fog,reveals:fog.reveals.slice(0,-1)});
    });
  }
  async function cast(){
    if(!canWrite()||busy||!chosenJutsu||!selectedSource||!selectedTarget)return;
    const f=getRoster().find(f=>f.id===selectedSource),target=getRoster().find(f=>f.id===selectedTarget);
    if(!f||!target)return notify('Selecione personagens válidos.');
    const technique=[...(f.jutsus||[]),...(f.poderes||[])].find(x=>x?.nome===chosenJutsu);
    if(!technique)return notify('Técnica não encontrada na ficha.');
    const name=chosenJutsu,action=actionType;
    const amount=safeInt(document.getElementById('sc-jutsu-value')?.value||power,1,999,1);
    const turns=safeInt(document.getElementById('sc-jutsu-rounds')?.value||duration,1,99,1);
    const condition=document.getElementById('sc-jutsu-condition')?.value||selectedCondition;
    const targetToken=getTokens().find(t=>t.fichaId===selectedTarget);
    busy=true;render();let resourceChanged=false;
    try{
      if(action==='damage'||action==='heal'){
        await adjustHitPoints(target,action,amount);resourceChanged=true;
      }
      if(action==='condition'){
        const next=[...getConditionList(selectedTarget).filter(c=>c.id!==condition),
          {id:condition,remaining:turns}];
        const all=validConditions({...conditions,[selectedTarget]:next});
        await saveFields({'theatre.conditions':all});conditions=all;resourceChanged=true;
      }
      await playEffect({
        kind:window.SHINOBI_JUTSU_FX?.classify?.(technique)||'chakra',
        name,sourceSheetId:selectedSource,targetSheetId:selectedTarget,
        targetToken:targetToken||null
      });
      notify(name+' → '+(target.nome||target.name)+' · '+(action==='damage'?amount+' de dano':
        action==='heal'?amount+' HP curado':action==='condition'?byId[condition]?.name||'Condição':'efeito visual')+'.');
    }catch(e){
      notify((resourceChanged?'Efeito na ficha salvo, mas a animação não foi compartilhada: ':
        'Não foi possível concluir a ação: ')+e.message);
    }finally{busy=false;render();redraw()}
  }
  async function setFog(nextFog){
    if(!canWrite()||busy||!currentScene())return;
    const prev=fogMap;
    const next=validFog({...fogMap,[currentScene()]:nextFog});
    busy=true;fogMap=next;fogCacheKey='';render();redraw();
    try{await saveFields({'theatre.fogMap':next});return true}
    catch(error){fogMap=prev;fogCacheKey='';notify('Falha ao salvar a névoa: '+error.message);return false}
    finally{busy=false;render();redraw()}
  }
  function toggleFogMode(){
    if(!getAdmin()||!currentScene())return false;
    if(!getCurrentFog().enabled){notify('Ative a névoa na aba Campanha antes de revelar áreas.');return false}
    walls.cancel();mode=mode==='reveal'?'':'reveal';shapeStart=null;brushPoints=[];render();redraw();return true;
  }
  function cancel(){const active=!!mode||!!shapeStart||!!brushPoints.length||walls.active();if(!active)return false;mode='';shapeStart=null;shapeEnd=null;brushPoints=[];walls.cancel();render();redraw();return true}
  // Coordinates are normalized to the map, never browser pixels.
  function coords(wx,wy){
    const img=getMap();if(!img?.naturalWidth||!img?.naturalHeight)return null;
    return {x:Math.max(0,Math.min(1,wx/img.naturalWidth)),y:Math.max(0,Math.min(1,wy/img.naturalHeight))};
  }
  function pointerDown(wx,wy,token){
    if(walls.active())return walls.pointerDown(wx,wy);
    if(mode==='target'){
      if(token?.fichaId){selectedTarget=token.fichaId;mode='';render();focusToken(token.fichaId);redraw()}
      else notify('Clique diretamente em um token para escolher o alvo.');
      return true;
    }
    if(!['reveal','brush-reveal','brush-cover'].includes(mode))return false;
    const p=coords(wx,wy);if(!p)return true;
    shapeStart=p;shapeEnd=p;
    brushPoints=mode==='reveal'?[]:[[p.x,p.y]];
    redraw();return true;
  }
  function pointerMove(wx,wy){
    if(walls.active())return walls.pointerMove(wx,wy);
    if(!shapeStart||!['reveal','brush-reveal','brush-cover'].includes(mode))return false;
    const p=coords(wx,wy);if(!p)return true;
    shapeEnd=p;
    if(mode!=='reveal'&&brushPoints.length<MAX_POINTS){
      const last=brushPoints[brushPoints.length-1];
      if(!last||Math.hypot(last[0]-p.x,last[1]-p.y)>.0016)brushPoints.push([p.x,p.y]);
    }
    return true;
  }
  async function pointerUp(wx,wy){
    if(walls.active())return walls.pointerUp(wx,wy);
    if(!shapeStart||!['reveal','brush-reveal','brush-cover'].includes(mode))return false;
    const p=coords(wx,wy)||shapeEnd||shapeStart;
    const old=shapeStart,kind=mode;
    const points=brushPoints.slice();
    shapeStart=null;shapeEnd=null;brushPoints=[];
    const fog=getCurrentFog();
    const strokes=[...(fog.strokes||[])];
    if(strokes.length>=MAX_STROKES){notify('Limite de áreas atingido. Use desfazer ou reocultar tudo.');redraw();return true}
    if(kind==='reveal'){
      const item={type:'rect',op:'reveal',x:Math.min(old.x,p.x),y:Math.min(old.y,p.y),
        w:Math.abs(old.x-p.x),h:Math.abs(old.y-p.y)};
      if(item.w<.002||item.h<.002){notify('Arraste para marcar uma área do mapa.');redraw();return true}
      strokes.push(item);
    }else{
      const final=points[points.length-1];
      if(points.length<MAX_POINTS&&(!final||Math.hypot(final[0]-p.x,final[1]-p.y)>.001))points.push([p.x,p.y]);
      strokes.push({type:'brush',op:kind==='brush-cover'?'cover':'reveal',r:brushSize/100,points});
    }
    await setFog({...fog,enabled:true,strokes});return true;
  }
  function brushHits(stroke,px,py,w,h){
    const points=stroke.points||[];
    if(!points.length)return false;
    const radius=Math.max(1,stroke.r*Math.min(w,h));
    const segmentDistance=(a,b)=>{
      const ax=a[0]*w,ay=a[1]*h,bx=b[0]*w,by=b[1]*h;
      const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
      const t=l2?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/l2)):0;
      return Math.hypot(px-ax-t*dx,py-ay-t*dy);
    };
    if(points.length===1)return Math.hypot(px-points[0][0]*w,py-points[0][1]*h)<=radius;
    for(let i=1;i<points.length;i++)if(segmentDistance(points[i-1],points[i])<=radius)return true;
    return false;
  }
  function isRevealed(token){
    if(isTokenHidden(token.id))return false;
    const fog=getCurrentFog();
    if(!fog.enabled)return true;
    const img=getMap();
    if(!img?.naturalWidth||!img?.naturalHeight)return false;
    const cell=Math.max(1,Number(getCell())||64),w=img.naturalWidth,h=img.naturalHeight;
    const px=(Number(token.x)+.5)*cell,py=(Number(token.y)+.75)*cell;
    let lastPaint=null;
    let visible=fog.reveals.some(r=>px>=r.x*w&&px<=(r.x+r.w)*w&&py>=r.y*h&&py<=(r.y+r.h)*h);
    for(const op of fog.strokes||[]){
      const inside=op.type==='rect'?
        (px>=op.x*w&&px<=(op.x+op.w)*w&&py>=op.y*h&&py<=(op.y+op.h)*h):
        brushHits(op,px,py,w,h);
      if(inside){visible=op.op==='reveal';lastPaint=op.op}
    }
    if(lastPaint==='cover')return false;
    // Revelações manuais nunca atravessam paredes com visão dinâmica ativa.
    if(walls.visionActive())return walls.visibleAtWorld(px,py);
    return visible;
  }
  function tokenVisible(token){return getAdmin()||isRevealed(token)}
  // The fog mask is composited separately, avoiding destination-out on the real
  // map canvas (which would destroy map pixels and token transparency).
  function buildFogMask(fog,w,h){
    const ratio=Math.min(1,1500/w,1500/h);
    const cw=Math.max(1,Math.round(w*ratio)),ch=Math.max(1,Math.round(h*ratio));
    if(!fogCanvas)fogCanvas=document.createElement('canvas');
    if(fogCanvas.width!==cw||fogCanvas.height!==ch){fogCanvas.width=cw;fogCanvas.height=ch}
    const c=fogCanvas.getContext('2d',{alpha:true});
    if(!c)return;
    c.clearRect(0,0,cw,ch);
    const color=getAdmin()?'rgba(13,23,22,.48)':'rgba(5,12,16,.985)';
    c.fillStyle=color;c.fillRect(0,0,cw,ch);
    const use=(op)=>{
      c.save();
      c.globalCompositeOperation=op.op==='cover'?'source-over':'destination-out';
      c.fillStyle=op.op==='cover'?color:'#fff';
      c.strokeStyle=op.op==='cover'?color:'#fff';
      if(op.type==='rect'){
        c.fillRect(op.x*cw,op.y*ch,op.w*cw,op.h*ch);
      }else if(op.type==='brush'&&op.points?.length){
        const pts=op.points;
        const radius=Math.max(1,op.r*Math.min(cw,ch));
        c.lineWidth=radius*2;c.lineCap='round';c.lineJoin='round';
        c.beginPath();
        c.moveTo(pts[0][0]*cw,pts[0][1]*ch);
        for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0]*cw,pts[i][1]*ch);
        c.stroke();
        c.beginPath();c.arc(pts[0][0]*cw,pts[0][1]*ch,radius,0,Math.PI*2);c.fill();
      }
      c.restore();
    };
    if(!getAdmin()&&walls.visionActive()){
      // A geometria dos segmentos define o campo de visão; revelações do pincel
      // não perfuram paredes. O mestre ainda pode cobrir áreas específicas.
      walls.cutVision(c,cw,ch,w,h);
      for(const op of fog.strokes||[])if(op.op==='cover')use(op);
    }else{
      for(const r of fog.reveals)use({...r,op:'reveal',type:'rect'});
      for(const op of fog.strokes||[])use(op);
    }
  }
  function paintFog(ctx,view){
    const fog=getCurrentFog(),img=getMap();
    if(!fog.enabled||!img?.naturalWidth||!img?.naturalHeight)return;
    const w=img.naturalWidth,h=img.naturalHeight;
    const signature=[currentScene(),w,h,getAdmin()?'master':'player',JSON.stringify(fog),walls.signature()].join('|');
    if(!fogCanvas||fogCacheKey!==signature){
      buildFogMask(fog,w,h);fogCacheKey=signature;
    }
    ctx.save();
    if(fogCanvas)ctx.drawImage(fogCanvas,0,0,w,h);
    if(getAdmin()){
      const scale=Math.max(.15,view.zoom);
      ctx.strokeStyle='rgba(222,199,147,.55)';
      ctx.lineWidth=1.4/scale;ctx.setLineDash([5/scale,6/scale]);
      for(const r of fog.reveals)ctx.strokeRect(r.x*w,r.y*h,r.w*w,r.h*h);
      for(const op of fog.strokes||[])if(op.type==='rect'){
        ctx.strokeStyle=op.op==='cover'?'rgba(223,125,116,.6)':'rgba(221,202,160,.62)';
        ctx.strokeRect(op.x*w,op.y*h,op.w*w,op.h*h);
      }
      ctx.setLineDash([]);
      if(shapeStart){
        if(mode==='reveal'&&shapeEnd){
          const x=Math.min(shapeStart.x,shapeEnd.x)*w,y=Math.min(shapeStart.y,shapeEnd.y)*h;
          ctx.strokeStyle='rgba(244,219,166,.95)';ctx.lineWidth=2/scale;
          ctx.strokeRect(x,y,Math.abs(shapeStart.x-shapeEnd.x)*w,Math.abs(shapeStart.y-shapeEnd.y)*h);
        }else if(brushPoints.length){
          const radius=brushSize/100*Math.min(w,h);
          ctx.strokeStyle=mode==='brush-cover'?'rgba(255,136,128,.94)':'rgba(169,247,198,.92)';
          ctx.lineWidth=radius*2;ctx.lineCap='round';ctx.lineJoin='round';
          ctx.globalAlpha=.48;
          ctx.beginPath();ctx.moveTo(brushPoints[0][0]*w,brushPoints[0][1]*h);
          for(let i=1;i<brushPoints.length;i++)ctx.lineTo(brushPoints[i][0]*w,brushPoints[i][1]*h);
          ctx.stroke();
          ctx.globalAlpha=1;
        }
      }
    }
    ctx.restore();
  }
  function drawTokenMarks(ctx,token,view,bounds){
    const list=getConditionList(token.fichaId).slice(0,3);
    if(!list.length)return;
    const x=bounds.left+bounds.width*.5,y=bounds.top-12/Math.max(.15,view.zoom);
    const px=18/Math.max(.15,view.zoom);
    ctx.save();
    ctx.textAlign='center';ctx.textBaseline='middle';
    for(let i=0;i<list.length;i++){
      const cx=x+(i-(list.length-1)/2)*px*1.2;
      ctx.beginPath();ctx.fillStyle='#1c2920ef';ctx.strokeStyle='#d8bb85';
      ctx.lineWidth=1/Math.max(.15,view.zoom);ctx.arc(cx,y,px*.55,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.font=(px*.82)+'px Georgia,serif';ctx.fillStyle='#f7e0b5';ctx.fillText(byId[list[i].id].icon,cx,y);
    }
    ctx.restore();
  }
  function refreshTimelineBadges(){
    const cards=document.querySelectorAll('#sc-turn-strip [data-sc-turn-id]');
    cards.forEach(card=>{
      const list=getConditionList(card.dataset.scTurnId);
      let badge=card.querySelector('.sc-turn-conditions');
      if(!list.length){badge?.remove();return}
      if(!badge){badge=document.createElement('span');badge.className='sc-turn-conditions';card.append(badge)}
      badge.textContent=list.slice(0,2).map(x=>byId[x.id]?.icon||'').join('');
      badge.title=condNames(card.dataset.scTurnId);
    });
  }
  function isMode(kind){return mode===kind||(kind==='wall-draw'&&walls.activeDraw())||(kind==='wall-select'&&walls.activeSelect())}
  function shortStatus(id){return condNames(id)}
  render();
  return {setData,render,paintFog,tokenVisible,drawTokenMarks,refreshTimelineBadges,
    addCondition,removeCondition,openForToken,setTarget:chooseTarget,
    pointerDown,pointerMove,pointerUp,cancel,toggleFogMode,isMode,shortStatus,
    getCurrentFog,applyRoundTick,getConditionList,setTokenHidden,toggleTokenHidden,isTokenHidden,isRevealed,
    drawWalls:(ctx,view)=>walls.draw(ctx,view),blocksMovement:walls.moveBlocked,
    doorHint:walls.doorHint,toggleDoorAt:walls.toggleDoorAt};
}