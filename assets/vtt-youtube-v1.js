// Shinobi Chronicles · Trilha do YouTube por playlists.
// Dados guardados nos campos theatre.youtubePlaylists e theatre.youtubeState
// do documento existente da Mesa Permanente; nenhum Firebase Storage necessário.
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore,doc,getDoc,onSnapshot,updateDoc,runTransaction,serverTimestamp}
  from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const app=getApps()[0]||initializeApp({
  apiKey:'AIzaSyCdTZejzKXYyyAnYgak7ADEsDhfsdFgvVo',
  authDomain:'shinobi-chronicles-b9635.firebaseapp.com',
  projectId:'shinobi-chronicles-b9635',
  appId:'1:1000505549378:web:e1cbf459451b617f3503db'
});
const auth=getAuth(app),db=getFirestore(app);
const roomRef=doc(db,'vttRooms','shinobi-chronicles');
const $=id=>document.getElementById(id),root=$('sc-music-root');
if(!root)throw Error('Não foi possível encontrar a aba de músicas.');

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cap=(x,n)=>String(x??'').trim().slice(0,n);
const nBound=(x,min,max)=>Math.max(min,Math.min(max,Number.isFinite(+x)?+x:min));
const uid=()=>crypto.randomUUID?crypto.randomUUID().replace(/-/g,'').slice(0,18):
  Math.random().toString(36).slice(2)+Date.now().toString(36);
