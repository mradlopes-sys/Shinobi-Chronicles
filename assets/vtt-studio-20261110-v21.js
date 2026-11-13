import {createTheatre} from './vtt-theatre-v17.js';
import {createRollsPanel,makeDicePayload,rollForSheet} from './vtt-rolls-v4.js?v=20261111-chat-medium5';
import {createCombatDirector} from './vtt-combat-director-v1.js?v=20261111-hidden1';
import {createBattleSystems} from './vtt-battle-systems-v1.js?v=20261112-doors2';
import {createGMQuickPanel} from './vtt-gm-quick-panel-v1.js?v=20261111-gm1';
import {createSessionTools} from './vtt-session-tools-v1.js?v=20261111-no-smoke1';
import {createVisualEffects,EFFECTS} from './vtt-effects-v2.js?v=20261110-jutsus2';
import {DEFAULT_METERS_PER_CELL,metersPerCell,pixelsToMeters,calibrateMetersPerCell,formatMeters,scaleBar} from './vtt-metrics-v1.js';
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore,doc,getDoc,addDoc,setDoc,collection,onSnapshot,serverTimestamp,updateDoc,query,where,getDocs,deleteDoc,limit,orderBy,runTransaction,writeBatch} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
const cfg={apiKey:'AIzaSyCdTZejzKXYyyAnYgak7ADEsDhfsdFgvVo',authDomain:'shinobi-chronicles-b9635.firebaseapp.com',projectId:'shinobi-chronicles-b9635',appId:'1:1000505549378:web:e1cbf459451b617f3503db'};
const app=getApps()[0]||initializeApp(cfg),auth=getAuth(app),db=getFirestore(app);
const WORLD_ID='shinobi-chronicles';
const activeDoorEvents=new Set(),pendingDoorEvents=new Map();
let activeEnvironmentView='walls';
const $=id=>document.getElementById(id);
let uid='',admin=false,room='',roomData=null,tokens=[],sheets=[],scenes=[],subs=[],dragToken=null,selected=null,sceneKey='',lastRoll='',busy=false,editingSceneId='',tokenUnsub=null,tokenSceneSubscribed=null,sheetsUnsub=null,subscriptionEpoch=0,worldCollectionsReady=false,portraitSubs=new Map(),vitalSubs=new Map(),lastVitals=new Map(),vitalTimer=null,masterUid='',lastStageRosterKey='__initial__',secretRollFeeds={self:[],gm:[],blind:[]},blindProcessing=new Set();
const stage=$('stage'),canvas=$('map'),ctx=canvas.getContext('2d');
const visualEffects=createVisualEffects(stage);
const combatDirector=createCombatDirector({
  panel:$('sc-combat-director'),strip:$('sc-turn-strip'),
  getAdmin:()=>admin,getSheets:()=>sheets,getRoomData:()=>roomData,
  rollInitiative:f=>{
    const rule=rollForSheet(f,'Iniciativa');
    const payload=makeDicePayload('1d8',rule?.bonus||0,'Iniciativa',String(f.nome||f.name||'Shinobi'));
    return {bonus:payload.bonus,roll:payload.rolls[0],score:payload.total};
  },
  saveCombat:async next=>{
    if(!admin||!room)throw Error('Apenas o mestre pode controlar a iniciativa.');
    // As regras publicadas autorizam "theatre", mas nao um campo "combat"
    // no nivel raiz do documento. Usamos atualizacao pontual no mapa permitido.
    const changed=battle.applyRoundTick(next);
    try{
      await updateDoc(roomRef(),{
        'theatre.combat':next,
        ...(changed?{'theatre.conditions':changed}:{}),
        updatedAt:serverTimestamp()
      });
      // A iniciativa é atualizada otimisticamente; manter a última rodada
      // confirmada permite expirar condições mesmo com cliques rápidos.
      if(roomData){
        roomData.theatre={...(roomData.theatre||{}),combat:next,
          ...(changed?{conditions:changed}:{})};
      }
    }catch(error){battle.setData(roomData?.theatre);throw error}
  },
  notify:message=>show(message),portrait:f=>portrait(f),
  getOnMap:id=>visibleTokens().some(t=>t.fichaId===id),
  getVisibleSheet:id=>{
    const onMap=visibleTokens().filter(t=>t.fichaId===id);
    return !onMap.length||onMap.some(t=>battle.isRevealed(t));
  },
  hasScene:()=>!!roomData?.activeSceneId,
  onPlaceOnMap:ids=>placeSheetsOnMap(ids),
  onOpenSheet:id=>{
    const f=sheets.find(f=>f.id===id);
    if(f)openSheet(f.id,f.ownerUid);
  }
});
const battle=createBattleSystems({
  getAdmin:()=>admin,getUid:()=>uid,getRoom:()=>room,getSceneId:()=>roomData?.activeSceneId||'',
  getRoomData:()=>roomData,getSheets:()=>sheets,getTokens:()=>visibleTokens(),
  getCurrentTurn:()=>roomData?.theatre?.combat||{round:1},
  setCombatTab:name=>{
    if($('workspace').classList.contains('panel-hidden'))$('vtt-toggle-panel').click();
    switchTab(name);
  },
  focusToken:id=>{
    const token=visibleTokens().find(t=>t.fichaId===id);
    if(token){selected=token.id;renderTokens();draw()}
  },
  playEffect:async({kind,name,sourceSheetId,targetSheetId,targetToken})=>{
    if(!admin||!room)throw Error('Apenas o mestre publica efeitos.');
    const nonce=uid+'-'+Date.now()+'-'+Math.floor(Math.random()*1000000);
    const payload={kind,source:'habilidade',fichaId:sourceSheetId,
      targetFichaId:targetSheetId,jutsuName:String(name).slice(0,80),
      sceneId:roomData?.activeSceneId||'',nonce};
    if(targetToken)payload.target={x:targetToken.x,y:targetToken.y};
    localVfxNonces.add(nonce);
    setTimeout(()=>localVfxNonces.delete(nonce),15000);
    visualEffects.play(kind,effectPoint(payload),payload.jutsuName);
    await addDoc(collection(db,'vttRooms',room,'events'),{
      type:'effect',uid,at:serverTimestamp(),payload
    });
  },
  adjustHitPoints:async(target,mode,points)=>{
    if(!admin||!room)throw Error('Apenas o mestre edita HP de outras fichas.');
    const ref=doc(db,'fichas',target.id);
    await runTransaction(db,async transaction=>{
      const snapshot=await transaction.get(ref);
      if(!snapshot.exists())throw Error('Ficha não encontrada.');
      const fresh=snapshot.data(),vital=healthOf(fresh);
      const delta=mode==='damage'?-points:points;
      const next=Math.max(0,Math.min(vital.max,vital.current+delta));
      transaction.update(ref,{'recursos.vit':next});
    });
  },
  saveFields:async fields=>{
    if(!admin||!room)throw Error('Apenas o mestre altera a campanha.');
    await updateDoc(roomRef(),{...fields,updatedAt:serverTimestamp()});
  },
  notify:message=>show(message),redraw:()=>draw(),getMap:()=>view.image,
  getCell:()=>view.cell,getZoom:()=>view.zoom,
  sendDoorRequest:async({sceneId,wallId,tokenId,state})=>{
    if(!room||!uid||!sceneId||roomData?.activeSceneId!==sceneId)
      throw Error('A cena mudou ou você saiu da mesa.');
    await addDoc(collection(db,'vttRooms',room,'events'),{
      type:'door',uid,at:serverTimestamp(),payload:{sceneId,wallId,tokenId,state}
    });
  }
});
function refreshCombatTargets(){
  const input=$('effect-target');if(!input)return;
  const value=input.value;
  const opts=[new Option('Centro do cenário','center'),new Option('Token selecionado','selected')];
  if(admin)for(const f of sheets){
    opts.push(new Option(String(f.nome||f.name||'Personagem').slice(0,65),'sheet:'+f.id));
  }
  input.replaceChildren(...opts);
  if([...input.options].some(x=>x.value===value))input.value=value;
}
function syncJutsuAudioControls(){
  const panel=window.SHINOBI_JUTSU_FX;
  const current=panel?.getSettings?.()||{enabled:true,volume:55};
  const toggle=$('vtt-jutsu-audio-toggle'),range=$('vtt-jutsu-audio-volume'),label=$('vtt-jutsu-audio-value');
  if(toggle){
    toggle.textContent=current.enabled?'🔊 Sons ativados':'🔇 Sons silenciados';
    toggle.setAttribute('aria-pressed',String(current.enabled));
  }
  if(range&&document.activeElement!==range)range.value=current.volume;
  if(label)label.textContent=current.volume+'%';
}
$('vtt-jutsu-audio-test')?.addEventListener('click',()=>{
  const audio=window.SHINOBI_JUTSU_FX;
  if(!audio?.getSettings?.().enabled)return show('Ative os sons para testar.');
  audio.audio('chakra','Prévia sonora shinobi');
});
$('vtt-jutsu-audio-toggle')?.addEventListener('click',()=>{
  window.SHINOBI_JUTSU_FX?.toggle?.();
  syncJutsuAudioControls();
});
$('vtt-jutsu-audio-volume')?.addEventListener('input',event=>{
  window.SHINOBI_JUTSU_FX?.volume?.(event.target.value);
  syncJutsuAudioControls();
});
syncJutsuAudioControls();
window.addEventListener('storage',event=>{
  if(event.key==='sc-jutsu-sound-v1')syncJutsuAudioControls();
});
const localVfxNonces=new Set();
const effectOptions=$('effect-kind');
for(const fx of EFFECTS){const option=document.createElement('option');option.value=fx.id;option.textContent=fx.name;effectOptions.append(option)}
function updateEffectHelp(){const fx=EFFECTS.find(x=>x.id===effectOptions.value);$('effect-help').textContent=fx?.description||''}
effectOptions.onchange=updateEffectHelp;updateEffectHelp();
const guide=$('effect-guide-items');
for(const fx of EFFECTS){
  const row=document.createElement('div');row.style.cssText='border-bottom:1px solid #3f5144;padding:8px 2px';
  const name=document.createElement('strong');name.textContent=fx.name;name.style.cssText='display:block;font-size:12px;color:#eee4d0';
  const description=document.createElement('p');description.textContent=fx.description;description.style.cssText='font-size:11px;margin:4px 0 0;color:#aebfad';
  row.append(name,description);guide.append(row);
}
const view={cell:64,zoom:1,ox:110,oy:85,image:null,scene:''};
const measure={enabled:false,calibrating:false,start:null,end:null,drag:false,drawnPx:0};
const tokenImages=new Map();function tokenImage(url){if(!safeImage(url)||(url.startsWith('data:')&&url.length>85000))return null;if(!tokenImages.has(url)){const img=new Image();img.onload=draw;img.onerror=()=>tokenImages.set(url,null);img.src=url;tokenImages.set(url,img)}return tokenImages.get(url)}
const safeUrl=s=>typeof s==='string'&&/^https:\/\/[^\s"'<>]+$/i.test(s)&&s.length<=1500;
const safeImage=s=>safeUrl(s)||(typeof s==='string'&&s.length<=1200000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s));
const show=(msg)=>{const x=$('status');x.textContent=msg;x.hidden=false;clearTimeout(show.timer);show.timer=setTimeout(()=>x.hidden=true,5500)};
const canMove=t=>admin||t.ownerUid===uid;
const visibleTokens=()=>tokens.filter(t=>t.sceneId===(roomData?.activeSceneId||'')||(!t.sceneId&&!roomData?.activeSceneId));
const roomRef=()=>doc(db,'vttRooms',room);
const currentMetersPerCell=()=>metersPerCell(roomData?.metersPerCell);
const hasCalibratedScale=()=>Number.isFinite(Number(roomData?.metersPerCell))
  && roomData?.metersPerCell!=null && Number(roomData.metersPerCell)>=.05
  && Number(roomData.metersPerCell)<=1000;
