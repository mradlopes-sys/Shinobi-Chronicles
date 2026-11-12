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
  style.textContent="\n#rolls-panel{--rGold:#dfc492;--rBorder:#516c59;--rMuted:#abbfb0;color:#e6e7d9}\n#rolls-panel *{box-sizing:border-box}\n#rolls-panel [hidden]{display:none!important}\n.vr-chat{margin:0 0 12px}.vr-dice{margin:0 0 8px}\n.vr-head{display:flex;align-items:center;gap:8px;justify-content:space-between;padding:2px 2px 8px}\n.vr-title{font:600 21px/1.1 Georgia,serif;color:#f4ead4;letter-spacing:-.025em}\n.vr-mini{font-size:9px;color:#bacbb7;letter-spacing:.07em}\n.vr-clean{background:transparent;border:1px solid #74837285;padding:7px 9px;color:#d8c69e;border-radius:7px;font-size:10px}\n.vr-clean:hover{background:#65523c50;border-color:#ddbb80}\n.vr-feed{height:auto;min-height:clamp(460px,74dvh,880px);max-height:none;overflow:visible;scrollbar-width:thin;padding:10px;background:linear-gradient(155deg,#152821cf,#1d3128b5);border:1px solid #5b715f99;border-radius:13px;display:flex;flex-direction:column;gap:7px;scrollbar-color:#768d79 transparent}\n.vr-chat-compose{display:flex;align-items:stretch;gap:6px;margin-top:10px}\n.vr-chat-compose input{flex:1;min-width:0;margin:0;border-radius:9px}\n.vr-chat-compose button{border:1px solid #a58d6c;border-radius:9px;background:#81684a;color:#ffebc8;font-weight:700;min-width:56px}\n.vr-chat-compose button:hover{background:#977954}\n.vr-empty{padding:22px 8px;text-align:center;color:#98b1a1;font-size:11px;line-height:1.6}\n.vr-empty:before{content:\"✧\";display:block;font:600 25px Georgia,serif;color:#bca679;margin-bottom:5px}\n.vr-message{background:linear-gradient(120deg,#2a4031c9,#23352bd9);border:1px solid #62776370;border-radius:10px;padding:8px 9px;box-shadow:0 3px 10px #08120b19}\n.vr-message.own{border-color:#ac92746e}\n.vr-message.roll{border-left:3px solid #cbb184}\n.vr-message.private{border-left:3px solid #88a8b8}\n.vr-message.blind{border-left:3px solid #c49d95}\n.vr-msg-head{display:flex;align-items:center;gap:8px;margin-bottom:4px}\n.vr-author{font-weight:700;font-size:10px;color:#eee5d2;flex:1;overflow-wrap:anywhere}\n.vr-mode{font-size:9px;border:1px solid #93826866;border-radius:5px;padding:3px 5px;color:#ead5ae;background:#8f7a4a2c;white-space:nowrap}\n.vr-message p{margin:0;color:#e0e7d9;font-size:13px;line-height:1.5;overflow-wrap:anywhere}\n.vr-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px}\n.vr-time{font-size:9px;color:#a1b9a6}\n.vr-delete{border:0;background:transparent;color:#cbb9a0;font-size:12px;padding:2px 5px}\n.vr-delete:hover{color:#ffc8bd}\n.vr-result{width:100%;display:flex;align-items:center;gap:9px;border:0;border-radius:8px;background:#12231b89;padding:6px 8px;color:inherit;text-align:left}\n.vr-result:hover{background:#374837ba}\n.vr-total{font:600 23px/1 Georgia,serif;color:#f7dba4;min-width:36px;text-align:center}\n.vr-result-copy{display:grid;gap:2px;flex:1;min-width:0}\n.vr-result-copy b{font:600 12px Georgia,serif;color:#f0e5cf;overflow-wrap:anywhere}\n.vr-result-copy small{font-size:10px;color:#bbcab4}\n.vr-breakdown{margin:7px 1px 0;padding:8px;border-radius:6px;background:#13271df0;color:#cbd8c5;font-size:11px}\n.vr-breakdown[hidden]{display:none}\n.vr-dice{border:1px solid #62786292;border-radius:14px;padding:9px 11px 10px;background:radial-gradient(circle at 97% 5%,#d1a56619,transparent 52%),linear-gradient(150deg,#304438cc,#1b2c25e8)}\n.vr-dice .vr-title{font-size:19px}\n.vr-dice-mini{font-size:10px;color:#aabfa9;line-height:1.5;padding:2px 0 10px}\n.vr-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin:0 0 8px}\n.vr-quick button{border:1px solid #607663;border-radius:8px;background:#182c21;color:#d2decb;padding:6px 0;font-size:11px;font-weight:800;transition:background .16s,border-color .16s}\n.vr-quick button:hover{background:#3c5b46}\n.vr-quick button.selected{border-color:#d3b27e;background:#766141;color:#fff2d7}\n.vr-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.8fr);gap:9px}\n.vr-field{display:block;margin:0 0 7px;font:600 10px/1.3 system-ui,sans-serif;color:#bdcdbd}\n.vr-field span{display:block;margin-bottom:6px}\n.vr-field input,.vr-field select{height:34px;margin:0;background:#13231d;border:1px solid #5a705c;border-radius:9px}\n.vr-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin:6px 0 8px}\n.vr-modes button.vr-mode-choice{width:100%;min-width:0;padding:0;margin:0;border:0;background:transparent;color:inherit;cursor:pointer;display:block;-webkit-tap-highlight-color:transparent}\n.vr-modes button.vr-mode-choice:focus{box-shadow:none}\n.vr-modes button.vr-mode-choice span{display:grid;place-items:center;min-height:32px;padding:7px 4px;text-align:center;border:1px solid #586e58;border-radius:8px;background:#192e24;color:#c9d6c7;font-size:10px;font-weight:700;line-height:1.25;transition:background .15s,border-color .15s;user-select:none}\n.vr-modes button.vr-mode-choice[aria-checked=\"true\"] span{background:#6f5d40;border-color:#d2b580;color:#fff2d6}\n.vr-modes button.vr-mode-choice:focus-visible span{outline:2px solid #d8ba85;outline-offset:1px}\n.vr-roll-button{width:100%;min-height:37px;border:1px solid #c3a374;border-radius:9px;background:linear-gradient(115deg,#a08458,#776146);color:#fff2d7;font-weight:800;letter-spacing:.035em;box-shadow:0 6px 16px #050e082a}\n.vr-roll-button:hover{filter:brightness(1.1)}\n.vr-roll-button:disabled{opacity:.55}\n.vr-explain{font-size:10px;line-height:1.5;color:#b7c6b7;margin-top:6px}\n.vr-dice-layer{position:absolute;bottom:15%;left:50%;transform:translateX(-50%);z-index:9;pointer-events:none;text-align:center}\n.vr-die{width:80px;height:84px;margin:auto;clip-path:polygon(50% 0,94% 22%,94% 75%,50% 100%,6% 75%,6% 22%);background:linear-gradient(135deg,#cfb68c,#806442);display:grid;place-items:center;font:700 30px Georgia,serif;color:#fff6e3;animation:vr-die-appear .65s ease both;text-shadow:0 2px 8px #0005}\n.vr-die-label{display:inline-block;background:#15261fdc;color:#fff1d4;border:1px solid #bb9d74;border-radius:7px;margin-top:7px;padding:5px 8px;font-size:10px;white-space:nowrap}\n@keyframes vr-die-appear{0%{opacity:0;transform:translateY(14px) rotate(-60deg) scale(.65)}70%{opacity:1;transform:translateY(-5px) rotate(14deg) scale(1.1)}100%{opacity:1;transform:translateY(0) rotate(0) scale(1)}}\n@media(prefers-reduced-motion:reduce){.vr-die{animation:none}.vr-quick button{transition:none}}\n/* O chat é a área prioritária da aba: mantém altura generosa mesmo vazio.\n   A rolagem continua na sidebar inteira, nunca num scroll interno do histórico. */\n/* Histórico expandido e dados compactos; preserva tipografia oriental. */\nhtml[data-appearance] #rolls-panel .vr-title{font-size:21px!important;line-height:1.12!important}\nhtml[data-appearance] #rolls-panel .vr-author{font-size:14px!important;line-height:1.2!important}\nhtml[data-appearance] #rolls-panel .vr-result-copy b{font-size:14px!important;line-height:1.18!important}\nhtml[data-appearance] #rolls-panel .vr-total{font-size:23px!important;line-height:1!important}\nhtml[data-appearance] #rolls-panel .vr-message p{font-size:13px;line-height:1.45}\nhtml[data-appearance] #rolls-panel .vr-head{margin-bottom:4px}\nhtml[data-appearance] #rolls-panel .vr-dice .vr-title{font-size:20px!important}/* Seletor de visibilidade: botões reais, nenhum input invisível que receba foco. */\nhtml[data-appearance] #rolls-panel .vr-modes .vr-mode-choice span{\nbackground:var(--vtt-paper-light,var(--sc-elev,#192e24));\ncolor:var(--vtt-ink,var(--sc-ink-2,#c9d6c7));\nborder-color:var(--vtt-line,var(--sc-stroke,#586e58));\n}\nhtml[data-appearance] #rolls-panel .vr-modes .vr-mode-choice[aria-checked=\"true\"] span{\nbackground:var(--vtt-inkwater,var(--sc-green-soft,#385343));\ncolor:var(--vtt-display,var(--sc-green,#fff2d6));\nborder-color:var(--vtt-pigment,var(--sc-green,#d2b580));\n}\n@media(max-width:690px){\n#rolls-panel .vr-feed{height:auto;min-height:clamp(300px,56dvh,660px)}\nhtml[data-appearance] #rolls-panel .vr-title{font-size:20px!important}\n}\n@media(max-height:680px) and (min-width:691px){\n#rolls-panel .vr-feed{height:auto;min-height:clamp(350px,66dvh,600px)}\n}\n";
  document.head.append(style);
  panel.innerHTML="\n<section class=\"vr-chat\" aria-label=\"Chat da campanha\">\n  <header class=\"vr-head\">\n    <span class=\"vr-title\">Chat</span>\n    <button type=\"button\" class=\"vr-clean\" id=\"vr-clear\" hidden title=\"Apagar histórico compartilhado\">Limpar chat</button>\n  </header>\n  <div id=\"vr-feed\" class=\"vr-feed\" role=\"log\" aria-live=\"polite\" aria-label=\"Mensagens e resultados\"></div>\n  <form class=\"vr-chat-compose\" id=\"vr-chat-form\">\n    <input id=\"vr-chat-input\" maxlength=\"400\" placeholder=\"Escrever para a mesa...\" aria-label=\"Mensagem para a mesa\" autocomplete=\"off\"/>\n    <button type=\"submit\">Enviar</button>\n  </form>\n</section>\n<section class=\"vr-dice\" aria-label=\"Rolador de dados\">\n  <header class=\"vr-head\"><span class=\"vr-title\">Dados</span><span class=\"vr-mini\">Sistema D8</span></header>\n  <div class=\"vr-quick\">\n    <button type=\"button\" data-dice=\"2d8\" class=\"selected\">2d8</button>\n    <button type=\"button\" data-dice=\"1d8\">1d8</button>\n    <button type=\"button\" data-dice=\"3d8\">3d8</button>\n    <button type=\"button\" data-dice=\"1d20\">1d20</button>\n  </div>\n  <div class=\"vr-grid\">\n    <label class=\"vr-field\"><span>Dados</span><select id=\"vr-dice\"></select></label>\n    <label class=\"vr-field\"><span>Modificador</span><input type=\"number\" id=\"vr-bonus\" min=\"-99\" max=\"99\" step=\"1\" value=\"0\"/></label>\n  </div>\n  <div class=\"vr-field\" style=\"margin-top:6px\"><span>Visibilidade da rolagem</span></div>\n  <div class=\"vr-modes\" role=\"radiogroup\" aria-label=\"Quem pode ver o resultado\">\n    <button type=\"button\" class=\"vr-mode-choice\" data-roll-mode=\"public\" role=\"radio\" aria-checked=\"true\" tabindex=\"0\"><span>◎ Pública</span></button>\n    <button type=\"button\" class=\"vr-mode-choice\" data-roll-mode=\"gm\" role=\"radio\" aria-checked=\"false\" tabindex=\"-1\"><span>◈ Para o mestre</span></button>\n    <button type=\"button\" class=\"vr-mode-choice\" data-roll-mode=\"self\" role=\"radio\" aria-checked=\"false\" tabindex=\"-1\"><span>◉ Privada</span></button>\n    <button type=\"button\" class=\"vr-mode-choice\" data-roll-mode=\"blind\" role=\"radio\" aria-checked=\"false\" tabindex=\"-1\"><span>◌ Cega (mestre)</span></button>\n  </div>\n  <button class=\"vr-roll-button\" id=\"vr-roll\" type=\"button\">⚄ Rolar dados</button>\n  <div class=\"vr-explain\" id=\"vr-mode-explain\">Todos na sessão verão o resultado.</div>\n</section>\n";
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
  // Botões visíveis em vez de radios invisíveis: evita scroll/focus fantasma
  // ao clicar nas opções e não modifica as regras de visibilidade do Firebase.
  let selectedMode='public';
  const mode=()=>selectedMode;
  const modeButtons=[...panel.querySelectorAll('[data-roll-mode]')];
  function syncMode(){
    for(const button of modeButtons){
      const selected=button.dataset.rollMode===selectedMode;
      button.setAttribute('aria-checked',String(selected));
      button.tabIndex=selected?0:-1;
    }
    $('vr-mode-explain').textContent=modeTips[selectedMode];
    $('vr-roll').textContent=selectedMode==='blind'?'◌ Enviar rolagem cega':'⚄ Rolar dados';
  }
  for(const [index,button] of modeButtons.entries()){
    button.addEventListener('click',()=>{
      selectedMode=button.dataset.rollMode;
      syncMode();
    });
    button.addEventListener('keydown',event=>{
      const direction={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];
      if(!direction)return;
      event.preventDefault();
      const next=modeButtons[(index+direction+modeButtons.length)%modeButtons.length];
      selectedMode=next.dataset.rollMode;
      syncMode();
      next.focus({preventScroll:true});
    });
  }
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
  // Mensagens internas da mesa não aparecem cruas no chat.
  const isSystemMessage=d=>d?.type==='message'&&typeof d.payload?.text==='string'&&
    ['@SC:G:','@SC:GE:','@SC:A:','@SC:FX:'].some(prefix=>d.payload.text.startsWith(prefix));
  const cleanRollLabel=value=>{
    const text=String(value||'Rolagem');
    return text.startsWith('@SC:GR:')?'Teste coletivo':text;
  };
  // Dados em pergaminho: animação curta, limpa e fiel à quantidade de faces.
  // As rolagens simultâneas aparecem uma após a outra; o chat mantém todas.
  const animationQueue=[];
  let animationRunning=false;
  function animation(result){
    if(!result||typeof result.total!=='number')return;
    animationQueue.push(result);
    if(animationQueue.length>10)animationQueue.splice(0,animationQueue.length-10);
    playNextAnimation();
  }
  function playNextAnimation(){
    if(animationRunning||!animationQueue.length)return;
    animationRunning=true;
    const result=animationQueue.shift();
    stage.querySelector('.vr-dice-layer')?.remove();
    const faces=Math.min(100,Math.max(4,Number(String(result.dice||'2d8').match(/d(\d+)/i)?.[1])||8));
    const sides=faces===6?6:faces===8?8:faces===12?12:faces===20?20:10;
    const shapes={
      6:{points:'12,12 58,12 58,58 12,58',detail:'M12 12 L22 22 M58 12 L48 22 M58 58 L48 48 M12 58 L22 48'},
      8:{points:'35,3 65,35 35,70 5,35',detail:'M35 3 L35 70 M5 35 L35 23 L65 35 M5 35 L35 50 L65 35'},
      10:{points:'35,3 58,12 66,41 35,72 4,41 12,12',detail:'M35 3 L35 72 M4 41 L35 24 L66 41 M12 12 L35 24 L58 12'},
      12:{points:'35,4 56,12 68,32 61,55 35,71 9,55 2,32 14,12',detail:'M14 12 L23 24 M56 12 L47 24 M9 55 L22 48 M61 55 L48 48 M35 71 L35 59'},
      20:{points:'35,3 60,16 68,47 51,66 19,66 2,47 10,16',detail:'M35 3 L10 16 L20 44 L35 60 L50 44 L60 16 Z M35 3 L35 24 L20 44 M35 24 L50 44 M35 60 L19 66 M35 60 L51 66'}
    };
    const shape=shapes[sides];
    const NS='http://www.w3.org/2000/svg';
    const makeSVG=(value)=>{
      const svg=document.createElementNS(NS,'svg');
      svg.setAttribute('viewBox','0 0 70 75');
      svg.setAttribute('aria-hidden','true');
      const base=document.createElementNS(NS,'polygon');
      base.setAttribute('points',shape.points);base.setAttribute('class','vr-min-outline');
      const facets=document.createElementNS(NS,'path');
      facets.setAttribute('d',shape.detail);facets.setAttribute('class','vr-min-facets');
      svg.append(base,facets);
      const text=document.createElementNS(NS,'text');
      text.setAttribute('x','35');text.setAttribute('y','39');
      text.setAttribute('text-anchor','middle');text.setAttribute('dominant-baseline','middle');
      text.setAttribute('class','vr-min-face');text.textContent=String(value);
      svg.append(text);return svg;
    };
    const layer=document.createElement('div');layer.className='vr-dice-layer vr-dice-minimal';
    layer.setAttribute('role','status');layer.setAttribute('aria-label','Rolagem '+String(result.dice||'')+'; resultado '+result.total);
    const tray=document.createElement('div');tray.className='vr-min-tray';
    const top=document.createElement('div');top.className='vr-min-heading';
    const caption=document.createElement('span');caption.textContent=cleanRollLabel(result.label).slice(0,60);
    const kind=document.createElement('small');kind.textContent=String(result.dice||'2d8');
    top.append(caption,kind);
    const main=document.createElement('div');main.className='vr-min-main';
    const dice=document.createElement('div');dice.className='vr-min-dice';
    const values=Array.isArray(result.rolls)?result.rolls.slice(0,4):[];
    for(let i=0;i<values.length;i++){
      const die=document.createElement('div');die.className='vr-min-die';
      die.style.setProperty('--vr-i',String(i));
      die.append(makeSVG(Number(values[i])||0));dice.append(die);
    }
    const sum=document.createElement('div');sum.className='vr-min-result';
    const number=document.createElement('strong');number.textContent=String(result.total);
    const breakdown=document.createElement('small');
    const bonus=Number(result.bonus)||0;
    breakdown.textContent=values.join(' + ')+(bonus>0?' + '+bonus:bonus<0?' − '+Math.abs(bonus):'');
    sum.append(number,breakdown);main.append(dice,sum);tray.append(top,main);layer.append(tray);
    stage.append(layer);
    window.setTimeout(()=>{layer.remove();animationRunning=false;playNextAnimation();},1850);
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
    const label='Rolagem de '+dice,character=name();
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
    if(d.type==='rollRequest'||isSystemMessage(d))return null;
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
      row.setAttribute('aria-label','Mostrar detalhes da rolagem '+cleanRollLabel(p.label));
      const total=document.createElement('span');total.className='vr-total';total.textContent=String(p.total??'—');
      const copy=document.createElement('span');copy.className='vr-result-copy';
      const label=document.createElement('b');label.textContent=cleanRollLabel(p.label);
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
    ].filter(item=>(item.data?.type==='message'||item.data?.type==='roll'||item.data?.type==='privateRoll')&&!isSystemMessage(item.data))
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
