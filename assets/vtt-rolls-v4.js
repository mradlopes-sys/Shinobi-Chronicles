// Shinobi Chronicles — Dados D8 e histórico seguro de rolagens.
// Sistema D8 do Shinobi: testes de perícia e combate usam 2d8 + modificador.
export const SKILL_DEFS=[
 ['Acrobacia','AGI'],['Arte','INT'],['Atletismo','FOR'],['Ciências Naturais','INT'],
 ['Concentração','INT'],['Cultura','INT'],['Disfarces','PER'],['Escapar','DES'],
 ['Furtividade','AGI'],['Lidar com Animais','PER',true],['Mecanismos','INT',true],
 ['Medicina','INT',true],['Ocultismo','INT',true],['Prestidigitação','DES'],
 ['Procurar','PER'],['Prontidão','PER'],['Rastrear','PER'],['Venefício','INT',true]
];
const COMBAT={CC:['Combate corporal','FOR'],CD:['Combate à distância','DES'],ESQ:['Esquiva','AGI'],LM:['Ler movimento','PER']};
const SIGNED_DICE=['2d8','1d8','3d8','1d6','1d10','1d12','1d20','1d100'];
const integer=(v,lo,hi)=>Math.min(hi,Math.max(lo,Number.isFinite(+v)?Math.round(+v):0));
const randomDie=faces=>{const cap=4294967296-(4294967296%faces),arr=new Uint32Array(1);let v;do{crypto.getRandomValues(arr);v=arr[0]}while(v>=cap);return v%faces+1};
export function rollForSheet(sheet,key){
  if(!sheet)return null;
  const skill=SKILL_DEFS.find(s=>s[0]===key);
  if(skill){
    const attr=integer(sheet.atributos?.[skill[1]],0,100);
    const points=integer(sheet.pericias?.[key],0,100),extra=integer(sheet.periciaOutros?.[key],-50,50);
    if(skill[2]&&points===0)return {error:key+' exige treinamento.'};
    if(key==='Venefício'&&(+sheet.nc||4)<8)return {error:'Venefício indisponível neste NC.'};
    return {label:key,bonus:Math.ceil(attr/2)+points+extra,dice:'2d8'};
  }
  if(COMBAT[key]){
    const attr=COMBAT[key][1];
    return {label:COMBAT[key][0],dice:'2d8',bonus:3+integer(sheet.combateAjustes?.[key],-20,20)+integer(sheet.atributos?.[attr],0,100)};
  }
  if(key==='Iniciativa'){
    const pronto=rollForSheet(sheet,'Prontidão');
    return {label:'Iniciativa',dice:'1d8',bonus:integer(sheet.atributos?.AGI,0,100)+(pronto?.bonus||0)};
  }
  return null;
}