function updateMetricHud(){
  const hud=$('metric-hud');
  const active=!!(roomData?.scene&&view.image);
  hud.hidden=!active;
  $('metric-hud-calibrate').hidden=!admin;
  hud.classList.toggle('uncalibrated',!hasCalibratedScale());
  if(!active)return;
  const factor=scaleBar(view.zoom,view.cell,currentMetersPerCell());
  if(!factor)return;
  $('metric-scale-line').style.width=Math.max(16,Math.min(175,factor.pixels))+'px';
  $('metric-scale-value').textContent=factor.label;
  $('metric-scale-hint').textContent=hasCalibratedScale()?'Escala compartilhada · metros':'Estimativa inicial · calibre com o mestre';
}
function liveMeasureLabel(){
  if(!measure.start||!measure.end)return '';
  const px=Math.hypot(measure.end.x-measure.start.x,measure.end.y-measure.start.y);
  return formatMeters(pixelsToMeters(px,view.cell,currentMetersPerCell()));
}
function updateMetricDrawStatus(){
  const hasLine=!!(measure.start&&measure.end&&measure.drawnPx>=2);
  $('metric-status').hidden=!measure.enabled||!hasLine;
  if(hasLine)$('metric-status').textContent='Distância · '+liveMeasureLabel();
  $('metric-drawn').textContent=hasLine?('Linha selecionada: '+liveMeasureLabel()+' (referência inicial)'):'Arraste para selecionar dois pontos';
  const known=Number($('metric-known-distance').value);
  $('metric-save').disabled=!admin||!hasLine||!Number.isFinite(known)||known<=0||known>100000;
}
const tokenRef=id=>doc(db,'vttRooms',room,'tokens',id);
const stopSubs=()=>{gmQuick?.reset?.();sessionTools?.reset?.();measure.enabled=false;measure.calibrating=false;measure.start=null;measure.end=null;measure.drawnPx=0;$('metric-card').hidden=true;$('metric-status').hidden=true;$('metric-hud').hidden=true;if($('sheet-modal').classList.contains('open'))$('sheet-close').click();subscriptionEpoch++;worldCollectionsReady=false;secretRollFeeds={self:[],gm:[],blind:[]};blindProcessing.clear();if(typeof rolls!=='undefined')rolls.setPrivateEvents([]);for(const stop of portraitSubs.values())stop();portraitSubs.clear();for(const stop of vitalSubs.values())stop();vitalSubs.clear();lastVitals.clear();clearTimeout(vitalTimer);masterUid='';if(tokenUnsub){tokenUnsub();tokenUnsub=null}tokenSceneSubscribed=null;subs.forEach(u=>u());subs=[];room='';roomData=null;tokens=[];scenes=[];selected=null;editingSceneId='';lastStageRosterKey='__initial__';theatre.reset();combatDirector.setData(null);battle.setData(null);$('room-heading').textContent='Mesa Permanente · Shinobi Chronicles';$('world-status').textContent='Aguardando conexão…';$('scene-empty').hidden=false;renderScenes();renderTokens();draw();};
const theatre=createTheatre({
  stage,
  notify:show,
  canOpenSheet:id=>{
    if(!uid)return false;
    const sheet=sheets.find(f=>f.id===id);
    return !!sheet&&(admin||sheet.ownerUid===uid);
  },
  onOpenSheet:id=>{
    const sheet=sheets.find(f=>f.id===id);
    if(!sheet||!uid||(!admin&&sheet.ownerUid!==uid)){
      show('Apenas o dono ou o mestre pode abrir essa ficha.');
      return;
    }
    openSheet(sheet.id,sheet.ownerUid);
  },
  onChange:async state=>{
    if(!admin||!room)throw Error('Apenas o mestre altera o Teatro.');
    // Atualizar apenas as propriedades do Teatro preserva a iniciativa no mesmo mapa.
    // Gravar "theatre:state" por inteiro apagaria o carrossel em cada mudanca de ator.
    await updateDoc(roomRef(),{
      'theatre.enabled':state.enabled,
      'theatre.cast':state.cast,
      'theatre.revision':state.revision,
      updatedAt:serverTimestamp()
    });
  },
  isAdmin:()=>admin,
  previewPortrait:(id,variant)=>{const f=sheets.find(x=>x.id===id);return variant==='casual'?(f?.retratos?.casual||f?.foto):f?.retratos?.[variant]},
  publishPortrait:async(id,variant)=>{
    if(!admin||!room)throw Error('Somente o mestre pode publicar retratos.');
    const f=sheets.find(x=>x.id===id);
    if(!f)throw Error('Ficha indisponível.');
    // Publica todas as expressões de uma só vez. A troca no palco não depende
    // de cliques, da presença contínua do mestre nem do download de outra imagem.
    const variants={};
    for(const key of ['casual','ninja','triste','ferido','grave']){
      const source=key==='casual'?(f.retratos?.casual||f.foto):f.retratos?.[key];
      if(!source)continue;
      if(!safeImage(source)||source.length>160000){
        if(key===variant)throw Error('O retrato escolhido é grande demais para sincronizar. Reenvie em WebP.');
        continue;
      }
      variants[key]=source;
    }
    if(!variants[variant])throw Error('Envie primeiro o retrato escolhido na ficha.');
    const name=String(f.nome||f.name||'Shinobi').slice(0,70);
    await setDoc(doc(db,'vttRooms',room,'theatrePortraits',id),{
      variants,name,ownerUid:f.ownerUid,updatedAt:serverTimestamp()
    });
    theatre.setPortrait(id,variants,variant);
  }
});
// Private results never enter the shared event feed.
function syncSecretFeed(){
  rolls.setPrivateEvents(['self','gm','blind'].flatMap(kind=>
    secretRollFeeds[kind].map(entry=>({...entry,kind}))
  ));
}
async function deleteCollectionItems(ref,type=''){
  let deleted=0;
  while(true){
    const q=type?query(ref,where('type','==',type),limit(180)):query(ref,limit(180));
    const snapshot=await getDocs(q);if(snapshot.empty)break;
    const batch=writeBatch(db);
    for(const item of snapshot.docs){batch.delete(item.ref);deleted++}
    await batch.commit();if(snapshot.size<180)break;
  }
  return deleted;
}
const rolls=createRollsPanel({
  panel:$('rolls-panel'),stage,isAdmin:()=>admin,getUid:()=>uid,getSheets:()=>sheets,notify:show,
  send:async(type,payload)=>{
    if(!room||!uid)throw Error('Entre na mesa antes de enviar.');
    if(!['roll','message'].includes(type))throw Error('Tipo público inválido.');
    return addDoc(collection(db,'vttRooms',room,'events'),{
      type,uid,at:serverTimestamp(),payload
    });
  },
  sendSpecial:async(mode,payload)=>{
    if(!room||!uid)throw Error('Entre na mesa antes de rolar.');
    if(!['gm','self'].includes(mode))throw Error('Modo privado inválido.');
    const destination=mode==='self'?
      collection(db,'vttRooms',room,'privateRolls',uid,'entries'):
      collection(db,'vttRooms',room,'gmRolls');
    return addDoc(destination,{
      type:'privateRoll',uid,mode,at:serverTimestamp(),
      dice:payload.dice,rolls:payload.rolls,bonus:payload.bonus,total:payload.total,
      label:payload.label,character:payload.character
    });
  },
  submitBlind:async payload=>{
    if(!room||!uid)throw Error('Entre na mesa antes de rolar.');
    return addDoc(collection(db,'vttRooms',room,'blindRequests'),{
      uid,dice:payload.dice,bonus:payload.bonus,label:payload.label,
      character:payload.character,status:'pending',at:serverTimestamp()
    });
  },
  clearChat:async()=>{
    if(!admin||!room)throw Error('Somente o mestre pode apagar o chat da campanha.');
    const world=room;
    await deleteCollectionItems(collection(db,'vttRooms',world,'blindRequests'));
    for(const type of ['message','roll','rollRequest'])
      await deleteCollectionItems(collection(db,'vttRooms',world,'events'),type);
    await deleteCollectionItems(collection(db,'vttRooms',world,'gmRolls'));
    await deleteCollectionItems(collection(db,'vttRooms',world,'blindRolls'));
    return true;
  },
  deleteChatItem:async(kind,id)=>{
    if(!room||!uid)throw Error('Você não está conectado.');
    if(kind==='self')return deleteDoc(doc(db,'vttRooms',room,'privateRolls',uid,'entries',id));
    if(kind==='public')return deleteDoc(doc(db,'vttRooms',room,'events',id));
    if(!admin)throw Error('Somente o mestre pode remover esse resultado.');
    if(kind==='gm'||kind==='blind')
      return deleteDoc(doc(db,'vttRooms',room,kind==='gm'?'gmRolls':'blindRolls',id));
    throw Error('Categoria inválida.');
  }
});
// Ferramentas integradas usam as coleções de eventos que o VTT já sincroniza.
// Os ajustes de HP/Chakra são atômicos para evitar conflitos entre ações.
const sessionTools=createSessionTools({
  combatPanel:$('sc-assisted-combat'),
  scenePanel:$('sc-scene-director'),
  stage,
  getUid:()=>uid,getAdmin:()=>admin,getSheets:()=>sheets,
  getSceneId:()=>roomData?.activeSceneId||'',
  getRoomData:()=>roomData,getMasterUid:()=>roomData?.masterUid||masterUid||'',
  notify:show,
  send:async(type,payload)=>{
    if(!room||!uid)throw Error('Entre na mesa antes de publicar.');
    if(type!=='message'&&type!=='roll')throw Error('Tipo de evento não permitido.');
    return addDoc(collection(db,'vttRooms',room,'events'),{
      type,uid,at:serverTimestamp(),payload
    });
  },
  applyResources:async(sourceId,targetId,damage,chakraCost)=>{
    if(!admin||!room)throw Error('Somente o mestre pode alterar recursos.');
    const sourceRef=doc(db,'fichas',sourceId),targetRef=doc(db,'fichas',targetId);
    const dmg=Math.max(0,Math.min(999,Math.round(Number(damage)||0)));
    const cost=Math.max(0,Math.min(999,Math.round(Number(chakraCost)||0)));
    await runTransaction(db,async tx=>{
      const src=await tx.get(sourceRef);
      const dst=sourceId===targetId?src:await tx.get(targetRef);
      if(!src.exists()||!dst.exists())throw Error('Ficha não encontrada.');
      const updatesSource={},updatesTarget={};
      if(cost>0){
        const data=src.data(),max=Math.max(0,10+3*(Number(data.atributos?.ESP)||0));
        const stored=data.recursos?.chakra;
        const current=stored===null||stored===undefined||stored===''?
          max:Math.max(0,Math.min(max,Math.round(Number(stored)||0)));
        if(current<cost)throw Error('Chakra insuficiente em '+(data.nome||'atacante')+'.');
        updatesSource['recursos.chakra']=current-cost;
      }
      if(dmg>0){
        const hp=healthOf(dst.data());
        updatesTarget['recursos.vit']=Math.max(0,hp.current-dmg);
      }
      if(sourceId===targetId){
        const changes={...updatesSource,...updatesTarget};
        if(Object.keys(changes).length)tx.update(sourceRef,changes);
      }else{
        if(Object.keys(updatesSource).length)tx.update(sourceRef,updatesSource);
        if(Object.keys(updatesTarget).length)tx.update(targetRef,updatesTarget);
      }
    });
  },
  applyCondition:(targetId,condition,rounds)=>battle.addCondition(targetId,condition,rounds),
  playEffect:async({kind,name,sourceSheetId,targetSheetId})=>{
    if(!admin||!room)throw Error('Somente o mestre transmite efeitos.');
    const targetToken=visibleTokens().find(t=>t.fichaId===targetSheetId);
    const nonce=uid+'-'+Date.now()+'-'+Math.floor(Math.random()*1000000);
    const payload={kind,source:'combate-assistido',fichaId:sourceSheetId,
      targetFichaId:targetSheetId,jutsuName:String(name||'Ataque').slice(0,80),
      sceneId:roomData?.activeSceneId||'',nonce};
    if(targetToken)payload.target={x:targetToken.x,y:targetToken.y};
    localVfxNonces.add(nonce);
    setTimeout(()=>localVfxNonces.delete(nonce),15000);
    visualEffects.play(kind,effectPoint(payload),payload.jutsuName);
    await addDoc(collection(db,'vttRooms',room,'events'),{
      type:'effect',uid,at:serverTimestamp(),payload
    });
  }
});
// Controle rápido reutiliza fichas e operações existentes, sem coleções novas.
const gmQuick=createGMQuickPanel({
 panel:$('sc-gm-quick-panel'),getAdmin:()=>admin,
 getSceneId:()=>roomData?.activeSceneId||'',
 getTokens:()=>visibleTokens(),getSheets:()=>sheets,
 getCombat:()=>combatDirector.getData(),
 getConditions:id=>battle.shortStatus(id),
 getTokenHidden:id=>battle.isTokenHidden(id),
 getFogVisible:token=>battle.isRevealed(token),
 notify:show,
 onHide:async tokenId=>{
   if(!admin||!room)throw Error('Apenas o mestre pode ocultar tokens.');
   const ok=await battle.toggleTokenHidden(tokenId);
   if(!ok)throw Error('A visibilidade não pôde ser salva.');
   renderTokens();draw();gmQuick.refresh();
 },
 onFocus:tokenId=>{
   const token=visibleTokens().find(t=>t.id===tokenId);if(!token)return;
   selected=token.id;
   view.ox=stage.clientWidth/2-(token.x+.5)*view.cell*view.zoom;
   view.oy=stage.clientHeight/2-(token.y+.5)*view.cell*view.zoom;
   renderTokens();draw();
 },
 onSheet:id=>{
   const f=sheets.find(f=>f.id===id);if(f)openSheet(f.id,f.ownerUid);
 },
 onCondition:id=>battle.openForToken(id,'condition'),
 onInitiative:id=>combatDirector.addOne(id),
 onAdjust:async(id,pool,amount)=>{
   if(!admin||!room||!['vit','chakra'].includes(pool))throw Error('Operação não autorizada.');
   if(!Number.isInteger(amount)||Math.abs(amount)<1||Math.abs(amount)>999)throw Error('Passo inválido.');
   const ref=doc(db,'fichas',id);
   return runTransaction(db,async transaction=>{
     const snap=await transaction.get(ref);
     if(!snap.exists())throw Error('Ficha não encontrada.');
     const f=snap.data();
     let max,current;
     if(pool==='vit'){const vital=healthOf(f);max=vital.max;current=vital.current}
     else{
       max=Math.max(0,Math.min(100000,10+3*(Number(f.atributos?.ESP)||0)));
       const raw=f.recursos?.chakra;
       current=raw===null||raw===undefined||raw===''?max:
         Math.max(0,Math.min(max,Math.round(Number(raw)||0)));
     }
     const next=Math.max(0,Math.min(max,current+amount));
     transaction.update(ref,{['recursos.'+pool]:next});
     return {current:next,max};
   });
 }
});
async function resolveBlindRequest(item,epoch){
  if(!admin||!room||epoch!==subscriptionEpoch||blindProcessing.has(item.id))return;
  blindProcessing.add(item.id);
  try{
    const requestRef=doc(db,'vttRooms',WORLD_ID,'blindRequests',item.id);
    const resultRef=doc(db,'vttRooms',WORLD_ID,'blindRolls',item.id);
    await runTransaction(db,async tx=>{
      const snapshot=await tx.get(requestRef);
      if(!snapshot.exists()||snapshot.data()?.status!=='pending')return;
      const request=snapshot.data();
      if(!request?.uid||!request?.dice)throw Error('Pedido cego incompleto.');
      const result=makeDicePayload(request.dice,request.bonus,request.label,request.character);
      tx.set(resultRef,{type:'privateRoll',mode:'blind',uid:request.uid,at:serverTimestamp(),...result});
      tx.update(requestRef,{status:'resolved',resolvedAt:serverTimestamp()});
    });
  }catch(error){show('Rolagem cega pendente: '+error.message)}
  finally{blindProcessing.delete(item.id)}
}
function setEnvironmentView(which,activate=true){
  if(!admin)return;
  activeEnvironmentView=which==='fog'?'fog':'walls';
  const pane=$('pane-ambiente');if(!pane)return;
  pane.dataset.envView=activeEnvironmentView;
  pane.querySelectorAll('[data-env-view]').forEach(button=>{
    const active=button.dataset.envView===activeEnvironmentView;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  if(activeEnvironmentView==='walls'&&activate){
    if(measure.enabled)setMetricTool('off');
    battle.enterWallEdit();
  }else battle.cancel();
  updateStageToolStatus();
}
function switchTab(name){
  if(['mapa','actors','biblioteca'].includes(name))name='campanha';
  if((name==='combate'||name==='ambiente')&&!admin){
    show('Esta ferramenta é exclusiva do mestre.');return;
  }
  const leavingEnvironment=!document.querySelector('#pane-ambiente[hidden]')&&name!=='ambiente';
  for(const b of document.querySelectorAll('[data-tab]')){
    const isActive=b.dataset.tab===name;
    b.classList.toggle('active',isActive);
    b.setAttribute('aria-current',isActive?'page':'false');
  }
  for(const p of document.querySelectorAll('.pane'))p.hidden=p.id!=='pane-'+name;
  if(name==='ambiente')setEnvironmentView(activeEnvironmentView,true);
  else if(leavingEnvironment)battle.cancel();
  const workspace=$('workspace');
  if(workspace?.classList.contains('panel-hidden'))$('vtt-toggle-panel').click();
  updateStageToolStatus();
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
document.querySelectorAll('[data-env-view]').forEach(b=>b.onclick=()=>setEnvironmentView(b.dataset.envView));
$('sc-open-environment').onclick=()=>{activeEnvironmentView='walls';switchTab('ambiente')};
function openScenes(){
  switchTab('campanha');
  if(!admin){show('A biblioteca é exclusiva do mestre. Você acompanha a cena ativa.');return}
  const workspace=$('workspace');
  if(workspace.classList.contains('panel-hidden'))$('vtt-toggle-panel').click();
  const folder=$('scene-library-drawer');folder.open=true;
  requestAnimationFrame(()=>folder.scrollIntoView({block:'nearest',behavior:'smooth'}));
}
$('scene-open-library').onclick=openScenes;
$('scene-open-panel').onclick=openScenes;
function applyRole(){for(const id of ['gm-scenes','next-turn','cast-effect','effect-kind','effect-kind-label','effect-target','effect-target-label','effect-help'])$(id).hidden=!admin;for(const item of document.querySelectorAll('[data-gm-only]'))item.hidden=!admin;$('scene-open-library').setAttribute('aria-label',admin?'Abrir biblioteca de mapas':'Cena em exibição');
$('scene-open-panel').title=admin?'Escolher mapa na biblioteca':'Cena em exibição';$('auth-label').textContent=uid?(admin?'Mestre · permissões administrativas':'Jogador · acesso restrito'):'Faça login nos Arquivos Shinobi';if(!admin&&(document.querySelector('[data-tab="combate"].active')||document.querySelector('[data-tab="ambiente"].active')))switchTab('rolls');theatre.refresh();renderSheets();combatDirector.refresh();battle.render();refreshCombatTargets();sessionTools.refresh();gmQuick.refresh();gmQuick.refresh();}
onAuthStateChanged(auth,async user=>{stopSubs();if(sheetsUnsub){sheetsUnsub();sheetsUnsub=null}uid=user?.uid||'';admin=false;sheets=[];theatre.setActors([]);rolls.setUser(uid);rolls.setSheets([]);applyRole();if(!uid){show('Faça login no Shinobi Chronicles antes de entrar na mesa.');return}try{admin=user.email==='mestre_shinobi@players.shinobi-chronicles.invalid'||(await getDoc(doc(db,'admins',uid))).exists();applyRole();loadSheets();void connectWorld()}catch(e){show('Falha na autenticação: '+e.message)}});
function loadSheets(){
  if(sheetsUnsub){sheetsUnsub();sheetsUnsub=null}
  const source=admin?collection(db,'fichas'):query(collection(db,'fichas'),where('ownerUid','==',uid));
  sheetsUnsub=onSnapshot(source,snap=>{
    sheets=snap.docs.filter(d=>d.data().tipo!=='diario').map(d=>({id:d.id,...d.data()}));
    updateTheatreDirectory();rolls.setSheets(sheets);
    renderSheets();combatDirector.refresh();battle.render();refreshCombatTargets();sessionTools.refresh();gmQuick.refresh();
    scheduleVitalSync();
  },e=>show('Não foi possível sincronizar as fichas: '+e.message));
}
function updateTheatreDirectory(){
  const master=roomData?.masterUid||masterUid||(auth.currentUser?.email==='mestre_shinobi@players.shinobi-chronicles.invalid'?uid:'');
  theatre.setActors(sheets.map(f=>({
    id:f.id,name:f.nome||f.name||'Shinobi',
    category:master&&f.ownerUid===master?'npc':'player',
    variants:['casual','ninja','triste','ferido','grave'].filter(key=>safeImage(key==='casual'?(f.retratos?.casual||f.foto):f.retratos?.[key]))
  })));
}
function syncTheatrePortraits(cast){
  const ids=new Set((Array.isArray(cast)?cast:[]).filter(c=>c&&typeof c.id==='string').map(c=>c.id));
  for(const [id,unsubscribe] of portraitSubs){
    if(ids.has(id))continue;
    unsubscribe();portraitSubs.delete(id);theatre.setPortrait(id,'','');
  }
  if(!room)return;
  for(const id of ids){
    if(portraitSubs.has(id))continue;
    const unsub=onSnapshot(doc(db,'vttRooms',room,'theatrePortraits',id),snap=>{
      const data=snap.data();
      theatre.setPortrait(id,data?.variants||data?.image||'',data?.variant||'');
    },e=>show('Retrato no Teatro: '+e.message));
    portraitSubs.set(id,unsub);
  }
}
// Estado HP público no Teatro, separado da ficha privada.
function healthOf(f){
  const vig=Number(f?.atributos?.VIG)||0;
  const nc=Number(f?.nc)||4;
  const max=Math.max(1,Math.min(100000,10+3*vig+5*nc));
  const raw=f?.recursos?.vit;
  const current=raw===null||raw===undefined||raw===''?max:Math.max(0,Math.min(max,Math.round(Number(raw)||0)));
  return {current,max};
}
function syncTheatreVitals(cast){
  const ids=new Set((Array.isArray(cast)?cast:[]).filter(c=>c&&typeof c.id==='string').map(c=>c.id));
  for(const [id,unsubscribe] of vitalSubs){
    if(ids.has(id))continue;
    unsubscribe();vitalSubs.delete(id);theatre.setVital(id,null);
  }
  if(!room)return;
  for(const id of ids){
    if(vitalSubs.has(id))continue;
    const unsubscribe=onSnapshot(doc(db,'vttRooms',room,'theatreVitals',id),snap=>{
      theatre.setVital(id,snap.exists()?snap.data():null);
    },err=>show('Sincronização do HP: '+err.message));
    vitalSubs.set(id,unsubscribe);
  }
}
function scheduleVitalSync(){
  clearTimeout(vitalTimer);
  vitalTimer=setTimeout(()=>void publishVitality(),240);
}
async function publishVitality(){
  if(!room||!uid||!roomData)return;
  const cast=theatre.getCast();
  for(const actor of cast){
    const f=sheets.find(s=>s.id===actor.id);
    if(!f||(!admin&&f.ownerUid!==uid))continue;
    const vital=healthOf(f),signature=f.ownerUid+':'+vital.current+':'+vital.max;
    if(lastVitals.get(f.id)===signature)continue;
    try{
      await setDoc(doc(db,'vttRooms',room,'theatreVitals',f.id),{
        ownerUid:f.ownerUid,current:vital.current,max:vital.max,updatedAt:serverTimestamp()
      });
      lastVitals.set(f.id,signature);
    }catch(err){
      // As fichas permanecem privadas; as novas regras do Firebase precisam
      // ser publicadas antes desta sincronização funcionar em produção.
      if(!String(err.message||'').includes('permission'))show('HP do Teatro: '+err.message);
    }
  }
}
function portrait(f){const variants=f.retratoBase==='casual'?[f.retratos?.casual,f.retratos?.ninja]:[f.retratos?.ninja,f.retratos?.casual];for(const x of [...variants,f.foto,f.portrait,f.retrato,f.imagem,f.avatar])if(safeImage(x))return x;return ''}
async function tokenPortrait(f){
  // Nunca cortar, enquadrar em círculo ou converter para JPEG: WebP mantém o canal alfa do PNG.
  const source=portrait(f);
  if(safeUrl(source))return source;
  if(!source)return '';
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      try{
        const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:true});
        if(!ctx){resolve('');return}
        const originalW=img.naturalWidth||img.width,originalH=img.naturalHeight||img.height;
        for(const maxSide of [420,340,270,220,170,120,90]){
          const ratio=Math.min(1,maxSide/Math.max(originalW,originalH));
          canvas.width=Math.max(1,Math.round(originalW*ratio));
          canvas.height=Math.max(1,Math.round(originalH*ratio));
          ctx.clearRect(0,0,canvas.width,canvas.height);
          ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          const webp=canvas.toDataURL('image/webp',.78);
          if(webp.startsWith('data:image/webp;')&&webp.length<=78000){resolve(webp);return}
          const png=canvas.toDataURL('image/png');
          if(png.startsWith('data:image/png;')&&png.length<=78000){resolve(png);return}
        }
      }catch(e){console.warn('Arte do token:',e)}
      resolve('');
    };
    img.onerror=()=>resolve('');
    img.src=source;
  });
}
// Menu contextual do elenco — botão direito na ficha ou botão ⋯.
let actorMenu=null;
function closeActorMenu(){
  if(!actorMenu)return;
  const {element,opener}=actorMenu;actorMenu=null;
  element.remove();
  if(opener?.isConnected&&document.activeElement===document.body)opener.focus({preventScroll:true});
}
function openActorMenu(sheet,x,y,opener=null){
  if(!admin||!room)return;
  closeActorMenu();
  const menu=document.createElement('div');menu.className='actor-context-menu';menu.setAttribute('role','menu');
  menu.setAttribute('aria-label','Ações de '+(sheet.nome||sheet.name||'personagem'));
  const caption=document.createElement('div');caption.className='actor-menu-caption';
  caption.textContent=sheet.nome||sheet.name||'Personagem';menu.append(caption);
  const action=(label,icon,fn,danger=false)=>{
    const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');
    button.className='actor-menu-action'+(danger?' danger':'');
    const ico=document.createElement('span');ico.className='actor-menu-icon';ico.textContent=icon;
    const name=document.createElement('span');name.textContent=label;
    button.append(ico,name);
    button.onclick=async()=>{
      closeActorMenu();
      try{await fn()}catch(e){show('Teatro: '+e.message)}
    };
    menu.append(button);return button;
  };
  if(theatre.hasActor(sheet.id)){
    action('Retirar do Teatro','×',async()=>{
      const ok=await theatre.removeActor(sheet.id);
      show(ok?'Personagem retirado do Teatro.':'Não foi possível retirar o personagem.');
      renderSheets();
    },true);
    action('Atualizar retratos','↻',async()=>{
      const variant=['ninja','casual','triste','ferido','grave'].find(key=>
        safeImage(key==='casual'?(sheet.retratos?.casual||sheet.foto):sheet.retratos?.[key]));
      if(!variant){show('Essa ficha ainda não possui um retrato.');return}
      await theatreRefreshPortrait(sheet.id,variant);
      show('Retratos atualizados no Teatro.');
    });
  }else{
    action('Adicionar ao Teatro','✦',async()=>{
      const ok=await theatre.addActor(sheet.id);
      show(ok?'Personagem adicionado ao Teatro.':'Não foi possível adicionar. Confira os retratos da ficha e o limite do palco.');
      renderSheets();
    });
  }
  // Ações iguais para o painel de atores e para o clique direito no token.
  if(combatDirector.hasEntry(sheet.id)){
    action('Retirar da iniciativa','−',()=>combatDirector.removeOne(sheet.id));
  }else{
    action('Adicionar à iniciativa','⚄',()=>combatDirector.addOne(sheet.id));
  }
  action('Condições de combate','✦',()=>battle.openForToken(sheet.id,'condition'));
  action('Lançar jutsu deste personagem','巻',()=>battle.openForToken(sheet.id,'jutsu'));
  action('Definir como alvo de jutsu','◎',()=>battle.openForToken(sheet.id,'target'));
  action('Abrir ficha','▤',()=>openSheet(sheet.id,sheet.ownerUid));
  document.body.append(menu);
  const rect=menu.getBoundingClientRect();
  menu.style.left=Math.max(8,Math.min(Number(x)||8,window.innerWidth-rect.width-9))+'px';
  menu.style.top=Math.max(8,Math.min(Number(y)||8,window.innerHeight-rect.height-9))+'px';
  actorMenu={element:menu,opener};
  menu.querySelector('button')?.focus({preventScroll:true});
}
async function theatreRefreshPortrait(id,variant){
  const sheet=sheets.find(f=>f.id===id);
  if(!sheet||!admin||!room)return;
  const variants={};
  for(const key of ['casual','ninja','triste','ferido','grave']){
    const src=key==='casual'?(sheet.retratos?.casual||sheet.foto):sheet.retratos?.[key];
    if(safeImage(src)&&src.length<=160000)variants[key]=src;
  }
  if(!variants[variant])throw Error('Nenhuma arte válida para publicação.');
  await setDoc(doc(db,'vttRooms',room,'theatrePortraits',id),{
    variants,name:String(sheet.nome||sheet.name||'Shinobi').slice(0,70),
    ownerUid:sheet.ownerUid,updatedAt:serverTimestamp()
  });
  theatre.setPortrait(id,variants,variant);
}
document.addEventListener('pointerdown',e=>{
  if(actorMenu&&!actorMenu.element.contains(e.target))closeActorMenu();
},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&actorMenu){e.preventDefault();closeActorMenu()}});
window.addEventListener('blur',closeActorMenu);

