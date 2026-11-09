import {createTheatre} from './vtt-theatre.js';
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore,doc,getDoc,addDoc,setDoc,collection,onSnapshot,serverTimestamp,updateDoc,query,where,getDocs,deleteDoc} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
const cfg={apiKey:'AIzaSyCdTZejzKXYyyAnYgak7ADEsDhfsdFgvVo',authDomain:'shinobi-chronicles-b9635.firebaseapp.com',projectId:'shinobi-chronicles-b9635',appId:'1:1000505549378:web:e1cbf459451b617f3503db'};
const app=getApps()[0]||initializeApp(cfg),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
let uid='',admin=false,room='',roomData=null,tokens=[],sheets=[],scenes=[],subs=[],dragToken=null,selected=null,sceneKey='',lastRoll='',busy=false,editingSceneId='',tokenUnsub=null,tokenSceneSubscribed=null,sheetsUnsub=null;
const stage=$('stage'),canvas=$('map'),ctx=canvas.getContext('2d');
const view={cell:64,zoom:1,ox:110,oy:85,grid:false,image:null,scene:''};
const tokenImages=new Map();function tokenImage(url){if(!safeImage(url)||url.length>85000)return null;if(!tokenImages.has(url)){const img=new Image();img.onload=draw;img.onerror=()=>tokenImages.set(url,null);img.src=url;tokenImages.set(url,img)}return tokenImages.get(url)}
const safeUrl=s=>typeof s==='string'&&/^https:\/\/[^\s"'<>]+$/i.test(s)&&s.length<=1500;
const safeImage=s=>safeUrl(s)||(typeof s==='string'&&s.length<=1200000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s));
const show=(msg)=>{const x=$('status');x.textContent=msg;x.hidden=false;clearTimeout(show.timer);show.timer=setTimeout(()=>x.hidden=true,5500)};
const canMove=t=>admin||t.ownerUid===uid;
const visibleTokens=()=>tokens.filter(t=>t.sceneId===(roomData?.activeSceneId||'')||(!t.sceneId&&!roomData?.activeSceneId));
const roomRef=()=>doc(db,'vttRooms',room);
const tokenRef=id=>doc(db,'vttRooms',room,'tokens',id);
const stopSubs=()=>{if(tokenUnsub){tokenUnsub();tokenUnsub=null}tokenSceneSubscribed=null;subs.forEach(u=>u());subs=[];room='';roomData=null;tokens=[];scenes=[];selected=null;editingSceneId='';theatre.setState({});theatre.setTokens([]);$('room-heading').textContent='Nenhuma sala conectada';$('scene-empty').hidden=false;renderScenes();renderTokens();draw();};
const theatre=createTheatre({stage,panel:$('theatre-panel'),onChange:async state=>{if(!admin||!room)return;try{await updateDoc(roomRef(),{theatre:state,updatedAt:serverTimestamp()})}catch(e){show(e.message)}},isAdmin:()=>admin});
function switchTab(name){for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===name);for(const p of document.querySelectorAll('.pane'))p.hidden=p.id!=='pane-'+name;}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
function applyRole(){for(const id of ['room-create-wrap','gm-scenes','next-turn','cast-effect','effect-kind'])$(id).hidden=!admin;$('auth-label').textContent=uid?(admin?'Mestre · permissões administrativas':'Jogador · acesso restrito'):'Faça login nos Arquivos Shinobi';theatre.refresh();renderSheets();}
onAuthStateChanged(auth,async user=>{stopSubs();if(sheetsUnsub){sheetsUnsub();sheetsUnsub=null}uid=user?.uid||'';admin=false;sheets=[];applyRole();if(!uid){show('Faça login no Shinobi Chronicles antes de entrar na mesa.');return}try{admin=user.email==='mestre_shinobi@players.shinobi-chronicles.invalid'||(await getDoc(doc(db,'admins',uid))).exists();applyRole();loadSheets();const recent=sessionStorage.getItem('sc-vtt-last-room');if(recent&&/^[A-Za-z0-9_-]{8,80}$/.test(recent)){void join(recent)}}catch(e){show('Falha na autenticação: '+e.message)}});
function loadSheets(){
  if(sheetsUnsub){sheetsUnsub();sheetsUnsub=null}
  const source=admin?collection(db,'fichas'):query(collection(db,'fichas'),where('ownerUid','==',uid));
  sheetsUnsub=onSnapshot(source,snap=>{
    sheets=snap.docs.filter(d=>d.data().tipo!=='diario').map(d=>({id:d.id,...d.data()}));
    renderSheets();
  },e=>show('Não foi possível sincronizar as fichas: '+e.message));
}
function portrait(f){for(const x of [f.retratos?.ninja,f.retratos?.casual,f.foto,f.portrait,f.retrato,f.imagem,f.avatar])if(safeImage(x))return x;return ''}
async function tokenPortrait(f){const src=portrait(f);if(safeUrl(src))return src;if(!src)return '';return new Promise(resolve=>{const img=new Image();img.onload=()=>{try{const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');const side=Math.min(img.width,img.height);g.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,96,96);const small=c.toDataURL('image/jpeg',.65);resolve(small.length<32000?small:'')}catch{resolve('')}};img.onerror=()=>resolve('');img.src=src})}
function renderSheets(){const list=$('actor-list');list.replaceChildren();const search=String($('actor-search')?.value||'').toLowerCase().trim();const filtered=sheets.filter(f=>!search||(f.nome||f.name||'').toLowerCase().includes(search)||String(f.clanId||f.clan||'').toLowerCase().includes(search));for(const f of filtered){const b=document.createElement('button');b.className='entry';b.draggable=admin&&!!room;b.title=admin?'Arraste para o mapa para criar o token':'Clique para abrir sua ficha';const pic=document.createElement('span');pic.className='thumb';if(portrait(f)){const img=document.createElement('img');img.src=portrait(f);img.alt='';pic.append(img)}else pic.textContent='忍';const meta=document.createElement('span');meta.className='meta';const strong=document.createElement('strong');strong.textContent=f.nome||f.name||'Personagem';const small=document.createElement('small');small.textContent=(f.clanId||f.clan||'Shinobi')+' · NC '+(f.nc||1);meta.append(strong,small);b.append(pic,meta);b.onclick=()=>openSheet(f.id,f.ownerUid);b.ondragstart=e=>{if(!admin||!room){e.preventDefault();return}e.dataTransfer.setData('text/shinobi-ficha',f.id);e.dataTransfer.effectAllowed='copy'};list.append(b);if(admin&&room){const add=document.createElement('button');add.className='btn small';add.textContent='+ Colocar token';add.onclick=()=>spawn(f,3,3);list.append(add)}}if(!filtered.length){const p=document.createElement('p');p.textContent=search?'Nenhum personagem corresponde à busca.':'Nenhuma ficha disponível nesta conta.';list.append(p)}}
$('actor-search').oninput=renderSheets;
function openSheet(id,owner){if(!id)return show('Token sem ficha vinculada.');if(!admin&&owner!==uid)return show('Esta ficha não pertence à sua conta.');const modal=$('sheet-modal');modal.classList.add('open');const frame=$('sheet-frame');frame.src='./index.html?vttSheet='+encodeURIComponent(id);$('sheet-close').focus()}
$('sheet-close').onclick=()=>{$('sheet-modal').classList.remove('open');$('sheet-frame').src='about:blank'};
$('sheet-modal').addEventListener('click',e=>{if(e.target===$('sheet-modal'))$('sheet-close').click()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('sheet-modal').classList.contains('open'))$('sheet-close').click()});
$('room-create').onclick=async()=>{if(!admin)return;try{const ref=await addDoc(collection(db,'vttRooms'),{name:'Mesa Shinobi',scene:'',sceneName:'Sem cena ativa',activeSceneId:'',grid:64,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),turn:0,theatre:{enabled:false,cast:[],speaker:'',dialogue:''}});$('room-id').value=ref.id;await join(ref.id)}catch(e){show('Não foi possível criar a sala: '+e.message)}};
$('room-join').onclick=()=>join($('room-id').value.trim());
async function join(id){if(!/^[A-Za-z0-9_-]{8,80}$/.test(id))return show('Código de sala inválido');stopSubs();try{const snap=await getDoc(doc(db,'vttRooms',id));if(!snap.exists())throw Error('Sala inexistente');room=id;roomData=snap.data();sessionStorage.setItem('sc-vtt-last-room',id);$('room-id').value=id;subs.push(onSnapshot(roomRef(),s=>{roomData=s.data();if(!roomData)return;$('room-heading').textContent=roomData.name+' · '+id;$('scene-name').textContent=roomData.sceneName||'Mesa Shinobi';$('scene-caption').textContent=roomData.scene?'Cena compartilhada':'Aguardando o mestre ativar uma cena';$('turn-label').textContent='Turno '+(roomData.turn||0);theatre.setState(roomData.theatre);view.cell=Math.max(32,Math.min(256,Number(roomData.grid)||64));$('scene-empty').hidden=!!roomData.scene;watchTokens(roomData.activeSceneId||'');theatre.setTokens(visibleTokens());renderTokens();renderScenes();loadMap(roomData.scene||'');draw()},e=>show(e.message)));

if(admin)subs.push(onSnapshot(collection(db,'vttRooms',id,'scenes'),s=>{scenes=s.docs.map(d=>({id:d.id,...d.data()}));renderScenes()},e=>show('Biblioteca: '+e.message)));
subs.push(onSnapshot(collection(db,'vttRooms',id,'events'),s=>{const logs=s.docs.map(d=>d.data()).filter(e=>e.type==='roll').sort((a,b)=>(b.at?.seconds||0)-(a.at?.seconds||0));if(logs.length){const roll=logs[0];$('roll-log').textContent='Última rolagem: d20 → '+roll.payload?.result}for(const change of s.docChanges()){const e=change.doc.data();if(change.type==='added'&&e.type==='effect'&&e.at?.toMillis&&Date.now()-e.at.toMillis()<3500)flash(e.payload?.kind)}},()=>{}));
show('Conectado à sala');renderSheets()}catch(e){stopSubs();show('Não foi possível entrar: '+e.message)}}
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
    theatre.setTokens(visibleTokens());renderTokens();draw();
  },err=>show('Permissão dos tokens: '+err.message));
}
$('member-add').onclick=async()=>{if(!admin||!room)return;const id=$('member-uid').value.trim();if(!/^[A-Za-z0-9]{15,128}$/.test(id))return show('UID inválido');try{await setDoc(doc(db,'vttRooms',room,'members',id),{joinedAt:serverTimestamp()});show('Jogador autorizado')}catch(e){show(e.message)}};