export function makeDicePayload(dice,bonus,label,character){
  if(!SIGNED_DICE.includes(dice))throw Error('Tipo de dado inválido.');
  const match=dice.match(/^(\d+)d(\d+)$/);
  if(!match)throw Error('Formato de dado inválido.');
  const n=Number(match[1]),faces=Number(match[2]);
  const rolls=Array.from({length:n},()=>randomDie(faces));
  const safeBonus=integer(bonus,-99,99);
  return {
    dice,rolls,bonus:safeBonus,total:rolls.reduce((a,b)=>a+b,0)+safeBonus,
    label:String(label||'Rolagem').slice(0,80),character:String(character||'Shinobi').slice(0,80)
  };
}
export function createRollsPanel({panel,stage,isAdmin,getUid,getSheets,send,sendSpecial,submitBlind,clearChat,deleteChatItem,notify}){
  const style=document.createElement('style');
  style.textContent="\n#rolls-panel{--rGold:#dfc492;--rBorder:#516c59;--rMuted:#abbfb0;color:#e6e7d9}\n#rolls-panel *{box-sizing:border-box}\n#rolls-panel [hidden]{display:none!important}\n.vr-chat,.vr-dice{margin:2px 0 16px}\n.vr-head{display:flex;align-items:center;gap:8px;justify-content:space-between;padding:2px 2px 11px}\n.vr-title{font:600 21px/1.1 Georgia,serif;color:#f4ead4;letter-spacing:-.025em}\n.vr-mini{font-size:9px;color:#bacbb7;letter-spacing:.07em}\n.vr-clean{background:transparent;border:1px solid #74837285;padding:7px 9px;color:#d8c69e;border-radius:7px;font-size:10px}\n.vr-clean:hover{background:#65523c50;border-color:#ddbb80}\n.vr-feed{min-height:128px;max-height:310px;overflow-y:auto;scrollbar-width:thin;padding:10px;background:linear-gradient(155deg,#152821cf,#1d3128b5);border:1px solid #5b715f99;border-radius:13px;display:flex;flex-direction:column;gap:9px;scrollbar-color:#768d79 transparent}\n.vr-chat-compose{display:flex;align-items:stretch;gap:6px;margin-top:10px}\n.vr-chat-compose input{flex:1;min-width:0;margin:0;border-radius:9px}\n.vr-chat-compose button{border:1px solid #a58d6c;border-radius:9px;background:#81684a;color:#ffebc8;font-weight:700;min-width:56px}\n.vr-chat-compose button:hover{background:#977954}\n.vr-empty{padding:22px 8px;text-align:center;color:#98b1a1;font-size:11px;line-height:1.6}\n.vr-empty:before{content:\"✧\";display:block;font:600 25px Georgia,serif;color:#bca679;margin-bottom:5px}\n.vr-message{background:linear-gradient(120deg,#2a4031c9,#23352bd9);border:1px solid #62776370;border-radius:10px;padding:10px;box-shadow:0 3px 10px #08120b19}\n.vr-message.own{border-color:#ac92746e}\n.vr-message.roll{border-left:3px solid #cbb184}\n.vr-message.private{border-left:3px solid #88a8b8}\n.vr-message.blind{border-left:3px solid #c49d95}\n.vr-msg-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}\n.vr-author{font-weight:700;font-size:10px;color:#eee5d2;flex:1;overflow-wrap:anywhere}\n.vr-mode{font-size:9px;border:1px solid #93826866;border-radius:5px;padding:3px 5px;color:#ead5ae;background:#8f7a4a2c;white-space:nowrap}\n.vr-message p{margin:0;color:#e0e7d9;font-size:12px;line-height:1.5;overflow-wrap:anywhere}\n.vr-meta{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-top:7px}\n.vr-time{font-size:9px;color:#a1b9a6}\n.vr-delete{border:0;background:transparent;color:#cbb9a0;font-size:12px;padding:2px 5px}\n.vr-delete:hover{color:#ffc8bd}\n.vr-result{width:100%;display:flex;align-items:center;gap:9px;border:0;border-radius:8px;background:#12231b89;padding:10px;color:inherit;text-align:left}\n.vr-result:hover{background:#374837ba}\n.vr-total{font:600 30px/1 Georgia,serif;color:#f7dba4;min-width:42px;text-align:center}\n.vr-result-copy{display:grid;gap:3px;flex:1;min-width:0}\n.vr-result-copy b{font:600 12px Georgia,serif;color:#f0e5cf;overflow-wrap:anywhere}\n.vr-result-copy small{font-size:10px;color:#bbcab4}\n.vr-breakdown{margin:7px 1px 0;padding:8px;border-radius:6px;background:#13271df0;color:#cbd8c5;font-size:11px}\n.vr-breakdown[hidden]{display:none}\n.vr-dice{border:1px solid #62786292;border-radius:14px;padding:14px 12px 16px;background:radial-gradient(circle at 97% 5%,#d1a56619,transparent 52%),linear-gradient(150deg,#304438cc,#1b2c25e8)}\n.vr-dice .vr-title{font-size:19px}\n.vr-dice-mini{font-size:10px;color:#aabfa9;line-height:1.5;padding:2px 0 10px}\n.vr-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:0 0 12px}\n.vr-quick button{border:1px solid #607663;border-radius:8px;background:#182c21;color:#d2decb;padding:8px 0;font-size:11px;font-weight:800;transition:background .16s,border-color .16s}\n.vr-quick button:hover{background:#3c5b46}\n.vr-quick button.selected{border-color:#d3b27e;background:#766141;color:#fff2d7}\n.vr-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.8fr);gap:9px}\n.vr-field{display:block;margin:0 0 9px;font:600 10px/1.3 system-ui,sans-serif;color:#bdcdbd}\n.vr-field span{display:block;margin-bottom:6px}\n.vr-field input,.vr-field select{height:40px;margin:0;background:#13231d;border:1px solid #5a705c;border-radius:9px}\n.vr-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:9px 0 12px}\n.vr-modes label{margin:0;cursor:pointer}\n.vr-modes input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}\n.vr-modes span{display:block;padding:9px 6px;text-align:center;border:1px solid #586e58;border-radius:8px;background:#192e24;color:#c9d6c7;font-size:10px;font-weight:700}\n.vr-modes input:checked+span{background:#6f5d40;border-color:#d2b580;color:#fff2d6}\n.vr-modes input:focus-visible+span{outline:2px solid #d8ba85;outline-offset:1px}\n.vr-roll-button{width:100%;min-height:43px;border:1px solid #c3a374;border-radius:9px;background:linear-gradient(115deg,#a08458,#776146);color:#fff2d7;font-weight:800;letter-spacing:.035em;box-shadow:0 6px 16px #050e082a}\n.vr-roll-button:hover{filter:brightness(1.1)}\n.vr-roll-button:disabled{opacity:.55}\n.vr-explain{font-size:10px;line-height:1.5;color:#b7c6b7;margin-top:10px}\n.vr-dice-layer{position:absolute;bottom:15%;left:50%;transform:translateX(-50%);z-index:9;pointer-events:none;text-align:center}\n.vr-die{width:80px;height:84px;margin:auto;clip-path:polygon(50% 0,94% 22%,94% 75%,50% 100%,6% 75%,6% 22%);background:linear-gradient(135deg,#cfb68c,#806442);display:grid;place-items:center;font:700 30px Georgia,serif;color:#fff6e3;animation:vr-die-appear .65s ease both;text-shadow:0 2px 8px #0005}\n.vr-die-label{display:inline-block;background:#15261fdc;color:#fff1d4;border:1px solid #bb9d74;border-radius:7px;margin-top:7px;padding:5px 8px;font-size:10px;white-space:nowrap}\n@keyframes vr-die-appear{0%{opacity:0;transform:translateY(14px) rotate(-60deg) scale(.65)}70%{opacity:1;transform:translateY(-5px) rotate(14deg) scale(1.1)}100%{opacity:1;transform:translateY(0) rotate(0) scale(1)}}\n@media(prefers-reduced-motion:reduce){.vr-die{animation:none}.vr-quick button{transition:none}}\n";
  document.head.append(style);
  panel.innerHTML="\n<section class=\"vr-chat\" aria-label=\"Chat da campanha\">\n  <header class=\"vr-head\">\n    <span class=\"vr-title\">Chat</span>\n    <button type=\"button\" class=\"vr-clean\" id=\"vr-clear\" hidden title=\"Apagar histórico compartilhado\">Limpar chat</button>\n  </header>\n  <div id=\"vr-feed\" class=\"vr-feed\" role=\"log\" aria-live=\"polite\" aria-label=\"Mensagens e resultados\"></div>\n  <form class=\"vr-chat-compose\" id=\"vr-chat-form\">\n    <input id=\"vr-chat-input\" maxlength=\"400\" placeholder=\"Escrever para a mesa...\" aria-label=\"Mensagem para a mesa\" autocomplete=\"off\"/>\n    <button type=\"submit\">Enviar</button>\n  </form>\n</section>\n<section class=\"vr-dice\" aria-label=\"Rolador de dados\">\n  <header class=\"vr-head\"><span class=\"vr-title\">Dados</span><span class=\"vr-mini\">Sistema D8</span></header>\n  <div class=\"vr-quick\">\n    <button type=\"button\" data-dice=\"2d8\" class=\"selected\">2d8</button>\n    <button type=\"button\" data-dice=\"1d8\">1d8</button>\n    <button type=\"button\" data-dice=\"3d8\">3d8</button>\n    <button type=\"button\" data-dice=\"1d20\">1d20</button>\n  </div>\n  <div class=\"vr-grid\">\n    <label class=\"vr-field\"><span>Dados</span><select id=\"vr-dice\"></select></label>\n    <label class=\"vr-field\"><span>Modificador</span><input type=\"number\" id=\"vr-bonus\" min=\"-99\" max=\"99\" step=\"1\" value=\"0\"/></label>\n  </div>\n  <label class=\"vr-field\"><span>Nome do teste</span><input id=\"vr-label\" maxlength=\"80\" placeholder=\"Ex.: Furtividade, ataque...\"/></label>\n  <div class=\"vr-field\" style=\"margin-top:12px\"><span>Visibilidade da rolagem</span></div>\n  <div class=\"vr-modes\" role=\"radiogroup\" aria-label=\"Quem pode ver o resultado\">\n    <label><input type=\"radio\" name=\"vr-mode\" value=\"public\" checked/><span>◎ Pública</span></label>\n    <label><input type=\"radio\" name=\"vr-mode\" value=\"gm\"/><span>◈ Para o mestre</span></label>\n    <label><input type=\"radio\" name=\"vr-mode\" value=\"self\"/><span>◉ Privada</span></label>\n    <label><input type=\"radio\" name=\"vr-mode\" value=\"blind\"/><span>◌ Cega (mestre)</span></label>\n  </div>\n  <button class=\"vr-roll-button\" id=\"vr-roll\" type=\"button\">⚄ Rolar dados</button>\n  <div class=\"vr-explain\" id=\"vr-mode-explain\">Todos na sessão verão o resultado.</div>\n</section>\n";
  const $=id=>panel.querySelector('#'+id);
  let publicEvents=[],privateEvents=[],sheets=[],rolling=false;
  const seen=new Set();
  const diceSelect=$('vr-dice');
  for(const value of SIGNED_DICE){const option=new Option(value,value);diceSelect.append(option);}
  diceSelect.value='2d8';
  const modeTips={
    public:'Todos na sessão verão o resultado.',
    gm:'Resultado enviado apenas ao mestre. Não aparece para os jogadores.',
    self:'Resultado visível somente para você, inclusive fora da visão do mestre.',
    blind:'Resultado gerado pelo navegador do mestre quando estiver conectado. Você não vê os dados.'
  };
  const mode=()=>panel.querySelector('input[name="vr-mode"]:checked')?.value||'public';
  function syncMode(){
    $('vr-mode-explain').textContent=modeTips[mode()];
    $('vr-roll').textContent=mode()==='blind'?'◌ Enviar rolagem cega':'⚄ Rolar dados';
  }
  for(const input of panel.querySelectorAll('input[name="vr-mode"]'))input.onchange=syncMode;
  function syncChips(){
    for(const button of panel.querySelectorAll('[data-dice]')){
      button.classList.toggle('selected',button.dataset.dice===diceSelect.value);
    }
  }
  for(const button of panel.querySelectorAll('[data-dice]')){
    button.onclick=()=>{diceSelect.value=button.dataset.dice;syncChips();};
  }
  diceSelect.onchange=syncChips;syncChips();syncMode();
  const name=()=>sheets.find(f=>f.ownerUid===getUid())?.nome||'Shinobi';
  const escTime=d=>d.at?.toDate?.()?.toLocaleTimeString?.('pt-BR',{hour:'2-digit',minute:'2-digit'})||'';
  const createdAt=d=>d.at?.toMillis?.()||((d.at?.seconds||0)*1000)||0;
  function animation(result){
    if(!result||typeof result.total!=='number')return;
    const previous=stage.querySelector('.vr-dice-layer.vr-dice-cinematic');
    if(previous)previous.remove();
    const layer=document.createElement('div');
    layer.className='vr-dice-layer vr-dice-cinematic';
    layer.setAttribute('aria-label','Resultado da rolagem '+String(result.total));
    const board=document.createElement('div');board.className='vr-cinematic-board';
    const label=document.createElement('div');label.className='vr-cinematic-heading';
    label.textContent=String(result.label||'Rolagem de dados').slice(0,80)+' · '+String(result.dice||'2d8');
    const row=document.createElement('div');row.className='vr-cinematic-dice';
    const values=Array.isArray(result.rolls)?result.rolls.slice(0,6):[];
    for(let i=0;i<values.length;i++){
      const value=Number.isFinite(Number(values[i]))?Math.max(0,Math.min(100,Number(values[i]))):0;
      const die=document.createElement('div');die.className='vr-cinematic-die';
      die.style.setProperty('--vr-i',String(i));
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 110 120');svg.setAttribute('aria-hidden','true');
      // Um verdadeiro octaedro estilizado, com facetas de luz e número separado do total.
      const NS='http://www.w3.org/2000/svg';
      const polygon=(points,fill,stroke='',strokeWidth=0)=>{
        const p=document.createElementNS(NS,'polygon');p.setAttribute('points',points);
        p.setAttribute('fill',fill);
        if(stroke){p.setAttribute('stroke',stroke);p.setAttribute('stroke-width',String(strokeWidth))}
        svg.append(p);
      };
      polygon('55,4 103,59 55,116 7,59','#bea276','#edd9ac',2.2);
      polygon('55,4 55,116 8,59','#a1845d');
      polygon('55,4 103,59 55,63','#e6d0a2');
      polygon('55,4 55,63 8,59','#d6ba85');
      polygon('103,59 55,116 55,63','#b29466');
      polygon('55,63 55,116 8,59','#886c4e');
      const topLine=document.createElementNS(NS,'path');
      topLine.setAttribute('d','M55 4 V116 M8 59 L55 63 L103 59');
      topLine.setAttribute('stroke','#fff0c5');topLine.setAttribute('stroke-opacity','.47');
      topLine.setAttribute('stroke-width','1.2');topLine.setAttribute('fill','none');
      svg.append(topLine);
      const number=document.createElementNS(NS,'text');number.textContent=String(value);
      number.setAttribute('x','55');number.setAttribute('y','72');
      number.setAttribute('text-anchor','middle');
      number.setAttribute('dominant-baseline','middle');
      svg.append(number);die.append(svg);row.append(die);
    }
    if(!values.length){const empty=document.createElement('span');empty.textContent='⚄';empty.className='vr-cinematic-heading';row.append(empty)}
    const summary=document.createElement('div');summary.className='vr-cinematic-summary';
    const sum=document.createElement('span');sum.className='formula';
    sum.textContent=values.join(' + ')||'—';
    const mod=document.createElement('span');mod.className='separator';
    const bonus=Number(result.bonus)||0;
    mod.textContent=(bonus<0?' − ':' + ')+Math.abs(bonus);
    const equals=document.createElement('span');equals.className='separator';equals.textContent=' = ';
    const total=document.createElement('strong');total.textContent=String(result.total);
    summary.append(sum,mod,equals,total);
    const shadow=document.createElement('div');shadow.className='vr-cinematic-shadow';
    board.append(label,row,summary,shadow);layer.append(board);stage.append(layer);
    window.setTimeout(()=>layer.remove(),2650);
  }
  async function roll(info){
    if(rolling)return;
    if(!getUid()){notify('Faça login para utilizar os dados.');return;}
    rolling=true;$('vr-roll').disabled=true;
    try{
      const kind=mode();
      if(kind==='blind'){
        await submitBlind({
          uid:getUid(),dice:info.dice,bonus:info.bonus,label:info.label,character:info.character
        });
        notify('Rolagem cega enviada. O mestre receberá o resultado quando estiver conectado.');
      }else if(kind==='public'){
        await send('roll',info);animation(info);
      }else if(kind==='gm'){
        await sendSpecial('gm',info);
        if(isAdmin())animation(info);else notify('Rolagem enviada exclusivamente ao mestre.');
      }else{
        await sendSpecial('self',info);animation(info);
      }
    }catch(e){notify('Não foi possível registrar a rolagem: '+e.message);}
    finally{rolling=false;$('vr-roll').disabled=false;}
  }
  $('vr-roll').onclick=()=>{
    const dice=diceSelect.value,bonus=integer($('vr-bonus').value,-99,99);
    const label=String($('vr-label').value||'Rolagem livre').slice(0,80),character=name();
    // Blind roll: the player's browser never generates or receives a result.
    // The authenticated GM calculates it from the request in Firestore.
    const payload=mode()==='blind'?
      {dice,bonus,label,character}:
      makeDicePayload(dice,bonus,label,character);
    void roll(payload);
  };
  $('vr-chat-form').onsubmit=async e=>{
    e.preventDefault();const text=$('vr-chat-input').value.trim();
    if(!text||!getUid())return;
    const submit=$('vr-chat-form').querySelector('button');
    submit.disabled=true;
    try{
      await send('message',{text:text.slice(0,400),character:name()});
      $('vr-chat-input').value='';
    }catch(error){notify('Erro ao enviar mensagem: '+error.message);}
    finally{submit.disabled=false;}
  };
  $('vr-clear').onclick=async()=>{
    if(!isAdmin()||!confirm('Apagar permanentemente as mensagens e rolagens compartilhadas da mesa? Esta ação não pode ser desfeita.'))return;
    $('vr-clear').disabled=true;
    try{
      const ok=await clearChat();
      if(ok!==false)notify('Chat compartilhado apagado.');
    }catch(error){notify('Não foi possível apagar o chat: '+error.message);}
    finally{$('vr-clear').disabled=false;}
  };
  function makeEntry(item){
    const d=item.data||{},p=d.payload||d,roll=d.type==='roll'||d.type==='privateRoll';
    if(!['roll','message','privateRoll','rollRequest'].includes(d.type))return null;
    if(d.type==='rollRequest')return null;
    const block=document.createElement('article');
    const mine=d.uid===getUid(),isPrivate=d.mode&&d.mode!=='public';
    block.className='vr-message'+(mine?' own':'')+(roll?' roll':'')+(isPrivate?' private':'')+(d.mode==='blind'?' blind':'');
    const head=document.createElement('div');head.className='vr-msg-head';
    const author=document.createElement('strong');author.className='vr-author';author.textContent=mine?'Você':String(p.character||d.uid?.slice(0,8)||'Shinobi');
    const type=document.createElement('span');type.className='vr-mode';
    type.textContent=roll?({public:'DADOS',gm:'MESTRE',self:'PRIVADA',blind:'CEGA'}[d.mode||'public']||'DADOS'):'CHAT';
    head.append(author,type);block.append(head);
    if(roll){
      const row=document.createElement('button');row.type='button';row.className='vr-result';
      row.setAttribute('aria-label','Mostrar detalhes da rolagem '+String(p.label||''));
      const total=document.createElement('span');total.className='vr-total';total.textContent=String(p.total??'—');
      const copy=document.createElement('span');copy.className='vr-result-copy';
      const label=document.createElement('b');label.textContent=String(p.label||'Rolagem');
      const min=document.createElement('small');min.textContent=String(p.dice||'2d8')+' · clique para detalhes';
      copy.append(label,min);row.append(total,copy);block.append(row);
      const detail=document.createElement('div');detail.className='vr-breakdown';detail.hidden=true;
      detail.textContent=String(p.dice||'2d8')+' → '+(Array.isArray(p.rolls)?p.rolls.join(' + '):'?')+
        ' '+((Number(p.bonus)||0)>=0?'+ ':'− ')+Math.abs(Number(p.bonus)||0)+' = '+String(p.total??'—');
      row.onclick=()=>{detail.hidden=!detail.hidden;row.setAttribute('aria-expanded',String(!detail.hidden));};
      block.append(detail);
    }else{
      const paragraph=document.createElement('p');
      paragraph.textContent=String(p.text||'');
      block.append(paragraph);
    }
    const foot=document.createElement('div');foot.className='vr-meta';
    const time=document.createElement('span');time.className='vr-time';time.textContent=escTime(d);foot.append(time);
    const canRemove=item.kind==='public'?(isAdmin()||(d.type==='message'&&mine)) :
      item.kind==='self'?mine:isAdmin();
    if(canRemove){
      const del=document.createElement('button');del.type='button';del.className='vr-delete';
      del.title='Apagar esta mensagem';del.setAttribute('aria-label','Apagar mensagem');del.textContent='✕';
      del.onclick=async()=>{try{await deleteChatItem(item.kind,item.id);}catch(e){notify('Não foi possível apagar: '+e.message);}};
      foot.append(del);
    }
    block.append(foot);return block;
  }
  function redraw(){
    $('vr-clear').hidden=!isAdmin();
    const feed=$('vr-feed'),wasNearBottom=feed.scrollHeight-feed.scrollTop-feed.clientHeight<65;
    feed.replaceChildren();
    const items=[
      ...publicEvents.map(v=>({...v,kind:'public'})),
      ...privateEvents
    ].filter(item=>item.data?.type==='message'||item.data?.type==='roll'||item.data?.type==='privateRoll')
      .sort((a,b)=>createdAt(a.data)-createdAt(b.data));
    if(!items.length){
      const empty=document.createElement('div');empty.className='vr-empty';
      empty.textContent='Nenhuma mensagem ainda. O chat da mesa aparecerá aqui.';
      feed.append(empty);
    }else for(const item of items.slice(-100)){
      const element=makeEntry(item);
      if(element)feed.append(element);
    }
    if(wasNearBottom)feed.scrollTop=feed.scrollHeight;
    for(const item of publicEvents){
      if(item.data?.type!=='roll'||seen.has(item.id))continue;
      const ms=createdAt(item.data);
      if(!ms)continue;seen.add(item.id);
      if(seen.size>300)seen.delete(seen.values().next().value);
      if(Math.abs(Date.now()-ms)<5000&&item.data.uid!==getUid())animation(item.data.payload);
    }
  }
  return {
    setUser(){publicEvents=[];privateEvents=[];seen.clear();redraw();},
    setSheets(data){sheets=Array.isArray(data)?data:[];},
    setEvents(data){publicEvents=Array.isArray(data)?data:[];redraw();},
    setPrivateEvents(data){privateEvents=Array.isArray(data)?data:[];redraw();},
    sendRoll:info=>roll(info),
    requestSkill(){/* O mestre não solicita mais rolagens por esse painel. */}
  };
}