function renderSheets(){
  closeActorMenu();
  const players=$('actor-list'),npcs=$('npc-list');
  players.replaceChildren();npcs.replaceChildren();
  const search=String($('actor-search')?.value||'').toLocaleLowerCase('pt-BR').trim();
  const master=roomData?.masterUid||masterUid||(admin?uid:'');
  const matches=sheets.filter(f=>!search||[
    f.nome,f.name,f.clanId,f.clan,f.usuario
  ].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(search)))
    .sort((a,b)=>String(a.nome||a.name||'').localeCompare(String(b.nome||b.name||''),'pt-BR'));

  let playerCount=0,npcCount=0;
  for(const f of matches){
    const npc=!!(admin&&master&&f.ownerUid===master);
    const list=npc?npcs:players;
    if(npc)npcCount++;else playerCount++;
    const row=document.createElement('div');row.className='actor-row'+(theatre.hasActor(f.id)?' on-stage':'');
    row.dataset.fichaId=f.id;
    const b=document.createElement('button');b.type='button';b.className='entry';
    b.draggable=admin&&!!room;
    b.title=admin?'Clique para abrir. Botão direito para ações do Teatro.':'Abrir ficha';
    const pic=document.createElement('span');pic.className='thumb';
    const src=portrait(f);
    if(src){const img=document.createElement('img');img.src=src;img.alt='';pic.append(img)}
    else pic.textContent='忍';
    const meta=document.createElement('span');meta.className='meta';
    const strong=document.createElement('strong');strong.textContent=f.nome||f.name||'Personagem';
    const small=document.createElement('small');
    small.textContent=[f.clanId||f.clan||'Shinobi','NC '+(f.nc||4),npc?'NPC':(admin?(f.usuario||'Jogador'):'')].filter(Boolean).join(' · ');
    meta.append(strong,small);b.append(pic,meta);
    if(theatre.hasActor(f.id)){
      const indicator=document.createElement('span');indicator.className='actor-stage-dot';
      indicator.title='Personagem no Teatro';indicator.setAttribute('aria-label','No Teatro');
      b.append(indicator);
    }
    b.onclick=()=>openSheet(f.id,f.ownerUid);
    b.ondragstart=e=>{
      if(!admin||!room){e.preventDefault();return}
      closeActorMenu();
      e.dataTransfer.setData('text/shinobi-ficha',f.id);
      e.dataTransfer.effectAllowed='copy';
    };
    row.append(b);
    if(admin){
      const more=document.createElement('button');more.type='button';
      more.className='actor-more';more.textContent='⋯';
      more.title='Ações de '+(f.nome||f.name||'personagem');
      more.setAttribute('aria-label','Ações de '+(f.nome||f.name||'personagem'));
      more.setAttribute('aria-haspopup','menu');
      more.onclick=e=>{
        e.stopPropagation();
        const rect=more.getBoundingClientRect();
        openActorMenu(f,rect.right,rect.top,more);
      };
      row.oncontextmenu=e=>{e.preventDefault();openActorMenu(f,e.clientX,e.clientY,more)};
      row.append(more);
    }
    list.append(row);
  }
  $('players-count').textContent=String(playerCount);
  $('npc-count').textContent=String(npcCount);
  for(const [list,count,label] of [[players,playerCount,'Jogadores'],[npcs,npcCount,'NPCs do mestre']]){
    if(count)continue;
    const p=document.createElement('p');p.className='hint';
    p.textContent=search?'Nenhuma ficha corresponde à busca.':'Nenhuma ficha cadastrada em '+label+'.';
    list.append(p);
  }
}
$('actor-search').oninput=renderSheets;
// Abre a MESMA ficha do Shinobi (sem criar um editor duplicado) em janela
// flutuante leve, sem backdrop bloqueando a Mesa Virtual.
const sheetFloat=$('sheet-window'),sheetDrag=$('sheet-drag-handle');
let sheetDragState=null,sheetHasPosition=false;
function clampFloat(){
  const rect=sheetFloat.getBoundingClientRect();
  const width=Math.min(rect.width,innerWidth-12),height=Math.min(rect.height,innerHeight-12);
  // Preserve the adjusted size when the user resizes the browser.
  if(rect.width>innerWidth-12)sheetFloat.style.width=Math.max(290,width)+'px';
  if(rect.height>innerHeight-12)sheetFloat.style.height=Math.max(240,height)+'px';
  const w=sheetFloat.getBoundingClientRect().width,h=sheetFloat.getBoundingClientRect().height;
  const left=Math.max(6,Math.min(innerWidth-w-6,parseFloat(sheetFloat.style.left)||6));
  const top=Math.max(6,Math.min(innerHeight-h-6,parseFloat(sheetFloat.style.top)||6));
  sheetFloat.style.left=left+'px';sheetFloat.style.top=top+'px';
}
function initialFloatPosition(){
  if(sheetHasPosition){clampFloat();return}
  const w=Math.min(750,Math.max(290,innerWidth-24));
  const h=Math.min(790,Math.max(250,innerHeight*.78));
  sheetFloat.style.width=w+'px';sheetFloat.style.height=h+'px';
  sheetFloat.style.left=Math.max(10,innerWidth-w-24)+'px';
  sheetFloat.style.top=Math.max(10,Math.min(58,innerHeight-h-12))+'px';
  sheetHasPosition=true;
}
function openSheet(id,owner){
  if(!uid)return show('Entre na campanha para consultar fichas.');
  if(!id)return show('Personagem sem ficha vinculada.');
  // Users do not have all sheets in memory: never request another user's ID.
  const found=sheets.find(f=>f.id===id);
  if(!found||(!admin&&found.ownerUid!==uid)||(!admin&&owner!==uid)){
    return show('Somente o dono e o ADM podem abrir esta ficha.');
  }
  const modal=$('sheet-modal');
  // Measure and clamp only after the floating window is visible.
  modal.classList.add('open');
  initialFloatPosition();
  $('sheet-window-title').textContent=found.nome||found.name||'Ficha do personagem';
  const target='./index.html?vttSheet='+encodeURIComponent(id);
  const frame=$('sheet-frame');
  if(frame.getAttribute('src')!==target)frame.src=target;
  sheetDrag.focus({preventScroll:true});
}
function closeSheet(){
  $('sheet-modal').classList.remove('open');
  $('sheet-frame').src='about:blank';
  sheetDragState=null;
}
$('sheet-close').onclick=closeSheet;
sheetDrag.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('button'))return;
  const rect=sheetFloat.getBoundingClientRect();
  sheetDragState={id:e.pointerId,dx:e.clientX-rect.left,dy:e.clientY-rect.top};
  sheetDrag.setPointerCapture(e.pointerId);e.preventDefault();
});
sheetDrag.addEventListener('pointermove',e=>{
  if(!sheetDragState||sheetDragState.id!==e.pointerId)return;
  const rect=sheetFloat.getBoundingClientRect();
  sheetFloat.style.left=Math.max(6,Math.min(innerWidth-rect.width-6,e.clientX-sheetDragState.dx))+'px';
  sheetFloat.style.top=Math.max(6,Math.min(innerHeight-rect.height-6,e.clientY-sheetDragState.dy))+'px';
});
function stopSheetDrag(e){
  if(!sheetDragState||sheetDragState.id!==e.pointerId)return;
  sheetDragState=null;
  if(sheetDrag.hasPointerCapture(e.pointerId))sheetDrag.releasePointerCapture(e.pointerId);
}
sheetDrag.addEventListener('pointerup',stopSheetDrag);
sheetDrag.addEventListener('pointercancel',stopSheetDrag);
sheetDrag.addEventListener('lostpointercapture',()=>{sheetDragState=null});
sheetDrag.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();const step=e.shiftKey?30:10;
  const rect=sheetFloat.getBoundingClientRect();
  const x=(parseFloat(sheetFloat.style.left)||rect.left)+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0);
  const y=(parseFloat(sheetFloat.style.top)||rect.top)+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);
  sheetFloat.style.left=Math.max(6,Math.min(innerWidth-rect.width-6,x))+'px';
  sheetFloat.style.top=Math.max(6,Math.min(innerHeight-rect.height-6,y))+'px';
});
window.addEventListener('resize',()=>{if($('sheet-modal').classList.contains('open'))clampFloat()});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('sheet-modal').classList.contains('open')){
    e.stopPropagation();closeSheet();
  }
});