function resetSceneEditor(){
  editingSceneId='';
  $('scene-title-input').value='';$('scene-url').value='';$('scene-grid').value='64';
  $('scene-add').textContent='Salvar cena na biblioteca';
  $('scene-cancel-edit').hidden=true;
}
$('scene-cancel-edit').onclick=resetSceneEditor;
$('scene-add').onclick=async()=>{
  if(!admin||!room)return show('Somente o mestre pode preparar cenas.');
  const name=$('scene-title-input').value.trim(),url=$('scene-url').value.trim();
  const grid=Number($('scene-grid').value);
  if(!name||name.length>80||!safeUrl(url)||!Number.isInteger(grid)||grid<32||grid>256)
    return show('Informe nome, imagem HTTPS e grade entre 32 e 256 px.');
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
    const detail=document.createElement('small');detail.textContent=(current?'● Em exibição · ':'Privada · ')+(scene.grid||64)+' px por célula';
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
      $('scene-grid').value=String(scene.grid||64);
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
function loadMap(url){if(sceneKey===url)return;sceneKey=url;view.image=null;if(!safeUrl(url)){draw();return}const img=new Image();img.onload=()=>{if(sceneKey!==url)return;view.image=img;center();draw()};img.onerror=()=>show('Não foi possível carregar a imagem da cena');img.src=url;draw()}
function center(){view.zoom=1;const w=stage.clientWidth,h=stage.clientHeight;if(view.image){const scale=Math.min((w-70)/view.image.width,(h-70)/view.image.height,1);view.zoom=Math.max(.08,scale);view.ox=(w-view.image.width*view.zoom)/2;view.oy=(h-view.image.height*view.zoom)/2}else{view.ox=w/2-8*view.cell;view.oy=h/2-5*view.cell}draw()}
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
