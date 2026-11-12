// Shinobi Chronicles · painel rápido do mestre (somente fichas já presentes no mapa).
// Recursos são alterados pelo callback transacional; nenhum dado é salvo no navegador.
export function createGMQuickPanel({
  panel,getAdmin,getSceneId,getTokens,getSheets,getCombat,getConditions,
  getTokenHidden,getFogVisible,onAdjust,onHide,onFocus,onSheet,onInitiative,onCondition,notify
}){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=(v,alt=0)=>Number.isFinite(Number(v))?Number(v):alt;
  const bounded=(n,min,max)=>Math.max(min,Math.min(max,n));
  let amount=5,working=false,filter='all',open=true;
  const hpOf=f=>{
    const max=Math.max(1,Math.min(100000,10+3*number(f?.atributos?.VIG)+5*number(f?.nc,4)));
    const raw=f?.recursos?.vit;
    return {max,current:raw==null||raw===''?max:bounded(Math.round(number(raw)),0,max)};
  };
  const chakraOf=f=>{
    const max=Math.max(0,Math.min(100000,10+3*number(f?.atributos?.ESP)));
    const raw=f?.recursos?.chakra;
    return {max,current:raw==null||raw===''?max:bounded(Math.round(number(raw)),0,max)};
  };
  function cards(){
    const seen=new Set();
    return getTokens().filter(t=>{
      if(!t?.id||!t.fichaId||seen.has(t.id))return false;
      seen.add(t.id);return true;
    }).map(t=>({token:t,sheet:getSheets().find(f=>f.id===t.fichaId)})).filter(x=>x.sheet)
      .filter(x=>filter==='all'||(filter==='hidden'?getTokenHidden(x.token.id):
        filter==='combat'?getCombat()?.entries?.some(e=>e.id===x.sheet.id):true));
  }
  const avatar=f=>{
    const raw=f?.retratos?.ninja||f?.retratos?.casual||f?.foto||'';
    return typeof raw==='string'&&/^https:\/\/[^\s"'<>]+$/i.test(raw)&&raw.length<1400?
      '<img src="'+esc(raw)+'" alt="" loading="lazy">':'<span aria-hidden="true">忍</span>';
  };
  const bar=(value,max,kind)=>'<div class="sc-gm-meter '+kind+'"><span style="width:'+
    (max?bounded(Math.round(value/max*100),0,100):0)+'%"></span></div>';
  function rowHTML({token,sheet}){
    const hp=hpOf(sheet),ch=chakraOf(sheet),hidden=getTokenHidden(token.id);
    const entry=getCombat()?.entries?.find(e=>e.id===sheet.id);
    const status=getConditions(sheet.id)||'';
    const name=esc(sheet.nome||sheet.name||token.name||'Shinobi'),id=esc(token.id);
    const readable=hidden?'Oculto para jogadores':!getFogVisible(token)?'Encoberto pela névoa':'Visível';
    return '<article class="sc-gm-character'+(hidden?' is-hidden':'')+'" data-gm-id="'+id+'">'+
      '<div class="sc-gm-character-top"><div class="sc-gm-avatar">'+avatar(sheet)+'</div>'+
      '<div class="sc-gm-person"><strong>'+name+'</strong><small>'+esc(readable)+
      (entry?' · INI '+esc(entry.score)+(entry.id===getCombat()?.activeId?' · AGINDO':''):'')+'</small></div>'+
      '<button type="button" class="sc-gm-eye" title="'+(hidden?'Revelar':'Ocultar')+' token dos jogadores" data-q-hide="'+id+'" aria-label="'+(hidden?'Revelar':'Ocultar')+' '+name+'">'+
      (hidden?'◉ Mostrar':'◌ Ocultar')+'</button></div>'+
      '<div class="sc-gm-resources">'+
        '<div class="sc-gm-resource"><div class="sc-gm-resource-label"><b>HP</b><span>'+hp.current+' / '+hp.max+'</span></div>'+bar(hp.current,hp.max,'hp')+
        '<div class="sc-gm-step"><button type="button" data-q-adjust="'+id+'" data-pool="vit" data-sign="-1" title="Diminuir HP">−</button>'+
        '<button type="button" data-q-adjust="'+id+'" data-pool="vit" data-sign="1" title="Recuperar HP">+</button></div></div>'+
        '<div class="sc-gm-resource"><div class="sc-gm-resource-label"><b>CHAKRA</b><span>'+ch.current+' / '+ch.max+'</span></div>'+bar(ch.current,ch.max,'chakra')+
        '<div class="sc-gm-step"><button type="button" data-q-adjust="'+id+'" data-pool="chakra" data-sign="-1" title="Gastar Chakra">−</button>'+
        '<button type="button" data-q-adjust="'+id+'" data-pool="chakra" data-sign="1" title="Recuperar Chakra">+</button></div></div></div>'+
      (status?'<div class="sc-gm-condition" title="Condições atuais">✦ '+esc(status)+'</div>':'')+
      '<div class="sc-gm-actions"><button type="button" data-q-focus="'+id+'">⌖ Mapa</button>'+
      '<button type="button" data-q-sheet="'+id+'">▤ Ficha</button>'+
      '<button type="button" data-q-cond="'+id+'">✧ Condições</button>'+
      (!entry?'<button type="button" data-q-ini="'+id+'">+ Iniciativa</button>':'')+'</div></article>';
  }
  panel.innerHTML='<details class="sc-gm-quick" id="sc-gm-quick-content" open><summary><span>'+
    '<small>CENTRAL DO MESTRE</small><strong>Controle rápido</strong></span><span class="sc-gm-chevron" aria-hidden="true">⌄</span></summary>'+
    '<div class="sc-gm-toolbar"><label>Passo <input id="sc-gm-step" type="number" min="1" max="999" value="5" aria-label="Pontos por ajuste"></label>'+
    '<label>Exibir <select id="sc-gm-filter"><option value="all">Todos no mapa</option><option value="combat">Em combate</option>'+
    '<option value="hidden">Ocultos</option></select></label></div>'+
    '<p class="sc-gm-helper">Ajuste HP e Chakra sem abrir fichas. O olho oculta somente o token escolhido, inclusive de outros jogadores.</p>'+
    '<div id="sc-gm-roster" class="sc-gm-roster"></div></details>';
  const $=id=>document.getElementById(id);
  const details=$('sc-gm-quick-content');
  details.addEventListener('toggle',()=>{open=details.open});
  $('sc-gm-step').addEventListener('input',e=>{
    const v=Number(e.target.value);
    if(Number.isFinite(v)&&v>=1&&v<=999)amount=Math.round(v);
  });
  $('sc-gm-filter').addEventListener('change',e=>{filter=e.target.value;refresh()});
  function refresh(){
    panel.hidden=!getAdmin();
    if(!getAdmin())return;
    if(details.open!==open)details.open=open;
    const root=$('sc-gm-roster');
    if(!root)return;
    const scroll=root.scrollTop,who=cards();
    root.innerHTML=who.length?who.map(rowHTML).join(''):
      '<p class="sc-gm-empty">'+(!getSceneId()?'Ative um mapa para controlar os participantes.':
      filter==='hidden'?'Nenhum token oculto nesta cena.':
      filter==='combat'?'Nenhum participante em combate está no mapa.':
      'Arraste personagens ao mapa para vê-los aqui.')+'</p>';
    root.scrollTop=scroll;
    for(const btn of root.querySelectorAll('[data-q-hide]'))btn.onclick=async()=>{
      if(working)return;
      working=true;btn.disabled=true;
      try{await onHide(btn.dataset.qHide)}
      catch(error){notify('Visibilidade: '+error.message)}
      finally{working=false;refresh()}
    };
    for(const btn of root.querySelectorAll('[data-q-adjust]'))btn.onclick=async()=>{
      if(working)return;
      const t=getTokens().find(x=>x.id===btn.dataset.qAdjust);
      if(!t)return;
      const change=(Number(btn.dataset.sign)||0)*amount;
      if(!change)return;
      working=true;btn.disabled=true;
      try{
        const outcome=await onAdjust(t.fichaId,btn.dataset.pool,change);
        notify((t.name||'Personagem')+' · '+(btn.dataset.pool==='vit'?'HP':'Chakra')+
          ': '+outcome.current+' / '+outcome.max);
      }catch(error){notify('Recursos: '+error.message)}
      finally{working=false;refresh()}
    };
    for(const b of root.querySelectorAll('[data-q-focus]'))b.onclick=()=>onFocus(b.dataset.qFocus);
    for(const b of root.querySelectorAll('[data-q-sheet]'))b.onclick=()=>{
      const token=getTokens().find(t=>t.id===b.dataset.qSheet);if(token)onSheet(token.fichaId);
    };
    for(const b of root.querySelectorAll('[data-q-cond]'))b.onclick=()=>{
      const token=getTokens().find(t=>t.id===b.dataset.qCond);if(token)onCondition(token.fichaId);
    };
    for(const b of root.querySelectorAll('[data-q-ini]'))b.onclick=async()=>{
      const token=getTokens().find(t=>t.id===b.dataset.qIni);
      if(!token||working)return;
      working=true;b.disabled=true;
      try{await onInitiative(token.fichaId)}
      catch(error){notify('Iniciativa: '+error.message)}
      finally{working=false;refresh()}
    };
  }
  function reset(){filter='all';$('sc-gm-filter').value='all';refresh()}
  refresh();
  return {refresh,reset};
}