// A campanha tem uma única mesa permanente; ninguém precisa criar sala ou informar UID.
async function connectWorld(){
  stopSubs();
  if(!uid)return;
  const epoch=subscriptionEpoch, expectedUid=uid;
  room=WORLD_ID;
  renderSheets(); // Reabilita arrastar e colocar fichas após a conexão automática.
  $('world-status').textContent='Conectando à mesa compartilhada…';
  const world=roomRef();
  try{
    const existing=await getDoc(world);
    if(epoch!==subscriptionEpoch||uid!==expectedUid)return;
    if(existing.exists()&&auth.currentUser?.email==='mestre_shinobi@players.shinobi-chronicles.invalid'&&existing.data()?.masterUid!==uid){
      try{await updateDoc(world,{masterUid:uid,updatedAt:serverTimestamp()})}
      catch(e){show('Mestre: publique as novas regras do Firebase para habilitar a distinção de NPCs.')}
    }
    if(!existing.exists()&&admin){
      await setDoc(world,{
        name:'Shinobi Chronicles',masterUid:auth.currentUser?.email==='mestre_shinobi@players.shinobi-chronicles.invalid'?uid:'',scene:'',sceneName:'Sem cena ativa',activeSceneId:'',
        grid:64,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),turn:0,
        theatre:{enabled:false,cast:[],speaker:'',dialogue:''}
      });
    }
    if(epoch!==subscriptionEpoch||uid!==expectedUid)return;
    subs.push(onSnapshot(world,snap=>{
      if(epoch!==subscriptionEpoch)return;
      if(!snap.exists()){
        roomData=null;combatDirector.setData(null);battle.setData(null);
        $('world-status').textContent='Aguardando o mestre iniciar a campanha.';
        $('scene-name').textContent='Mesa Permanente';
        $('scene-caption').textContent='Nenhuma cena foi preparada ainda';
        $('scene-current-preview').hidden=true;
        $('scene-current-icon').hidden=false;
        $('scene-empty').hidden=false;
        return;
      }
      roomData=snap.data();masterUid=roomData?.masterUid||masterUid;sessionTools.refresh();
      combatDirector.setData(roomData.theatre?.combat||roomData.combat);
       battle.setData(roomData.theatre);
       combatDirector.refresh();
       refreshCombatTargets();gmQuick.refresh();renderTokens();
      theatre.setState(roomData.theatre);
      const cast=theatre.getCast();
      updateTheatreDirectory();
      syncTheatrePortraits(cast);syncTheatreVitals(cast);scheduleVitalSync();
      const rosterKey=String(masterUid)+'|'+cast.map(a=>a.id).join('|');
      if(rosterKey!==lastStageRosterKey){
        lastStageRosterKey=rosterKey;renderSheets();
      }
      $('world-status').textContent='Conectado · campanha compartilhada';
      $('room-heading').textContent='Mesa Permanente · '+(roomData.name||'Shinobi Chronicles');
      $('scene-name').textContent=roomData.sceneName||'Mesa Shinobi';
      $('scene-caption').textContent=admin?'Clique para abrir a biblioteca':'Cena compartilhada';
      $('turn-label').textContent='Turno '+(roomData.turn||0);
      $('current-scene-label').textContent=roomData.sceneName||'Nenhuma cena ativa';
      $('current-scene-subtitle').textContent=admin?'Clique para escolher um cenário':'Cenário compartilhado pelo mestre';
      const thumb=$('scene-current-preview'),icon=$('scene-current-icon');
      if(safeUrl(roomData.scene||'')){
        if(thumb.getAttribute('src')!==roomData.scene)thumb.src=roomData.scene;
        thumb.hidden=false;icon.hidden=true;
        thumb.onerror=()=>{thumb.hidden=true;icon.hidden=false};
      }else{thumb.hidden=true;thumb.removeAttribute('src');icon.hidden=false}
      view.cell=view.image&&sceneKey===roomData.scene?automaticMapCell(view.image):64;
      $('scene-empty').hidden=!!roomData.scene;
      updateMetricHud();updateMetricDrawStatus();
      watchTokens(roomData.activeSceneId||'');
      
      renderTokens();renderScenes();loadMap(roomData.scene||'');draw();
      if(!worldCollectionsReady){
        worldCollectionsReady=true;
        if(admin)subs.push(onSnapshot(collection(db,'vttRooms',WORLD_ID,'scenes'),sceneSnapshot=>{
          if(epoch!==subscriptionEpoch)return;
          scenes=sceneSnapshot.docs.map(d=>({id:d.id,...d.data()}));renderScenes();
        },e=>show('Biblioteca: '+e.message)));
        subs.push(onSnapshot(query(collection(db,'vttRooms',WORLD_ID,'events'),orderBy('at','desc'),limit(100)),events=>{
          if(epoch!==subscriptionEpoch)return;
          const eventRows=events.docs.map(d=>({id:d.id,data:d.data()}));
          rolls.setEvents(eventRows);
          sessionTools.setEvents(eventRows);
          for(const change of events.docChanges()){
            if(change.type!=='added'&&change.type!=='modified')continue;
            const data=change.doc.data();
            if(data.type==='door'){
              if(admin)void resolveDoorEvent(change.doc,epoch);
              continue;
            }
            if(data.type!=='effect')continue;
            if(data.payload?.sceneId&&data.payload.sceneId!==roomData?.activeSceneId)continue;
            const stamp=data.at?.toMillis?.();
            if(!stamp||Math.abs(Date.now()-stamp)>12000)continue;
            if(visualEffects.seenEvent(change.doc.id))continue;
            if(data.payload?.nonce&&localVfxNonces.has(data.payload.nonce))continue;
            visualEffects.play(data.payload?.kind,effectPoint(data.payload),data.payload?.jutsuName||'');
          }
        },e=>show('Histórico: '+e.message)));
        // Private rolls are fetched by the only principal authorized to see them.
        subs.push(onSnapshot(
          query(collection(db,'vttRooms',WORLD_ID,'privateRolls',uid,'entries'),orderBy('at','desc'),limit(90)),
          snapshot=>{
            if(epoch!==subscriptionEpoch)return;
            secretRollFeeds.self=snapshot.docs.map(d=>({id:d.id,data:d.data()}));
            syncSecretFeed();
          },e=>show('Rolagens privadas: publique as novas regras do Firebase. '+e.message)
        ));
        if(admin){
          subs.push(onSnapshot(
            query(collection(db,'vttRooms',WORLD_ID,'gmRolls'),orderBy('at','desc'),limit(90)),
            snapshot=>{
              if(epoch!==subscriptionEpoch)return;
              secretRollFeeds.gm=snapshot.docs.map(d=>({id:d.id,data:d.data()}));
              syncSecretFeed();
            },e=>show('Rolagens do mestre: publique as regras do Firebase. '+e.message)
          ));
          subs.push(onSnapshot(
            query(collection(db,'vttRooms',WORLD_ID,'blindRolls'),orderBy('at','desc'),limit(90)),
            snapshot=>{
              if(epoch!==subscriptionEpoch)return;
              secretRollFeeds.blind=snapshot.docs.map(d=>({id:d.id,data:d.data()}));
              syncSecretFeed();
            },e=>show('Rolagens cegas: publique as regras do Firebase. '+e.message)
          ));
          subs.push(onSnapshot(
            query(collection(db,'vttRooms',WORLD_ID,'blindRequests'),where('status','==','pending'),limit(45)),
            snapshot=>{
              if(epoch!==subscriptionEpoch)return;
              for(const req of snapshot.docs)void resolveBlindRequest(req,epoch);
            },e=>show('Pedidos cegos: publique as regras do Firebase. '+e.message)
          ));
        }
      }
    },e=>{
      $('world-status').textContent='Conexão indisponível · confira as regras do Firebase';
      show('Acesso à Mesa Permanente negado: '+e.message);
    }));
  }catch(e){
    if(epoch!==subscriptionEpoch)return;
    $('world-status').textContent='Não foi possível conectar à campanha';
    show('Mesa Permanente: '+e.message+'. Confira as regras do Firebase.');
  }
}
// Pedidos de abertura/fechamento são validados pelo mestre, inclusive
// propriedade do token, proximidade, parede intermediária e trinco.
function doorLineCrosses(ax,ay,bx,by,w){
  const vx=bx-ax,vy=by-ay,sx=w.x2-w.x1,sy=w.y2-w.y1;
  const cross=(x,y,u,v)=>x*v-y*u,den=cross(vx,vy,sx,sy);
  if(Math.abs(den)<1e-8)return false;
  const tx=w.x1-ax,ty=w.y1-ay,t=cross(tx,ty,sx,sy)/den,u=cross(tx,ty,vx,vy)/den;
  return t>.0001&&t<.9999&&u>=-.00001&&u<=1.00001;
}
async function resolveDoorEvent(entry,epoch){
  const id=entry.id,record=entry.data(),req=record.payload||{};
  if(!admin||epoch!==subscriptionEpoch||activeDoorEvents.has(id))return;
  if(record.type!=='door'||!record.uid||!req.sceneId||!req.wallId||!req.tokenId||
     !['open','closed'].includes(req.state))return;
  const stamp=record.at?.toMillis?.();
  if(!stamp||Math.abs(Date.now()-stamp)>30000||req.sceneId!==roomData?.activeSceneId)return;
  if(!view.image?.naturalWidth||sceneKey!==roomData?.scene){pendingDoorEvents.set(id,entry);return}
  pendingDoorEvents.delete(id);activeDoorEvents.add(id);
  const w=view.image.naturalWidth,h=view.image.naturalHeight,cell=automaticMapCell(view.image);
  try{
    await runTransaction(db,async tx=>{
      const roomSnap=await tx.get(roomRef()),tokenSnap=await tx.get(tokenRef(req.tokenId));
      if(!roomSnap.exists()||!tokenSnap.exists())return;
      const state=roomSnap.data(),token=tokenSnap.data();
      if(state.activeSceneId!==req.sceneId||token.sceneId!==req.sceneId||token.ownerUid!==record.uid)return;
      const wallsMap=state.theatre?.wallsMap||{},config=wallsMap[req.sceneId];
      if(!config||!Array.isArray(config.walls))return;
      const door=config.walls.find(wall=>wall.id===req.wallId);
      if(!door||!['door','secret'].includes(door.type)||door.state==='locked'||
         (door.type==='secret'&&door.state!=='open')||door.state===req.state)return;
      const a={x:(Number(token.x)+.5)*cell,y:(Number(token.y)+.75)*cell};
      const b={x:(Number(door.x1)+Number(door.x2))*w/2,y:(Number(door.y1)+Number(door.y2))*h/2};
      if(!Number.isFinite(a.x+a.y+b.x+b.y)||Math.hypot(b.x-a.x,b.y-a.y)>cell*1.75)return;
      const blocked=config.walls.some(wall=>{
        if(wall.id===door.id||wall.type==='ethereal'||
           (['door','secret'].includes(wall.type)&&wall.state==='open'))return false;
        const other={x1:Number(wall.x1)*w,y1:Number(wall.y1)*h,
          x2:Number(wall.x2)*w,y2:Number(wall.y2)*h};
        const side=(other.x2-other.x1)*(a.y-other.y1)-(other.y2-other.y1)*(a.x-other.x1);
        if((wall.dir==='left'&&side<0)||(wall.dir==='right'&&side>0))return false;
        return doorLineCrosses(a.x,a.y,b.x,b.y,other);
      });
      if(blocked)return;
      const walls=config.walls.map(wall=>wall.id===door.id?{...wall,state:req.state}:wall);
      tx.update(roomRef(),{'theatre.wallsMap':{...wallsMap,[req.sceneId]:{...config,walls}},
        updatedAt:serverTimestamp()});
    });
  }catch(error){show('Interação com porta: '+error.message)}
}
function watchTokens(sceneId){
  if(!room||tokenSceneSubscribed===sceneId)return;
  if(tokenUnsub){tokenUnsub();tokenUnsub=null}
  tokenSceneSubscribed=sceneId;tokens=[];selected=null;renderTokens();draw();
  const watchingRoom=room;
  const ref=collection(db,'vttRooms',room,'tokens');
  // Os jogadores consultam somente tokens da cena ativa; o mestre administra todos.
  const source=admin?ref:query(ref,where('sceneId','==',sceneId));
  tokenUnsub=onSnapshot(source,snap=>{
    if(room!==watchingRoom)return;
    tokens=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderTokens();draw();battle.render();combatDirector.refreshMapStatus();combatDirector.refresh();refreshCombatTargets();gmQuick.refresh();
  },err=>show('Permissão dos tokens: '+err.message));
}
function resetSceneEditor(){
  editingSceneId='';
  $('scene-title-input').value='';$('scene-url').value='';$('scene-meter-scale').value=String(DEFAULT_METERS_PER_CELL);
  $('scene-add').textContent='Salvar cena na biblioteca';
  $('scene-cancel-edit').hidden=true;
}
$('scene-cancel-edit').onclick=resetSceneEditor;
$('scene-add').onclick=async()=>{
  if(!admin||!room)return show('Somente o mestre pode preparar cenas.');
  const name=$('scene-title-input').value.trim(),url=$('scene-url').value.trim();
  const grid=64; // Unidade visual interna, independente da distância em metros.
  const rawScale=Number($('scene-meter-scale').value);
  if(!name||name.length>80||!safeUrl(url))
    return show('Informe o nome do mapa e uma URL HTTPS válida.');
  if(!Number.isFinite(rawScale)||rawScale<.05||rawScale>1000)
    return show('A escala deve estar entre 0,05 m e 1.000 m por célula.');
  const mScale=Math.round(rawScale*1000)/1000;
  try{
    if(editingSceneId){
      await updateDoc(doc(db,'vttRooms',room,'scenes',editingSceneId),{name,url,grid,metersPerCell:mScale,updatedAt:serverTimestamp()});
      if(roomData?.activeSceneId===editingSceneId){
        await updateDoc(roomRef(),{scene:url,sceneName:name,grid,metersPerCell:mScale,updatedAt:serverTimestamp()});
      }
      show('Cena atualizada na biblioteca.');
    }else{
      await addDoc(collection(db,'vttRooms',room,'scenes'),{name,url,grid,metersPerCell:mScale,createdAt:serverTimestamp()});
      show('Cena salva. Clique em Ativar para mostrá-la aos jogadores.');
    }
    resetSceneEditor();
  }catch(e){show('Não foi possível salvar a cena: '+e.message)}
};
function renderScenes(){
  const root=$('scene-library');root.replaceChildren();
  $('scene-count').textContent=String(scenes.length);
  if(!admin||!room)return;
  if(!scenes.length){const p=document.createElement('p');p.textContent='Nenhuma cena salva. Cadastre seu primeiro mapa acima.';root.append(p);return}
  for(const scene of [...scenes].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'))){
    const current=roomData?.activeSceneId===scene.id;
    const card=document.createElement('article');card.className='scene-card'+(current?' current':'');
    const img=document.createElement('img');img.className='scene-preview';img.src=scene.url;img.alt='Prévia de '+scene.name;img.loading='lazy';
    const info=document.createElement('div');info.className='scene-info';
    const title=document.createElement('strong');title.textContent=scene.name||'Cena sem nome';
    const detail=document.createElement('small');detail.textContent=(current?'● Em exibição · ':'Privada · ')
      +formatMeters(metersPerCell(scene.metersPerCell))+' / célula · enquadramento automático';
    const actions=document.createElement('div');actions.className='scene-actions';
    const activate=document.createElement('button');activate.className='btn small'+(!current?' primary':'');
    activate.textContent=current?'Ocultar dos jogadores':'Ativar para jogadores';
    activate.onclick=async()=>{
      if(!admin||!room)return;
      try{
        if(current)await updateDoc(roomRef(),{scene:'',sceneName:'Sem cena ativa',activeSceneId:'',updatedAt:serverTimestamp()});
        else await updateDoc(roomRef(),{scene:scene.url,sceneName:scene.name,activeSceneId:scene.id,grid:scene.grid||64,
          metersPerCell:metersPerCell(scene.metersPerCell),updatedAt:serverTimestamp()});
        show(current?'Cena ocultada.':'Cena ativada para todos.');
      }catch(e){show('Falha na ativação: '+e.message)}
    };
    const edit=document.createElement('button');edit.className='btn small';edit.textContent='Editar';
    edit.onclick=()=>{
      editingSceneId=scene.id;
      $('scene-title-input').value=scene.name||'';
      $('scene-url').value=scene.url||'';
      $('scene-meter-scale').value=String(metersPerCell(scene.metersPerCell));
      $('scene-add').textContent='Salvar alterações';
      $('scene-cancel-edit').hidden=false;
      $('scene-title-input').focus();
    };
    const remove=document.createElement('button');remove.className='btn small';remove.textContent='Excluir';remove.disabled=current;
    remove.title=current?'Oculte a cena antes de excluí-la':'Excluir mapa da biblioteca';
    remove.onclick=async()=>{
      if(!admin||!room||current||!confirm('Excluir esta cena da biblioteca do mestre?'))return;
      try{await deleteDoc(doc(db,'vttRooms',room,'scenes',scene.id));if(editingSceneId===scene.id)resetSceneEditor();show('Cena excluída.')}
      catch(e){show('Não foi possível excluir: '+e.message)}
    };
    actions.append(activate,edit,remove);info.append(title,detail,actions);card.append(img,info);root.append(card);
  }
}

