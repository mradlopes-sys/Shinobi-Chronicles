// Shinobi Chronicles · central compartilhada de iniciativa
export function createCombatDirector({panel,strip,getAdmin,getSheets,getRoomData,rollInitiative,saveCombat,notify,portrait}){
 const cap=36,selected=new Set();let combat={entries:[],activeId:'',round:1,started:false},search='',busy=false;
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const number=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Math.round(Number(v)):min));
 const validImg=s=>typeof s==='string'&&((/^https:\/\/[^\s"'<>]+$/i.test(s)&&s.length<1500)||(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s)&&s.length<12000));
 const photo=e=>validImg(e.portrait)?'<img src="'+esc(e.portrait)+'" alt="" loading="lazy">':'<span aria-hidden="true">忍</span>';
 const order=()=>combat.entries.slice().sort((a,b)=>b.score-a.score||a.order-b.order||a.name.localeCompare(b.name,'pt-BR'));
 const allowed=()=>getAdmin()&&!!getRoomData();
 const normalize=data=>{
  const seen=new Set(),entries=[];
  for(const e of (Array.isArray(data?.entries)?data.entries:[]).slice(0,cap)){
   if(!e||typeof e.id!=='string'||!e.id||seen.has(e.id))continue;
   seen.add(e.id);
   entries.push({id:e.id.slice(0,120),name:String(e.name||'Shinobi').slice(0,60),
    portrait:validImg(e.portrait)?e.portrait:'',score:number(e.score,-99,999),
    bonus:number(e.bonus,-99,99),roll:number(e.roll,0,100),order:number(e.order,0,cap)});
  }
  return {entries,activeId:entries.some(x=>x.id===data?.activeId)?data.activeId:(entries[0]?.id||''),
   round:number(data?.round||1,1,9999),started:!!data?.started};
 };
 const stripEmpty=()=>{strip.hidden=true;strip.replaceChildren()};
 function drawStrip(){
  const list=order();if(!list.length){stripEmpty();return}strip.hidden=false;
  const index=Math.max(0,list.findIndex(x=>x.id===combat.activeId)),next=list[(index+1)%list.length];
  const trackBefore=$('sc-turn-track'),previous=trackBefore?.scrollLeft||0;
  strip.innerHTML='<div class="sc-turn-header"><div><small>INICIATIVA · '+(combat.started?'EM COMBATE':'PREPARAÇÃO')+
    '</small><b>Rodada '+combat.round+'</b></div><span class="sc-turn-next">Próximo: <strong>'+
    esc(next.name)+'</strong></span><button type="button" data-sc-scroll="-1" aria-label="Voltar no carrossel">‹</button>'+
    '<button type="button" data-sc-scroll="1" aria-label="Avançar no carrossel">›</button></div>'+
    '<div id="sc-turn-track" class="sc-turn-track">'+list.map(e=>{
      const active=e.id===combat.activeId,upcoming=!active&&e.id===next.id;
      return '<button type="button" class="sc-turn-card'+(active?' is-active':'')+(upcoming?' is-next':'')+
       '" data-sc-turn-id="'+esc(e.id)+'" '+(!getAdmin()?'disabled':'')+' aria-label="'+esc(e.name+', iniciativa '+e.score)+'">'+
       '<span class="sc-turn-pic">'+photo(e)+'</span><span class="sc-turn-body"><strong>'+esc(e.name)+'</strong><small>'+
       (active?'AGINDO AGORA':upcoming?'PRÓXIMO':'AGUARDANDO')+'</small></span><b class="sc-turn-score">'+e.score+'</b></button>';
    }).join('')+'</div>';
  const track=$('sc-turn-track');track.scrollLeft=previous;
  strip.querySelectorAll('[data-sc-scroll]').forEach(b=>b.onclick=()=>track.scrollBy({left:Number(b.dataset.scScroll)*240,behavior:'smooth'}));
  strip.querySelectorAll('[data-sc-turn-id]').forEach(b=>b.onclick=()=>{
    if(!allowed()||busy)return;void change(c=>({...c,activeId:b.dataset.scTurnId,started:true}));
  });
  requestAnimationFrame(()=>{
   const active=track.querySelector('.is-active');if(active)
    track.scrollTo({left:Math.max(0,active.offsetLeft-track.offsetLeft-track.clientWidth/2+active.clientWidth/2),behavior:'smooth'});
  });
 }
 async function smallPortrait(f){
  const source=portrait(f);if(!source)return '';
  if(/^https:\/\//.test(source))return validImg(source)?source:'';
  if(!source.startsWith('data:image/'))return '';
  return await new Promise(resolve=>{
   const img=new Image();let done=false;const finish=url=>{if(!done){done=true;resolve(url)}};
   img.onerror=()=>finish('');
   img.onload=()=>{try{
    const cv=document.createElement('canvas');cv.width=64;cv.height=64;
    const cx=cv.getContext('2d');if(!cx)return finish('');
    const scale=Math.min(64/img.naturalWidth,64/img.naturalHeight);
    const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
    cx.drawImage(img,(64-w)/2,(64-h)/2,w,h);
    const url=cv.toDataURL('image/webp',.66);finish(validImg(url)?url:'');
   }catch(e){finish('')}};
   img.src=source;setTimeout(()=>finish(''),2000);
  });
 }
 function renderDirectory(){
  const root=$('sc-combat-directory');if(!root)return;
  const used=new Set(combat.entries.map(x=>x.id));
  const visible=getSheets().filter(f=>[f.nome,f.name,f.clanId].some(v=>String(v||'').toLowerCase().includes(search)))
   .sort((a,b)=>String(a.nome||a.name||'').localeCompare(String(b.nome||b.name||''),'pt-BR'));
  if(!visible.length){root.innerHTML='<p class="sc-combat-empty">Nenhuma ficha encontrada.</p>';return}
  root.innerHTML=visible.map(f=>{
   const checked=selected.has(f.id),inList=used.has(f.id),name=esc(f.nome||f.name||'Shinobi');
   const icon=portrait(f),img=validImg(icon)?'<img src="'+esc(icon)+'" alt="">':'忍';
   return '<label class="sc-combat-pick'+(checked?' selected':'')+(inList?' already':'')+'">'+
    '<input type="checkbox" data-sc-pick="'+esc(f.id)+'" '+(checked?'checked ':'')+(inList||busy?'disabled ':'')+'>'+
    '<span class="sc-combat-pic">'+img+'</span><span class="sc-combat-person"><b>'+name+'</b><small>'+
    esc(f.clanId||'Shinobi')+(inList?' · NA INICIATIVA':'')+'</small></span><span class="sc-combat-check">'+
    (inList||checked?'✓':'+')+'</span></label>';
  }).join('');
  root.querySelectorAll('[data-sc-pick]').forEach(input=>input.onchange=()=>{
   const id=input.dataset.scPick;if(input.checked)selected.add(id);else selected.delete(id);
   input.closest('label').classList.toggle('selected',input.checked);
   const icon=input.closest('label').querySelector('.sc-combat-check');if(icon)icon.textContent=input.checked?'✓':'+';
   updateSelected();
  });
 }
 function updateSelected(){
  if($('sc-combat-selected'))$('sc-combat-selected').textContent=selected.size+' selecionada'+(selected.size===1?'':'s');
  if($('sc-combat-add'))$('sc-combat-add').disabled=busy||!selected.size;
 }
 function drawBoard(){
  if(!getAdmin())return;
  $('sc-combat-round').textContent='Rodada '+combat.round;
  $('sc-combat-status').textContent=combat.entries.length?(combat.started?'Combate em andamento':'Aguardando início'):'Sem participantes';
  for(const id of ['sc-combat-prev','sc-combat-next','sc-combat-reroll','sc-combat-clear']){
   $(id).disabled=busy||!combat.entries.length;
  }
  const start=$('sc-combat-start');start.disabled=busy||!combat.entries.length;
  start.textContent=combat.started?'Pausar combate':'Iniciar combate';
  const list=order(),root=$('sc-combat-order');
  root.innerHTML=list.length?list.map((e,i)=>{
   const current=e.id===combat.activeId;
   return '<div class="sc-combat-line'+(current?' active':'')+'">'+
    '<span class="sc-combat-rank">'+String(i+1).padStart(2,'0')+'</span>'+
    '<div class="sc-combat-pic">'+photo(e)+'</div><div class="sc-combat-person"><b>'+esc(e.name)+'</b><small>'+
    (current?'AGINDO AGORA':e.roll+' no d8 + '+e.bonus+' bônus')+'</small></div>'+
    '<label class="sc-combat-score">INI<input data-sc-score="'+esc(e.id)+'" type="number" min="-99" max="999" value="'+e.score+'" '+(busy?'disabled':'')+'></label>'+
    '<button class="sc-combat-remove" data-sc-remove="'+esc(e.id)+'" aria-label="Remover '+esc(e.name)+'" '+(busy?'disabled':'')+'>×</button></div>';
  }).join(''):'<div class="sc-combat-empty">Marque as fichas abaixo e adicione-as à ordem do combate.</div>';
  root.querySelectorAll('[data-sc-score]').forEach(input=>input.onchange=()=>{
   const id=input.dataset.scScore,score=number(input.value,-99,999);
   void change(c=>({...c,entries:c.entries.map(x=>x.id===id?{...x,score}:x)}));
  });
  root.querySelectorAll('[data-sc-remove]').forEach(b=>b.onclick=()=>void change(c=>{
   const entries=c.entries.filter(x=>x.id!==b.dataset.scRemove);
   return {...c,entries,activeId:c.activeId===b.dataset.scRemove?'':c.activeId,started:c.started&&entries.length>0};
  }));
  renderDirectory();updateSelected();
 }
 async function change(build){
  if(!allowed()||busy){if(!getAdmin())notify('Somente o mestre altera a iniciativa.');return}
  const previous=combat;const next=normalize(build(structuredClone(combat)));
  busy=true;combat=next;drawStrip();drawBoard();
  try{await saveCombat(next)}catch(err){combat=previous;notify('Erro ao salvar iniciativa: '+err.message)}
  finally{busy=false;drawStrip();drawBoard()}
 }
 async function add(){
  if(!allowed()||busy)return;
  const toAdd=getSheets().filter(f=>selected.has(f.id)&&!combat.entries.some(x=>x.id===f.id));
  if(!toAdd.length){selected.clear();drawBoard();return}
  const count=cap-combat.entries.length;if(count<=0){notify('Limite de '+cap+' participantes por encontro.');return}
  busy=true;drawBoard();
  try{
   const incoming=await Promise.all(toAdd.slice(0,count).map(async(f,i)=>{
    const roll=rollInitiative(f);
    return {id:f.id,name:String(f.nome||f.name||'Shinobi').slice(0,60),
     portrait:await smallPortrait(f),bonus:roll.bonus,roll:roll.roll,score:roll.score,
     order:combat.entries.length+i};
   }));
   const next=normalize({...combat,entries:[...combat.entries,...incoming]});
   if(!combat.started){
    const sorted=next.entries.slice().sort((a,b)=>b.score-a.score||a.order-b.order);
    next.activeId=sorted[0]?.id||'';
   }
   await saveCombat(next);combat=next;selected.clear();
   notify(incoming.length+' participante(s) adicionados à iniciativa.');
  }catch(err){notify('Erro ao adicionar participantes: '+err.message)}
  finally{busy=false;drawStrip();drawBoard()}
 }
 panel.innerHTML='<div class="sc-combat-heading"><span>FERRAMENTAS DO MESTRE</span><h2>Direção de combate</h2>'+
  '<p>Monte a ordem de iniciativa e controle os turnos da campanha.</p></div>'+
  '<div class="sc-combat-hero"><div><small id="sc-combat-status">Sem participantes</small>'+
  '<strong id="sc-combat-round">Rodada 1</strong></div><button class="sc-combat-primary" id="sc-combat-start">Iniciar combate</button></div>'+
  '<div class="sc-combat-controls"><button id="sc-combat-prev">← Anterior</button>'+
  '<button class="primary" id="sc-combat-next">Próximo turno →</button></div>'+
  '<div class="sc-combat-heading sub"><h3>Ordem de ação</h3><small>Maior iniciativa primeiro · valores editáveis</small></div>'+
  '<div class="sc-combat-order" id="sc-combat-order"></div>'+
  '<div class="sc-combat-controls"><button id="sc-combat-reroll">⚄ Rolar novamente</button>'+
  '<button class="danger" id="sc-combat-clear">Encerrar encontro</button></div>'+
  '<div class="sc-combat-heading sub"><h3>Selecionar fichas</h3>'+
  '<small>Jogadores e NPCs podem entrar juntos na iniciativa.</small></div>'+
  '<input type="search" id="sc-combat-search" class="sc-combat-search" placeholder="Nome ou clã" aria-label="Buscar fichas">'+
  '<div class="sc-combat-controls small"><button id="sc-combat-all">Selecionar visíveis</button>'+
  '<button id="sc-combat-none">Desmarcar</button><span id="sc-combat-selected">0 selecionadas</span></div>'+
  '<div class="sc-combat-directory" id="sc-combat-directory"></div>'+
  '<button class="sc-combat-primary full" id="sc-combat-add">Adicionar selecionadas · 1d8</button>'+
  '<p class="sc-combat-hint">Iniciativa = 1d8 + AGI + Prontidão. As fichas não são modificadas.</p>';
 $('sc-combat-search').oninput=e=>{search=e.target.value.trim().toLowerCase();renderDirectory()};
 $('sc-combat-all').onclick=()=>{
  for(const f of getSheets())if(!combat.entries.some(e=>e.id===f.id)&&
   [f.nome,f.name,f.clanId].some(v=>String(v||'').toLowerCase().includes(search)))selected.add(f.id);
  drawBoard();
 };
 $('sc-combat-none').onclick=()=>{selected.clear();drawBoard()};
 $('sc-combat-add').onclick=()=>void add();
 $('sc-combat-start').onclick=()=>void change(c=>({...c,started:!c.started}));
 $('sc-combat-next').onclick=()=>void change(c=>{
  const roster=c.entries.slice().sort((a,b)=>b.score-a.score||a.order-b.order);
  const i=roster.findIndex(x=>x.id===c.activeId),j=(i+1)%roster.length;
  return {...c,started:true,activeId:roster[j]?.id||'',round:c.round+(j===0&&i>=0?1:0)};
 });
 $('sc-combat-prev').onclick=()=>void change(c=>{
  const roster=c.entries.slice().sort((a,b)=>b.score-a.score||a.order-b.order);
  const i=roster.findIndex(x=>x.id===c.activeId),j=(i-1+roster.length)%roster.length;
  return {...c,started:true,activeId:roster[j]?.id||'',round:Math.max(1,c.round-(j===roster.length-1&&i===0?1:0))};
 });
 $('sc-combat-reroll').onclick=()=>{
  if(!confirm('Rolar novamente todas as iniciativas e reiniciar a rodada?'))return;
  void change(c=>{
   const entries=c.entries.map(e=>{
    const sheet=getSheets().find(f=>f.id===e.id);
    return {...e,...(sheet?rollInitiative(sheet):{bonus:e.bonus,roll:e.roll,score:e.score})};
   });
   const first=entries.slice().sort((a,b)=>b.score-a.score||a.order-b.order)[0];
   return {...c,entries,round:1,started:false,activeId:first?.id||''};
  });
 };
 $('sc-combat-clear').onclick=()=>{
  if(!confirm('Encerrar encontro e limpar toda a iniciativa?'))return;
  selected.clear();void change(()=>({entries:[],activeId:'',round:1,started:false}));
 };
 drawStrip();drawBoard();
 return {setData(raw){if(!busy)combat=normalize(raw||{});drawStrip();drawBoard()},
  refresh(){drawStrip();drawBoard()},getData(){return combat}};
}
