// Modo Teatro — camada de apresentação, independente do mapa tático.
export function createTheatre({stage, panel, onChange, isAdmin}) {
  const css=document.createElement('style');
  css.textContent=`
  #sc-theatre{position:absolute;inset:0;z-index:4;pointer-events:none;display:none;overflow:hidden;background:linear-gradient(180deg,rgba(10,16,18,.12),rgba(10,16,18,.65));}
  #sc-theatre.open{display:block}
  #sc-theatre .cast{position:absolute;left:3%;right:3%;bottom:92px;display:flex;align-items:flex-end;justify-content:space-evenly;gap:8px;height:65%}
  #sc-theatre .actor{flex:1;min-width:0;max-width:320px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;opacity:.55;filter:grayscale(.45);transition:opacity .25s,transform .25s,filter .25s;transform:translateY(8px)}
  #sc-theatre .actor.speaking{opacity:1;filter:none;transform:translateY(-10px)}
  #sc-theatre .actor img{max-height:calc(100% - 30px);max-width:100%;object-fit:contain;filter:drop-shadow(0 10px 18px #000b)}
  #sc-theatre .actor .placeholder{height:75%;width:85%;display:grid;place-items:center;border-radius:80px 80px 12px 12px;background:linear-gradient(130deg,#334c46,#1b292a);font-size:54px}
  #sc-theatre .actor b{font-size:12px;text-shadow:0 2px 6px black}
  #sc-theatre .dialogue{position:absolute;bottom:10px;left:4%;right:4%;min-height:75px;padding:13px 20px;background:rgba(14,22,22,.94);border:1px solid #c4a77a;border-radius:8px;box-shadow:0 8px 35px #0009}
  #sc-theatre .dialogue strong{display:block;color:#dfc28a;font-size:13px;margin-bottom:5px}
  #sc-theatre .dialogue p{margin:0;color:#fff;font-size:15px}
  .theatre-controls{border-top:1px solid #536056;margin-top:18px;padding-top:14px}
  .theatre-controls select,.theatre-controls textarea{width:100%;background:#121b17;color:#fff;border:1px solid #667467;border-radius:5px;padding:8px}
  .theatre-controls textarea{resize:vertical;min-height:55px}
  @media(max-width:720px){#sc-theatre .cast{height:53%;bottom:105px}#sc-theatre .dialogue{min-height:90px}}
  @media(prefers-reduced-motion:reduce){#sc-theatre .actor{transition:none}}
  `;
  document.head.append(css);
  const overlay=document.createElement('div');overlay.id='sc-theatre';overlay.setAttribute('aria-live','polite');stage.append(overlay);
  const controls=document.createElement('div');controls.className='theatre-controls';
  controls.innerHTML='<h3>Modo Teatro</h3><p>Retratos sobre o mapa, como numa visual novel.</p><button id="sc-theatre-toggle">Mostrar teatro</button><div id="sc-theatre-director"><label for="sc-theatre-actor">Personagem</label><select id="sc-theatre-actor"></select><button id="sc-theatre-add">Colocar no palco</button><button id="sc-theatre-remove">Retirar do palco</button><label for="sc-theatre-text">Diálogo</label><textarea id="sc-theatre-text" maxlength="400" placeholder="O que o personagem está dizendo?"></textarea><button id="sc-theatre-speak">Exibir fala</button><button id="sc-theatre-clear">Limpar palco</button></div>';
  panel.append(controls);
  const $=id=>document.getElementById(id);
  let data={enabled:false,cast:[],speaker:'',dialogue:''}, tokens=[];
  const update=patch=>{if(!isAdmin())return;onChange({...data,...patch})};
  $('sc-theatre-toggle').onclick=()=>update({enabled:!data.enabled});
  $('sc-theatre-add').onclick=()=>{const id=$('sc-theatre-actor').value;if(id&&!data.cast.includes(id))update({cast:[...data.cast,id].slice(0,5)})};
  $('sc-theatre-remove').onclick=()=>{const id=$('sc-theatre-actor').value;update({cast:data.cast.filter(x=>x!==id),speaker:data.speaker===id?'':data.speaker})};
  $('sc-theatre-speak').onclick=()=>update({speaker:$('sc-theatre-actor').value,dialogue:$('sc-theatre-text').value.slice(0,400),enabled:true});
  $('sc-theatre-clear').onclick=()=>update({cast:[],speaker:'',dialogue:''});
  function render(){
    const dir=$('sc-theatre-director');dir.hidden=!isAdmin();
    $('sc-theatre-toggle').hidden=!isAdmin();
    $('sc-theatre-toggle').textContent=data.enabled?'Ocultar teatro':'Mostrar teatro';
    overlay.classList.toggle('open',!!data.enabled);
    overlay.replaceChildren();
    if(!data.enabled)return;
    const cast=document.createElement('div');cast.className='cast';
    for(const id of data.cast){const t=tokens.find(x=>x.id===id);if(!t)continue;const actor=document.createElement('div');actor.className='actor'+(id===data.speaker?' speaking':'');const portrait=String(t.portrait||'');if(/^https:\/\//.test(portrait)){const img=document.createElement('img');img.src=portrait;img.alt=t.name||'Personagem';actor.append(img)}else{const placeholder=document.createElement('div');placeholder.className='placeholder';placeholder.textContent='忍';actor.append(placeholder)}const name=document.createElement('b');name.textContent=t.name||'Shinobi';actor.append(name);cast.append(actor)}
    overlay.append(cast);
    if(data.dialogue){const d=document.createElement('div');d.className='dialogue';const who=document.createElement('strong');who.textContent=tokens.find(t=>t.id===data.speaker)?.name||'Narrador';const p=document.createElement('p');p.textContent=data.dialogue;d.append(who,p);overlay.append(d)}
  }
  return {
    setState(next){data={enabled:!!next?.enabled,cast:Array.isArray(next?.cast)?next.cast.slice(0,5):[],speaker:next?.speaker||'',dialogue:next?.dialogue||''};render()},
    setTokens(items){tokens=items;const select=$('sc-theatre-actor');const old=select.value;select.replaceChildren();for(const t of tokens){const o=document.createElement('option');o.value=t.id;o.textContent=t.name||t.id;select.append(o)}if(tokens.some(t=>t.id===old))select.value=old;render()},
    refresh:render
  };
}
