// Shinobi Chronicles · trilha sonora sincronizada da Mesa Permanente.
// Biblioteca de arquivos no Storage, metadados e estado do player no Firestore.
// Apenas o mestre publica músicas e altera a reprodução; cada jogador ativa o áudio localmente.
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore,collection,doc,getDoc,setDoc,deleteDoc,onSnapshot,serverTimestamp}
  from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {getStorage,ref as storageRef,uploadBytesResumable,getDownloadURL,deleteObject}
  from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';

const WORLD='shinobi-chronicles',MAX_BYTES=35*1024*1024;
const bucket='gs://shinobi-chronicles-b9635.firebasestorage.app';
const app=getApps()[0]||initializeApp({
  apiKey:'AIzaSyCdTZejzKXYyyAnYgak7ADEsDhfsdFgvVo',
  authDomain:'shinobi-chronicles-b9635.firebaseapp.com',
  projectId:'shinobi-chronicles-b9635',
  storageBucket:'shinobi-chronicles-b9635.firebasestorage.app',
  appId:'1:1000505549378:web:e1cbf459451b617f3503db'
});
const auth=getAuth(app),db=getFirestore(app),storage=getStorage(app,bucket);
const tracksRef=collection(db,'vttRooms',WORLD,'musicTracks');
const stateRef=doc(db,'vttRooms',WORLD,'musicState','current');
const $=id=>document.getElementById(id);
const root=$('sc-music-root');
if(!root)throw Error('A aba de músicas não foi encontrada na mesa.');
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number.isFinite(+n)?+n:min));
const fmt=s=>{s=Math.max(0,Math.floor(Number(s)||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const cleanName=name=>String(name||'Música').replace(/\.[^./\\]+$/,'').trim().slice(0,90)||'Música';
const isHttps=s=>{try{const u=new URL(s);return u.protocol==='https:'&&u.username===''&&u.password==='';}catch{return false}};
const validType=file=>{
  const ext=String(file.name).split('.').pop().toLowerCase();
  const mime={mp3:'audio/mpeg',ogg:'audio/ogg',wav:'audio/wav',m4a:'audio/mp4',aac:'audio/aac',webm:'audio/webm',flac:'audio/flac'}[ext];
  return mime&&(!file.type||file.type.startsWith('audio/'))?mime:null;
};
const audio=new Audio();
audio.preload='auto';
audio.loop=false;
let user=null,isGM=false,tracks=[],playback={trackId:'',status:'stopped',position:0,volume:85,loop:false};
let localVolume=75,unlocked=false,subTracks=null,subState=null,authEpoch=0;
let activeTrackId='',sourceKey='',sourceEpoch=0,operation=false;
let tracksLoaded=false,stateLoaded=false,connectionProblem='';
try{const v=Number(localStorage.getItem('sc-vtt-music-volume'));if(Number.isFinite(v))localVolume=clamp(v,0,100)}catch{}
root.innerHTML=String.raw`
  <div class="sc-music-heading">
    <span class="sc-music-kicker">音楽 · SHINOBI CHRONICLES</span>
    <h2>Trilha da sessão</h2>
    <p>Conduza a atmosfera da campanha, da calmaria ao combate.</p>
  </div>
  <div class="sc-music-connect" id="sc-music-connection" data-state="loading">
    <span class="sc-music-connect-dot" aria-hidden="true"></span>
    <span id="sc-music-connection-label">Verificando a biblioteca da mesa…</span>
  </div>
  <section class="sc-music-player" aria-label="Reprodutor da campanha">
    <div class="sc-music-art" aria-hidden="true"><span class="sc-music-art-sun"></span><span class="sc-music-art-symbol">音</span><span class="sc-music-art-ink"></span></div>
    <div class="sc-music-player-content">
      <span class="sc-music-label">AGORA NA MESA</span>
      <strong class="sc-music-playing-title" id="sc-music-now-title">Nenhuma faixa selecionada</strong>
      <small class="sc-music-playing-status" id="sc-music-now-status">Aguardando o mestre…</small>
      <div class="sc-music-timeline">
        <span id="sc-music-elapsed">0:00</span>
        <input id="sc-music-seek" type="range" min="0" max="100" value="0" step="1" aria-label="Posição da faixa" disabled>
        <span id="sc-music-duration">0:00</span>
      </div>
      <div class="sc-music-controls" id="sc-music-master-controls" hidden>
        <button type="button" id="sc-music-prev" title="Faixa anterior" aria-label="Faixa anterior">⏮</button>
        <button type="button" id="sc-music-toggle" class="sc-music-primary" title="Reproduzir ou pausar">▶</button>
        <button type="button" id="sc-music-stop" title="Parar">■</button>
        <button type="button" id="sc-music-next" title="Próxima faixa" aria-label="Próxima faixa">⏭</button>
        <button type="button" id="sc-music-loop" title="Repetir faixa" aria-pressed="false">↻</button>
      </div>
    </div>
    <div class="sc-music-mix">
      <button type="button" id="sc-music-enable" class="sc-music-enable">▶ Habilitar som neste dispositivo</button>
      <label class="sc-music-volume" for="sc-music-local-volume"><span>MEU VOLUME</span>
        <input id="sc-music-local-volume" type="range" min="0" max="100" value="75" step="1">
        <output id="sc-music-local-label">75%</output></label>
      <label class="sc-music-volume" id="sc-music-global-row" for="sc-music-global-volume" hidden><span>VOLUME DA MESA</span>
        <input id="sc-music-global-volume" type="range" min="0" max="100" value="85" step="5">
        <output id="sc-music-global-label">85%</output></label>
    </div>
  </section>
  <div class="sc-music-section-title">
    <div><span>ACERVO SONORO</span><small>Trilhas selecionadas para a campanha</small></div>
    <span id="sc-music-count">0 faixas</span>
  </div>
  <details class="sc-music-source-drawer" id="sc-music-add" hidden>
    <summary><span>＋</span><strong>Adicionar música</strong><small>Arquivo ou link direto</small></summary>
    <div class="sc-music-source-body">
      <label class="sc-music-upload" for="sc-music-file"><strong>↑ Enviar do computador</strong><small>MP3, OGG, WAV, M4A, AAC, FLAC e WebM · até 35 MB</small></label>
      <input type="file" id="sc-music-file" accept=".mp3,.ogg,.wav,.m4a,.aac,.flac,.webm,audio/*" hidden>
      <details class="sc-music-link-drawer"><summary>Ou usar um endereço direto de áudio</summary>
        <div class="sc-music-url"><label for="sc-music-url">LINK HTTPS DE ARQUIVO (MP3/OGG...)</label>
          <div><input type="url" id="sc-music-url" placeholder="https://site.com/musica.mp3" autocomplete="off">
          <button type="button" id="sc-music-add-url">Salvar</button></div></div>
      </details>
      <div id="sc-music-progress" class="sc-music-progress" hidden><span>Enviando música…</span><progress value="0" max="100"></progress></div>
      <p class="sc-music-hint">As faixas enviadas ficam no Firebase Storage. Links de páginas do YouTube ou Spotify não funcionam como arquivos de áudio.</p>
    </div>
  </details>
  <p id="sc-music-feedback" class="sc-music-feedback" role="status" aria-live="polite"></p>
  <div id="sc-music-list" class="sc-music-list"><p class="sc-music-empty">Conectando ao acervo sonoro…</p></div>
  <details class="sc-music-help"><summary>ⓘ Como funciona / problemas para carregar</summary>
    <div>
      <p><b>Como mestre:</b> abra Adicionar música, selecione um arquivo de áudio no computador e aguarde o envio completar. Depois clique no ▶ da faixa e em Habilitar som.</p>
      <p><b>Como jogador:</b> abra Músicas e clique em Habilitar som neste dispositivo quando o mestre iniciar a música. O volume individual não interfere nos demais.</p>
      <p><b>Se aparecer permissão negada:</b> as regras do Firestore e do Storage precisam ser publicadas no Console do Firebase, projeto <code>shinobi-chronicles-b9635</code>. Código no GitHub, sozinho, não publica as regras.</p>
      <p><b>Se um link não tocar:</b> use um link HTTPS que abra um arquivo MP3 ou OGG diretamente, ou envie o arquivo do computador. Serviços externos podem bloquear reprodução.</p>
    </div>
  </details>
`;
const tell=(message,error=false)=>{const el=$('sc-music-feedback');el.textContent=message;el.classList.toggle('is-error',error)};
const formatError=error=>{
  const c=error?.code||'',message=String(error?.message||error||'Erro desconhecido');
  if(/storage\/(unauthorized|unauthenticated)/.test(c))return 'Upload bloqueado: publique as regras do Firebase Storage e confirme seu acesso de mestre.';
  if(/storage\/(bucket-not-found|unknown|retry-limit-exceeded|project-not-found)/.test(c))
    return 'Firebase Storage indisponível. Verifique se foi criado/ativado no projeto shinobi-chronicles-b9635.';
  if(/permission-denied/.test(c)||/Missing or insufficient permissions/i.test(message))
    return 'Permissões do Firestore pendentes. Publique firebase/firestore.rules no Console do Firebase.';
  if(/network-request-failed|unavailable/.test(c))return 'Falha de rede. Confira sua conexão e tente novamente.';
  return message;
};
function refreshConnection(){
  const root=$('sc-music-connection'),label=$('sc-music-connection-label');
  const state=connectionProblem?'error':!user?'login':tracksLoaded&&stateLoaded?'ok':'loading';
  root.dataset.state=state;
  label.textContent=connectionProblem?'Não foi possível conectar · '+connectionProblem:
    !user?'Entre no Shinobi Chronicles para acessar a biblioteca.':
    state==='ok'?'Biblioteca conectada · faixas sincronizadas com a mesa':'Conectando à biblioteca do Firebase…';
}
const selected=()=>tracks.find(t=>t.id===playback.trackId)||null;
const volume=()=>{audio.volume=clamp(localVolume/100*clamp(playback.volume??85,0,100)/100,0,1)};
const position=()=>{
  const base=Math.max(0,Number(playback.position)||0);
  if(playback.status!=='playing')return base;
  const stamp=playback.startedAt?.toMillis?.();
  return stamp?Math.max(0,base+(Date.now()-stamp)/1000):base;
};
function refreshStatus(){
  const track=selected(),isPlaying=playback.status==='playing';
  $('sc-music-now-title').textContent=track?.name||'Nenhuma faixa selecionada';
  $('sc-music-now-status').textContent=!user?'Faça login para ouvir a mesa':
    !track?'Aguardando o mestre…':isPlaying?(unlocked?'Reproduzindo para a mesa':'Reprodução ativa · libere o áudio'):
      playback.status==='paused'?'Pausado pelo mestre':'Parado';
  $('sc-music-toggle').textContent=isPlaying?'Ⅱ':'▶';
  $('sc-music-toggle').title=isPlaying?'Pausar':'Reproduzir';
  $('sc-music-loop').setAttribute('aria-pressed',String(!!playback.loop));
  $('sc-music-loop').classList.toggle('selected',!!playback.loop);
  $('sc-music-local-volume').value=localVolume;
  $('sc-music-local-label').textContent=localVolume+'%';
  if(document.activeElement!==$('sc-music-global-volume'))$('sc-music-global-volume').value=playback.volume??85;
  $('sc-music-global-label').textContent=(playback.volume??85)+'%';
  $('sc-music-enable').textContent=unlocked?'✓ Som habilitado neste dispositivo':'▶ Habilitar som neste dispositivo';
  $('sc-music-enable').classList.toggle('enabled',unlocked);
  $('sc-music-enable').disabled=!user;
  $('sc-music-master-controls').hidden=!isGM;
  $('sc-music-global-row').hidden=!isGM;
  $('sc-music-add').hidden=!isGM;
  $('sc-music-seek').disabled=!isGM||!track;
  volume();
  refreshConnection();
}
function refreshTimeline(){
  const duration=Number.isFinite(audio.duration)?audio.duration:0;
  const remotePos=position();
  const elapsed=audio.readyState&&activeTrackId===playback.trackId?audio.currentTime:remotePos;
  $('sc-music-elapsed').textContent=fmt(elapsed);
  $('sc-music-duration').textContent=fmt(duration);
  const slider=$('sc-music-seek');
  slider.max=Math.max(1,Math.round(duration||elapsed||1));
  if(document.activeElement!==slider)slider.value=Math.min(+slider.max,Math.max(0,elapsed));
}
function renderList(){
  $('sc-music-count').textContent=tracks.length+' '+(tracks.length===1?'faixa':'faixas');
  if(!tracks.length){$('sc-music-list').innerHTML='<p class="sc-music-empty">'+
    (isGM?'Sua biblioteca está vazia. Adicione um arquivo MP3 ou um link direto acima.':
      'O mestre ainda não adicionou músicas à biblioteca.')+'</p>';return}
  $('sc-music-list').innerHTML=tracks.map((t,i)=>`
    <article class="sc-music-track ${t.id===playback.trackId?'active':''}" data-track-id="${esc(t.id)}">
      <span class="sc-music-track-index">${t.id===playback.trackId&&playback.status==='playing'?'♫':String(i+1).padStart(2,'0')}</span>
      <div class="sc-music-track-name"><strong title="${esc(t.name)}">${esc(t.name)}</strong>
        <small>${t.source==='storage'?'Arquivo da biblioteca':'Link de áudio'}${t.id===playback.trackId?' · Na mesa':''}</small></div>
      ${isGM?'<button type="button" data-music-play="'+esc(t.id)+'" title="Tocar na sessão">▶</button>'+
        '<button type="button" class="sc-music-remove" data-music-remove="'+esc(t.id)+'" title="Excluir faixa">×</button>':''}
    </article>`).join('');
  root.querySelectorAll('[data-music-play]').forEach(el=>el.onclick=()=>void playTrack(el.dataset.musicPlay));
  root.querySelectorAll('[data-music-remove]').forEach(el=>el.onclick=()=>void removeTrack(el.dataset.musicRemove));
}
async function audioSource(track){
  if(track.source==='storage'&&typeof track.storagePath==='string'&&track.storagePath.startsWith('vttMusic/'+WORLD+'/'))
    return getDownloadURL(storageRef(storage,track.storagePath));
  if(track.source==='url'&&isHttps(track.url))return track.url;
  throw Error('Endereço de música inválido.');
}
async function synchronize(){
  refreshStatus();renderList();refreshTimeline();
  const track=selected();
  if(!track){
    sourceEpoch++;sourceKey='';activeTrackId='';audio.pause();audio.removeAttribute('src');audio.load();return;
  }
  const key=track.id+'|'+(track.storagePath||track.url||'');
  if(key!==sourceKey){
    sourceKey=key;activeTrackId='';audio.pause();
    const epoch=++sourceEpoch;
    try{
      const src=await audioSource(track);
      if(epoch!==sourceEpoch||sourceKey!==key)return;
      audio.src=src;activeTrackId=track.id;audio.load();
    }catch(error){if(epoch!==sourceEpoch)return;tell('Não foi possível abrir '+track.name+': '+formatError(error),true);return}
  }
  if(activeTrackId!==track.id)return;
  const target=position();
  if(Number.isFinite(target)&&Math.abs((audio.currentTime||0)-target)>2.2){
    const max=Number.isFinite(audio.duration)?Math.max(0,audio.duration-.2):target;
    try{audio.currentTime=Math.max(0,Math.min(target,max))}catch{/* Metadados ainda carregando. */}
  }
  audio.loop=!!playback.loop;
  volume();
  if(playback.status==='playing'&&unlocked){
    try{await audio.play()}catch(error){
      unlocked=false;refreshStatus();tell('Clique em Ativar áudio para liberar a reprodução neste navegador.',true);
    }
  }else audio.pause();
}
async function publish(next){
  if(!isGM||!user)throw Error('Somente o mestre controla as músicas.');
  await setDoc(stateRef,{
    trackId:String(next.trackId||''),status:next.status||'stopped',
    position:Math.max(0,Number(next.position)||0),
    startedAt:serverTimestamp(),volume:clamp(next.volume??85,0,100),
    loop:!!next.loop,updatedBy:user.uid,updatedAt:serverTimestamp()
  });
}
const currentPosition=()=>activeTrackId===playback.trackId&&audio.readyState?
  audio.currentTime:position();
async function playTrack(id){
  if(!isGM||operation)return;
  const track=tracks.find(t=>t.id===id);if(!track)return;
  try{await publish({trackId:id,status:'playing',position:0,volume:playback.volume??85,loop:playback.loop})}
  catch(error){tell('Não foi possível iniciar a música: '+formatError(error),true)}
}
async function togglePlayback(){
  if(!isGM)return;
  try{
    if(playback.status==='playing')await publish({...playback,status:'paused',position:currentPosition()});
    else{
      const id=selected()?.id||tracks[0]?.id;if(!id){tell('Adicione uma faixa primeiro.');return}
      await publish({...playback,trackId:id,status:'playing',position:id===playback.trackId?currentPosition():0});
    }
  }catch(error){tell(formatError(error),true)}
}
function adjacent(offset){
  if(!isGM||!tracks.length)return;
  const idx=tracks.findIndex(t=>t.id===playback.trackId);
  const dest=tracks[(idx<0?0:idx+offset+tracks.length)%tracks.length];
  if(dest)void playTrack(dest.id);
}
async function removeTrack(id){
  if(!isGM||operation)return;
  const track=tracks.find(t=>t.id===id);if(!track)return;
  if(!confirm('Excluir "'+track.name+'" da biblioteca da mesa?'))return;
  operation=true;
  try{
    if(playback.trackId===id)await publish({trackId:'',status:'stopped',position:0,loop:false,volume:playback.volume??85});
    await deleteDoc(doc(tracksRef,id));
    if(track.source==='storage'&&track.storagePath)await deleteObject(storageRef(storage,track.storagePath))
      .catch(e=>tell('Faixa excluída, mas o arquivo não pôde ser removido: '+formatError(e),true));
    tell('Faixa excluída da biblioteca.');
  }catch(e){tell('Não foi possível excluir: '+formatError(e),true)}
  finally{operation=false}
}
function setBusy(busy){
  operation=busy;
  $('sc-music-file').disabled=busy;
  $('sc-music-add-url').disabled=busy;
  $('sc-music-progress').hidden=!busy;
}
async function upload(file){
  if(!isGM||operation||!file)return;
  const mime=validType(file);
  if(!mime){tell('Use um arquivo MP3, OGG, WAV, M4A, AAC, FLAC ou WebM.',true);return}
  if(file.size===0||file.size>MAX_BYTES){tell('Arquivo inválido ou maior que 35 MB.',true);return}
  setBusy(true);
  const trackRef=doc(tracksRef);
  const safe=String(file.name).normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-110)||'audio';
  const path='vttMusic/'+WORLD+'/'+trackRef.id+'/'+safe;
  const fileRef=storageRef(storage,path);
  let uploaded=false;
  try{
    const job=uploadBytesResumable(fileRef,file,{contentType:mime,customMetadata:{ownerUid:user.uid}});
    await new Promise((resolve,reject)=>job.on('state_changed',snap=>{
      const pct=Math.round(snap.bytesTransferred/snap.totalBytes*100);
      $('sc-music-progress').querySelector('span').textContent='Enviando '+file.name+' · '+pct+'%';
      $('sc-music-progress').querySelector('progress').value=pct;
    },reject,resolve));
    uploaded=true;
    await setDoc(trackRef,{
      name:cleanName(file.name),source:'storage',storagePath:path,addedBy:user.uid,createdAt:serverTimestamp()
    });
    tell('Música adicionada: '+cleanName(file.name));
  }catch(error){
    if(uploaded)await deleteObject(fileRef).catch(()=>{});
    tell('Não foi possível enviar: '+formatError(error),true);
  }finally{setBusy(false);$('sc-music-file').value=''}
}
async function addUrl(){
  if(!isGM||operation)return;
  const url=$('sc-music-url').value.trim();
  if(!isHttps(url)){tell('Cole um link HTTPS direto para um arquivo de áudio.',true);return}
  operation=true;$('sc-music-add-url').disabled=true;
  try{
    const tail=decodeURIComponent(new URL(url).pathname.split('/').pop()||'Música');
    await setDoc(doc(tracksRef),{
      name:cleanName(tail),source:'url',url,addedBy:user.uid,createdAt:serverTimestamp()
    });
    $('sc-music-url').value='';tell('Link adicionado. Use um endereço direto para MP3/OGG, não uma página de streaming.');
  }catch(error){tell('Não foi possível salvar o link: '+formatError(error),true)}
  finally{operation=false;$('sc-music-add-url').disabled=false}
}
function unsubscribe(){
  subTracks?.();subTracks=null;subState?.();subState=null;
  tracks=[];playback={trackId:'',status:'stopped',position:0,volume:85,loop:false};
  unlocked=false;tracksLoaded=false;stateLoaded=false;connectionProblem='';sourceEpoch++;sourceKey='';activeTrackId='';audio.pause();audio.removeAttribute('src');audio.load();
  refreshConnection();
}
onAuthStateChanged(auth,async nextUser=>{
  const epoch=++authEpoch;unsubscribe();
  user=nextUser;isGM=false;tell('');
  if(!user){renderList();refreshStatus();return}
  try{
    isGM=user.email==='mestre_shinobi@players.shinobi-chronicles.invalid'||
      (await getDoc(doc(db,'admins',user.uid))).exists();
    if(epoch!==authEpoch)return;
    refreshStatus();renderList();
    subTracks=onSnapshot(tracksRef,snap=>{
      tracksLoaded=true;connectionProblem='';
      tracks=snap.docs.map(d=>({id:d.id,...d.data()}))
        .sort((a,b)=>(a.createdAt?.toMillis?.()||0)-(b.createdAt?.toMillis?.()||0)||a.id.localeCompare(b.id));
      void synchronize();
    },error=>{connectionProblem=formatError(error);refreshConnection();tell('Biblioteca indisponível: '+connectionProblem,true)});
    subState=onSnapshot(stateRef,snap=>{
      stateLoaded=true;connectionProblem='';
      playback=snap.exists()?{trackId:'',status:'stopped',position:0,volume:85,loop:false,...snap.data()}:
        {trackId:'',status:'stopped',position:0,volume:85,loop:false};
      void synchronize();
    },error=>{connectionProblem=formatError(error);refreshConnection();tell('Sincronização indisponível: '+connectionProblem,true)});
  }catch(error){connectionProblem=formatError(error);refreshConnection();tell('Não foi possível conectar a trilha sonora: '+connectionProblem,true)}
});
$('sc-music-file').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)void upload(file)});
$('sc-music-add-url').addEventListener('click',()=>void addUrl());
$('sc-music-toggle').addEventListener('click',()=>void togglePlayback());
$('sc-music-prev').addEventListener('click',()=>adjacent(-1));
$('sc-music-next').addEventListener('click',()=>adjacent(1));
$('sc-music-stop').addEventListener('click',()=>{if(isGM)void publish({...playback,status:'stopped',position:0})});
$('sc-music-loop').addEventListener('click',()=>{if(isGM)void publish({...playback,loop:!playback.loop,position:currentPosition()})});
$('sc-music-seek').addEventListener('change',e=>{
  if(isGM)void publish({...playback,position:clamp(e.target.value,0,Number.isFinite(audio.duration)?audio.duration:999999)});
});
$('sc-music-global-volume').addEventListener('change',e=>{
  if(isGM)void publish({...playback,position:currentPosition(),volume:clamp(e.target.value,0,100)});
});
$('sc-music-local-volume').addEventListener('input',e=>{
  localVolume=clamp(e.target.value,0,100);
  try{localStorage.setItem('sc-vtt-music-volume',String(localVolume))}catch{}
  volume();refreshStatus();
});
$('sc-music-enable').addEventListener('click',async()=>{
  if(!user)return;
  unlocked=true;
  if(!selected()){unlocked=false;refreshStatus();tell('Aguarde o mestre selecionar uma música e então clique novamente para habilitar o som.');return}
  try{
    if(!audio.src){unlocked=false;tell('A música ainda não carregou. Clique novamente quando o mestre iniciar uma faixa.');refreshStatus();return}
    if(playback.status==='playing'){
      audio.currentTime=position();
      await audio.play();
    }else{
      // O clique também libera a saída de áudio quando a faixa ainda está parada.
      audio.muted=true;await audio.play();audio.pause();audio.muted=false;
    }
    refreshStatus();tell('Áudio ativado neste dispositivo.');
  }catch(error){
    audio.muted=false;unlocked=false;refreshStatus();
    tell('O navegador bloqueou o som. Clique novamente em Ativar áudio: '+formatError(error),true);
  }
});
audio.addEventListener('loadedmetadata',()=>{if(selected()&&activeTrackId===playback.trackId){const p=position();if(Number.isFinite(p))audio.currentTime=Math.min(p,Math.max(0,(audio.duration||p)-.05));}});
audio.addEventListener('ended',()=>{if(!isGM||playback.loop||playback.status!=='playing')return;
  const i=tracks.findIndex(t=>t.id===playback.trackId);
  const next=tracks[i+1];
  if(next)void playTrack(next.id);else void publish({...playback,status:'stopped',position:0});
});
audio.addEventListener('error',()=>{if(activeTrackId)tell('Falha ao carregar a faixa. Confirme se o arquivo existe, se o Storage permite leitura e se o link abre áudio diretamente.',true)});
setInterval(()=>{
  if(!user)return;
  refreshTimeline();
  if(playback.status==='playing'&&audio.readyState>0&&activeTrackId===playback.trackId&&unlocked){
    const delta=position()-audio.currentTime;
    if(Math.abs(delta)>4&&Number.isFinite(delta)&&Number.isFinite(audio.duration)&&audio.duration>1)
      audio.currentTime=Math.min(Math.max(0,position()),audio.duration-.1);
  }
},700);
refreshStatus();
