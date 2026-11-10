// Shinobi Chronicles — Rolagens e solicitações de perícias para a mesa permanente.
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
export function createRollsPanel({panel,stage,isAdmin,getUid,getSheets,send,notify}){
  const style=document.createElement('style');
  style.textContent=`
/* Shinobi Chronicles · Rolagens: cartas, fichas de resultado e foco visual no D8. */
#rolls-panel{--gold:#dfc395;--ink:#16271f;--edge:#5b725e}
#rolls-panel h3{margin:0;color:#f4ead3}
#rolls-panel [hidden]{display:none!important}
.vtt-roll-hero{padding:17px 15px 16px;background:radial-gradient(ellipse at 94% 9%,#a18d4e26,transparent 58%),linear-gradient(135deg,#3b4935,#22372c);border:1px solid #79806491;border-radius:15px;margin:1px 0 14px;position:relative;overflow:hidden}
.vtt-roll-hero:before{content:"⚄";position:absolute;right:12px;top:8px;color:#d9c08a22;font:700 87px/1 Georgia,serif;pointer-events:none}
.vtt-roll-eyebrow{font:700 9px system-ui,sans-serif;letter-spacing:.17em;color:#d4bb8b;display:block;margin-bottom:7px}
.vtt-roll-hero h3{font:600 23px/1.15 Georgia,serif;letter-spacing:-.03em;color:#f5e9d2}
.vtt-roll-hero p{max-width:255px;margin:8px 0 0;color:#bfccbb;font-size:11px;line-height:1.6;position:relative}
.vtt-roll-card{padding:13px 12px 15px;border:1px solid #60755f91;border-radius:13px;background:linear-gradient(148deg,#2a4033c9,#1a2c24d9);margin:11px 0;box-shadow:inset 0 1px 0 #ffffff0a}
.vtt-roll-section-head{display:flex;align-items:center;justify-content:space-between;margin:2px 0 13px;gap:8px}
.vtt-roll-section-head strong{color:#f1e4ca;font:600 14px Georgia,serif}
.vtt-roll-hint-tag{font-size:9px;color:#dfc495;background:#5b543d69;padding:5px 7px;border-radius:6px;white-space:nowrap}
.vtt-roll-label{display:block;margin:12px 0 6px;color:#bacdbb;font-size:10px;letter-spacing:.03em}
.vtt-roll-dice-chips{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:9px 0 12px}
.vtt-roll-chip{border:1px solid #647c65;border-radius:8px;background:#1c3026;color:#cad9c9;min-height:37px;font-size:11px;font-weight:700;transition:transform .16s,background .16s,border-color .16s}
.vtt-roll-chip:hover{background:#4c624d;transform:translateY(-2px);border-color:#c3ac81}
.vtt-roll-chip.selected{background:linear-gradient(145deg,#8a714c,#685338);border-color:#d0b485;color:#fff0d3;box-shadow:0 5px 10px #080e0a40}
.vtt-roll-row{display:flex;gap:7px;align-items:center}.vtt-roll-row>*{min-width:0}
.vtt-roll-form{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(92px,.7fr);gap:9px;align-items:end}
.vtt-roll-form label{margin:0;display:grid;gap:5px}
.vtt-roll-form select,.vtt-roll-form input{height:39px}
.vtt-roll-action{width:100%;margin:13px 0 0!important;min-height:44px;border-color:#d8b783!important;background:linear-gradient(125deg,#9f8060,#755e42)!important;box-shadow:0 7px 18px #0b120b55;font-weight:800;letter-spacing:.02em;border-radius:10px!important;transition:transform .16s,filter .16s}
.vtt-roll-action:hover{transform:translateY(-2px);filter:brightness(1.12)}
.vtt-roll-action:disabled{opacity:.5;transform:none}
.vtt-roll-request{margin-top:13px;border-top:1px solid #76866b4d;padding-top:6px}
.vtt-roll-request h3{font:600 14px Georgia,serif!important;margin:8px 0}
.vtt-roll-chat-form{display:flex;gap:6px}
.vtt-roll-chat-form input{flex:1;min-width:0}
.vtt-roll-chat-form button{margin:0!important;white-space:nowrap}
.vtt-roll-feed-head{display:flex;align-items:center;justify-content:space-between;margin:19px 2px 9px}
.vtt-roll-feed-head strong{font:600 16px Georgia,serif;color:#f0e5d0}
.vtt-roll-live{display:flex;align-items:center;gap:5px;color:#a9c2a8;font-size:9px}
.vtt-roll-live:before{content:"";width:6px;height:6px;background:#99c099;border-radius:50%;box-shadow:0 0 0 3px #8cb4852f}
.vtt-roll-chat{display:flex;flex-direction:column;gap:9px;max-height:440px;overflow-y:auto;padding:0 3px 5px 0;margin-top:10px;scrollbar-width:thin;scrollbar-color:#687f66 transparent}
.vtt-roll-message{padding:11px 12px;background:#22382c;border:1px solid #5b725b80;border-radius:12px;box-shadow:0 3px 14px #00000019;animation:sc-roll-card-enter .2s ease-out}
.vtt-roll-message.mine{border-color:#a48f6e}
.vtt-roll-message.roll-result{background:linear-gradient(120deg,#2c4535,#213329 78%);border-left:3px solid #cbb180}
.vtt-roll-message.roll-request{background:#3b3829;border-left:3px solid #d1a86d}
.vtt-roll-event-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.vtt-roll-event-head strong{font-size:10px;color:#e6decb;line-height:1.25;flex:1;overflow-wrap:anywhere}
.vtt-roll-event-type{font-size:9px;color:#e8d3aa;border:1px solid #b29a735e;background:#79613d45;border-radius:5px;padding:3px 6px;white-space:nowrap}
.vtt-roll-result{display:flex;align-items:center;gap:11px;padding:9px 10px;border:1px solid #7f866c50;border-radius:9px;background:#14251e78}
.vtt-roll-total{font:600 32px/1 Georgia,serif;color:#ffe6aa;min-width:45px;text-align:center;text-shadow:0 2px 15px #d7b47130}
.vtt-roll-detail{flex:1;min-width:0}
.vtt-roll-detail b{display:block;font-size:11px;color:#f1e6d2;margin-bottom:4px;overflow-wrap:anywhere}
.vtt-roll-detail small{display:block;font-size:10px;color:#a6c2aa;line-height:1.5;overflow-wrap:anywhere}
.vtt-roll-message p{font-size:11px;color:#e0e5d6;margin:7px 0;line-height:1.5;overflow-wrap:anywhere}
.vtt-roll-time{display:block;text-align:right;font-size:9px;color:#a6baa6;margin-top:7px}
.vtt-roll-empty{padding:24px 12px;text-align:center;background:#1d312877;border:1px dashed #79896c90;color:#b2c1ae;border-radius:11px;font-size:11px;line-height:1.6}
.vtt-roll-empty:before{content:"⚄";font:500 30px Georgia,serif;display:block;color:#d1b684;margin-bottom:7px}
.vtt-dice-layer{position:absolute;z-index:9;pointer-events:none;bottom:12%;left:50%;transform:translateX(-50%);display:grid;place-items:center}
.vtt-dice-symbol{background:linear-gradient(145deg,#c9b085,#6d563a);box-shadow:0 14px 42px #0009;border:2px solid #ead6ae;clip-path:polygon(50% 0%,94% 21%,96% 75%,50% 100%,4% 75%,6% 21%);width:108px;height:112px;display:grid;place-items:center;color:#fff3d3;font:bold 29px Georgia,serif;animation:vtt-roll-in 720ms ease-out both}
.vtt-dice-label{margin-top:8px;padding:6px 12px;background:#18261fed;border:1px solid #bca7837c;border-radius:7px;color:#f6e9d3;font-size:12px;white-space:nowrap;text-align:center}
@keyframes vtt-roll-in{0%{transform:rotate(-240deg) scale(.25);opacity:0}55%{transform:rotate(32deg) scale(1.15);opacity:1}100%{transform:rotate(0) scale(1);opacity:1}}
@keyframes sc-roll-card-enter{from{opacity:.2;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){.vtt-dice-symbol,.vtt-roll-message{animation:none!important}.vtt-roll-chip,.vtt-roll-action{transition:none!important}}
`;
  document.head.append(style);
  panel.innerHTML=`
    <header class="vtt-roll-hero"><span class="vtt-roll-eyebrow">MESA SHINOBI · SISTEMA D8</span><h3>Rolagens &amp; Chat</h3><p>Seus testes, resultados e mensagens sincronizados com a campanha.</p></header>
    <section class="vtt-roll-card" aria-label="Painel de dados">
      <div class="vtt-roll-section-head"><strong>Dados da sorte</strong><span class="vtt-roll-hint-tag">2d8 + bônus</span></div>
      <span class="vtt-roll-label">Escolha rápida</span>
      <div class="vtt-roll-dice-chips" aria-label="Escolha rápida de dados">
        <button type="button" class="vtt-roll-chip selected" data-dice-value="2d8" aria-pressed="true">2d8</button>
        <button type="button" class="vtt-roll-chip" data-dice-value="1d8" aria-pressed="false">1d8</button>
        <button type="button" class="vtt-roll-chip" data-dice-value="1d20" aria-pressed="false">1d20</button>
        <button type="button" class="vtt-roll-chip" data-dice-value="1d100" aria-pressed="false">1d100</button>
      </div>
      <div class="vtt-roll-form">
        <label><span class="vtt-roll-label">Tipo de dado</span><select id="roll-dice" aria-label="Dados"></select></label>
        <label><span class="vtt-roll-label">Bônus</span><input id="roll-bonus" type="number" min="-99" max="99" value="0" aria-label="Modificador"></label>
      </div>
      <label for="roll-label" class="vtt-roll-label">Descrição da jogada</label>
      <input id="roll-label" maxlength="80" placeholder="Ex.: Teste de resistência">
      <button class="btn primary vtt-roll-action" id="roll-submit">⚄ &nbsp; Rolar dados</button>
      <section id="roll-request-director" class="vtt-roll-request" hidden>
        <h3>Solicitar perícia</h3>
        <label for="roll-request-actor">Jogador / ficha</label><select id="roll-request-actor"></select>
        <label for="roll-request-skill">Teste solicitado</label><select id="roll-request-skill"></select>
        <button class="btn" id="roll-request-send">Solicitar rolagem ↗</button>
      </section>
    </section>
    <div class="vtt-roll-feed-head"><strong>Histórico da mesa</strong><span class="vtt-roll-live">Sincronizado</span></div>
    <div class="vtt-roll-chat-form"><input id="roll-chat-text" maxlength="400" placeholder="Enviar mensagem para a mesa..." aria-label="Mensagem para a mesa"><button class="btn primary" id="roll-chat-send">Enviar</button></div>
    <div id="roll-feed" class="vtt-roll-chat" aria-live="polite" aria-relevant="additions"></div>
  `;
  const $=id=>document.getElementById(id);
  for(const id of SIGNED_DICE){const o=document.createElement('option');o.value=id;o.textContent=id; $('roll-dice').append(o)}
  $('roll-dice').value='2d8';
  function syncDiceChips(){
    const value=$('roll-dice').value;
    for(const chip of panel.querySelectorAll('[data-dice-value]')){
      const selected=chip.dataset.diceValue===value;
      chip.classList.toggle('selected',selected);
      chip.setAttribute('aria-pressed',String(selected));
    }
  }
  for(const chip of panel.querySelectorAll('[data-dice-value]')){
    chip.onclick=()=>{$('roll-dice').value=chip.dataset.diceValue;syncDiceChips()};
  }
  $('roll-dice').addEventListener('change',syncDiceChips);
  syncDiceChips();
  const keys=[...SKILL_DEFS.map(s=>s[0]),'CC','CD','ESQ','LM','Iniciativa'];
  for(const k of keys){const o=document.createElement('option');o.value=k;o.textContent=COMBAT[k]?.[0]||k;$('roll-request-skill').append(o)}
  const seen=new Set(),announce=new Set();
  let sheets=[],events=[],currentUid='',rolling=false;
  const escapeTime=event=>event.at?.toDate?.()?.toLocaleTimeString?.('pt-BR',{hour:'2-digit',minute:'2-digit'})||'';
  const getCurrentName=()=>getUid()?getUid().slice(0,8):'Jogador';
  const makeDice=(dice,bonus,label,character,requestId='')=>{
    if(!SIGNED_DICE.includes(dice))throw Error('Formato de dado inválido.');
    const [,count,faces]=dice.match(/^(\d+)d(\d+)$/),rolls=Array.from({length:+count},()=>randomDie(+faces));
    const b=integer(bonus,-99,99),sum=rolls.reduce((a,b)=>a+b,0);
    return {dice,rolls,bonus:b,total:sum+b,label:String(label||'Rolagem').slice(0,80),character:String(character||'Shinobi').slice(0,80),requestId:String(requestId||'').slice(0,90),source:'mesa'};
  };
  function animation(item){
    const layer=document.createElement('div');layer.className='vtt-dice-layer';
    const die=document.createElement('div');die.className='vtt-dice-symbol';die.textContent=item.total;
    const label=document.createElement('div');label.className='vtt-dice-label';label.textContent=item.label+' · '+item.dice+' = '+item.total;
    layer.append(die,label);stage.append(layer);setTimeout(()=>layer.remove(),1600);
  }
  async function publishRoll(info){
    if(rolling)return;
    rolling=true;$('roll-submit').disabled=true;
    try{await send('roll',info);animation(info)}catch(e){notify('Falha na rolagem: '+e.message)}
    finally{rolling=false;$('roll-submit').disabled=false}
  }
  $('roll-submit').onclick=()=>{if(!getUid())return notify('Faça login para rolar.');const sheet=sheets.find(f=>f.ownerUid===getUid());const info=makeDice($('roll-dice').value,$('roll-bonus').value,$('roll-label').value||'Rolagem livre',sheet?.nome||getCurrentName());void publishRoll(info)};
  $('roll-chat-send').onclick=async()=>{const text=$('roll-chat-text').value.trim();if(!text)return;try{await send('message',{text:text.slice(0,400)});$('roll-chat-text').value=''}catch(e){notify('Mensagem não enviada: '+e.message)}};
  $('roll-chat-text').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('roll-chat-send').click()}});
  $('roll-request-send').onclick=async()=>{
    if(!isAdmin())return;
    const id=$('roll-request-actor').value,f=sheets.find(x=>x.id===id);
    if(!f?.ownerUid)return notify('Selecione a ficha de um jogador.');
    try{await send('rollRequest',{targetUid:f.ownerUid,fichaId:f.id,character:String(f.nome||'Shinobi').slice(0,80),skill:$('roll-request-skill').value});notify('Perícia solicitada para '+(f.nome||'Shinobi'))}catch(e){notify('Falha na solicitação: '+e.message)}
  };
  function renderRequests(){
    $('roll-request-director').hidden=!isAdmin();
    const sel=$('roll-request-actor'),previous=sel.value;sel.replaceChildren();
    for(const f of sheets.filter(s=>!!s.ownerUid&&!s.tipo)){
      const o=document.createElement('option');o.value=f.id;o.textContent=(f.nome||'Shinobi')+' · '+(f.usuario||f.ownerUid.slice(0,8));sel.append(o)
    }
    if(sheets.some(f=>f.id===previous))sel.value=previous;
  }
  function buildMessage(id,e){
    const p=e.payload||{},mine=e.uid===getUid(),isRoll=e.type==='roll',isRequest=e.type==='rollRequest';
    const row=document.createElement('article');
    row.className='vtt-roll-message'+(mine?' mine':'')+(isRoll?' roll-result':isRequest?' roll-request':'');
    const head=document.createElement('div');head.className='vtt-roll-event-head';
    const heading=document.createElement('strong');
    heading.textContent=mine?'Você':String(p.character||e.uid?.slice(0,8)||'Shinobi');
    const category=document.createElement('span');category.className='vtt-roll-event-type';
    category.textContent=isRoll?'⚄ DADOS':isRequest?'✦ PEDIDO':'✉ CHAT';
    head.append(heading,category);row.append(head);
    if(isRoll){
      const result=document.createElement('div');result.className='vtt-roll-result';
      const big=document.createElement('span');big.className='vtt-roll-total';
      big.textContent=String(p.total??p.result??'—');
      const detail=document.createElement('div');detail.className='vtt-roll-detail';
      const label=document.createElement('b');label.textContent=String(p.label||'Rolagem');
      const breakdown=document.createElement('small');
      const dice=String(p.dice||'2d8'),rolls=Array.isArray(p.rolls)?p.rolls.join(' + '):String(p.result??'—');
      const bonus=Number.isFinite(Number(p.bonus))?Number(p.bonus):0;
      breakdown.textContent=dice+' ['+rolls+'] '+(bonus>=0?'+ ':'− ')+Math.abs(bonus);
      detail.append(label,breakdown);result.append(big,detail);row.append(result);
    }else{
      const info=document.createElement('p');
      if(isRequest){
        info.textContent='Teste de '+String(p.skill||'perícia')+' solicitado para '+String(p.character||'personagem')+'.';
        if(p.targetUid===getUid()){
          const button=document.createElement('button');button.className='btn small';button.textContent='⚄ Rolar agora';
          button.onclick=()=>{
            const f=sheets.find(x=>x.id===p.fichaId&&x.ownerUid===getUid());
            const test=rollForSheet(f,p.skill);
            if(!test)return notify('Ficha não encontrada para a rolagem.');
            if(test.error)return notify(test.error);
            void publishRoll(makeDice(test.dice,test.bonus,test.label,f.nome,id));
          };
          row.append(info,button);
        }else row.append(info);
      }else{info.textContent=String(p.text||'');row.append(info);}
    }
    const time=document.createElement('small');time.className='vtt-roll-time';time.textContent=escapeTime(e);
    row.append(time);return row;
  }
  function setEvents(docs){
    events=docs.filter(x=>['roll','rollRequest','message'].includes(x.data.type)).sort((a,b)=>(a.data.at?.seconds||0)-(b.data.at?.seconds||0));
    const list=$('roll-feed');list.replaceChildren();
    if(!events.length){
      const empty=document.createElement('div');empty.className='vtt-roll-empty';
      empty.textContent='Ainda não há rolagens nesta sessão. O primeiro resultado aparecerá aqui.';
      list.append(empty);
    }
    for(const item of events.slice(-65))list.append(buildMessage(item.id,item.data));
    list.scrollTop=list.scrollHeight;
    for(const item of events){
      if(item.data.type!=='roll'||seen.has(item.id))continue;
      const ms=item.data.at?.toMillis?.();
      if(!ms)continue; // Aguarda o timestamp de servidor para não perder eventos remotos pendentes.
      seen.add(item.id);if(seen.size>300)seen.delete(seen.values().next().value);
      if(Math.abs(Date.now()-ms)<6000&&item.data.uid!==getUid())animation(item.data.payload||{dice:'2d8',total:0,label:'Rolagem'});
    }
  }
  return {
    setUser(uid){currentUid=uid},
    setSheets(next){sheets=Array.isArray(next)?next:[];renderRequests()},
    setEvents,
    sendRoll:info=>publishRoll(info),
    requestSkill(skill,actorId){if(!isAdmin())return;const f=sheets.find(s=>s.id===actorId);if(f){$('roll-request-actor').value=actorId;$('roll-request-skill').value=skill;$('roll-request-send').click()}}
  };
}
