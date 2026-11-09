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
  style.textContent='.vtt-roll-row{display:flex;gap:7px;align-items:center}.vtt-roll-row>*{min-width:0}.vtt-roll-row input{width:65px}.vtt-roll-chat{margin-top:14px;display:flex;flex-direction:column;gap:9px;max-height:420px;overflow-y:auto;padding-right:4px}.vtt-roll-message{padding:10px 12px;background:#26372f;border:1px solid #51644c;border-radius:11px}.vtt-roll-message.mine{border-color:#a28b66}.vtt-roll-message strong{font-size:11px;color:#ebddbc}.vtt-roll-message p{font-size:12px;color:#dfdfd2;margin:5px 0;overflow-wrap:anywhere}.vtt-roll-message small{font-size:10px;color:#97ad9e}.vtt-dice-layer{position:absolute;z-index:9;pointer-events:none;bottom:12%;left:50%;transform:translateX(-50%);display:grid;place-items:center}.vtt-dice-symbol{background:linear-gradient(145deg,#c9b085,#6d563a);box-shadow:0 14px 42px #0009;border:2px solid #ead6ae;clip-path:polygon(50% 0%,94% 21%,96% 75%,50% 100%,4% 75%,6% 21%);width:108px;height:112px;display:grid;place-items:center;color:#fff3d3;font:bold 29px Georgia,serif;animation:vtt-roll-in 720ms ease-out both}.vtt-dice-label{margin-top:8px;padding:6px 12px;background:#18261fed;border:1px solid #bca7837c;border-radius:7px;color:#f6e9d3;font-size:12px;white-space:nowrap;text-align:center}@keyframes vtt-roll-in{0%{transform:rotate(-240deg) scale(.25);opacity:0}55%{transform:rotate(32deg) scale(1.15);opacity:1}100%{transform:rotate(0) scale(1);opacity:1}}@media(prefers-reduced-motion:reduce){.vtt-dice-symbol{animation:none}}';
  document.head.append(style);
  panel.innerHTML='<h3>Rolagens da mesa</h3><p class="hint">Testes do Shinobi: 2d8 + modificador. As rolagens da ficha aparecem neste histórico para todos.</p><label for="roll-dice">Dados</label><div class="vtt-roll-row"><select id="roll-dice"></select><input id="roll-bonus" type="number" min="-99" max="99" value="0" aria-label="Modificador"><button class="btn primary" id="roll-submit">Rolar</button></div><label for="roll-label">Descrição</label><input id="roll-label" maxlength="80" placeholder="Ex.: Teste de resistência"><div id="roll-request-director" hidden><h3>Solicitar perícia</h3><label for="roll-request-actor">Jogador / ficha</label><select id="roll-request-actor"></select><label for="roll-request-skill">Teste solicitado</label><select id="roll-request-skill"></select><button class="btn" id="roll-request-send">Pedir rolagem</button></div><h3>Chat e resultados</h3><div class="vtt-roll-row"><input id="roll-chat-text" maxlength="400" placeholder="Mensagem para a mesa"><button class="btn" id="roll-chat-send">Enviar</button></div><div id="roll-feed" class="vtt-roll-chat" aria-live="polite"></div>';
  const $=id=>document.getElementById(id);
  for(const id of SIGNED_DICE){const o=document.createElement('option');o.value=id;o.textContent=id; $('roll-dice').append(o)}
  $('roll-dice').value='2d8';
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
    const row=document.createElement('article');row.className='vtt-roll-message'+(e.uid===getUid()?' mine':'');
    const heading=document.createElement('strong');heading.textContent=(e.uid===getUid()?'Você':(e.payload?.character||e.uid?.slice(0,8)||'Shinobi'))+' · '+(e.type==='roll'?'Rolagem':e.type==='rollRequest'?'Pedido do mestre':'Mensagem');
    const info=document.createElement('p'),p=e.payload||{};
    if(e.type==='roll'){
      const rolls=Array.isArray(p.rolls)?p.rolls.join(' + '):String(p.result??'—');
      info.textContent=(p.character? p.character+' · ':'')+(p.label||'Dados')+' — '+(p.dice||'d20')+' ['+rolls+'] '+(Number.isFinite(+p.bonus)?(+p.bonus>=0?'+ ':'− ')+Math.abs(+p.bonus):'')+' = '+(p.total??p.result??'—');
    }else if(e.type==='rollRequest'){
      info.textContent='Solicitação: '+String(p.skill||'Perícia')+' para '+String(p.character||'personagem');
      if(p.targetUid===getUid()){
        const b=document.createElement('button');b.className='btn small';b.textContent='Rolar agora';
        b.onclick=()=>{
          const f=sheets.find(s=>s.id===p.fichaId&&s.ownerUid===getUid());
          const test=rollForSheet(f,p.skill);
          if(!test)return notify('Ficha não encontrada para a rolagem.');
          if(test.error)return notify(test.error);
          void publishRoll(makeDice(test.dice,test.bonus,test.label,f.nome,id));
        };
        row.append(b);
      }
    }else info.textContent=String(p.text||'');
    const time=document.createElement('small');time.textContent=escapeTime(e);
    row.append(heading,info,time);return row;
  }
  function setEvents(docs){
    events=docs.filter(x=>['roll','rollRequest','message'].includes(x.data.type)).sort((a,b)=>(a.data.at?.seconds||0)-(b.data.at?.seconds||0));
    const list=$('roll-feed');list.replaceChildren();
    for(const item of events.slice(-65))list.append(buildMessage(item.id,item.data));
    list.scrollTop=list.scrollHeight;
    for(const item of events){
      if(item.data.type!=='roll'||seen.has(item.id))continue;
      seen.add(item.id);if(seen.size>300)seen.delete(seen.values().next().value);
      const ms=item.data.at?.toMillis?.();
      if(ms&&Math.abs(Date.now()-ms)<6000&&item.data.uid!==getUid())animation(item.data.payload||{dice:'2d8',total:0,label:'Rolagem'});
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
