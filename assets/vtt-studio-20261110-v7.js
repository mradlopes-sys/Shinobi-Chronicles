import {createTheatre} from './vtt-theatre-v5.js';
import {createRollsPanel} from './vtt-rolls-v2.js';
import {createVisualEffects,EFFECTS} from './vtt-effects.js';
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore,doc,getDoc,addDoc,setDoc,collection,onSnapshot,serverTimestamp,updateDoc,query,where,getDocs,deleteDoc,limit,orderBy} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
const cfg={apiKey:'AIzaSyCdTZejzKXYyyAnYgak7ADEsDhfsdFgvVo',authDomain:'shinobi-chronicles-b9635.firebaseapp.com',projectId:'shinobi-chronicles-b9635',appId:'1:1000505549378:web:e1cbf459451b617f3503db'};
const app=getApps()[0]||initializeApp(cfg),auth=getAuth(app),db=getFirestore(app);
const WORLD_ID='shinobi-chronicles';
const $=id=>document.getElementById(id);
let uid='',admin=false,room='',roomData=null,tokens=[],sheets=[],scenes=[],subs=[],dragToken=null,selected=null,sceneKey='',lastRoll='',busy=false,editingSceneId='',tokenUnsub=null,tokenSceneSubscribed=null,sheetsUnsub=null,subscriptionEpoch=0,worldCollectionsReady=false,portraitSubs=new Map(),vitalSubs=new Map(),lastVitals=new Map(),vitalTimer=null,masterUid='';
const stage=$('stage'),canvas=$('map'),ctx=canvas.getContext('2d');
const visualEffects=createVisualEffects(stage);
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
const measure={enabled:false,start:null,end:null,drag:false};
const tokenImages=new Map();function tokenImage(url){if(!safeImage(url)||(url.startsWith('data:')&&url.length>85000))return null;if(!tokenImages.has(url)){const img=new Image();img.onload=draw;img.onerror=()=>tokenImages.set(url,null);img.src=url;tokenImages.set(url,img)}return tokenImages.get(url)}
const safeUrl=s=>typeof s==='string'&&/^https:\/\/[^\s"'<>]+$/i.test(s)&&s.length<=1500;
const safeImage=s=>safeUrl(s)||(typeof s==='string'&&s.length<=1200000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s));
const show=(msg)=>{const x=$('status');x.textContent=msg;x.hidden=false;clearTimeout(show.timer);show.timer=setTimeout(()=>x.hidden=true,5500)};
const canMove=t=>admin||t.ownerUid===uid;
const visibleTokens=()=>tokens.filter(t=>t.sceneId===(roomData?.activeSceneId||'')||(!t.sceneId&&!roomData?.activeSceneId));
const roomRef=()=>doc(db,'vttRooms',room);
const tokenRef=id=>doc(db,'vttRooms',room,'tokens',id);
const stopSubs=()=>{subscriptionEpoch++;worldCollectionsReady=false;for(const stop of portraitSubs.values())stop();portraitSubs.clear();for(const stop of vitalSubs.values())stop();vitalSubs.clear();lastVitals.clear();clearTimeout(vitalTimer);masterUid='';if(tokenUnsub){tokenUnsub();tokenUnsub=null}tokenSceneSubscribed=null;subs.forEach(u=>u());subs=[];room='';roomData=null;tokens=[];scenes=[];selected=null;editingSceneId='';theatre.setState({});$('room-heading').textContent='Mesa Permanente · Shinobi Chronicles';$('world-status').textContent='Aguardando conexão…';$('scene-empty').hidden=false;renderScenes();renderTokens();draw();};
const theatre=createTheatre({
  stage,panel:$('theatre-panel'),
  onChange:async state=>{
    if(!admin||!room)throw Error('Apenas o mestre altera o Teatro.');
    await updateDoc(roomRef(),{theatre:state,updatedAt:serverTimestamp()});
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
const rolls=createRollsPanel({panel:$('rolls-panel'),stage,isAdmin:()=>admin,getUid:()=>uid,getSheets:()=>sheets,notify:show,
  send:async(type,payload)=>{
    if(!room||!uid)throw Error('Entre na mesa antes de enviar.');
    if(!['roll','rollRequest','message'].includes(type))throw Error('Tipo de evento inválido.');
    return addDoc(collection(db,'vttRooms',room,'events'),{type,uid,at:serverTimestamp(),payload});
  }
});
function switchTab(name){
  if(['mapa','actors','biblioteca'].includes(name))name='campanha';
  for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===name);
  for(const p of document.querySelectorAll('.pane'))p.hidden=p.id!=='pane-'+name;
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
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
$('scene-open-panel').title=admin?'Escolher mapa na biblioteca':'Cena em exibição';$('auth-label').textContent=uid?(admin?'Mestre · permissões administrativas':'Jogador · acesso restrito'):'Faça login nos Arquivos Shinobi';theatre.refresh();renderSheets();}
onAuthStateChanged(auth,async user=>{stopSubs();if(sheetsUnsub){sheetsUnsub();sheetsUnsub=null}uid=user?.uid||'';admin=false;sheets=[];theatre.setActors([]);rolls.setUser(uid);rolls.setSheets([]);applyRole();if(!uid){show('Faça login no Shinobi Chronicles antes de entrar na mesa.');return}try{admin=user.email==='mestre_shinobi@players.shinobi-chronicles.invalid'||(await getDoc(doc(db,'admins',uid))).exists();applyRole();loadSheets();void connectWorld()}catch(e){show('Falha na autenticação: '+e.message)}});
function loadSheets(){
  if(sheetsUnsub){sheetsUnsub();sheetsUnsub=null}
  const source=admin?collection(db,'fichas'):query(collection(db,'fichas'),where('ownerUid','==',uid));
  sheetsUnsub=onSnapshot(source,snap=>{
    sheets=snap.docs.filter(d=>d.data().tipo!=='diario').map(d=>({id:d.id,...d.data()}));
    updateTheatreDirectory();rolls.setSheets(sheets);
    renderSheets();
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
  const cast=Array.isArray(roomData.theatre?.cast)?roomData.theatre.cast:[];
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
function renderSheets(){
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
    const b=document.createElement('button');b.type='button';b.className='entry';
    b.draggable=admin&&!!room;
    b.title=admin?'Clique para abrir a ficha ou arraste para o mapa':'Abrir ficha';
    const pic=document.createElement('span');pic.className='thumb';
    const src=portrait(f);
    if(src){const img=document.createElement('img');img.src=src;img.alt='';pic.append(img)}
    else pic.textContent='忍';
    const meta=document.createElement('span');meta.className='meta';
    const strong=document.createElement('strong');strong.textContent=f.nome||f.name||'Personagem';
    const small=document.createElement('small');
    small.textContent=[f.clanId||f.clan||'Shinobi','NC '+(f.nc||4),npc?'NPC':(admin?(f.usuario||'Jogador'):'')].filter(Boolean).join(' · ');
    meta.append(strong,small);b.append(pic,meta);
    b.onclick=()=>openSheet(f.id,f.ownerUid);
    b.ondragstart=e=>{
      if(!admin||!room){e.preventDefault();return}
      e.dataTransfer.setData('text/shinobi-ficha',f.id);
      e.dataTransfer.effectAllowed='copy';
    };
    list.append(b);
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
function openSheet(id,owner){if(!id)return show('Token sem ficha vinculada.');if(!admin&&owner!==uid)return show('Esta ficha não pertence à sua conta.');const modal=$('sheet-modal');modal.classList.add('open');const frame=$('sheet-frame');frame.src='./index.html?vttSheet='+encodeURIComponent(id);$('sheet-close').focus()}
$('sheet-close').onclick=()=>{$('sheet-modal').classList.remove('open');$('sheet-frame').src='about:blank'};
$('sheet-modal').addEventListener('click',e=>{if(e.target===$('sheet-modal'))$('sheet-close').click()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('sheet-modal').classList.contains('open'))$('sheet-close').click()});

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
        roomData=null;
        $('world-status').textContent='Aguardando o mestre iniciar a campanha.';
        $('scene-name').textContent='Mesa Permanente';
        $('scene-caption').textContent='Nenhuma cena foi preparada ainda';
        $('scene-empty').hidden=false;
        return;
      }
      roomData=snap.data();masterUid=roomData?.masterUid||masterUid;
      updateTheatreDirectory();syncTheatrePortraits(roomData?.theatre?.cast);syncTheatreVitals(roomData?.theatre?.cast);scheduleVitalSync();renderSheets();
      $('world-status').textContent='Conectado · campanha compartilhada';
      $('room-heading').textContent='Mesa Permanente · '+(roomData.name||'Shinobi Chronicles');
      $('scene-name').textContent=roomData.sceneName||'Mesa Shinobi';
      $('scene-caption').textContent=roomData.scene?'Cena compartilhada':'Aguardando o mestre ativar uma cena';
      $('turn-label').textContent='Turno '+(roomData.turn||0);
      theatre.setState(roomData.theatre);$('current-scene-label').textContent=roomData.sceneName||'Nenhuma cena ativa';$('current-scene-subtitle').textContent=roomData.scene?'Imagem adaptada automaticamente ao espaço da mesa':'O mestre pode escolher uma imagem na Biblioteca de Mapas';
      view.cell=view.image&&sceneKey===roomData.scene?automaticMapCell(view.image):64;
      $('scene-empty').hidden=!!roomData.scene;
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
          rolls.setEvents(events.docs.map(d=>({id:d.id,data:d.data()})));
          for(const change of events.docChanges()){
            if(change.type!=='added'&&change.type!=='modified')continue;
            const data=change.doc.data();
            if(data.type!=='effect')continue;
            if(data.payload?.sceneId&&data.payload.sceneId!==roomData?.activeSceneId)continue;
            const stamp=data.at?.toMillis?.();
            if(!stamp||Math.abs(Date.now()-stamp)>12000)continue;
            if(visualEffects.seenEvent(change.doc.id))continue;
            if(data.payload?.nonce&&localVfxNonces.has(data.payload.nonce))continue;
            visualEffects.play(data.payload?.kind,effectPoint(data.payload));
          }
        },e=>show('Histórico: '+e.message)));
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
    renderTokens();draw();
  },err=>show('Permissão dos tokens: '+err.message));
}
function resetSceneEditor(){
  editingSceneId='';
  $('scene-title-input').value='';$('scene-url').value='';
  $('scene-add').textContent='Salvar cena na biblioteca';
  $('scene-cancel-edit').hidden=true;
}
$('scene-cancel-edit').onclick=resetSceneEditor;
$('scene-add').onclick=async()=>{
  if(!admin||!room)return show('Somente o mestre pode preparar cenas.');
  const name=$('scene-title-input').value.trim(),url=$('scene-url').value.trim();
  const grid=64; // Unidade interna: dimensões visuais se adaptam automaticamente à imagem.
  if(!name||name.length>80||!safeUrl(url))
    return show('Informe o nome do mapa e uma URL HTTPS válida.');
  try{
    if(editingSceneId){
      await updateDoc(doc(db,'vttRooms',room,'scenes',editingSceneId),{name,url,grid,updatedAt:serverTimestamp()});
      if(roomData?.activeSceneId===editingSceneId){
        await updateDoc(roomRef(),{scene:url,sceneName:name,grid,updatedAt:serverTimestamp()});
      }
      show('Cena atualizada na biblioteca.');
    }else{
      await addDoc(collection(db,'vttRooms',room,'scenes'),{name,url,grid,createdAt:serverTimestamp()});
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
    const detail=document.createElement('small');detail.textContent=(current?'● Em exibição · ':'Privada · ')+'enquadramento automático';
    const actions=document.createElement('div');actions.className='scene-actions';
    const activate=document.createElement('button');activate.className='btn small'+(!current?' primary':'');
    activate.textContent=current?'Ocultar dos jogadores':'Ativar para jogadores';
    activate.onclick=async()=>{
      if(!admin||!room)return;
      try{
        if(current)await updateDoc(roomRef(),{scene:'',sceneName:'Sem cena ativa',activeSceneId:'',updatedAt:serverTimestamp()});
        else await updateDoc(roomRef(),{scene:scene.url,sceneName:scene.name,activeSceneId:scene.id,grid:scene.grid||64,updatedAt:serverTimestamp()});
        show(current?'Cena ocultada.':'Cena ativada para todos.');
      }catch(e){show('Falha na ativação: '+e.message)}
    };
    const edit=document.createElement('button');edit.className='btn small';edit.textContent='Editar';
    edit.onclick=()=>{
      editingSceneId=scene.id;
      $('scene-title-input').value=scene.name||'';
      $('scene-url').value=scene.url||'';
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
  const list=visibleTokens();
  $('tokens-count').textContent=String(list.length);
  const h=document.createElement('h3');h.textContent='Tokens da cena · '+list.length;root.append(h);
  if(!list.length){const p=document.createElement('p');p.textContent=admin?'Arraste uma ficha da pasta Jogadores ou NPCs até o mapa para colocar um token.':'O mestre ainda não colocou personagens nesta cena.';root.append(p);return}
  for(const t of list){
    const line=document.createElement('div');line.className='token-card'+(selected===t.id?' selected':'');
    const name=document.createElement('span');name.textContent=(t.name||'Shinobi')+' · '+t.x+', '+t.y;
    const choose=document.createElement('button');choose.className='btn small';choose.textContent='Localizar';
    choose.onclick=()=>{selected=t.id;view.ox=stage.clientWidth/2-(t.x+.5)*view.cell*view.zoom;view.oy=stage.clientHeight/2-(t.y+.5)*view.cell*view.zoom;renderTokens();draw()};
    line.append(name,choose);
    if(canMove(t)){
      const open=document.createElement('button');open.className='btn small';open.textContent='Ficha';
      open.onclick=()=>openSheet(t.fichaId,t.ownerUid);line.append(open);
    }
    if(admin){
      const remove=document.createElement('button');remove.className='btn small';remove.textContent='Retirar';
      remove.title='Remove o token, não a ficha original';
      remove.onclick=async()=>{if(!confirm('Retirar o token de '+(t.name||'Shinobi')+'? A ficha original será mantida.'))return;try{await deleteDoc(tokenRef(t.id));if(selected===t.id)selected=null;show('Token retirado; ficha preservada.')}catch(e){show(e.message)}};
      line.append(remove);
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
  if(payload?.target&&Number.isFinite(payload.target.x)&&Number.isFinite(payload.target.y)){
    return {
      x:view.ox+(payload.target.x+.5)*view.cell*view.zoom,
      y:view.oy+(payload.target.y+.5)*view.cell*view.zoom
    };
  }
  return {x:stage.clientWidth/2,y:stage.clientHeight/2};
}
$('cast-effect').onclick=async()=>{
  if(!admin||!room)return show('Apenas o mestre ativa efeitos da mesa.');
  const kind=effectOptions.value;
  if(!EFFECTS.some(x=>x.id===kind))return;
  const onToken=$('effect-target').value==='selected';
  const target=onToken?visibleTokens().find(t=>t.id===selected):null;
  if(onToken&&!target)return show('Selecione um personagem no mapa antes de executar o efeito.');
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
function automaticMapCell(img){return Math.max(32,Math.min(192,Math.round(Math.min(img.naturalWidth||img.width,img.naturalHeight||img.height)/18)))}
function loadMap(url){if(sceneKey===url)return;sceneKey=url;view.image=null;if(!safeUrl(url)){view.cell=64;center();return}const img=new Image();img.onload=()=>{if(sceneKey!==url)return;view.image=img;view.cell=automaticMapCell(img);center()};img.onerror=()=>{$('scene-empty').hidden=false;show('Não foi possível carregar a imagem da cena. Confira a URL HTTPS.')};img.src=url;draw()}
function center(){view.zoom=1;const w=stage.clientWidth,h=stage.clientHeight;if(view.image){const scale=Math.min((w-28)/view.image.width,(h-28)/view.image.height);view.zoom=Math.max(.012,Math.min(4,scale));view.ox=(w-view.image.width*view.zoom)/2;view.oy=(h-view.image.height*view.zoom)/2}else{view.ox=w/2-8*view.cell;view.oy=h/2-5*view.cell}draw()}
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
  if(view.image)ctx.drawImage(view.image,0,0);
  else{ctx.fillStyle='#1a2923';ctx.fillRect(-5000,-5000,10000,10000)}
  // Arte original em destaque, proporção natural, com transparência e sem máscaras, círculos ou molduras.
  for(const t of visibleTokens()){
    const b=spriteBounds(t);
    if(b.image?.complete&&b.image.naturalWidth){
      ctx.save();
      ctx.shadowColor='rgba(0,0,0,.42)';ctx.shadowBlur=9;ctx.shadowOffsetY=5;
      ctx.drawImage(b.image,b.left,b.top,b.width,b.height);
      ctx.restore();
    }else if(!t.portrait){
      ctx.save();ctx.fillStyle='#f2e4cc';ctx.textAlign='center';ctx.font='600 12px system-ui';
      ctx.fillText((t.name||'Shinobi').slice(0,18),b.x,b.y-view.cell*.3);ctx.restore();
    }
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
  ctx.restore();
  drawRuler();
}
function hit(x,y){
  const p=world(x,y);
  return [...visibleTokens()].reverse().find(t=>{
    const b=spriteBounds(t);
    return p.x>=b.left&&p.x<=b.left+b.width&&p.y>=b.top&&p.y<=b.top+b.height;
  });
}
function drawRuler(){
  if(!measure.start||!measure.end)return;
  const a={x:view.ox+measure.start.x*view.zoom,y:view.oy+measure.start.y*view.zoom};
  const b={x:view.ox+measure.end.x*view.zoom,y:view.oy+measure.end.y*view.zoom};
  const px=Math.hypot(measure.end.x-measure.start.x,measure.end.y-measure.start.y);
  const units=100*px/Math.max(1,view.image?.naturalWidth||view.image?.width||stage.clientWidth/view.zoom);
  ctx.save();ctx.strokeStyle='#ffe0a2';ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
  for(const p of [a,b]){ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle='#fff1ca';ctx.fill()}
  const label=units.toFixed(1)+' u',x=(a.x+b.x)/2,y=(a.y+b.y)/2;
  ctx.font='bold 13px system-ui';const width=ctx.measureText(label).width+20;
  ctx.fillStyle='#14221ee8';ctx.fillRect(x-width/2,y-27,width,24);ctx.fillStyle='#ffe7b6';ctx.textAlign='center';ctx.fillText(label,x,y-10);ctx.restore();
}
const point=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
canvas.onpointerdown=e=>{if(e.button!==0)return;const p=point(e);if(measure.enabled){measure.start=world(p.x,p.y);measure.end=measure.start;measure.drag=true;canvas.setPointerCapture(e.pointerId);draw();return}const t=hit(p.x,p.y);selected=t?.id||null;renderTokens();draw();if(t&&!canMove(t))return;dragToken={id:e.pointerId,start:p,ox:view.ox,oy:view.oy,t,original:t?{x:t.x,y:t.y}:null};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging')};
canvas.onpointermove=e=>{if(measure.enabled&&measure.drag){const p=point(e);measure.end=world(p.x,p.y);draw();return}if(!dragToken||dragToken.id!==e.pointerId)return;const p=point(e);if(dragToken.t){const q=world(p.x,p.y);dragToken.t.x=Math.max(0,Math.min(1000,Math.round((q.x/view.cell-.5)*1000)/1000));dragToken.t.y=Math.max(0,Math.min(1000,Math.round((q.y/view.cell-1)*1000)/1000))}else{view.ox=dragToken.ox+p.x-dragToken.start.x;view.oy=dragToken.oy+p.y-dragToken.start.y}draw()};
const finish=async e=>{if(measure.drag){measure.drag=false;draw();return}if(!dragToken||dragToken.id!==e.pointerId)return;const d=dragToken;dragToken=null;canvas.classList.remove('dragging');if(d.t&&room&&(d.t.x!==d.original.x||d.t.y!==d.original.y)){try{await updateDoc(tokenRef(d.t.id),{x:d.t.x,y:d.t.y})}catch(err){d.t.x=d.original.x;d.t.y=d.original.y;draw();show('Movimento recusado: '+err.message)}}};
canvas.onpointerup=finish;canvas.onpointercancel=finish;
canvas.ondblclick=e=>{const p=point(e),t=hit(p.x,p.y);if(t)openSheet(t.fichaId,t.ownerUid)};
canvas.ondragover=e=>{if(admin&&room){e.preventDefault();e.dataTransfer.dropEffect='copy'}};
async function spawn(f,x,y){if(!admin||!room)return;if(!roomData?.activeSceneId)return show('Ative um mapa na Biblioteca antes de colocar personagens.');try{await addDoc(collection(db,'vttRooms',room,'tokens'),{name:String(f.nome||f.name||'Shinobi').slice(0,40),fichaId:f.id,ownerUid:f.ownerUid,x,y,color:'#a57c64',portrait:await tokenPortrait(f),sceneId:roomData?.activeSceneId||''});show('Token criado: '+(f.nome||'Shinobi'))}catch(err){show('Falha ao criar token: '+err.message)}}
canvas.ondrop=e=>{if(!admin||!room)return;e.preventDefault();const id=e.dataTransfer.getData('text/shinobi-ficha');const f=sheets.find(x=>x.id===id);if(!f)return;const p=point(e),w=world(p.x,p.y);const x=Math.max(0,Math.min(1000,Math.round((w.x/view.cell-.5)*1000)/1000)),y=Math.max(0,Math.min(1000,Math.round((w.y/view.cell-1)*1000)/1000));void spawn(f,x,y)};
function zoom(factor){const x=stage.clientWidth/2,y=stage.clientHeight/2,p=world(x,y);view.zoom=Math.max(.07,Math.min(4,view.zoom*factor));view.ox=x-p.x*view.zoom;view.oy=y-p.y*view.zoom;draw()}
canvas.onwheel=e=>{e.preventDefault();zoom(e.deltaY<0?1.1:.9)};
$('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(.8);$('reset').onclick=center;$('tool-ruler').onclick=()=>{measure.enabled=!measure.enabled;measure.start=null;measure.end=null;measure.drag=false;$('tool-ruler').classList.toggle('active',measure.enabled);$('tool-ruler').setAttribute('aria-pressed',String(measure.enabled));show(measure.enabled?'Régua: arraste para medir. Uma unidade corresponde a 1% da largura do mapa.':'Régua desativada.');draw()};
new ResizeObserver(()=>{const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(stage.clientWidth*dpr);canvas.height=Math.round(stage.clientHeight*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(view.image)center();else draw()}).observe(stage);


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
workspace.addEventListener('transitionend',e=>{if(e.propertyName==='grid-template-columns')center()});
$('vtt-exit').onclick=()=>{if(window.parent&&window.parent!==window)window.parent.postMessage({scVtt:'exit'},location.origin);else location.assign('./index.html')};
$('vtt-manage-sheets').onclick=()=>{if(!admin)return;if(window.parent&&window.parent!==window)window.parent.postMessage({scVtt:'admin'},location.origin);else location.assign('./index.html')};
$('vtt-fullscreen').onclick=async()=>{
  try{
    if(document.fullscreenElement)await document.exitFullscreen();
    else await workspace.requestFullscreen();
  }catch(e){show('Tela cheia indisponível: '+e.message)}
};

document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,[contenteditable]')||$('sheet-modal').classList.contains('open'))return;const t=visibleTokens().find(x=>x.id===selected);if((e.key==='c'||e.key==='C')&&t&&canMove(t)){e.preventDefault();openSheet(t.fichaId,t.ownerUid)}if(e.key==='Delete'&&admin&&t){e.preventDefault();if(confirm('Retirar token '+t.name+'?'))deleteDoc(tokenRef(t.id)).catch(err=>show(err.message))}});
