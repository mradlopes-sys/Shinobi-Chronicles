import {createTheatre} from './vtt-theatre.js';
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore,doc,getDoc,addDoc,setDoc,collection,onSnapshot,serverTimestamp,updateDoc,query,where,getDocs,deleteDoc,limit,orderBy} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
const cfg={apiKey:'AIzaSyCdTZejzKXYyyAnYgak7ADEsDhfsdFgvVo',authDomain:'shinobi-chronicles-b9635.firebaseapp.com',projectId:'shinobi-chronicles-b9635',appId:'1:1000505549378:web:e1cbf459451b617f3503db'};
const app=getApps()[0]||initializeApp(cfg),auth=getAuth(app),db=getFirestore(app);
const WORLD_ID='shinobi-chronicles';
const $=id=>document.getElementById(id);
let uid='',admin=false,room='',roomData=null,tokens=[],sheets=[],scenes=[],subs=[],dragToken=null,selected=null,sceneKey='',lastRoll='',busy=false,editingSceneId='',tokenUnsub=null,tokenSceneSubscribed=null,sheetsUnsub=null,subscriptionEpoch=0,worldCollectionsReady=false;
const stage=$('stage'),canvas=$('map'),ctx=canvas.getContext('2d');
const view={cell:64,zoom:1,ox:110,oy:85,grid:false,image:null,scene:''};
const tokenImages=new Map();function tokenImage(url){if(!safeImage(url)||(url.startsWith('data:')&&url.length>85000))return null;if(!tokenImages.has(url)){const img=new Image();img.onload=draw;img.onerror=()=>tokenImages.set(url,null);img.src=url;tokenImages.set(url,img)}return tokenImages.get(url)}
const safeUrl=s=>typeof s==='string'&&/^https:\/\/[^\s"'<>]+$/i.test(s)&&s.length<=1500;
const safeImage=s=>safeUrl(s)||(typeof s==='string'&&s.length<=1200000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s));
const show=(msg)=>{const x=$('status');x.textContent=msg;x.hidden=false;clearTimeout(show.timer);show.timer=setTimeout(()=>x.hidden=true,5500)};
const canMove=t=>admin||t.ownerUid===uid;
const visibleTokens=()=>tokens.filter(t=>t.sceneId===(roomData?.activeSceneId||'')||(!t.sceneId&&!roomData?.activeSceneId));
const roomRef=()=>doc(db,'vttRooms',room);
const tokenRef=id=>doc(db,'vttRooms',room,'tokens',id);
const stopSubs=()=>{subscriptionEpoch++;worldCollectionsReady=false;theatre?.setActors?.([]);if(tokenUnsub){tokenUnsub();tokenUnsub=null}tokenSceneSubscribed=null;subs.forEach(u=>u());subs=[];room='';roomData=null;tokens=[];scenes=[];selected=null;editingSceneId='';theatre.setState({});theatre.setTokens([]);$('room-heading').textContent='Mesa Permanente · Shinobi Chronicles';$('world-status').textContent='Aguardando conexão…';$('scene-empty').hidden=false;renderScenes();renderTokens();draw();};
const theatre=createTheatre({stage,panel:$('theatre-panel'),onChange:async state=>{if(!admin||!room)return;try{await updateDoc(roomRef(),{theatre:state,updatedAt:serverTimestamp()})}catch(e){show('Teatro: '+e.message)}},isAdmin:()=>admin,resolveActor:async id=>{if(!admin)return null;const f=sheets.find(x=>x.id===id);if(!f)return null;return {name:f.nome||f.name||'Shinobi',portrait:await tokenPortrait(f)}}});
function switchTab(name){if(name==='biblioteca'&&!admin)return;for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===name);for(const p of document.querySelectorAll('.pane'))p.hidden=p.id!=='pane-'+name;}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
function applyRole(){for(const id of ['gm-scenes','next-turn','cast-effect','effect-kind'])$(id).hidden=!admin;for(const item of document.querySelectorAll('[data-gm-only]'))item.hidden=!admin;if(!admin&&!$('pane-biblioteca').hidden)switchTab('mapa');$('auth-label').textContent=uid?(admin?'Mestre · permissões administrativas':'Jogador · acesso restrito'):'Faça login nos Arquivos Shinobi';theatre.refresh();renderSheets();}
onAuthStateChanged(auth,async user=>{stopSubs();if(sheetsUnsub){sheetsUnsub();sheetsUnsub=null}uid=user?.uid||'';admin=false;sheets=[];applyRole();if(!uid){show('Faça login no Shinobi Chronicles antes de entrar na mesa.');return}try{admin=user.email==='mestre_shinobi@players.shinobi-chronicles.invalid'||(await getDoc(doc(db,'admins',uid))).exists();applyRole();loadSheets();void connectWorld()}catch(e){show('Falha na autenticação: '+e.message)}});
function loadSheets(){
  if(sheetsUnsub){sheetsUnsub();sheetsUnsub=null}
  const source=admin?collection(db,'fichas'):query(collection(db,'fichas'),where('ownerUid','==',uid));
  sheetsUnsub=onSnapshot(source,snap=>{
    sheets=snap.docs.filter(d=>d.data().tipo!=='diario').map(d=>({id:d.id,...d.data()}));
    theatre.setActors(sheets.map(f=>({id:f.id,name:f.nome||f.name||'Shinobi'})));
    renderSheets();
  },e=>show('Não foi possível sincronizar as fichas: '+e.message));
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
function renderSheets(){const list=$('actor-list');list.replaceChildren();const search=String($('actor-search')?.value||'').toLowerCase().trim();const filtered=sheets.filter(f=>!search||(f.nome||f.name||'').toLowerCase().includes(search)||String(f.clanId||f.clan||'').toLowerCase().includes(search));for(const f of filtered){const b=document.createElement('button');b.className='entry';b.draggable=admin&&!!room;b.title=admin?'Arraste para o mapa para criar o token':'Clique para abrir sua ficha';const pic=document.createElement('span');pic.className='thumb';if(portrait(f)){const img=document.createElement('img');img.src=portrait(f);img.alt='';pic.append(img)}else pic.textContent='忍';const meta=document.createElement('span');meta.className='meta';const strong=document.createElement('strong');strong.textContent=f.nome||f.name||'Personagem';const small=document.createElement('small');small.textContent=(f.clanId||f.clan||'Shinobi')+' · NC '+(f.nc||1);meta.append(strong,small);b.append(pic,meta);b.onclick=()=>openSheet(f.id,f.ownerUid);b.ondragstart=e=>{if(!admin||!room){e.preventDefault();return}e.dataTransfer.setData('text/shinobi-ficha',f.id);e.dataTransfer.effectAllowed='copy'};list.append(b);if(admin&&room){const add=document.createElement('button');add.className='btn small';add.textContent='+ Colocar token';add.onclick=()=>spawn(f,3,3);list.append(add)}}if(!filtered.length){const p=document.createElement('p');p.textContent=search?'Nenhum personagem corresponde à busca.':'Nenhuma ficha disponível nesta conta.';list.append(p)}}
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
  $('world-status').textContent='Conectando à mesa compartilhada…';
  const world=roomRef();
  try{
    const existing=await getDoc(world);
    if(epoch!==subscriptionEpoch||uid!==expectedUid)return;
    if(!existing.exists()&&admin){
      await setDoc(world,{
        name:'Shinobi Chronicles',scene:'',sceneName:'Sem cena ativa',activeSceneId:'',
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
      roomData=snap.data();
      $('world-status').textContent='Conectado · campanha compartilhada';
      $('room-heading').textContent='Mesa Permanente · '+(roomData.name||'Shinobi Chronicles');
      $('scene-name').textContent=roomData.sceneName||'Mesa Shinobi';
      $('scene-caption').textContent=roomData.scene?'Cena compartilhada':'Aguardando o mestre ativar uma cena';
      $('turn-label').textContent='Turno '+(roomData.turn||0);
      theatre.setState(roomData.theatre);$('current-scene-label').textContent=roomData.sceneName||'Nenhuma cena ativa';$('current-scene-subtitle').textContent=roomData.scene?'Imagem adaptada automaticamente ao espaço da mesa':'O mestre pode escolher uma imagem na Biblioteca de Mapas';
      view.cell=Math.max(32,Math.min(256,Number(roomData.grid)||64));
      $('scene-empty').hidden=!!roomData.scene;
      watchTokens(roomData.activeSceneId||'');
      
      renderTokens();renderScenes();loadMap(roomData.scene||'');draw();
      if(!worldCollectionsReady){
        worldCollectionsReady=true;
        if(admin)subs.push(onSnapshot(collection(db,'vttRooms',WORLD_ID,'scenes'),sceneSnapshot=>{
          if(epoch!==subscriptionEpoch)return;
          scenes=sceneSnapshot.docs.map(d=>({id:d.id,...d.data()}));renderScenes();
        },e=>show('Biblioteca: '+e.message)));
        subs.push(onSnapshot(query(collection(db,'vttRooms',WORLD_ID,'events'),orderBy('at','desc'),limit(60)),events=>{
          if(epoch!==subscriptionEpoch)return;
          const rolls=events.docs.map(d=>d.data()).filter(e=>e.type==='roll').sort((a,b)=>(b.at?.seconds||0)-(a.at?.seconds||0));
          if(rolls.length)$('roll-log').textContent='Última rolagem: d20 → '+rolls[0].payload?.result;
          for(const change of events.docChanges()){
            const data=change.doc.data();
            if(change.type==='added'&&data.type==='effect'&&data.at?.toMillis&&Date.now()-data.at.toMillis()<3500)flash(data.payload?.kind);
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
  const h=document.createElement('h3');h.textContent='Tokens da cena · '+list.length;root.append(h);
  if(!list.length){const p=document.createElement('p');p.textContent=admin?'Abra Atores e arraste uma ficha para o mapa, ou use + Colocar token.':'O mestre ainda não colocou personagens nesta cena.';root.append(p);return}
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
    }
    root.append(line);
  }
}
$('next-turn').onclick=async()=>{if(admin&&room)try{await updateDoc(roomRef(),{turn:(roomData?.turn||0)+1,updatedAt:serverTimestamp()})}catch(e){show(e.message)}};
$('roll-d20').onclick=async()=>{if(!room)return show('Entre numa sala');const result=crypto.getRandomValues(new Uint32Array(1))[0]%20+1;try{await addDoc(collection(db,'vttRooms',room,'events'),{type:'roll',uid,at:serverTimestamp(),payload:{result}});show('d20 → '+result)}catch(e){show(e.message)}};
$('cast-effect').onclick=async()=>{if(!room)return;try{await addDoc(collection(db,'vttRooms',room,'events'),{type:'effect',uid,at:serverTimestamp(),payload:{kind:$('effect-kind').value}})}catch(e){show(e.message)}};
function flash(kind){const colors={katon:'#ff622f66',raiton:'#72b5ff66',chakra:'#68d2c866'};const div=document.createElement('div');div.style.cssText='position:absolute;inset:0;z-index:5;pointer-events:none;background:radial-gradient(circle,'+(colors[kind]||colors.chakra)+',transparent 70%);animation:fadefx .8s forwards';stage.append(div);setTimeout(()=>div.remove(),850)}
const css=document.createElement('style');css.textContent='@keyframes fadefx{from{opacity:1}to{opacity:0}}';document.head.append(css);
function loadMap(url){if(sceneKey===url)return;sceneKey=url;view.image=null;if(!safeUrl(url)){view.cell=64;center();return}const img=new Image();img.onload=()=>{if(sceneKey!==url)return;view.image=img;view.cell=Math.max(32,Math.min(192,Math.round(Math.min(img.naturalWidth,img.naturalHeight)/18)));center()};img.onerror=()=>{$('scene-empty').hidden=false;show('Não foi possível carregar a imagem da cena. Confira a URL HTTPS.')};img.src=url;draw()}
function center(){view.zoom=1;const w=stage.clientWidth,h=stage.clientHeight;if(view.image){const scale=Math.min((w-28)/view.image.width,(h-28)/view.image.height);view.zoom=Math.max(.012,Math.min(4,scale));view.ox=(w-view.image.width*view.zoom)/2;view.oy=(h-view.image.height*view.zoom)/2}else{view.ox=w/2-8*view.cell;view.oy=h/2-5*view.cell}draw()}
const world=(x,y)=>({x:(x-view.ox)/view.zoom,y:(y-view.oy)/view.zoom});
function draw(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(view.ox,view.oy);ctx.scale(view.zoom,view.zoom);
if(view.image)ctx.drawImage(view.image,0,0);else{ctx.fillStyle='#1b2b29';ctx.fillRect(-5000,-5000,10000,10000)}
if(view.grid&&view.image){const a=world(0,0),b=world(w,h),step=view.cell;ctx.strokeStyle='#e8e8d744';ctx.lineWidth=1/view.zoom;ctx.beginPath();for(let x=Math.floor(a.x/step)*step;x<b.x;x+=step){ctx.moveTo(x,a.y);ctx.lineTo(x,b.y)}for(let y=Math.floor(a.y/step)*step;y<b.y;y+=step){ctx.moveTo(a.x,y);ctx.lineTo(b.x,y)}ctx.stroke()}
for(const t of visibleTokens()){const x=(t.x+.5)*view.cell,y=(t.y+.5)*view.cell;ctx.beginPath();ctx.arc(x,y,view.cell*.38,0,Math.PI*2);ctx.fillStyle=t.color||'#a77a5b';ctx.fill();const image=tokenImage(t.portrait);if(image?.complete&&image.naturalWidth){ctx.save();ctx.clip();const side=Math.min(image.naturalWidth,image.naturalHeight),sx=(image.naturalWidth-side)/2,sy=(image.naturalHeight-side)/2;ctx.drawImage(image,sx,sy,side,side,x-view.cell*.38,y-view.cell*.38,view.cell*.76,view.cell*.76);ctx.restore()}ctx.strokeStyle=selected===t.id?'#ffe7a1':canMove(t)?'#f5e1b0':'#89968e';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold 12px system-ui';ctx.fillText((t.name||'Shinobi').slice(0,13),x,y+view.cell*.6)}
ctx.restore()}
function hit(x,y){const p=world(x,y);return [...visibleTokens()].reverse().find(t=>Math.hypot(p.x-(t.x+.5)*view.cell,p.y-(t.y+.5)*view.cell)<view.cell*.4)}
const point=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
canvas.onpointerdown=e=>{if(e.button!==0)return;const p=point(e),t=hit(p.x,p.y);selected=t?.id||null;renderTokens();draw();if(t&&!canMove(t))return;dragToken={id:e.pointerId,start:p,ox:view.ox,oy:view.oy,t,original:t?{x:t.x,y:t.y}:null};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging')};
canvas.onpointermove=e=>{if(!dragToken||dragToken.id!==e.pointerId)return;const p=point(e);if(dragToken.t){const q=world(p.x,p.y);dragToken.t.x=Math.max(0,Math.min(1000,Math.floor(q.x/view.cell)));dragToken.t.y=Math.max(0,Math.min(1000,Math.floor(q.y/view.cell)))}else{view.ox=dragToken.ox+p.x-dragToken.start.x;view.oy=dragToken.oy+p.y-dragToken.start.y}draw()};
const finish=async e=>{if(!dragToken||dragToken.id!==e.pointerId)return;const d=dragToken;dragToken=null;canvas.classList.remove('dragging');if(d.t&&room&&(d.t.x!==d.original.x||d.t.y!==d.original.y)){try{await updateDoc(tokenRef(d.t.id),{x:d.t.x,y:d.t.y})}catch(err){d.t.x=d.original.x;d.t.y=d.original.y;draw();show('Movimento recusado: '+err.message)}}};
canvas.onpointerup=finish;canvas.onpointercancel=finish;
canvas.ondblclick=e=>{const p=point(e),t=hit(p.x,p.y);if(t)openSheet(t.fichaId,t.ownerUid)};
canvas.ondragover=e=>{if(admin&&room){e.preventDefault();e.dataTransfer.dropEffect='copy'}};
async function spawn(f,x,y){if(!admin||!room)return;try{await addDoc(collection(db,'vttRooms',room,'tokens'),{name:String(f.nome||f.name||'Shinobi').slice(0,40),fichaId:f.id,ownerUid:f.ownerUid,x,y,color:'#a57c64',portrait:await tokenPortrait(f),sceneId:roomData?.activeSceneId||''});show('Token criado: '+(f.nome||'Shinobi'))}catch(err){show('Falha ao criar token: '+err.message)}}
canvas.ondrop=e=>{if(!admin||!room)return;e.preventDefault();const id=e.dataTransfer.getData('text/shinobi-ficha');const f=sheets.find(x=>x.id===id);if(!f)return;const p=point(e),w=world(p.x,p.y);const x=Math.max(0,Math.min(1000,Math.floor(w.x/view.cell))),y=Math.max(0,Math.min(1000,Math.floor(w.y/view.cell)));void spawn(f,x,y)};
function zoom(factor){const x=stage.clientWidth/2,y=stage.clientHeight/2,p=world(x,y);view.zoom=Math.max(.07,Math.min(4,view.zoom*factor));view.ox=x-p.x*view.zoom;view.oy=y-p.y*view.zoom;draw()}
canvas.onwheel=e=>{e.preventDefault();zoom(e.deltaY<0?1.1:.9)};
$('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(.8);$('reset').onclick=center;$('grid').onclick=()=>{view.grid=!view.grid;$('grid').style.color=view.grid?'#f0c889':'';draw()};
new ResizeObserver(()=>{const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(stage.clientWidth*dpr);canvas.height=Math.round(stage.clientHeight*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw()}).observe(stage);

$('vtt-fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch(e){show('Tela cheia não disponível: '+e.message)}};
document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,[contenteditable]')||$('sheet-modal').classList.contains('open'))return;const t=visibleTokens().find(x=>x.id===selected);if((e.key==='c'||e.key==='C')&&t&&canMove(t)){e.preventDefault();openSheet(t.fichaId,t.ownerUid)}if(e.key==='Delete'&&admin&&t){e.preventDefault();if(confirm('Retirar token '+t.name+'?'))deleteDoc(tokenRef(t.id)).catch(err=>show(err.message))}});