function renderTokens(){
  const root=$('token-list');root.replaceChildren();
  const list=visibleTokens().filter(t=>battle.tokenVisible(t));
  $('tokens-count').textContent=String(list.length);
  const h=document.createElement('h3');h.textContent='Tokens da cena · '+list.length;root.append(h);
  if(!list.length){const p=document.createElement('p');p.textContent=admin?'Arraste uma ficha da pasta Jogadores ou NPCs até o mapa para colocar um token.':'O mestre ainda não colocou personagens nesta cena.';root.append(p);return}
  for(const t of list){
    const line=document.createElement('div');line.className='token-card'+(selected===t.id?' selected':'');
    const name=document.createElement('span');name.textContent=(t.name||'Shinobi')+' · X '+formatMeters((t.x+.5)*currentMetersPerCell())+' · Y '+formatMeters((t.y+1)*currentMetersPerCell());
    const choose=document.createElement('button');choose.className='btn small';choose.textContent='Localizar';
    choose.onclick=()=>{selected=t.id;view.ox=stage.clientWidth/2-(t.x+.5)*view.cell*view.zoom;view.oy=stage.clientHeight/2-(t.y+.5)*view.cell*view.zoom;renderTokens();draw()};
    line.append(name,choose);
    if(canMove(t)){
      const open=document.createElement('button');open.className='btn small';open.textContent='Ficha';
      open.onclick=()=>openSheet(t.fichaId,t.ownerUid);line.append(open);
    }
    if(admin){
      const toggle=document.createElement('button');toggle.className='btn small';
      const hidden=battle.isTokenHidden(t.id);
      toggle.textContent=hidden?'◉ Revelar':'◌ Ocultar';
      toggle.title=hidden?'Tornar este token visível aos jogadores':'Ocultar este token dos jogadores';
      toggle.onclick=async()=>{
        toggle.disabled=true;
        const ok=await battle.toggleTokenHidden(t.id);
        if(!ok)show('Não foi possível alterar a visibilidade do token.');
        renderTokens();gmQuick.refresh();draw();
      };
      line.append(toggle);
      const remove=document.createElement('button');remove.className='btn small';remove.textContent='Retirar';
      remove.title='Remove o token, não a ficha original';
      remove.onclick=async()=>{if(!confirm('Retirar o token de '+(t.name||'Shinobi')+'? A ficha original será mantida.'))return;try{await deleteDoc(tokenRef(t.id));if(selected===t.id)selected=null;show('Token retirado; ficha preservada.')}catch(e){show(e.message)}};
      line.append(remove);
      const openMenu=document.createElement('button');
      openMenu.type='button';openMenu.className='btn small';
      openMenu.textContent='⋯';openMenu.title='Ações de combate e Teatro';
      openMenu.setAttribute('aria-label','Ações de '+(t.name||'personagem'));
      openMenu.onclick=()=>{
        const sheet=sheets.find(f=>f.id===t.fichaId);
        if(!sheet)return show('Ficha vinculada indisponível.');
        const rect=openMenu.getBoundingClientRect();
        openActorMenu(sheet,rect.left,rect.bottom+4,openMenu);
      };
      line.append(openMenu);
      const original=sheets.find(f=>f.id===t.fichaId);
      if(original){
        const restore=document.createElement('button');restore.className='btn small';
        restore.textContent='Atualizar PNG';restore.title='Atualizar arte de tokens criados antes desta versão';
        restore.onclick=async()=>{try{const portrait=await tokenPortrait(original);await updateDoc(tokenRef(t.id),{portrait});show('Arte atualizada mantendo a transparência disponível na ficha.')}catch(e){show('Falha ao atualizar arte: '+e.message)}};
        line.append(restore);
      }
    }
    root.append(line);
  }
}
$('next-turn').onclick=async()=>{if(admin&&room)try{await updateDoc(roomRef(),{turn:(roomData?.turn||0)+1,updatedAt:serverTimestamp()})}catch(e){show(e.message)}};
function effectPoint(payload){
  let target=payload?.target;
  if(!target&&payload?.targetFichaId)
    target=visibleTokens().find(t=>t.fichaId===payload.targetFichaId);
  if(!target&&!payload?.targetFichaId&&payload?.fichaId)
    target=visibleTokens().find(t=>t.fichaId===payload.fichaId);
  if(target&&Number.isFinite(target.x)&&Number.isFinite(target.y)){
    return {
      x:view.ox+(target.x+.5)*view.cell*view.zoom,
      y:view.oy+(target.y+.5)*view.cell*view.zoom
    };
  }
  return {x:stage.clientWidth/2,y:stage.clientHeight/2};
}
$('cast-effect').onclick=async()=>{
  if(!admin||!room)return show('Apenas o mestre ativa efeitos da mesa.');
  const kind=effectOptions.value;
  if(!EFFECTS.some(x=>x.id===kind))return;
  const selectedTarget=$('effect-target').value;
  const onToken=selectedTarget==='selected'||selectedTarget.startsWith('sheet:');
  const target=selectedTarget==='selected'?visibleTokens().find(t=>t.id===selected):
    selectedTarget.startsWith('sheet:')?visibleTokens().find(t=>t.fichaId===selectedTarget.slice(6)):null;
  if(onToken&&!target)return show('Coloque o personagem no mapa ou selecione um token para executar o efeito nele.');
  const nonce=uid+'-'+Date.now()+'-'+Math.floor(Math.random()*1000000);
  localVfxNonces.add(nonce);
  setTimeout(()=>localVfxNonces.delete(nonce),15000);
  const payload={kind,sceneId:roomData?.activeSceneId||'',nonce};
  if(target)payload.target={x:target.x,y:target.y};
  visualEffects.play(kind,effectPoint(payload));
  $('effect-feedback').textContent='Efeito executado: '+(EFFECTS.find(x=>x.id===kind)?.name||kind);
  try{
    await addDoc(collection(db,'vttRooms',room,'events'),{type:'effect',uid,at:serverTimestamp(),payload});
  }catch(e){
    show('Efeito exibido apenas localmente; falha ao compartilhar: '+e.message);
    $('effect-feedback').textContent='Não foi possível compartilhar o efeito com os jogadores.';
  }
};
// Um toque para executar efeitos frequentes; posiciona no token selecionado
// quando existe um alvo, senão no centro da cena.
for(const button of document.querySelectorAll('#fx-quick [data-fx]')){
  button.addEventListener('click',()=>{
    if(!admin||!room)return show('Efeitos rápidos disponíveis apenas para o mestre.');
    const id=button.dataset.fx;
    if(!EFFECTS.some(effect=>effect.id===id))return;
    effectOptions.value=id;updateEffectHelp();
    // O efeito rápido usa o alvo já escolhido no seletor do mestre.
    $('cast-effect').click();
  });
}
function automaticMapCell(img){return Math.max(32,Math.min(192,Math.round(Math.min(img.naturalWidth||img.width,img.naturalHeight||img.height)/18)))}
function loadMap(url){
  if(sceneKey===url)return;
  sceneKey=url;
  // Ruler coordinates from a different scene must never remain on this map.
  if(measure.enabled)setMetricTool('off');
  measure.start=null;measure.end=null;measure.drawnPx=0;
  view.image=null;
  if(!safeUrl(url)){
    stage.classList.remove('scene-loading');view.cell=64;center();
    updateMetricHud();return;
  }
  stage.classList.add('scene-loading');
  const img=new Image();
  img.onload=()=>{
    if(sceneKey!==url)return;
    view.image=img;view.cell=automaticMapCell(img);center();
    if(admin&&!$('pane-ambiente').hidden&&activeEnvironmentView==='walls')battle.enterWallEdit();
    for(const event of pendingDoorEvents.values())void resolveDoorEvent(event,subscriptionEpoch);
    pendingDoorEvents.clear();
    updateMetricHud();
    setTimeout(()=>{if(sceneKey===url)stage.classList.remove('scene-loading')},230);
  };
  img.onerror=()=>{
    if(sceneKey!==url)return;
    stage.classList.remove('scene-loading');
    $('scene-empty').hidden=false;updateMetricHud();
    show('Não foi possível carregar a imagem da cena. Confira a URL HTTPS.');
  };
  img.src=url;draw();
}
function center(){view.zoom=1;const w=stage.clientWidth,h=stage.clientHeight;if(view.image){const scale=Math.min((w-28)/view.image.width,(h-28)/view.image.height);view.zoom=Math.max(.012,Math.min(4,scale));view.ox=(w-view.image.width*view.zoom)/2;view.oy=(h-view.image.height*view.zoom)/2}else{view.ox=w/2-8*view.cell;view.oy=h/2-5*view.cell}draw();updateMetricHud()}
const world=(x,y)=>({x:(x-view.ox)/view.zoom,y:(y-view.oy)/view.zoom});
function spriteBounds(t){
  const image=tokenImage(t.portrait);
  const ratio=image?.naturalWidth&&image?.naturalHeight?Math.max(.16,Math.min(4,image.naturalWidth/image.naturalHeight)):.67;
  let height=view.cell*1.65,width=height*ratio;
  if(width>view.cell*1.7){width=view.cell*1.7;height=width/ratio}
  const x=(t.x+.5)*view.cell,y=(t.y+1)*view.cell;
  return {image,left:x-width/2,top:y-height,width,height,x,y};
}
function draw(){
  const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
  ctx.clearRect(0,0,w,h);ctx.save();
  ctx.translate(view.ox,view.oy);ctx.scale(view.zoom,view.zoom);
  // Fora dos limites da imagem, o canvas fica transparente e exibe o fundo
  // escuro da área de jogo, independentemente do modo claro/escuro.
  if(view.image)ctx.drawImage(view.image,0,0);
  battle.paintFog(ctx,view);
  // Tokens sob a névoa não são desenhados para os jogadores.
  for(const t of visibleTokens().filter(t=>battle.tokenVisible(t))){
    const b=spriteBounds(t);
    if(b.image?.complete&&b.image.naturalWidth){
      ctx.save();
      if(admin&&battle.isTokenHidden(t.id))ctx.globalAlpha=.48;
      ctx.shadowColor='rgba(0,0,0,.42)';ctx.shadowBlur=9;ctx.shadowOffsetY=5;
      ctx.drawImage(b.image,b.left,b.top,b.width,b.height);
      ctx.restore();
    }else if(!t.portrait){
      ctx.save();if(admin&&battle.isTokenHidden(t.id))ctx.globalAlpha=.48;ctx.fillStyle='#f2e4cc';ctx.textAlign='center';ctx.font='600 12px system-ui';
      ctx.fillText((t.name||'Shinobi').slice(0,18),b.x,b.y-view.cell*.3);ctx.restore();
    }
    battle.drawTokenMarks(ctx,t,view,b);
    if(selected===t.id){
      // Apenas a seleção tem indicadores discretos nos cantos, nunca um aro permanente.
      const pad=view.cell*.07,l=b.left-pad,r=b.left+b.width+pad,top=b.top-pad,bot=b.top+b.height+pad,d=view.cell*.14;
      ctx.save();ctx.strokeStyle='#f7dca5';ctx.lineWidth=2/view.zoom;ctx.beginPath();
      ctx.moveTo(l+d,top);ctx.lineTo(l,top);ctx.lineTo(l,top+d);
      ctx.moveTo(r-d,top);ctx.lineTo(r,top);ctx.lineTo(r,top+d);
      ctx.moveTo(l,bot-d);ctx.lineTo(l,bot);ctx.lineTo(l+d,bot);
      ctx.moveTo(r-d,bot);ctx.lineTo(r,bot);ctx.lineTo(r,bot-d);
      ctx.stroke();ctx.restore();
    }
  }
  battle.drawWalls(ctx,view);
  ctx.restore();
  drawRuler();
  drawTokenTravel();
}
// Mostra a distância de deslocamento durante um arraste, sem impor grade.
function drawTokenTravel(){
  if(!dragToken?.t||!dragToken.original||measure.enabled)return;
  const t=dragToken.t,old=dragToken.original;
  const a={
    x:view.ox+(old.x+.5)*view.cell*view.zoom,
    y:view.oy+(old.y+1)*view.cell*view.zoom
  };
  const b={
    x:view.ox+(t.x+.5)*view.cell*view.zoom,
    y:view.oy+(t.y+1)*view.cell*view.zoom
  };
  const meters=Math.hypot(t.x-old.x,t.y-old.y)*currentMetersPerCell();
  if(meters<.05)return;
  ctx.save();
  ctx.setLineDash([5,5]);ctx.lineWidth=1.6;ctx.strokeStyle='#f5d399';
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
  const label=formatMeters(meters),x=(a.x+b.x)/2,y=(a.y+b.y)/2;
  ctx.font='700 11px system-ui';
  const w=ctx.measureText(label).width+16;
  ctx.fillStyle='#1b2e24ed';ctx.strokeStyle='#d9bb8d';ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(x-w/2,y-30,w,22,6);ctx.fill();ctx.stroke();
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff0d0';
  ctx.fillText(label,x,y-19);
  ctx.restore();
}
window.addEventListener('sc-vtt-appearance',()=>{
  // Redesenha somente a área vazia do mapa; a arte do cenário não é alterada.
  draw();
  updateMetricHud();
});
function hit(x,y){
  const p=world(x,y),list=visibleTokens();
  for(let i=list.length-1;i>=0;i--){
    const t=list[i];if(!battle.tokenVisible(t))continue;
    const b=spriteBounds(t);
    if(p.x>=b.left&&p.x<=b.left+b.width&&p.y>=b.top&&p.y<=b.top+b.height)return t;
  }
  return null;
}
function drawRuler(){
  if(!measure.enabled||!measure.start||!measure.end)return;
  const a={x:view.ox+measure.start.x*view.zoom,y:view.oy+measure.start.y*view.zoom};
  const b={x:view.ox+measure.end.x*view.zoom,y:view.oy+measure.end.y*view.zoom};
  const px=Math.hypot(measure.end.x-measure.start.x,measure.end.y-measure.start.y);
  if(px<1)return;
  const label=formatMeters(pixelsToMeters(px,view.cell,currentMetersPerCell()));
  ctx.save();
  ctx.lineCap='round';ctx.strokeStyle='#f3d5a0';ctx.lineWidth=2.7;
  ctx.shadowBlur=8;ctx.shadowColor='#0b170de0';ctx.setLineDash([8,5]);
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  ctx.shadowBlur=0;ctx.setLineDash([]);
  for(const p of [a,b]){
    ctx.beginPath();ctx.arc(p.x,p.y,4.7,0,Math.PI*2);
    ctx.fillStyle='#fff1d2';ctx.fill();ctx.strokeStyle='#5d7456';ctx.lineWidth=2;ctx.stroke();
  }
  const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
  ctx.font='700 12px system-ui';
  const width=ctx.measureText(label).width+23;
  ctx.fillStyle='#15281fe9';ctx.strokeStyle='#cdb58a';ctx.lineWidth=1;
  const left=x-width/2,top=y-35;
  ctx.beginPath();ctx.roundRect(left,top,width,25,7);ctx.fill();ctx.stroke();
  ctx.fillStyle='#ffe8b6';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(label,x,top+12.5);
  ctx.restore();
}
const point=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
let fogDrawing=false,drawRequested=false;
function requestDraw(){
  if(drawRequested)return;
  drawRequested=true;
  requestAnimationFrame(()=>{drawRequested=false;draw()});
}
function updateStageToolStatus(){
  const label=$('sc-tool-active-label'),exit=$('sc-tool-exit');if(!label||!exit)return;
  const text=battle.isMode('wall-select')?'Editando paredes':
    battle.isMode('wall-draw')?'Desenhando paredes':
    battle.isMode('reveal')?'Revelando área':
    battle.isMode('brush-reveal')?'Pincel revelar':
    battle.isMode('brush-cover')?'Pincel ocultar':
    battle.isMode('target')?'Selecionar alvo':
    measure.enabled?'Régua':'';
  label.hidden=!text;exit.hidden=!text;label.textContent=text;
}
$('sc-tool-exit').onclick=()=>{
  if(measure.enabled)setMetricTool('off');
  battle.cancel();updateStageToolStatus();
};
new MutationObserver(()=>updateStageToolStatus())
  .observe(stage,{attributes:true,attributeFilter:['class']});