const GENERAL='geral';
const FADE_MS=5000; // Fade-out real de cinco segundos, compartilhado pela mesa.
const DEFAULT_LIST=()=>({id:GENERAL,name:'Geral',tracks:[]});
const EMPTY_STATE=()=>({playlistId:'',trackId:'',videoId:'',status:'stopped',position:0,loop:false});
function parseYouTube(raw){
  const url=cap(raw,2000);
  let u;
  try{u=new URL(/^https?:\/\//i.test(url)?url:'https://'+url)}
  catch{return null}
  if(u.protocol!=='https:')return null;
  const h=u.hostname.toLowerCase();
  let id='';
  if(h==='youtu.be'||h==='www.youtu.be')id=u.pathname.split('/')[1]||'';
  else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(h)){
    const seg=u.pathname.split('/').filter(Boolean);
    if(u.pathname==='/watch')id=u.searchParams.get('v')||'';
    else if(['shorts','live','embed','v'].includes(seg[0]))id=seg[1]||'';
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
}
function sanitizeLists(value){
  const raw=Array.isArray(value)?value:[];
  const out=[DEFAULT_LIST()],seen=new Set([GENERAL]);
  for(const entry of raw.slice(0,30)){
    if(!entry||typeof entry!=='object')continue;
    let id=cap(entry.id,40);
    if(id===GENERAL){out[0].tracks=sanitizeTracks(entry.tracks);continue}
    if(!/^[A-Za-z0-9_-]{5,40}$/.test(id)||seen.has(id))continue;
    seen.add(id);
    out.push({id,name:cap(entry.name,56)||'Playlist',tracks:sanitizeTracks(entry.tracks)});
  }
  return out;
}
function sanitizeTracks(value){
  if(!Array.isArray(value))return [];
  const seen=new Set();
  return value.slice(0,180).filter(x=>{
    if(!x||typeof x!=='object'||!(/^[A-Za-z0-9_-]{5,40}$/).test(x.id||'')||
      !(/^[A-Za-z0-9_-]{11}$/).test(x.videoId||'')||seen.has(x.id))return false;
    seen.add(x.id);return true;
  }).map(x=>({id:x.id,videoId:x.videoId,url:'https://www.youtube.com/watch?v='+x.videoId,title:cap(x.title,95)||'Faixa do YouTube'}));
}
function safeState(value){
  if(!value||typeof value!=='object')return EMPTY_STATE();
  return {
    playlistId:cap(value.playlistId,40),trackId:cap(value.trackId,40),
    videoId:/^[A-Za-z0-9_-]{11}$/.test(value.videoId||'')?value.videoId:'',
    status:['playing','paused','stopped','fading'].includes(value.status)?value.status:'stopped',
    position:nBound(value.position,0,86400),loop:!!value.loop,
    startedAt:value.startedAt||null,
    fadeLocalTime:nBound(value.fadeLocalTime,0,1e15),
    transitionId:cap(value.transitionId,40),
    fadeTo:value.fadeTo&&typeof value.fadeTo==='object'?{
      playlistId:cap(value.fadeTo.playlistId,40),
      trackId:cap(value.fadeTo.trackId,40),
      videoId:cap(value.fadeTo.videoId,11),
      status:['playing','paused','stopped'].includes(value.fadeTo.status)?value.fadeTo.status:'stopped',
      position:nBound(value.fadeTo.position,0,86400),
      loop:!!value.fadeTo.loop
    }:null
  };
}
function findTrack(trackId,playlistId){
  for(const p of lists){
    if(playlistId&&p.id!==playlistId)continue;
    const t=p.tracks.find(x=>x.id===trackId);
    if(t)return {...t,playlist:p};
  }
  return null;
}
const errorText=error=>{
  const code=String(error?.code||''),msg=String(error?.message||error||'Erro desconhecido');
  if(code.includes('permission-denied')||/Missing or insufficient permissions/i.test(msg))
    return 'O Firebase negou acesso. Confira se você está logado como mestre e se a mesa está com as permissões atuais.';
  if(code.includes('unavailable'))return 'A conexão com o Firebase caiu. Confira a internet.';
  return msg;
};
let user=null,gm=false,lists=[DEFAULT_LIST()],state=EMPTY_STATE();
let selectedPlaylistId=GENERAL,player=null,playerReady=false;
let loadedVideoId='',appliedState='',lastAppliedStatus='',fireUnsub=null,authEpoch=0;
let busy=false,localVolume=80,lastLibraryKey='',lastManualPlayAt=0;
let fadeFinishInFlight='',fadeCommandBusy=false,sliderDragging=false,librarySearch='';
try{
  const stored=localStorage.getItem('sc-youtube-volume');
  if(stored!==null&&stored!==''){
    const v=Number(stored);
    if(Number.isFinite(v))localVolume=nBound(v,0,100);
  }
}catch{}

root.innerHTML=String.raw`
  <div class="sc-yt-topbar">
    <span id="sc-yt-status" class="sc-yt-status" role="status">Conectando…</span>
    <button type="button" id="sc-yt-video-toggle" class="sc-yt-video-toggle" aria-expanded="false">▣ Ver vídeo</button>
  </div>
  <section class="sc-yt-deck" aria-label="Reprodutor do YouTube">
    <div class="sc-yt-deck-title">
      <span class="sc-yt-deck-icon">音</span>
      <span><strong id="sc-yt-now">Nenhuma música selecionada</strong>
      <em id="sc-yt-now-playlist">Escolha uma faixa</em></span>
    </div>
    <div class="sc-yt-video-shell is-collapsed" id="sc-yt-video-shell">
      <div id="sc-yt-embed"></div>
    </div>
    <button type="button" id="sc-yt-listener-play" class="sc-yt-listener-play" hidden>▶ Ouvir música</button>
    <div class="sc-yt-seek" aria-label="Linha do tempo da trilha sonora">
      <div class="sc-yt-seek-times">
        <span id="sc-yt-elapsed">0:00</span>
        <span id="sc-yt-remaining">--:-- restantes</span>
      </div>
      <input id="sc-yt-seek" type="range" min="0" max="100" value="0" step="0.1"
        aria-label="Avançar ou retroceder na música (somente mestre)" disabled>
      <div class="sc-yt-seek-footer">
        <small id="sc-yt-seek-hint">Tempo de reprodução</small>
        <span id="sc-yt-total">0:00</span>
      </div>
    </div>
    <div class="sc-yt-master-heading" id="sc-yt-master-heading" hidden>CONTROLES DO MESTRE</div>
    <div class="sc-yt-deck-controls" id="sc-yt-gm-controls" hidden>
      <button type="button" id="sc-yt-prev" title="Música anterior" aria-label="Música anterior">⏮</button>
      <button type="button" id="sc-yt-play" class="primary" title="Reproduzir ou pausar">▶ Tocar</button>
      <button type="button" id="sc-yt-stop" title="Parar trilha" aria-label="Parar trilha">■</button>
      <button type="button" id="sc-yt-next" title="Próxima música">Próx. ⏭</button>
      <button type="button" id="sc-yt-loop" title="Repetir faixa" aria-label="Repetir faixa" aria-pressed="false">↻</button>
    </div>
    <label class="sc-yt-volume" for="sc-yt-volume"><span>Volume</span>
      <input id="sc-yt-volume" type="range" min="0" max="100" value="80" step="1">
      <output id="sc-yt-volume-label">80%</output></label>
    <p class="sc-yt-notice" id="sc-yt-notice" hidden></p>
  </section>
  <section class="sc-yt-library">
    <div class="sc-yt-library-toolbar">
      <input type="search" id="sc-yt-search" aria-label="Buscar em todas as playlists"
        placeholder="⌕ Buscar músicas ou playlists…" autocomplete="off">
      <span id="sc-yt-count" class="sc-yt-library-count">1 playlist</span>
    </div>
    <details class="sc-yt-new" id="sc-yt-new" hidden>
      <summary>＋ Nova playlist</summary>
      <div class="sc-yt-new-fields">
        <input id="sc-yt-new-name" type="text" maxlength="56" placeholder="Nome da playlist" aria-label="Nome da playlist">
        <button type="button" id="sc-yt-new-create">Criar</button>
      </div>
    </details>
    <div class="sc-yt-folders" id="sc-yt-folders"></div>
    <div class="sc-yt-track-head">
      <div><span id="sc-yt-list-title">Geral</span><small id="sc-yt-list-count">0 músicas</small></div>
      <button type="button" id="sc-yt-play-list" hidden>▶ Playlist</button>
    </div>
    <details class="sc-yt-add-panel" id="sc-yt-add-panel" hidden>
      <summary>＋ Adicionar música por link</summary>
      <form id="sc-yt-add-form" class="sc-yt-add">
        <input id="sc-yt-link" type="url" placeholder="Link do vídeo do YouTube" autocomplete="off" required>
        <input id="sc-yt-title" type="text" maxlength="95" placeholder="Nome opcional">
        <button type="submit">Salvar na playlist selecionada</button>
      </form>
    </details>
    <div id="sc-yt-tracks" class="sc-yt-tracks"></div>
  </section>
  <p class="sc-yt-feedback" id="sc-yt-feedback" aria-live="polite"></p>
  <details class="sc-yt-help"><summary>Ajuda</summary>
    <p>Crie uma playlist e cole links do YouTube. As faixas são salvas no Firebase.</p>
    <p>O mestre controla reprodução, pausa, busca e troca de faixas. O fade-out dura cinco segundos.</p>
    <p>Se o navegador bloquear o som automaticamente, clique em “Ouvir música”. Alguns vídeos impedem reprodução incorporada.</p>
  </details>
`;
const toast=(message,error=false)=>{
  const el=$('sc-yt-feedback');el.textContent=message;el.classList.toggle('error',error);
};
function connected(text,status='ok'){
  const el=$('sc-yt-status');el.textContent=text;el.dataset.state=status;
}
function notice(text){
  const el=$('sc-yt-notice');el.hidden=!text;el.textContent=text||'';
}
function current(){
  return findTrack(state.trackId,state.playlistId)||findTrack(state.trackId)||null;
}
function statePosition(){
  if(state.status!=='playing'&&state.status!=='fading')return state.position;
  const stamp=state.startedAt?.toMillis?.()||(state.status==='fading'?state.fadeLocalTime:0);
  return stamp?Math.max(0,state.position+(Date.now()-stamp)/1000):state.position;
}
function fadeFraction(){
  if(state.status!=='fading')return 0;
  const start=state.startedAt?.toMillis?.()||state.fadeLocalTime;
  return start? nBound((Date.now()-start)/FADE_MS,0,1):0;
}
const mmss=sec=>{
  if(!Number.isFinite(sec)||sec<0)return '--:--';
  const v=Math.floor(sec);
  return Math.floor(v/60)+':'+String(v%60).padStart(2,'0');
};
function durationSeconds(){
  if(!playerReady||!current()||loadedVideoId!==current().videoId)return 0;
  const seconds=Number(player?.getDuration?.());
  return Number.isFinite(seconds)&&seconds>0?seconds:0;
}
function refreshSeek(){
  const input=$('sc-yt-seek'),duration=durationSeconds();
  const live=playerReady&&loadedVideoId===current()?.videoId?
    Number(player?.getCurrentTime?.()):NaN;
  const elapsed=nBound(Number.isFinite(live)?live:statePosition(),0,duration||86400);
  input.max=String(Math.max(1,duration));
  if(!sliderDragging)input.value=String(elapsed);
  const shown=sliderDragging?Number(input.value):elapsed;
  input.disabled=!gm||!current()||duration===0||state.status==='fading'||state.status==='stopped';
  input.style.setProperty('--sc-yt-progress',(duration?100*nBound(shown,0,duration)/duration:0).toFixed(2)+'%');
  $('sc-yt-elapsed').textContent=mmss(shown);
  $('sc-yt-remaining').textContent=duration?'-'+mmss(Math.max(0,duration-shown))+' restantes':'--:-- restantes';
  $('sc-yt-total').textContent=duration?mmss(duration):'--:--';
  $('sc-yt-seek-hint').textContent=state.status==='fading'?
    'Fade-out · '+(Math.max(0,5-5*fadeFraction())).toFixed(1)+' s restantes':
    gm?'Arraste para escolher o trecho':'Acompanhando a música do mestre';
}
function syncHeader(){
  const song=current();
  $('sc-yt-now').textContent=song?.title||'Nenhuma música selecionada';
  $('sc-yt-now-playlist').textContent=song?.playlist.name||'Escolha uma faixa';
  $('sc-yt-gm-controls').hidden=!gm;
  $('sc-yt-master-heading').hidden=!gm;
  root.classList.toggle('sc-yt-master',gm);
  root.dataset.playback=state.status;
  const fading=state.status==='fading';
  for(const id of ['sc-yt-prev','sc-yt-play','sc-yt-stop','sc-yt-next','sc-yt-loop','sc-yt-play-list'])
    $(id).disabled=!gm||fading;
  $('sc-yt-play').textContent=fading?'↘ Saindo…':state.status==='playing'?'Ⅱ Pausar':'▶ Tocar';
  $('sc-yt-loop').textContent=state.loop?'↻✓':'↻';
  $('sc-yt-loop').title=state.loop?'Desativar repetição':'Ativar repetição';
  $('sc-yt-loop').setAttribute('aria-pressed',String(state.loop));
  $('sc-yt-loop').classList.toggle('active',state.loop);
  $('sc-yt-volume').value=localVolume;
  $('sc-yt-volume-label').textContent=localVolume+'%';
  $('sc-yt-new').hidden=!gm;
  $('sc-yt-add-panel').hidden=!gm;
  $('sc-yt-play-list').hidden=!gm||!!librarySearch;
  refreshSeek();
}
const normMusicSearch=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
function selectPlaylist(id){
  if(!lists.some(x=>x.id===id))id=GENERAL;
  selectedPlaylistId=id;
  if(librarySearch){librarySearch='';$('sc-yt-search').value=''}
  renderFolders();renderTracks();
}
function renderFolders(){
  $('sc-yt-count').textContent=lists.length+' '+(lists.length===1?'playlist':'playlists');
  const host=$('sc-yt-folders');host.replaceChildren();
  for(const p of lists){
    if(librarySearch&&!normMusicSearch(p.name).includes(librarySearch)&&
      !p.tracks.some(t=>normMusicSearch(t.title).includes(librarySearch)))continue;
    const row=document.createElement('div');row.className='sc-yt-folder'+(p.id===selectedPlaylistId?' active':'');
    const choose=document.createElement('button');choose.type='button';choose.className='sc-yt-folder-choice';
    choose.innerHTML='<span class="sc-yt-folder-glyph">▤</span><span class="sc-yt-folder-info"><strong>'+
      esc(p.name)+'</strong><small>'+p.tracks.length+' '+(p.tracks.length===1?'música':'músicas')+'</small></span>';
    choose.onclick=()=>selectPlaylist(p.id);row.append(choose);
    if(gm&&p.id!==GENERAL){
      const rename=document.createElement('button');rename.type='button';rename.className='sc-yt-folder-action';
      rename.title='Renomear';rename.textContent='✎';rename.onclick=()=>void renamePlaylist(p.id);
      const remove=document.createElement('button');remove.type='button';remove.className='sc-yt-folder-action danger';
      remove.title='Excluir playlist';remove.textContent='×';remove.onclick=()=>void deletePlaylist(p.id);
      row.append(rename,remove);
    }
    host.append(row);
  }
}
function renderTracks(){
  const p=lists.find(x=>x.id===selectedPlaylistId)||lists[0],host=$('sc-yt-tracks');
  const searching=!!librarySearch;
  const entries=searching?lists.flatMap(origin=>origin.tracks
    .filter(t=>normMusicSearch(t.title).includes(librarySearch)||normMusicSearch(origin.name).includes(librarySearch))
    .map(t=>({p:origin,t}))):p.tracks.map(t=>({p,t}));
  $('sc-yt-list-title').textContent=searching?'Resultados':p.name;
  $('sc-yt-list-count').textContent=entries.length+' '+(entries.length===1?'música':'músicas')+(searching&&entries.length>100?' · 100 exibidas':'');
  $('sc-yt-play-list').hidden=!gm||searching;
  $('sc-yt-play-list').disabled=!p.tracks.length;
  host.replaceChildren();
  if(!entries.length){
    const empty=document.createElement('p');empty.className='sc-yt-empty';
    empty.textContent=searching?'Nenhuma música encontrada.':
      gm?'Esta playlist está vazia. Use “Adicionar música por link”.':'Esta playlist está vazia.';
    host.append(empty);return;
  }
  entries.slice(0,100).forEach(({p,t},i)=>{
    const active=state.trackId===t.id;
    const item=document.createElement('article');
    item.className='sc-yt-track'+(active?' active':'');
    const image=document.createElement('img');
    image.src='https://i.ytimg.com/vi/'+t.videoId+'/mqdefault.jpg';
    image.loading='lazy';image.alt='';image.className='sc-yt-track-thumb';
    const info=document.createElement('div');info.className='sc-yt-track-info';
    const name=document.createElement('strong');name.textContent=t.title;
    const label=document.createElement('small');label.textContent=active?'♫ Tocando · '+p.name:
      searching?p.name:'YouTube · '+String(i+1).padStart(2,'0');
    const external=document.createElement('a');external.href='https://www.youtube.com/watch?v='+t.videoId;
    external.target='_blank';external.rel='noopener noreferrer';external.textContent='↗';
    external.title='Abrir vídeo no YouTube';external.setAttribute('aria-label','Abrir '+t.title+' no YouTube');
    external.className='sc-yt-external';
    info.append(name,label);item.append(image,info,external);
    if(gm){
      const play=document.createElement('button');play.type='button';play.className='sc-yt-track-play';
      play.title='Tocar na mesa';play.textContent='▶';play.onclick=()=>void playTrack(p.id,t.id);
      const menu=document.createElement('button');menu.type='button';menu.className='sc-yt-track-edit';
      menu.title='Renomear música';menu.textContent='✎';menu.onclick=()=>void renameTrack(p.id,t.id);
      const del=document.createElement('button');del.type='button';del.className='sc-yt-track-delete';
      del.title='Excluir link';del.textContent='×';del.onclick=()=>void deleteTrack(p.id,t.id);
      item.append(play,menu,del);
    }
    const wrap=document.createElement('div');wrap.className='sc-yt-track-wrap';wrap.append(item);
    if(gm&&lists.length>1){
      const move=document.createElement('select');move.className='sc-yt-track-move';
      move.setAttribute('aria-label','Mover música para outra playlist');
      for(const destination of lists)move.add(new Option(destination.name,destination.id));
      move.value=p.id;
      move.onchange=async()=>{
        const target=move.value;
        move.disabled=true;
        try{
          await changeLibrary(data=>{
            const old=data.find(x=>x.id===p.id),dest=data.find(x=>x.id===target);
            if(!old||!dest)return;
            const idx=old.tracks.findIndex(x=>x.id===t.id);
            if(idx<0)return;
            const [track]=old.tracks.splice(idx,1);
            if(dest.tracks.length>=180)throw Error('Playlist de destino cheia.');
            dest.tracks.push(track);
          });
          toast('Música movida para '+(lists.find(x=>x.id===target)?.name||'a playlist')+'.');
        }catch(e){toast(errorText(e),true);move.disabled=false}
      };
      const foot=document.createElement('div');foot.className='sc-yt-track-foot';
      foot.hidden=true;
      const caption=document.createElement('span');caption.textContent='MOVER PARA';
      foot.append(caption,move);wrap.append(foot);
      const organizer=document.createElement('button');
      organizer.type='button';organizer.className='sc-yt-track-organize';
      organizer.title='Organizar faixa';organizer.setAttribute('aria-expanded','false');
      organizer.textContent='⋯';
      organizer.onclick=()=>{
        foot.hidden=!foot.hidden;
        organizer.setAttribute('aria-expanded',String(!foot.hidden));
      };
      item.append(organizer);
    }
    host.append(wrap);
  });
}
async function changeLibrary(mutator){
  if(!gm||!user)throw Error('Somente o mestre pode modificar as playlists.');
  return runTransaction(db,async tx=>{
    const snap=await tx.get(roomRef);
    if(!snap.exists())throw Error('Entre na Mesa Permanente antes de salvar músicas.');
    const clean=sanitizeLists(snap.data()?.theatre?.youtubePlaylists);
    const result=mutator(clean);
    tx.update(roomRef,{'theatre.youtubePlaylists':clean,updatedAt:serverTimestamp()});
    return result;
  });
}
async function createPlaylist(){
  if(!gm||busy)return;
  const field=$('sc-yt-new-name'),name=cap(field.value.replace(/\s+/g,' '),56);
  if(!name)return toast('Dê um nome para a playlist.',true);
  busy=true;
  const id=uid();
  try{
    await changeLibrary(data=>{
      if(data.length>=26)throw Error('Limite de 25 playlists personalizadas.');
      if(data.some(x=>x.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))
        throw Error('Já existe uma playlist com esse nome.');
      data.push({id,name,tracks:[]});
    });
    field.value='';selectedPlaylistId=id;
    $('sc-yt-new').open=false;
    if(librarySearch){librarySearch='';$('sc-yt-search').value=''}
    toast('Playlist criada: '+name);
  }catch(e){toast(errorText(e),true)}finally{busy=false}
}
async function renamePlaylist(id){
  if(!gm)return;
  const existing=lists.find(x=>x.id===id);if(!existing||id===GENERAL)return;
  const result=prompt('Novo nome da playlist',existing.name);
  if(result===null)return;
  const name=cap(result.replace(/\s+/g,' '),56);
  if(!name)return toast('Informe um nome válido.',true);
  try{
    await changeLibrary(data=>{
      const p=data.find(x=>x.id===id);if(!p)throw Error('Playlist não encontrada.');
      p.name=name;
    });
  }catch(e){toast(errorText(e),true)}
}
async function deletePlaylist(id){
  if(!gm)return;
  if(state.status==='fading')return toast('Aguarde o fade-out terminar para excluir playlists.',true);
  if(state.playlistId===id&&['playing','fading'].includes(state.status))
    return toast('Pare a música e aguarde o fade-out de 5 segundos antes de excluir a playlist.',true);
  const p=lists.find(x=>x.id===id);if(!p||p.id===GENERAL)return;
  if(!confirm('Excluir a playlist "'+p.name+'" e todos os links salvos nela?'))return;
  try{
    if(state.playlistId===id)await publish({...EMPTY_STATE(),loop:state.loop});
    await changeLibrary(data=>{
      const i=data.findIndex(x=>x.id===id);if(i!==-1)data.splice(i,1);
    });
    if(selectedPlaylistId===id)selectedPlaylistId=GENERAL;
    toast('Playlist excluída.');
  }catch(e){toast(errorText(e),true)}
}
async function addTrack(){
  if(!gm||busy)return;
  const link=$('sc-yt-link').value.trim();
  const videoId=parseYouTube(link);
  if(!videoId)return toast('Cole um link válido de vídeo do YouTube (watch, youtu.be ou shorts).',true);
  const title=cap($('sc-yt-title').value.replace(/\s+/g,' '),95)||'YouTube · '+videoId;
  const playlistId=selectedPlaylistId,id=uid();busy=true;
  try{
    await changeLibrary(data=>{
      const p=data.find(x=>x.id===playlistId);if(!p)throw Error('Playlist não encontrada.');
      if(p.tracks.length>=180)throw Error('Esta playlist chegou ao limite de 180 músicas.');
      if(p.tracks.some(x=>x.videoId===videoId))throw Error('Essa música já está salva na playlist.');
      p.tracks.push({id,videoId,title,url:'https://www.youtube.com/watch?v='+videoId});
    });
    $('sc-yt-link').value='';$('sc-yt-title').value='';
    $('sc-yt-add-panel').open=false;
    if(librarySearch){librarySearch='';$('sc-yt-search').value=''}
    toast('Música salva na playlist "'+(lists.find(p=>p.id===playlistId)?.name||'Geral')+'".');
  }catch(e){toast(errorText(e),true)}finally{busy=false}
}
async function renameTrack(playlistId,trackId){
  if(!gm)return;
  const t=findTrack(trackId,playlistId);if(!t)return;
  const result=prompt('Nome da música',t.title);
  if(result===null)return;
  const title=cap(result.replace(/\s+/g,' '),95);
  if(!title)return toast('Informe um título válido.',true);
  try{await changeLibrary(data=>{
    const item=data.find(x=>x.id===playlistId)?.tracks.find(x=>x.id===trackId);
    if(!item)throw Error('Música não encontrada.');item.title=title;
  })}catch(e){toast(errorText(e),true)}
}
async function deleteTrack(playlistId,trackId){
  if(!gm)return;
  if(state.status==='fading')return toast('Aguarde o fade-out terminar para excluir músicas.',true);
  if(state.trackId===trackId&&['playing','fading'].includes(state.status))
    return toast('Pare a música e aguarde o fade-out de 5 segundos antes de excluir o link.',true);
  const t=findTrack(trackId,playlistId);if(!t||!confirm('Remover "'+t.title+'" da playlist?'))return;
  try{
    if(state.trackId===trackId)await publish({...EMPTY_STATE(),loop:state.loop});
    await changeLibrary(data=>{
      const p=data.find(x=>x.id===playlistId);if(!p)return;
      p.tracks=p.tracks.filter(x=>x.id!==trackId);
    });
    toast('Link removido.');
  }catch(e){toast(errorText(e),true)}
}
async function publish(next){
  if(!gm||!user)throw Error('Só o mestre controla a trilha da sessão.');
  const payload={
    playlistId:cap(next.playlistId,40),trackId:cap(next.trackId,40),
    videoId:cap(next.videoId,11),
    status:next.status||'stopped',
    position:nBound(next.position,0,86400),
    loop:!!next.loop,
    startedAt:serverTimestamp(),
    updatedBy:user.uid
  };
  if(next.status==='fading'){
    payload.transitionId=cap(next.transitionId,40);
    payload.fadeLocalTime=nBound(next.fadeLocalTime,0,1e15);
    payload.fadeTo={
      playlistId:cap(next.fadeTo?.playlistId,40),
      trackId:cap(next.fadeTo?.trackId,40),
      videoId:cap(next.fadeTo?.videoId,11),
      status:next.fadeTo?.status||'stopped',
      position:nBound(next.fadeTo?.position,0,86400),
      loop:!!next.fadeTo?.loop
    };
  }
  await updateDoc(roomRef,{'theatre.youtubeState':payload,updatedAt:serverTimestamp()});
}
async function exitWithFade(next){
  if(!gm||!user)return;
  if(fadeCommandBusy||state.status==='fading'){
    toast('O fade-out de cinco segundos ainda está em andamento.');return;
  }
  // Não há o que reduzir se a faixa já estiver parada ou pausada.
  if(state.status!=='playing'||!current()){
    await publish(next);return;
  }
  fadeCommandBusy=true;
  try{
    const now=playerTime(),duration=durationSeconds();
    const target={
      playlistId:next.playlistId||'',trackId:next.trackId||'',
      videoId:next.videoId||'',status:next.status||'stopped',
      position:next.status==='paused'?
        Math.min(now+FADE_MS/1000,duration||86400):nBound(next.position,0,86400),
      loop:!!next.loop
    };
    await publish({...state,status:'fading',position:now,
      transitionId:uid(),fadeLocalTime:Date.now(),fadeTo:target});
  }finally{fadeCommandBusy=false}
}
// O mestre conclui a transição após o fade. A transação impede
// confirmações duplicadas em múltiplas abas e comandos atrasados.
async function finalizeFade(){
  if(!gm||!user||state.status!=='fading'||!state.transitionId||
    fadeFraction()<1||fadeFinishInFlight===state.transitionId)return;
  const transitionId=state.transitionId;
  fadeFinishInFlight=transitionId;
  try{
    await runTransaction(db,async tx=>{
      const snapshot=await tx.get(roomRef);
      const stored=snapshot.data()?.theatre?.youtubeState;
      if(stored?.status!=='fading'||stored?.transitionId!==transitionId)return;
      const to=stored.fadeTo;
      if(!to)return;
      const next={
        playlistId:cap(to.playlistId,40),trackId:cap(to.trackId,40),
        videoId:cap(to.videoId,11),status:to.status||'stopped',
        position:nBound(to.position,0,86400),loop:!!to.loop,
        startedAt:serverTimestamp(),updatedBy:user.uid
      };
      tx.update(roomRef,{'theatre.youtubeState':next,updatedAt:serverTimestamp()});
    });
  }catch(error){
    fadeFinishInFlight='';
    toast('Não foi possível concluir o fade-out: '+errorText(error),true);
  }
}
function playerTime(){
  const currentTime=playerReady?Number(player?.getCurrentTime?.()):NaN;
  return Number.isFinite(currentTime)&&currentTime>=0?currentTime:statePosition();
}
async function playTrack(playlistId,trackId){
  if(!gm)return;
  if(state.status==='fading'||fadeCommandBusy)return toast('Aguarde o fade-out terminar para trocar a música.');
  const song=findTrack(trackId,playlistId);
  if(!song)return toast('A música não foi encontrada.',true);
  lastManualPlayAt=Date.now();
  notice('');
  try{
    if(state.status==='playing'&&current()){
      // Mantém a música anterior audível durante os cinco segundos completos.
      await exitWithFade({playlistId,trackId,videoId:song.videoId,
        status:'playing',position:0,loop:state.loop});
    }else{
      // Sem faixa tocando, o clique já pode iniciar imediatamente.
      if(playerReady){
        loadedVideoId=song.videoId;
        player.loadVideoById({videoId:song.videoId,startSeconds:0});
        player.setVolume(localVolume);
      }
      await publish({playlistId,trackId,videoId:song.videoId,status:'playing',position:0,loop:state.loop});
    }
  }catch(e){toast('Falha ao trocar a música: '+errorText(e),true)}
}
async function togglePlay(){
  if(!gm||state.status==='fading'||fadeCommandBusy)return;
  const song=current();
  if(!song){
    const p=lists.find(x=>x.id===selectedPlaylistId);
    if(p?.tracks[0])return playTrack(p.id,p.tracks[0].id);
    return toast('Adicione uma música antes de dar play.',true);
  }
  try{
    if(state.status==='playing'){
      await exitWithFade({...state,status:'paused',position:playerTime()});
    }else{
      if(playerReady){try{player.playVideo()}catch{}}
      await publish({...state,status:'playing',position:playerTime()});
    }
  }catch(e){toast(errorText(e),true)}
}
async function stopPlayback(){
  if(!gm||state.status==='fading'||fadeCommandBusy)return;
  try{
    await exitWithFade({...state,status:'stopped',position:0});
  }catch(e){toast(errorText(e),true)}
}
function adjacent(offset){
  // Manual e determinístico: nunca depende de eventos ENDED do YouTube.
  if(!gm||state.status==='fading'||fadeCommandBusy)return;
  const song=current(),p=song?.playlist||lists.find(x=>x.id===selectedPlaylistId);
  if(!p?.tracks.length)return toast('Esta playlist está vazia.',true);
  const idx=song?.playlist.id===p.id?p.tracks.findIndex(x=>x.id===song.id):-1;
  const next=idx<0?(offset<0?p.tracks.length-1:0):(idx+offset+p.tracks.length)%p.tracks.length;
  void playTrack(p.id,p.tracks[next].id);
}
function onYTStateChange(e){
  updateListenerPlay();
  // Eventos de fim de vídeo podem chegar atrasados depois de trocar de faixa.
  // Nunca avançar a playlist automaticamente: a próxima faixa é decisão do mestre.
  if(e.data!==window.YT?.PlayerState?.ENDED||!gm||state.status!=='playing')return;
  const videoId=player?.getVideoData?.()?.video_id||'';
  const duration=Number(player?.getDuration?.()||0),position=Number(player?.getCurrentTime?.()||0);
  if(!current()||videoId!==current().videoId||!duration||position<duration-2)return;
  if(Date.now()-lastManualPlayAt<3500)return;
  // Terminou DE VERDADE: parar ou repetir a MESMA faixa, nunca passar à próxima.
  if(state.loop){
    lastManualPlayAt=Date.now();
    try{player.seekTo(0,true);player.playVideo()}catch{}
    void publish({...state,position:0,status:'playing'}).catch(error=>toast(errorText(error),true));
  }else{
    void publish({...state,position:0,status:'stopped'}).catch(error=>toast(errorText(error),true));
  }
}
function playerVolume(){
  if(playerReady){
    const gain=state.status==='fading'?(1-fadeFraction()):1;
    try{player.setVolume(Math.round(localVolume*gain))}catch{}
  }
}
// O player nativo não pode ser clicado por jogadores. O único gesto
// permitido, caso o navegador bloqueie autoplay, é iniciar a escuta.
function updateListenerPlay(){
  const button=$('sc-yt-listener-play');
  if(!button)return;
  const playing=window.YT?.PlayerState?.PLAYING;
  const status=playerReady?Number(player?.getPlayerState?.()):NaN;
  const needsClick=!gm&&!!user&&playerReady&&!!current()&&state.status==='playing'&&status!==playing;
  button.hidden=!needsClick;
}
$('sc-yt-listener-play').addEventListener('click',()=>{
  if(gm||!user||state.status!=='playing'||!current()||!playerReady)return;
  try{
    player.playVideo();
    $('sc-yt-listener-play').hidden=true;
    setTimeout(updateListenerPlay,1500);
  }catch(error){notice('O YouTube não conseguiu iniciar a música. Confira o navegador e tente novamente.')}
});
function syncPlayer(){
  if(!playerReady)return;
  const song=current();
  if(!song){
    loadedVideoId='';appliedState='';lastAppliedStatus='';
    try{player.stopVideo()}catch{}
    return;
  }
  const videoId=song.videoId,requested=state.status;
  // Ao sair de um fade para a mesma faixa, reiniciar do começo também.
  const justFinishedFade=lastAppliedStatus==='fading'&&requested!=='fading';
  const forceRestart=justFinishedFade&&requested==='playing'&&state.position===0;
  const changingVideo=videoId!==loadedVideoId||forceRestart;
  const stamp=state.startedAt?.toMillis?.()||0;
  const marker=[state.trackId,requested,stamp,Math.round(state.position)].join('|');
  if(changingVideo){
    loadedVideoId=videoId;appliedState='';
    try{
      if(requested==='playing'||requested==='fading')player.loadVideoById({videoId,startSeconds:statePosition()});
      else player.cueVideoById({videoId,startSeconds:state.position});
    }catch(error){toast('Falha ao abrir o vídeo: '+errorText(error),true)}
  }
  if(marker!==appliedState){
    appliedState=marker;
    try{
      if(requested==='playing'||requested==='fading'){
        const seconds=statePosition(),local=Number(player.getCurrentTime?.()||0);
        // O mestre nunca deve ser arrastado por correções de relógio do Firestore.
        // Quando já tocamos esta faixa, preservar o ponto local.
        if(!gm && !changingVideo && Math.abs(seconds-local)>8)
          player.seekTo(seconds,true);
        player.playVideo();
      }else{
        player.pauseVideo();
        if(requested==='stopped')player.seekTo(0,true);
        else{
          const local=Number(player.getCurrentTime?.()||0);
          if(Math.abs(state.position-local)>3)player.seekTo(state.position,true);
        }
      }
    }catch(error){console.warn('YouTube:',error)}
  }
  lastAppliedStatus=requested;
  playerVolume();
  updateListenerPlay();
}
function onYoutubeError(e){
  const messages={
    2:'ID de vídeo inválido.',
    5:'O YouTube não conseguiu reproduzir este vídeo.',
    100:'Vídeo removido ou privado.',
    101:'O proprietário não permite reproduzir este vídeo fora do YouTube.',
    150:'O proprietário não permite reproduzir este vídeo fora do YouTube.',
    153:'O YouTube não recebeu as informações de origem necessárias para a reprodução.'
  };
  notice(messages[e.data]||'Erro do YouTube. Teste outro vídeo.');
}
function attachPlayer(){
  if(player||!window.YT?.Player)return;
  player=new window.YT.Player('sc-yt-embed',{
    width:'100%',height:'214',
    playerVars:{playsinline:1,controls:0,disablekb:1,fs:0,rel:0,origin:location.origin},
    events:{
      onReady:e=>{
        playerReady=true;
        try{
          e.target.getIframe().setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');
          e.target.getIframe().setAttribute('tabindex','-1');
          e.target.getIframe().setAttribute('referrerpolicy','strict-origin-when-cross-origin');
        }catch{}
        syncPlayer();playerVolume();updateListenerPlay();refreshSeek();
      },
      onStateChange:onYTStateChange,
      onAutoplayBlocked:()=>{
        if(!gm&&state.status==='playing'){
          notice('O navegador bloqueou o início automático. Use “Ouvir música da mesa” para começar a escutar.');
          updateListenerPlay();
        }else if(gm){
          notice('O navegador bloqueou a reprodução automática. Use o play do mestre para iniciar.');
        }
      },
      onError:onYoutubeError
    }
  });
}
function loadYT(){
  if(window.YT?.Player)return attachPlayer();
  if(document.getElementById('sc-yt-api-script'))return;
  const previous=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{
    try{if(typeof previous==='function')previous()}catch{}
    attachPlayer();
  };
  const script=document.createElement('script');script.id='sc-yt-api-script';
  script.src='https://www.youtube.com/iframe_api';script.async=true;
  script.onerror=()=>notice('Não foi possível carregar o player do YouTube. Confira a conexão ou o bloqueador de anúncios.');
  document.head.append(script);
}
function refreshAfterSnapshot(){
  syncHeader();
  if(!lists.some(x=>x.id===selectedPlaylistId))selectedPlaylistId=GENERAL;
  const key=JSON.stringify(lists);
  if(key!==lastLibraryKey){
    lastLibraryKey=key;renderFolders();renderTracks();
  }else{
    root.querySelectorAll('.sc-yt-track').forEach(x=>x.classList.remove('active'));
    // O estado foi alterado, não os links; atualize apenas os destaques.
    renderTracks();
  }
  syncPlayer();
  updateListenerPlay();
}
function resetConnection(){
  fireUnsub?.();fireUnsub=null;
  sliderDragging=false;fadeFinishInFlight='';fadeCommandBusy=false;
  lists=[DEFAULT_LIST()];state=EMPTY_STATE();
  lastLibraryKey='';loadedVideoId='';appliedState='';lastAppliedStatus='';
  try{player?.stopVideo?.()}catch{}
  renderFolders();renderTracks();syncHeader();updateListenerPlay();
}
onAuthStateChanged(auth,async nextUser=>{
  const epoch=++authEpoch;resetConnection();
  user=nextUser;gm=false;
  if(!user){connected('Entre no Shinobi Chronicles para acessar suas playlists.','error');return}
  connected('Carregando playlists da Mesa Permanente…','loading');
  try{
    gm=user.email==='mestre_shinobi@players.shinobi-chronicles.invalid'||
      (await getDoc(doc(db,'admins',user.uid))).exists();
    if(epoch!==authEpoch)return;
    syncHeader();renderFolders();renderTracks();
    fireUnsub=onSnapshot(roomRef,snap=>{
      if(epoch!==authEpoch)return;
      if(!snap.exists()){connected('O mestre ainda não iniciou a Mesa Permanente.','error');return}
      const theatre=snap.data()?.theatre||{};
      lists=sanitizeLists(theatre.youtubePlaylists);
      state=safeState(theatre.youtubeState);
      connected(gm?'Mestre · sincronizado':'Sincronizado');
      refreshAfterSnapshot();
    },error=>{
      if(epoch!==authEpoch)return;
      connected('Erro de conexão: '+errorText(error),'error');
      toast(errorText(error),true);
    });
  }catch(error){if(epoch===authEpoch)connected(errorText(error),'error')}
});
$('sc-yt-video-toggle').onclick=()=>{
  const shell=$('sc-yt-video-shell'),collapsed=shell.classList.toggle('is-collapsed');
  $('sc-yt-video-toggle').setAttribute('aria-expanded',String(!collapsed));
  $('sc-yt-video-toggle').textContent=collapsed?'▣ Ver vídeo':'▣ Ocultar vídeo';
};
$('sc-yt-search').addEventListener('input',event=>{
  librarySearch=normMusicSearch(event.target.value.trim());
  renderFolders();renderTracks();
});
$('sc-yt-new-create').onclick=()=>void createPlaylist();
$('sc-yt-new-name').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();void createPlaylist()}
});
$('sc-yt-add-form').addEventListener('submit',e=>{e.preventDefault();void addTrack()});
$('sc-yt-play-list').onclick=()=>{
  const p=lists.find(x=>x.id===selectedPlaylistId);
  if(p?.tracks[0])void playTrack(p.id,p.tracks[0].id);
};
$('sc-yt-play').onclick=()=>void togglePlay();
$('sc-yt-stop').onclick=()=>void stopPlayback();
$('sc-yt-next').onclick=()=>adjacent(1);
$('sc-yt-prev').onclick=()=>adjacent(-1);
$('sc-yt-loop').onclick=async()=>{
  if(!gm||state.status==='fading')return;
  try{await publish({...state,position:playerTime(),loop:!state.loop})}
  catch(error){toast(errorText(error),true)}
};
$('sc-yt-volume').addEventListener('input',e=>{
  localVolume=nBound(e.target.value,0,100);
  $('sc-yt-volume-label').textContent=localVolume+'%';
  try{localStorage.setItem('sc-youtube-volume',String(localVolume))}catch{}
  playerVolume();
});
// A linha do tempo mostra o ponto real do YouTube. Somente o mestre
// pode arrastar; ao soltar, a posição é compartilhada com os jogadores.
const seekSlider=$('sc-yt-seek');
seekSlider.addEventListener('pointerdown',()=>{
  if(gm&&!seekSlider.disabled)sliderDragging=true;
});
seekSlider.addEventListener('input',()=>{
  if(!gm||seekSlider.disabled)return;
  sliderDragging=true;refreshSeek();
});
seekSlider.addEventListener('change',async()=>{
  if(!gm||seekSlider.disabled){sliderDragging=false;return}
  const duration=durationSeconds(),target=nBound(seekSlider.value,0,duration||0);
  sliderDragging=false;
  if(!duration||state.status==='fading'||!current())return;
  try{
    lastManualPlayAt=Date.now();
    if(playerReady){
      player.seekTo(target,true);
      if(state.status==='paused')player.pauseVideo();
    }
    await publish({...state,position:target});
    toast('Reprodução ajustada para '+mmss(target)+'.');
  }catch(error){toast('Não foi possível mudar o trecho: '+errorText(error),true)}
  refreshSeek();
});
seekSlider.addEventListener('pointercancel',()=>{sliderDragging=false;refreshSeek()});
seekSlider.addEventListener('blur',()=>{sliderDragging=false;refreshSeek()});
// Atualização leve da linha do tempo e do fade, sem alterar a posição
// do YouTube automaticamente. Não há troca automática de faixas.
setInterval(()=>{
  updateListenerPlay();
  refreshSeek();
  if(state.status!=='fading')return;
  playerVolume();
  if(fadeFraction()<1)return;
  // O volume já chegou a zero. Interrompe o vídeo somente após cinco segundos.
  if(playerReady&&Number(player?.getPlayerState?.())===window.YT?.PlayerState?.PLAYING){
    try{player.pauseVideo()}catch{}
  }
  if(gm)void finalizeFade();
},120);
renderFolders();renderTracks();syncHeader();loadYT();
