// Shinobi Chronicles · Combat 2.0, Jutsu targeting and visual fog
// Uses only the already-permitted theatre field of the shared room.
export function createBattleSystems({
  getAdmin,getRoom,getSceneId,getRoomData,getSheets,getTokens,getCurrentTurn,
  setCombatTab,focusToken,playEffect,adjustHitPoints,saveFields,notify,redraw,getMap,getCell
}){
  const MAX_FOG=48,MAX_CONDITIONS=8,MAX_DURATION=99;
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
  let conditions={},fogMap={},mode='',selectedSource='',selectedTarget='',selectedCondition='atordoado';
  let chosenJutsu='',actionType='visual',power=4,duration=2,shapeStart=null,shapeEnd=null;
  let busy=false,previewPointer=null;
  const currentScene=()=>getSceneId()||'';
  const canWrite=()=>getAdmin()&&!!getRoom();
  const getRoster=()=>getSheets().filter(x=>typeof x.id==='string'&&x.id);
  const getCurrentFog=()=>fogMap[currentScene()]||{enabled:false,reveals:[]};
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
  function validFog(obj){
    const out={};if(!obj||typeof obj!=='object'||Array.isArray(obj))return out;
    for(const [scene,val] of Object.entries(obj).slice(0,90)){
      if(!scene||scene.length>120||!val||typeof val!=='object')continue;
      const reveals=(Array.isArray(val.reveals)?val.reveals:[]).slice(0,MAX_FOG)
        .filter(r=>[r.x,r.y,r.w,r.h].every(v=>Number.isFinite(Number(v))))
        .map(r=>({
          x:Math.max(0,Math.min(1,Number(r.x))),y:Math.max(0,Math.min(1,Number(r.y))),
          w:Math.max(0,Math.min(1,Number(r.w))),h:Math.max(0,Math.min(1,Number(r.h)))
        })).filter(r=>r.w>.002&&r.h>.002);
      out[scene]={enabled:val.enabled===true,reveals};
    }
    return out;
  }
  function setData(theatre){
    if(!busy){
      conditions=validConditions(theatre?.conditions);
      fogMap=validFog(theatre?.fogMap);
    }
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
  function chooseTarget(id){
    selectedTarget=id;render();
    if(id)focusToken(id);
  }
  function openForToken(id,tab='condition'){
    if(!canWrite())return;
    selectedTarget=id;setCombatTab('combate');
    render();
    requestAnimationFrame(()=>{const element=tab==='jutsu'?jutsuPanel:condPanel;element?.scrollIntoView({block:'nearest',behavior:'smooth'})});
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
    return '<div class="sc-battle-head"><small>CONTROLE DO MESTRE · EXPLORAÇÃO</small><h3>Névoa de guerra</h3>'+
      '<p>Oculte visualmente o mapa dos jogadores e revele regiões retangulares conforme explorarem.</p></div>'+
      '<div class="sc-fog-options"><button id="sc-fog-toggle" type="button" class="sc-battle-submit">'+
        (fog.enabled?'☾ Desativar névoa':'☾ Ocultar todo o mapa')+'</button>'+
      '<button id="sc-fog-reveal" type="button" class="sc-battle-secondary'+(mode==='reveal'?' active':'')+'"'+(!fog.enabled?' disabled':'')+'>'+
        (mode==='reveal'?'Arraste no mapa · ESC cancela':'▤ Revelar região')+'</button>'+
      '<button id="sc-fog-clear" type="button" class="sc-battle-secondary"'+(!fog.enabled||fog.reveals.length===0?' disabled':'')+'>↶ Reocultar regiões</button></div>'+
      '<p class="sc-battle-note">'+(fog.enabled?'Névoa ligada · '+fog.reveals.length+' região(ões) revelada(s).':'Névoa desligada para esta cena.')+
      ' A ocultação é visual, não criptográfica: o navegador ainda recebe o mapa.</p>';
  }
  function render(){
    if(condPanel&&getAdmin())condPanel.innerHTML=conditionsHTML();
    if(jutsuPanel&&getAdmin())jutsuPanel.innerHTML=jutsuHTML();
    if(fogPanel&&getAdmin())fogPanel.innerHTML=fogHTML();
    const active=!!getCurrentFog().enabled&&!!currentScene();
    if(fogIndicator){
      fogIndicator.hidden=!active;
      fogIndicator.textContent=getAdmin()?'☾ Névoa visual ativada':'☾ Área encoberta';
    }
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
    bind('sc-jutsu-map-target','click',()=>{mode=mode==='target'?'':'target';render();redraw()});
    bind('sc-jutsu-cast','click',()=>void cast());
    bind('sc-fog-toggle','click',()=>void setFog({enabled:!getCurrentFog().enabled,reveals:[]}));
    bind('sc-fog-reveal','click',()=>{mode=mode==='reveal'?'':'reveal';render();redraw()});
    bind('sc-fog-clear','click',()=>void setFog({...getCurrentFog(),reveals:[]}));
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
    busy=true;render();
    try{
      if(action==='damage'||action==='heal')await adjustHitPoints(target,action,amount);
      if(action==='condition'){
        const next=[...getConditionList(selectedTarget).filter(c=>c.id!==condition),
          {id:condition,remaining:turns}];
        const all=validConditions({...conditions,[selectedTarget]:next});
        await saveFields({'theatre.conditions':all});conditions=all;
      }
      await playEffect({
        kind:window.SHINOBI_JUTSU_FX?.classify?.(technique)||'chakra',
        name,sourceSheetId:selectedSource,targetSheetId:selectedTarget,
        targetToken:targetToken||null
      });
      notify(name+' → '+(target.nome||target.name)+' · '+(action==='damage'?amount+' de dano':
        action==='heal'?amount+' HP curado':action==='condition'?byId[condition]?.name||'Condição':'efeito visual')+'.');
    }catch(e){notify('Não foi possível executar toda a ação: '+e.message)}
    finally{busy=false;render();redraw()}
  }
  async function setFog(nextFog){
    if(!canWrite()||busy||!currentScene())return;
    const prev=fogMap;
    const next=validFog({...fogMap,[currentScene()]:nextFog});
    busy=true;fogMap=next;render();redraw();
    try{await saveFields({'theatre.fogMap':next});return true}
    catch(error){fogMap=prev;notify('Falha ao salvar a névoa: '+error.message);return false}
    finally{busy=false;render();redraw()}
  }
  function toggleFogMode(){
    if(!getAdmin()||!currentScene())return false;
    if(!getCurrentFog().enabled){notify('Ative a névoa na aba Campanha antes de revelar áreas.');return false}
    mode=mode==='reveal'?'':'reveal';render();redraw();return true;
  }
  function cancel(){if(!mode&&!shapeStart)return false;mode='';shapeStart=null;shapeEnd=null;render();redraw();return true}
  // Coordinates are normalized to the map, never browser pixels.
  function coords(wx,wy){
    const img=getMap();if(!img?.naturalWidth||!img?.naturalHeight)return null;
    return {x:Math.max(0,Math.min(1,wx/img.naturalWidth)),y:Math.max(0,Math.min(1,wy/img.naturalHeight))};
  }
  function pointerDown(wx,wy,token){
    if(mode==='target'){
      if(token?.fichaId){selectedTarget=token.fichaId;mode='';render();focusToken(token.fichaId);redraw()}
      else notify('Clique diretamente em um token para escolher o alvo.');
      return true;
    }
    if(mode!=='reveal')return false;
    const p=coords(wx,wy);if(!p)return true;
    shapeStart=p;shapeEnd=p;redraw();return true;
  }
  function pointerMove(wx,wy){
    if(mode!=='reveal'||!shapeStart)return false;
    shapeEnd=coords(wx,wy)||shapeEnd;redraw();return true;
  }
  async function pointerUp(wx,wy){
    if(mode!=='reveal'||!shapeStart)return false;
    shapeEnd=coords(wx,wy)||shapeEnd;
    const a=shapeStart,b=shapeEnd;
    const box={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)};
    shapeStart=null;shapeEnd=null;
    if(box.w<.002||box.h<.002){notify('Arraste um retângulo para revelar a região.');redraw();return true}
    const current=getCurrentFog();
    if(current.reveals.length>=MAX_FOG){notify('Limite de regiões atingido. Reoculte e redesenhe a cena.');redraw();return true}
    await setFog({...current,enabled:true,reveals:[...current.reveals,box]});return true;
  }
  function tokenVisible(token){
    if(getAdmin())return true;
    const fog=getCurrentFog();
    if(!fog.enabled)return true;
    const img=getMap();
    if(!img?.naturalWidth||!img?.naturalHeight)return false;
    const cell=Math.max(1,Number(getCell())||64);
    const x=(Number(token.x)+.5)*cell/img.naturalWidth;
    const y=(Number(token.y)+.75)*cell/img.naturalHeight;
    return fog.reveals.some(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h);
  }
  function paintFog(ctx,view){
    const fog=getCurrentFog(),img=getMap();if(!fog.enabled||!img?.naturalWidth)return;
    const w=img.naturalWidth,h=img.naturalHeight;
    ctx.save();
    ctx.fillStyle=getAdmin()?'rgba(12,19,14,.46)':'rgba(7,12,9,.99)';
    ctx.beginPath();ctx.rect(0,0,w,h);
    for(const r of fog.reveals)ctx.rect(r.x*w,r.y*h,r.w*w,r.h*h);
    ctx.fill('evenodd');
    if(getAdmin()){
      ctx.lineWidth=1.5/Math.max(.15,view.zoom);ctx.strokeStyle='#e9d4a280';
      ctx.setLineDash([5,6]);
      for(const r of fog.reveals)ctx.strokeRect(r.x*w,r.y*h,r.w*w,r.h*h);
      ctx.setLineDash([]);
    }
    if(getAdmin()&&shapeStart&&shapeEnd){
      const x=Math.min(shapeStart.x,shapeEnd.x)*w,y=Math.min(shapeStart.y,shapeEnd.y)*h;
      const width=Math.abs(shapeStart.x-shapeEnd.x)*w,height=Math.abs(shapeStart.y-shapeEnd.y)*h;
      ctx.strokeStyle='#f7e1a9';ctx.lineWidth=2/Math.max(.15,view.zoom);
      ctx.strokeRect(x,y,width,height);
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
  function isMode(kind){return mode===kind}
  function shortStatus(id){return condNames(id)}
  render();
  return {setData,render,paintFog,tokenVisible,drawTokenMarks,refreshTimelineBadges,
    addCondition,removeCondition,openForToken,setTarget:chooseTarget,
    pointerDown,pointerMove,pointerUp,cancel,toggleFogMode,isMode,shortStatus,
    getCurrentFog,applyRoundTick};
}