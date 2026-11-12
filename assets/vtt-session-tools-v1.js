// Shinobi Chronicles — extensões da mesa (teste coletivo, combate assistido e cena).
// Usa somente eventos "message"/"roll"/"effect" já existentes: nenhuma coleção nova.
import {makeDicePayload,rollForSheet} from './vtt-rolls-v4.js?v=20261111-session5';
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeN=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Math.round(Number(value)):min));
const safeId=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{6,30}$/.test(s);
const SYS_SCENE='@SC:A:',SYS_FX='@SC:FX:';
const PRESETS={none:'Sem efeito',rain:'Chuva',storm:'Tempestade',mist:'Névoa',night:'Noite',chakra:'Chakra'};
const CUES={shake:'Tremor',flash:'Relâmpago',pulse:'Pulso de chakra',transition:'Transição'};
const CND=[['','Sem condição'],['atordoado','Atordoado'],['imobilizado','Imobilizado'],['envenenado','Envenenado'],['inconsciente','Inconsciente'],['queimando','Queimando'],['sangrando','Sangrando'],['cego','Cego']];
const stamp=d=>d?.at?.toMillis?.()||((d?.at?.seconds||0)*1000)||0;
function payloadFromText(text,prefix){
  if(typeof text!=='string'||!text.startsWith(prefix)||text.length>500)return null;
  try{const result=JSON.parse(text.slice(prefix.length));return result&&typeof result==='object'&&!Array.isArray(result)?result:null}catch{return null}
}
const makeId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
function makeOptions(values,selected=''){
  return values.map(([value,name])=>'<option value="'+escapeHTML(value)+'"'+(value===selected?' selected':'')+'>'+escapeHTML(name)+'</option>').join('');
}
export function createSessionTools({
  combatPanel,scenePanel,stage,getUid,getAdmin,getSheets,getSceneId,getRoomData,getMasterUid,
  send,applyResources,applyCondition,playEffect,notify
}){
  let publicEvents=[],busyCombat=false,busyScene=false;
  let selectedMode='none',lastAmbienceKey='',previousScene='',lastComparison=null;
  const seenCues=new Set();
  const $=id=>document.getElementById(id);
  const roster=()=>getSheets().filter(f=>typeof f?.id==='string'&&f.id);
  const authorized=d=>{const master=getMasterUid();return !master||d.uid===master;};
  const canEdit=()=>getAdmin()&&!!getUid()&&!!getRoomData();
  const addNote=async (prefix,data)=>{
    const text=prefix+JSON.stringify(data);
    if(text.length>395)throw Error('Solicitação longa demais. Selecione menos participantes.');
    await send('message',{text,character:'Mestre'});
  };

  // Confronto assistido: automatiza cálculos conhecidos da ficha, mas não supõe dano
  // pelo sistema de regras. HP, Chakra e condições exigem confirmação do mestre.
  combatPanel.innerHTML='<section class="sc-tool-card" aria-label="Combate assistido">'+
    '<div class="sc-tool-head"><strong>Combate assistido</strong><small>FICHAS INTEGRADAS</small></div>'+
    '<p>Escolha atacante e alvo para rolar os dois testes. Confirme o dano e o Chakra manualmente.</p>'+
    '<label class="sc-tool-field">Atacante<select id="sc-smart-attacker"></select></label>'+
    '<label class="sc-tool-field">Defensor<select id="sc-smart-defender"></select></label>'+
    '<div class="sc-tool-fields"><label class="sc-tool-field">Ataque<select id="sc-smart-attack">'+makeOptions([['CC','Corporal'],['CD','À distância']])+'</select></label>'+
    '<label class="sc-tool-field">Defesa<select id="sc-smart-defense">'+makeOptions([['ESQ','Esquiva'],['LM','Ler movimento']])+'</select></label></div>'+
    '<button type="button" class="sc-tool-btn" id="sc-smart-roll">⚄ Rolar confronto</button>'+
    '<div class="sc-tool-outcome" id="sc-smart-outcome" role="status"></div><hr class="sc-tool-divider">'+
    '<div class="sc-tool-fields"><label class="sc-tool-field">Dano ao HP<input id="sc-smart-damage" type="number" min="0" max="999" value="0"></label>'+
    '<label class="sc-tool-field">Custo de Chakra<input id="sc-smart-chakra" type="number" min="0" max="999" value="0"></label></div>'+
    '<label class="sc-tool-field">Condição opcional<select id="sc-smart-condition">'+makeOptions(CND)+'</select></label>'+
    '<div class="sc-tool-actions"><button type="button" class="sc-tool-btn" id="sc-smart-apply">Aplicar recursos</button>'+
    '<button type="button" class="sc-tool-btn secondary" id="sc-smart-effect">✦ Efeito no mapa</button></div>'+
    '<p class="sc-tool-hint">Um resultado alto é apenas uma comparação sugerida. Os valores de dano e Chakra não são calculados automaticamente.</p></section>';
  let lastRosterKey='';
  function refreshCombatRoster(){
    combatPanel.hidden=!canEdit();
    if(!canEdit())return;
    const people=roster().slice(0,180);
    const key=people.map(f=>f.id+':'+(f.nome||'')).join('|');
    if(key===lastRosterKey)return;
    lastRosterKey=key;
    for(const elId of ['sc-smart-attacker','sc-smart-defender']){
      const target=$(elId),prev=target.value;
      target.innerHTML=people.map(f=>'<option value="'+escapeHTML(f.id)+'">'+escapeHTML(f.nome||f.name||'Shinobi')+'</option>').join('');
      if(people.some(f=>f.id===prev))target.value=prev;
      else if(elId==='sc-smart-defender'&&people.length>1)target.selectedIndex=1;
    }
  }
  $('sc-smart-roll').onclick=async()=>{
    if(!canEdit()||busyCombat)return;
    const a=roster().find(f=>f.id===$('sc-smart-attacker').value);
    const d=roster().find(f=>f.id===$('sc-smart-defender').value);
    if(!a||!d)return notify('Escolha atacante e defensor.');
    const ar=rollForSheet(a,$('sc-smart-attack').value);
    const dr=rollForSheet(d,$('sc-smart-defense').value);
    if(!ar||!dr||ar.error||dr.error)return notify(ar?.error||dr?.error||'Teste não disponível.');
    busyCombat=true;$('sc-smart-roll').disabled=true;
    try{
      const attack=makeDicePayload(ar.dice,ar.bonus,'Ataque · '+(a.nome||'Shinobi'),a.nome||'Shinobi');
      const defense=makeDicePayload(dr.dice,dr.bonus,'Defesa · '+(d.nome||'Shinobi'),d.nome||'Shinobi');
      await Promise.all([send('roll',attack),send('roll',defense)]);
      const suggested=attack.total>defense.total?'Ataque superior':'Defesa igualou ou superou o ataque';
      $('sc-smart-outcome').textContent=(a.nome||'Atacante')+': '+attack.total+' ('+ar.dice+' + '+attack.bonus+')\n'+
        (d.nome||'Defensor')+': '+defense.total+' ('+dr.dice+' + '+defense.bonus+')\n'+suggested+' · confirme os efeitos conforme as regras.';
      lastComparison={source:a.id,target:d.id,attack:attack.total,defense:defense.total};
    }catch(error){notify('Falha na rolagem do confronto: '+error.message)}
    finally{busyCombat=false;$('sc-smart-roll').disabled=false}
  };
  $('sc-smart-apply').onclick=async()=>{
    if(!canEdit()||busyCombat)return;
    const a=roster().find(f=>f.id===$('sc-smart-attacker').value);
    const d=roster().find(f=>f.id===$('sc-smart-defender').value);
    const damage=safeN($('sc-smart-damage').value,0,999),chakra=safeN($('sc-smart-chakra').value,0,999);
    const cond=$('sc-smart-condition').value;
    if(!a||!d)return notify('Selecione atacante e alvo.');
    if(!damage&&!chakra&&!cond)return notify('Informe dano, custo de Chakra ou condição.');
    if(!window.confirm('Aplicar '+damage+' de dano em '+(d.nome||'alvo')+', gastar '+chakra+
      ' de Chakra de '+(a.nome||'atacante')+(cond?' e aplicar '+cond:'')+'?'))return;
    busyCombat=true;$('sc-smart-apply').disabled=true;
    try{
      if(damage||chakra)await applyResources(a.id,d.id,damage,chakra);
      if(cond){
        const applied=await applyCondition(d.id,cond,2);
        if(applied===false)throw Error('A condição não pôde ser registrada.');
      }
      $('sc-smart-outcome').textContent='Recursos aplicados · '+damage+' HP de dano; '+chakra+
        ' Chakra gasto.'+(cond?' Condição: '+cond+'.':'');
      notify('Combate atualizado nas fichas.');
    }catch(error){notify('Não foi possível concluir todos os efeitos: '+error.message)}
    finally{busyCombat=false;$('sc-smart-apply').disabled=false}
  };
  $('sc-smart-effect').onclick=async()=>{
    if(!canEdit()||busyCombat)return;
    const a=roster().find(f=>f.id===$('sc-smart-attacker').value);
    const d=roster().find(f=>f.id===$('sc-smart-defender').value);
    if(!a||!d)return notify('Selecione atacante e alvo.');
    busyCombat=true;$('sc-smart-effect').disabled=true;
    try{
      await playEffect({kind:'taijutsu',name:'Ataque de '+(a.nome||'Shinobi'),sourceSheetId:a.id,targetSheetId:d.id});
      notify('Impacto enviado ao mapa.');
    }catch(e){notify('Efeito visual indisponível: '+e.message)}
    finally{busyCombat=false;$('sc-smart-effect').disabled=false}
  };

  // Diretor de cena. O último evento por cenário define a atmosfera dos clientes.
  // As transições são cosméticas e não alteram mapas, tokens ou fichas.
  const ambience=document.getElementById('sc-scene-ambience');
  scenePanel.innerHTML='<section class="sc-tool-card" aria-label="Diretor cinematográfico">'+
    '<div class="sc-tool-head"><strong>Diretor de cenas</strong><small>TINTA · CLIMA · CHAKRA</small></div>'+
    '<p>Altere a atmosfera da cena para todos os jogadores sem recarregar o mapa.</p>'+
    '<div class="sc-scene-preset-grid" id="sc-scene-presets">'+Object.entries(PRESETS).map(([id,title])=>
      '<button type="button" class="sc-scene-preset" data-sc-preset="'+id+'" aria-pressed="'+(id==='none')+'">'+escapeHTML(title)+'</button>').join('')+'</div>'+
    '<label class="sc-tool-field" for="sc-scene-strength">Intensidade <output id="sc-scene-strength-out">60%</output></label>'+
    '<input type="range" id="sc-scene-strength" min="15" max="100" value="60" step="5">'+
    '<div class="sc-tool-actions"><button type="button" class="sc-tool-btn" id="sc-scene-apply">Aplicar atmosfera</button>'+
    '<button type="button" class="sc-tool-btn secondary" id="sc-scene-clear">Limpar</button></div>'+
    '<hr class="sc-tool-divider"><p class="sc-tool-hint">Efeitos rápidos sincronizados:</p>'+
    '<div class="sc-tool-actions" id="sc-scene-cues">'+Object.entries(CUES).map(([id,title])=>
      '<button type="button" class="sc-tool-btn secondary" data-sc-cue="'+id+'">'+escapeHTML(title)+'</button>').join('')+'</div>'+
    '<p class="sc-tool-hint" id="sc-scene-current">Atmosfera: sem efeito</p></section>';
  const presetButtons=[...scenePanel.querySelectorAll('[data-sc-preset]')];
  presetButtons.forEach(button=>button.onclick=()=>{
    selectedMode=button.dataset.scPreset;
    presetButtons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  });
  $('sc-scene-strength').oninput=()=>$('sc-scene-strength-out').textContent=$('sc-scene-strength').value+'%';
  function useAmbience(state){
    if(!ambience)return;
    const preset=Object.hasOwn(PRESETS,state?.p)?state.p:'none';
    const strength=safeN(state?.n,15,100)/100;
    ambience.dataset.preset=preset;
    ambience.style.setProperty('--sc-atm-strength',String(strength));
    selectedMode=preset;
    presetButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scPreset===preset)));
    $('sc-scene-current').textContent='Atmosfera: '+PRESETS[preset];
  }
  function playCue(kind){
    if(!ambience||!Object.hasOwn(CUES,kind))return;
    const classes={shake:'sc-scene-shake',flash:'sc-atm-lightning',pulse:'sc-atm-pulse',transition:'sc-scene-transition'};
    const klass=classes[kind],node=kind==='shake'?stage:ambience;
    node.classList.remove(klass);void node.offsetWidth;node.classList.add(klass);
    setTimeout(()=>node.classList.remove(klass),1250);
    if(kind==='pulse'&&window.SHINOBI_JUTSU_FX?.getSettings?.().enabled)
      window.SHINOBI_JUTSU_FX?.audio?.('chakra','Pulso de chakra');
  }
  async function publishScene(preset){
    if(!canEdit()||busyScene)return;
    busyScene=true;$('sc-scene-apply').disabled=true;
    try{
      const data={i:makeId(),p:preset,n:safeN($('sc-scene-strength').value,15,100),sc:getSceneId()||'',t:Date.now()};
      await addNote(SYS_SCENE,data);
      useAmbience(data);playCue('transition');
      notify('Atmosfera '+PRESETS[preset]+' compartilhada.');
    }catch(error){notify('Não foi possível publicar a atmosfera: '+error.message)}
    finally{busyScene=false;$('sc-scene-apply').disabled=false}
  }
  $('sc-scene-apply').onclick=()=>void publishScene(selectedMode);
  $('sc-scene-clear').onclick=()=>void publishScene('none');
  scenePanel.querySelectorAll('[data-sc-cue]').forEach(button=>button.onclick=async()=>{
    if(!canEdit()||busyScene)return;
    const kind=button.dataset.scCue;
    const id=makeId();
    seenCues.add(id);playCue(kind);
    try{await addNote(SYS_FX,{i:id,fx:kind,sc:getSceneId()||'',t:Date.now()})}
    catch(error){notify('Não foi possível compartilhar o efeito: '+error.message)}
  });
  function syncScene(){
    scenePanel.hidden=!canEdit();
    if(!ambience)return;
    const scene=getSceneId()||'';
    if(previousScene!==scene){
      if(previousScene&&scene)playCue('transition');
      lastAmbienceKey='';previousScene=scene;
    }
    const newest=publicEvents.find(event=>{
      const d=event.data||{},p=payloadFromText(d.payload?.text,SYS_SCENE);
      return d.type==='message'&&authorized(d)&&p&&(p.sc||'')===scene&&
        Object.hasOwn(PRESETS,p.p)&&safeId(p.i);
    });
    const state=newest?payloadFromText(newest.data.payload.text,SYS_SCENE):null;
    const key=state?.i||'none|'+scene;
    if(key!==lastAmbienceKey){lastAmbienceKey=key;useAmbience(state);if(state)playCue('transition')}
    for(const event of publicEvents){
      const d=event.data||{},p=payloadFromText(d.payload?.text,SYS_FX);
      if(d.type!=='message'||!authorized(d)||!p||!safeId(p.i)||!Object.hasOwn(CUES,p.fx)||seenCues.has(p.i))continue;
      seenCues.add(p.i);
      if(seenCues.size>160)seenCues.delete(seenCues.values().next().value);
      if((p.sc||'')===scene&&Math.abs(Date.now()-(stamp(d)||p.t||0))<7500)playCue(p.fx);
    }
  }
  function setEvents(data){publicEvents=Array.isArray(data)?data:[];syncScene()}
  function refresh(){refreshCombatRoster();syncScene()}
  function reset(){
    publicEvents=[];seenCues.clear();lastAmbienceKey='';previousScene='';
    useAmbience(null);refreshCombatRoster();
  }
  refresh();
  return {setEvents,refresh,reset};
}