function reflectBattleMode(){
  stage.classList.toggle('sc-battle-target',battle.isMode('target'));
  stage.classList.toggle('sc-battle-fog',['reveal','brush-reveal','brush-cover'].some(kind=>battle.isMode(kind)));
  stage.classList.toggle('sc-battle-walls',battle.isMode('wall-draw')||battle.isMode('wall-select'));
  updateStageToolStatus();
}
canvas.onpointerdown=e=>{if(e.button!==0)return;const p=point(e);
  if(!measure.enabled&&!['target','reveal','brush-reveal','brush-cover','wall-draw','wall-select']
      .some(kind=>battle.isMode(kind))){
    const q=world(p.x,p.y);
    if(battle.doorHint(q.x,q.y)){
      e.preventDefault();void battle.toggleDoorAt(q.x,q.y);return;
    }
  }
  if(battle.isMode('target')||['reveal','brush-reveal','brush-cover','wall-draw','wall-select'].some(kind=>battle.isMode(kind))){
    const q=world(p.x,p.y),token=hit(p.x,p.y);
    fogDrawing=['reveal','brush-reveal','brush-cover','wall-draw','wall-select'].some(kind=>battle.isMode(kind));
    if(battle.pointerDown(q.x,q.y,token)){
      e.preventDefault();
      if(fogDrawing)canvas.setPointerCapture(e.pointerId);
      reflectBattleMode();
      return;
    }
  }if(measure.enabled){if(!view.image)return show('Ative e carregue um cenário antes de medir.');measure.start=world(p.x,p.y);measure.end=measure.start;measure.drag=true;measure.drawnPx=0;canvas.setPointerCapture(e.pointerId);updateMetricDrawStatus();draw();return}const t=hit(p.x,p.y);selected=t?.id||null;renderTokens();draw();if(t&&!canMove(t))return;dragToken={id:e.pointerId,start:p,ox:view.ox,oy:view.oy,t,original:t?{x:t.x,y:t.y}:null};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging')};
canvas.onpointermove=e=>{
  if(!fogDrawing&&!dragToken&&!measure.enabled){
    const p=point(e),q=world(p.x,p.y),hint=battle.doorHint(q.x,q.y);
    canvas.style.cursor=hint?'pointer':'';canvas.title=hint;
  }
  if(fogDrawing){
    const p=point(e),q=world(p.x,p.y);
    battle.pointerMove(q.x,q.y);
    requestDraw();return;
  }
  if(measure.enabled&&measure.drag){const p=point(e);measure.end=world(p.x,p.y);measure.drawnPx=Math.hypot(measure.end.x-measure.start.x,measure.end.y-measure.start.y);updateMetricDrawStatus();draw();return}if(!dragToken||dragToken.id!==e.pointerId)return;const p=point(e);if(dragToken.t){
    const q=world(p.x,p.y),token=dragToken.t;
    const nx=Math.max(0,Math.min(1000,Math.round((q.x/view.cell-.5)*1000)/1000));
    const ny=Math.max(0,Math.min(1000,Math.round((q.y/view.cell-1)*1000)/1000));
    const cell=view.cell;
    const ax=(token.x+.5)*cell,ay=(token.y+.75)*cell;
    const bx=(nx+.5)*cell,by=(ny+.75)*cell;
    // O mestre pode atravessar paredes segurando Shift para preparar a cena.
    if((admin&&e.shiftKey)||!battle.blocksMovement(ax,ay,bx,by)){
      token.x=nx;token.y=ny;
    }
  }else{view.ox=dragToken.ox+p.x-dragToken.start.x;view.oy=dragToken.oy+p.y-dragToken.start.y}requestDraw()};
const finish=async e=>{
  if(fogDrawing){
    fogDrawing=false;
    const p=point(e),q=world(p.x,p.y);
    await battle.pointerUp(q.x,q.y);
    reflectBattleMode();
    return;
  }
  if(measure.drag){measure.drag=false;updateMetricDrawStatus();draw();return}if(!dragToken||dragToken.id!==e.pointerId)return;const d=dragToken;dragToken=null;canvas.classList.remove('dragging');if(d.t&&room&&(d.t.x!==d.original.x||d.t.y!==d.original.y)){try{await updateDoc(tokenRef(d.t.id),{x:d.t.x,y:d.t.y})}catch(err){d.t.x=d.original.x;d.t.y=d.original.y;draw();show('Movimento recusado: '+err.message)}}};
canvas.onpointerup=finish;
canvas.onpointercancel=e=>{
  if(fogDrawing){fogDrawing=false;battle.cancel();reflectBattleMode();return}
  void finish(e);
};
canvas.ondblclick=e=>{const p=point(e),t=hit(p.x,p.y);if(t)openSheet(t.fichaId,t.ownerUid)};
canvas.oncontextmenu=e=>{
  if(!admin||!room||measure.enabled)return;
  const p=point(e),token=hit(p.x,p.y);
  if(!token){closeActorMenu();return}
  // O menu só substitui o clique direito nativo sobre personagens do mapa.
  e.preventDefault();
  selected=token.id;renderTokens();draw();
  const sheet=sheets.find(f=>f.id===token.fichaId);
  if(!sheet){show('Token sem ficha disponível: não é possível usar Teatro ou iniciativa.');return}
  openActorMenu(sheet,e.clientX,e.clientY,canvas);
};
// Arrastar as fichas da iniciativa e da biblioteca utiliza o mesmo formato.
const canPlaceToken=()=>admin&&!!room&&!!roomData?.activeSceneId;
const toTokenCoord=(x,y)=>({
  x:Math.max(0,Math.min(1000,Math.round(Number(x)*1000)/1000)),
  y:Math.max(0,Math.min(1000,Math.round(Number(y)*1000)/1000))
});
async function spawn(f,x,y,{silent=false}={}){
  if(!canPlaceToken()){
    if(!silent)show('Ative um cenário na Biblioteca antes de colocar personagens.');
    return null;
  }
  try{
    const position=toTokenCoord(x,y);
    const created=await addDoc(collection(db,'vttRooms',room,'tokens'),{
      name:String(f.nome||f.name||'Shinobi').slice(0,40),
      fichaId:f.id,ownerUid:f.ownerUid,x:position.x,y:position.y,
      color:'#a57c64',portrait:await tokenPortrait(f),
      sceneId:roomData.activeSceneId
    });
    if(!silent)show('Token criado: '+(f.nome||'Shinobi'));
    return created.id;
  }catch(error){
    if(!silent)show('Falha ao criar token: '+error.message);
    throw error;
  }
}
async function placeSheetsOnMap(ids,pointOnMap=null){
  if(!canPlaceToken())return show('Ative um mapa na Biblioteca antes de posicionar os personagens.');
  const sheetIds=[...new Set(Array.isArray(ids)?ids:[])].filter(id=>typeof id==='string').slice(0,24);
  const available=sheetIds.map(id=>sheets.find(f=>f.id===id)).filter(Boolean);
  if(!available.length)return show('Selecione uma ou mais fichas válidas.');
  const existing=new Map(visibleTokens().filter(t=>t.fichaId).map(t=>[t.fichaId,t]));
  const needsPlacement=pointOnMap?available:available.filter(f=>!existing.has(f.id));
  const cols=Math.max(1,Math.min(4,Math.ceil(Math.sqrt(needsPlacement.length||1))));
  const rows=Math.ceil(needsPlacement.length/cols);
  const anchor=pointOnMap||world(stage.clientWidth/2,stage.clientHeight/2);
  let created=0,moved=0,already=0,failed=0,firstTokenId='';
  for(let i=0;i<available.length;i++){
    const f=available[i],token=existing.get(f.id);
    // Quando usamos o botão, personagens já posicionados são preservados;
    // ao arrastar sobre o mapa, tokens existentes são deslocados até a queda.
    if(token&&!pointOnMap){
      already++;
      if(!firstTokenId)firstTokenId=token.id;
      continue;
    }
    const slot=needsPlacement.findIndex(item=>item.id===f.id);
    const offsetX=(slot%cols-(cols-1)/2)*1.25;
    const offsetY=(Math.floor(slot/cols)-(rows-1)/2)*1.4;
    const position=toTokenCoord(
      anchor.x/view.cell-.5+offsetX,
      anchor.y/view.cell-1+offsetY
    );
    try{
      if(token){
        await updateDoc(tokenRef(token.id),position);
        moved++;
        if(!firstTokenId)firstTokenId=token.id;
      }else{
        const tokenId=await spawn(f,position.x,position.y,{silent:true});
        if(tokenId){
          created++;
          if(!firstTokenId)firstTokenId=tokenId;
        }else failed++;
      }
    }catch(error){failed++;console.warn('Posicionamento de ficha no mapa:',error)}
  }
  if(firstTokenId){
    selected=firstTokenId;
    if(available.length===1&&already===1){
      const token=existing.get(available[0].id);
      if(token){
        view.ox=stage.clientWidth/2-(token.x+.5)*view.cell*view.zoom;
        view.oy=stage.clientHeight/2-(token.y+.7)*view.cell*view.zoom;
      }
    }
    renderTokens();draw();
  }
  const report=[
    created?created+' criado(s)':'',moved?moved+' reposicionado(s)':'',
    already?already+' já estavam no mapa':'',failed?failed+' falharam':''
  ].filter(Boolean).join(' · ');
  show((report||'Nenhum token foi alterado')+'. Dê dois cliques no token para abrir a ficha.');
  combatDirector.refreshMapStatus();
  return {created,moved,already,failed};
}
canvas.ondragover=e=>{
  if(!canPlaceToken())return;
  if(![...(e.dataTransfer?.types||[])].some(type=>type==='text/shinobi-ficha'||type==='text/shinobi-fichas'))return;
  e.preventDefault();
  e.dataTransfer.dropEffect='copy';
  stage.classList.add('sc-sheet-drop');
};
canvas.ondragleave=e=>{
  if(!canvas.contains(e.relatedTarget))stage.classList.remove('sc-sheet-drop');
};
canvas.ondrop=e=>{
  stage.classList.remove('sc-sheet-drop');
  if(!canPlaceToken())return;
  const rawSingle=e.dataTransfer?.getData('text/shinobi-ficha')||'';
  const rawGroup=e.dataTransfer?.getData('text/shinobi-fichas')||'';
  let ids=[];
  try{
    const group=JSON.parse(rawGroup);
    if(Array.isArray(group))ids=group.filter(v=>typeof v==='string').slice(0,24);
  }catch(error){/* Fichas arrastadas da aba Campanha possuem apenas um ID. */}
  if(!ids.length&&rawSingle)ids=[rawSingle];
  if(!ids.length)return;
  e.preventDefault();
  const p=point(e),w=world(p.x,p.y);
  void placeSheetsOnMap(ids,w);
};
function zoom(factor){const x=stage.clientWidth/2,y=stage.clientHeight/2,p=world(x,y);view.zoom=Math.max(.07,Math.min(4,view.zoom*factor));view.ox=x-p.x*view.zoom;view.oy=y-p.y*view.zoom;draw();updateMetricHud()}
canvas.onwheel=e=>{e.preventDefault();zoom(e.deltaY<0?1.1:.9)};
$('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(.8);$('reset').onclick=center;function setMetricTool(mode){
  const calibrating=mode==='calibrate',enabled=mode==='ruler'||calibrating;
  if(enabled&&!view.image){show('Abra um mapa para medir distâncias.');return}
  if(calibrating&&!admin){show('Só o mestre pode calibrar a escala.');return}
  if(enabled)battle.cancel();
  measure.enabled=enabled;measure.calibrating=calibrating;measure.drag=false;
  measure.start=null;measure.end=null;measure.drawnPx=0;
  $('metric-known-distance').value='';
  $('tool-ruler').classList.toggle('active',enabled&&!calibrating);
  $('tool-calibrate').classList.toggle('active',calibrating);
  $('tool-ruler').setAttribute('aria-pressed',String(enabled&&!calibrating));
  $('tool-calibrate').setAttribute('aria-pressed',String(calibrating));
  $('metric-card').hidden=!calibrating;
  canvas.style.cursor=enabled?'crosshair':'';
  updateMetricDrawStatus();draw();updateStageToolStatus();
  if(calibrating)show('Calibração: arraste a régua sobre uma distância conhecida.');
  else if(enabled)show('Régua em metros: arraste entre dois pontos. Pressione R para sair.');
}
$('tool-ruler').onclick=()=>setMetricTool(measure.enabled&&!measure.calibrating?'off':'ruler');
$('tool-calibrate').onclick=()=>setMetricTool(measure.calibrating?'off':'calibrate');
$('metric-hud-calibrate').onclick=()=>setMetricTool('calibrate');
$('metric-close').onclick=()=>setMetricTool('off');
$('metric-known-distance').addEventListener('input',updateMetricDrawStatus);
$('metric-save').onclick=async()=>{
  if(!admin||!room||!roomData?.activeSceneId||!view.image)
    return show('Só é possível calibrar uma cena ativa como mestre.');
  if(measure.drawnPx<2)return show('Desenhe uma linha de referência sobre o mapa.');
  const known=Number($('metric-known-distance').value);
  const scale=calibrateMetersPerCell(measure.drawnPx,known,view.cell);
  if(scale===null)return show('Distância fora do intervalo. Calibre entre 0,05 m e 1.000 m por célula.');
  const button=$('metric-save');button.disabled=true;
  try{
    const sceneId=roomData.activeSceneId;
    await updateDoc(doc(db,'vttRooms',room,'scenes',sceneId),{metersPerCell:scale,updatedAt:serverTimestamp()});
    await updateDoc(roomRef(),{metersPerCell:scale,updatedAt:serverTimestamp()});
    roomData.metersPerCell=scale;
    updateMetricHud();draw();
    setMetricTool('off');
    show('Escala salva: '+formatMeters(scale)+' por célula virtual, compartilhada com todos.');
  }catch(error){show('Não foi possível salvar a calibração: '+error.message)}
  finally{button.disabled=false}
};
document.addEventListener('keydown',e=>{
  const target=e.target;
  if(target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if($('sheet-modal').classList.contains('open')||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key?.toLowerCase()==='r'&&!e.repeat){
    e.preventDefault();
    setMetricTool(measure.enabled?'off':'ruler');
  }else if(e.key==='Escape'&&measure.enabled){setMetricTool('off')}
});
let previousStageWidth=0,previousStageHeight=0;
new ResizeObserver(()=>{
  const width=stage.clientWidth,height=stage.clientHeight;
  if(!width||!height)return;
  const hadViewport=previousStageWidth>0&&previousStageHeight>0;
  const centerBefore=hadViewport?world(previousStageWidth/2,previousStageHeight/2):null;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  previousStageWidth=width;previousStageHeight=height;
  if(centerBefore){
    view.ox=width/2-centerBefore.x*view.zoom;
    view.oy=height/2-centerBefore.y*view.zoom;
    draw();
  }else if(view.image)center();
  else draw();
  updateMetricHud();
}).observe(stage);


const workspace=$('workspace');
function updateSpaceToggle(button,hidden,hiddenLabel,shownLabel){
  button.setAttribute('aria-pressed',String(hidden));
  button.setAttribute('aria-label',hidden?shownLabel:hiddenLabel);
  button.title=hidden?shownLabel:hiddenLabel;
}
$('vtt-toggle-rail').onclick=()=>{
  const hidden=workspace.classList.toggle('rail-hidden');
  $('vtt-toggle-rail').textContent=hidden?'❯':'❮';
  updateSpaceToggle($('vtt-toggle-rail'),hidden,'Recolher ferramentas','Expandir ferramentas');
};
$('vtt-toggle-panel').onclick=()=>{
  const hidden=workspace.classList.toggle('panel-hidden');
  updateSpaceToggle($('vtt-toggle-panel'),hidden,'Ocultar painel lateral','Mostrar painel lateral');
};
workspace.addEventListener('transitionend',e=>{
  if(e.propertyName==='grid-template-columns'){draw();updateMetricHud()}
});
$('vtt-exit').onclick=()=>{if(window.parent&&window.parent!==window)window.parent.postMessage({scVtt:'exit'},location.origin);else location.assign('./index.html')};
$('vtt-manage-sheets').onclick=()=>{if(!admin)return;if(window.parent&&window.parent!==window)window.parent.postMessage({scVtt:'admin'},location.origin);else location.assign('./index.html')};
$('vtt-fullscreen').onclick=async()=>{
  try{
    if(document.fullscreenElement)await document.exitFullscreen();
    else await workspace.requestFullscreen();
  }catch(e){show('Tela cheia indisponível: '+e.message)}
};

document.addEventListener('keydown',e=>{
  if(e.target?.closest?.('input,textarea,select,[contenteditable]')||
     $('sheet-modal').classList.contains('open'))return;
  if(admin&&battle.isWallEditing()&&(e.ctrlKey||e.metaKey)&&
     e.key.toLowerCase()==='z'&&!e.shiftKey){
    e.preventDefault();e.stopImmediatePropagation();
    void battle.undoWallEdit();return;
  }
  if(e.key==='Delete'&&admin&&battle.isWallEditing()){
    e.preventDefault();e.stopImmediatePropagation();
    if(battle.isWallSelected())void battle.deleteSelectedWall();
    else show('Clique numa parede para selecioná-la antes de pressionar Del.');
    return;
  }
  const t=visibleTokens().find(x=>x.id===selected);
  if((e.key==='c'||e.key==='C')&&t&&canMove(t)){
    e.preventDefault();openSheet(t.fichaId,t.ownerUid);
  }
  if(e.key==='Delete'&&admin&&t){
    e.preventDefault();
    if(confirm('Retirar token '+t.name+'?'))deleteDoc(tokenRef(t.id)).catch(err=>show(err.message));
  }
});

let nudgeInFlight=false;
document.addEventListener('keydown',async e=>{
  if(e.target?.closest?.('input,textarea,select,[contenteditable]')||
     $('sheet-modal').classList.contains('open')||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='Escape'){
    if(battle.cancel()){updateStageToolStatus();e.preventDefault();return}
  }
  const key=e.key.toLowerCase();
  if(key==='i'&&admin&&!e.repeat){
    e.preventDefault();switchTab('combate');
    if($('workspace').classList.contains('panel-hidden'))$('vtt-toggle-panel').click();
    return;
  }
  if(key==='f'&&admin&&!e.repeat){
    e.preventDefault();
    if(measure.enabled)setMetricTool('off');
    if(activeEnvironmentView!=='fog'||$('pane-ambiente').hidden){
      activeEnvironmentView='fog';switchTab('ambiente');
    }
    battle.toggleFogMode();
    updateStageToolStatus();
    return;
  }
  if(key==='+'||key==='='){e.preventDefault();zoom(1.1);return}
  if(key==='-'){e.preventDefault();zoom(1/1.1);return}
  if(key==='0'){e.preventDefault();center();return}
  const steps={'ArrowLeft':[-1,0],'ArrowRight':[1,0],'ArrowUp':[0,-1],'ArrowDown':[0,1]};
  if(!steps[e.key]||!room||measure.enabled||battle.isWallEditing()||battle.isMode('reveal')||battle.isMode('brush-reveal')||battle.isMode('brush-cover')||battle.isMode('target'))return;
  const token=visibleTokens().find(t=>t.id===selected);
  if(!token||!canMove(token)||!battle.tokenVisible(token))return;
  e.preventDefault();
  if(e.repeat||nudgeInFlight)return;
  const [dx,dy]=steps[e.key],step=e.shiftKey?.25:.05;
  const previous={x:token.x,y:token.y};
  const nx=Math.max(0,Math.min(1000,Math.round((token.x+dx*step)*1000)/1000));
  const ny=Math.max(0,Math.min(1000,Math.round((token.y+dy*step)*1000)/1000));
  const cell=view.cell;
  if(!(admin&&e.shiftKey)&&battle.blocksMovement(
    (token.x+.5)*cell,(token.y+.75)*cell,(nx+.5)*cell,(ny+.75)*cell)){
    show('Uma parede ou porta fechada bloqueia esse movimento.');return;
  }
  token.x=nx;token.y=ny;
  renderTokens();draw();
  nudgeInFlight=true;
  try{await updateDoc(tokenRef(token.id),{x:token.x,y:token.y})}
  catch(error){
    token.x=previous.x;token.y=previous.y;
    renderTokens();draw();show('Movimento não autorizado: '+error.message);
  }finally{nudgeInFlight=false}
});
