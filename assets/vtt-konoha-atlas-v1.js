(function(){
  "use strict";
  // Atlas ilustrado de Konohagakure. Não altera estado, câmera, tokens ou ferramentas do VTT.
  const LOCATIONS = [
    {id:"monumento",name:"Monumento Hokage",type:"Marco histórico",x:600,y:133,symbol:"影",
     description:"Esculpido no paredão de pedra acima da vila, o monumento guarda os rostos dos Hokage e domina a paisagem de Konohagakure.",
     note:"Ponto de referência visual e símbolo da história da Folha."},
    {id:"gabinete",name:"Gabinete do Hokage",type:"Administração",x:600,y:302,symbol:"火",
     description:"Centro político e administrativo da Vila da Folha. É aqui que a liderança recebe relatórios, delega missões e toma decisões sobre a segurança de Konoha.",
     note:"As decisões da campanha e os ocupantes do cargo seguem a história de Shinobi Chronicles."},
    {id:"academia",name:"Academia Ninja",type:"Instituição",x:410,y:344,symbol:"学",
     description:"Local de formação dos jovens shinobi, com salas de aula, exercícios básicos, avaliações e instruções sobre a tradição ninja.",
     note:"Próxima à encosta do Monumento Hokage, como nas representações clássicas da vila."},
    {id:"hospital",name:"Hospital de Konoha",type:"Instituição",x:346,y:500,symbol:"医",
     description:"Principal centro de atendimento médico da vila, responsável pelos cuidados de civis e shinobi feridos em missões.",
     note:"Pode servir como ponto de encontro após batalhas e missões perigosas."},
    {id:"ichiraku",name:"Ichiraku Ramen",type:"Comércio",x:530,y:477,symbol:"麺",
     description:"Pequeno estabelecimento de ramen conhecido entre os habitantes de Konoha. Um lugar para conversas e encontros no cotidiano da vila.",
     note:"Local reconhecível do universo Naruto; seu funcionamento no ano da campanha depende do mestre."},
    {id:"mercado",name:"Centro Comercial",type:"Comércio",x:626,y:570,symbol:"市",
     description:"Ruas de lojas, feiras e serviços que movimentam a vida civil de Konoha, entre missões e treinos.",
     note:"Região útil para cenas de investigação, compras e encontros sociais."},
    {id:"hyuga",name:"Distrito Hyūga",type:"Distrito de clã",x:844,y:364,symbol:"眼",
     description:"Área residencial associada ao clã Hyūga, com construções tradicionais e espaços reservados às famílias do clã.",
     note:"A organização interna e as famílias seguem os acontecimentos de Shinobi Chronicles."},
    {id:"uchiha",name:"Distrito Uchiha",type:"Distrito de clã",x:825,y:515,symbol:"扇",
     description:"Distrito historicamente associado ao clã Uchiha, afastado das áreas mais movimentadas do centro.",
     note:"Seu estado atual e sua ocupação respeitam a história própria do RPG."},
    {id:"santuario",name:"Santuário Naka",type:"Local histórico",x:917,y:637,symbol:"社",
     description:"Santuário tradicional associado à história dos Uchiha e às memórias preservadas pelo clã.",
     note:"Possíveis segredos e informações de campanha não são exibidos no atlas público."},
    {id:"campo",name:"Campo de Treinamento",type:"Treinamento",x:339,y:654,symbol:"忍",
     description:"Área aberta com vegetação, trilhas e terrenos apropriados para práticas de taijutsu, ninjutsu e exercícios em equipe.",
     note:"Pode ser usado como ponto de partida para missões e sessões de treino."},
    {id:"arena",name:"Arena de Exames",type:"Treinamento",x:504,y:630,symbol:"試",
     description:"Instalação de provas e competições, utilizada para avaliar habilidades e acompanhar confrontos entre shinobi.",
     note:"Sua utilização depende dos eventos planejados pelo mestre."},
    {id:"portao",name:"Portão Principal",type:"Acesso à vila",x:598,y:742,symbol:"門",
     description:"Entrada monumental da Vila Oculta da Folha e passagem principal para viajantes, comerciantes e equipes que partem em missão.",
     note:"A trilha ao sul se conecta às estradas da Terra do Fogo."},
    {id:"cemiterio",name:"Memorial da Vila",type:"Local histórico",x:964,y:667,symbol:"碑",
     description:"Área reservada à lembrança e à homenagem de shinobi e habitantes que marcaram a história de Konohagakure.",
     note:"Os nomes e acontecimentos históricos refletem a linha do tempo da campanha."}
  ];
  const W=1200,H=820;
  const $=id=>document.getElementById(id);
  function rng(seed){let n=seed>>>0;return ()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};}
  function svgMap(){
    const random=rng(1990);
    const a=['<svg viewBox="0 0 1200 820" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
      '<defs>',
      '<linearGradient id="sc-atlas-ground" x2="0" y2="1"><stop stop-color="#e2dfc5"/><stop offset=".53" stop-color="#d9d8b7"/><stop offset="1" stop-color="#c9c8a7"/></linearGradient>',
      '<linearGradient id="sc-atlas-rock" x2="0" y2="1"><stop stop-color="#827965"/><stop offset=".55" stop-color="#b8a083"/><stop offset="1" stop-color="#d8c6a4"/></linearGradient>',
      '<linearGradient id="sc-atlas-wall" x2="0" y2="1"><stop stop-color="#9b846a"/><stop offset="1" stop-color="#665b4d"/></linearGradient>',
      '<filter id="sc-atlas-paper"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="3" seed="12" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".11"/></feComponentTransfer></filter>',
      '</defs>',
      '<rect width="1200" height="820" fill="url(#sc-atlas-ground)"/>',
      '<path d="M0 180 Q170 80 250 130 Q430 78 530 152 Q715 83 880 142 Q1050 40 1200 127 V0 H0Z" fill="#758770" opacity=".32"/>',
      '<path d="M0 0H1200V820H0Z" fill="#aec3a4" opacity=".12"/>'
    ];
    // Bosques ao redor da muralha, sem posicionamento aleatório a cada visita.
    for(let i=0;i<370;i++){
      const x=random()*1200,y=random()*820;
      const v=((x-600)/479)**2+((y-482)/298)**2;
      if(v<1.04|| (x>300&&x<930&&y<192))continue;
      const r=9+random()*20;
      a.push('<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+r.toFixed(1)+'" fill="'+(i%3===0?'#526f57':i%3===1?'#7a9266':'#93a174')+'" opacity="'+(.32+random()*.26).toFixed(2)+'"/>');
      a.push('<circle cx="'+(x-3).toFixed(1)+'" cy="'+(y-4).toFixed(1)+'" r="'+(r*.55).toFixed(1)+'" fill="#b7b88a" opacity=".23"/>');
    }
    // Paredão dos Hokage, ao norte. Caras gravadas ilustrativas; atlas não representa retratos específicos.
    a.push('<path d="M255 221 L270 93 317 65 353 104 386 38 428 86 482 34 539 93 590 15 647 78 713 32 756 91 813 47 848 112 902 84 935 211 Q607 234 255 221Z" fill="url(#sc-atlas-rock)" stroke="#76694e" stroke-width="9"/>');
    for(let i=0;i<4;i++){
      const cx=441+i*101,cy=119+(i%2)*9;
      a.push('<g fill="none" stroke="#766c58" stroke-width="5" stroke-linecap="round" opacity=".85">');
      a.push('<path d="M'+(cx-26)+' '+(cy+16)+' Q'+(cx-36)+' '+(cy-37)+' '+cx+' '+(cy-42)+' Q'+(cx+35)+' '+(cy-32)+' '+(cx+28)+' '+(cy+19)+'"/>');
      a.push('<path d="M'+(cx-18)+' '+(cy-7)+'l12 -2 M'+(cx+7)+' '+(cy-9)+'l13 2 M'+cx+' '+(cy-3)+'l-5 19 12 -1 M'+(cx-13)+' '+(cy+26)+'q14 9 28 -2"/>');
      a.push('</g>');
    }
    a.push('<path d="M257 216 Q597 258 943 216" fill="none" stroke="#655b4c" stroke-width="14" opacity=".48"/>');
    // Muralha circular, interior da vila.
    a.push('<ellipse cx="600" cy="492" rx="471" ry="294" fill="#e5ddbd" stroke="#656d55" stroke-width="44" opacity=".56"/>');
    a.push('<ellipse cx="600" cy="492" rx="471" ry="294" fill="none" stroke="#7c6551" stroke-width="14"/>');
    a.push('<ellipse cx="600" cy="492" rx="461" ry="284" fill="none" stroke="#ddcaa4" stroke-width="9" stroke-dasharray="23 12"/>');
    // Zonas verdes e parques.
    a.push('<path d="M185 403 Q300 310 414 388 L414 566 Q300 635 187 594Z" fill="#94aa80" opacity=".26"/>');
    a.push('<path d="M731 288 Q833 255 949 369 Q947 445 888 477 L744 438Z" fill="#89a57e" opacity=".25"/>');
    a.push('<path d="M280 594 Q374 573 438 658 Q397 756 301 747 Q239 699 280 594Z" fill="#819b72" opacity=".28"/>');
    // Malha viária. Vias largas e caminhos secundários.
    const roads=[
      'M598 202 C599 350 584 510 599 782',
      'M158 492 C339 476 469 503 1046 490',
      'M253 270 C385 426 538 522 851 723',
      'M945 279 C760 390 565 511 293 707',
      'M349 249 Q399 411 299 591',
      'M790 254 Q740 464 845 680',
      'M251 609 Q606 675 958 609',
      'M367 379 Q603 411 830 342',
      'M469 294 Q490 510 486 727'
    ];
    for(const p of roads){
      a.push('<path d="'+p+'" fill="none" stroke="#aa9673" stroke-width="23" stroke-linecap="round" opacity=".65"/>');
      a.push('<path d="'+p+'" fill="none" stroke="#f3e6c7" stroke-width="14" stroke-linecap="round"/>');
    }
    // Casas em grupos. Construções não são lotes canônicos exatos.
    const roof=['#a8634a','#966b55','#7e846e','#aa8a66','#8e6455'];
    for(let i=0;i<430;i++){
      const x=203+random()*795, y=264+random()*474;
      if(((x-600)/432)**2+((y-494)/257)**2>1)continue;
      if(Math.abs(x-598)<30||Math.abs(y-492)<28)continue;
      if(LOCATIONS.some(p=>((p.x-x)**2+(p.y-y)**2)<57**2))continue;
      const w=13+random()*19,h=10+random()*17,fill=roof[Math.floor(random()*roof.length)];
      a.push('<g transform="translate('+x.toFixed(0)+' '+y.toFixed(0)+') rotate('+(Math.floor(random()*3)-1)*10+')">');
      a.push('<rect x="'+(-w/2).toFixed(1)+'" y="'+(-h/2).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+h.toFixed(1)+'" fill="#ece1c9" stroke="#a89f85" stroke-width="1"/>');
      a.push('<path d="M'+(-w/2-3).toFixed(1)+' -2 L0 '+(-h/2-6).toFixed(1)+' L'+(w/2+3).toFixed(1)+' -2 L0 '+(h/2+3).toFixed(1)+'Z" fill="'+fill+'" stroke="#695c50" stroke-width="1.2"/>');
      a.push('</g>');
    }
    // Riacho a leste e ponte.
    a.push('<path d="M1086 159 Q1023 279 1021 357 Q963 429 996 497 Q1084 579 1021 683 Q994 732 1097 819" stroke="#78998d" stroke-width="37" fill="none" opacity=".85"/>');
    a.push('<path d="M1086 159 Q1023 279 1021 357 Q963 429 996 497 Q1084 579 1021 683 Q994 732 1097 819" stroke="#b1d3c8" stroke-width="25" fill="none" opacity=".85"/>');
    a.push('<path d="M986 483 L1038 489" stroke="#b89a69" stroke-width="19" fill="none"/>');
    a.push('<path d="M986 483 L1038 489" stroke="#f2e6ce" stroke-width="12" fill="none"/>');
    // Prédios marcantes com silhuetas de telhado.
    a.push('<g transform="translate(597 302)"><ellipse cy="8" rx="67" ry="51" fill="#8b6750" opacity=".25"/><rect x="-48" y="-34" width="96" height="67" rx="10" fill="#c5b493" stroke="#826850" stroke-width="6"/><ellipse cy="-30" rx="57" ry="24" fill="#a54b40" stroke="#6b493b" stroke-width="6"/><ellipse cy="-50" rx="33" ry="12" fill="#b86d4c" stroke="#754d3b" stroke-width="4"/><rect x="-12" y="-15" width="24" height="25" fill="#ece3cb" stroke="#806a51"/></g>');
    a.push('<g transform="translate(409 344)"><rect x="-54" y="-35" width="108" height="70" rx="7" fill="#e6d4ae" stroke="#9c8b6b" stroke-width="5"/><path d="M-63 -35 L0 -67 63 -35 Z" fill="#a9654a" stroke="#815444" stroke-width="5"/></g>');
    a.push('<g transform="translate(347 499)"><rect x="-40" y="-32" width="80" height="64" rx="6" fill="#f6e9d1" stroke="#807e72" stroke-width="5"/><rect x="-4" y="-21" width="8" height="42" fill="#a75445"/><rect x="-22" y="-4" width="44" height="8" fill="#a75445"/></g>');
    a.push('<g transform="translate(500 629)"><ellipse rx="70" ry="51" fill="#b8a57e" stroke="#726953" stroke-width="7"/><ellipse rx="51" ry="34" fill="#e4ddbd" stroke="#927e5e" stroke-width="3"/></g>');
    a.push('<g transform="translate(598 741)"><path d="M-43 23V-13Q0 -56 43 -13V23" fill="#b05e47" stroke="#6c4d40" stroke-width="10"/><rect x="-21" y="-6" width="42" height="33" fill="#e5c392" stroke="#73543f" stroke-width="6"/><path d="M-52 -15Q0 -55 52 -15" fill="none" stroke="#e9d8b4" stroke-width="9"/></g>');
    // Caligrafia discreta e papel.
    a.push('<text x="66" y="79" font-size="35" fill="#61725c" font-family="Georgia,serif" opacity=".65">木ノ葉隠れ</text>');
    a.push('<text x="67" y="104" font-size="14" fill="#65715e" letter-spacing="4" font-family="Georgia,serif">KONOHAGAKURE</text>');
    a.push('<text x="1050" y="76" font-size="19" fill="#70816b" font-family="Georgia,serif" opacity=".75">火の国</text>');
    a.push('<rect width="1200" height="820" filter="url(#sc-atlas-paper)" pointer-events="none"/>');
    a.push('</svg>');
    return a.join('');
  }
  function init(){
    const stage=$('stage');
    const scene=$('scene-open-library');
    if(!stage||!scene||$('sc-konoha-atlas'))return;
    const toggle=document.createElement('button');
    toggle.id='sc-konoha-atlas-toggle';
    toggle.type='button';
    toggle.title='Abrir mapa interativo público da Vila da Folha';
    toggle.setAttribute('aria-label','Abrir o mapa de Konoha');
    toggle.setAttribute('aria-expanded','false');
    toggle.innerHTML='<span class="sc-atlas-glyph" aria-hidden="true">図</span><span><span class="sc-atlas-mini">Atlas Shinobi</span>Mapa de Konoha</span>';
    scene.insertAdjacentElement('afterend',toggle);
    const panel=document.createElement('section');
    panel.id='sc-konoha-atlas';
    panel.setAttribute('aria-label','Atlas interativo de Konoha');
    panel.setAttribute('role','region');
    panel.hidden=true;
    panel.innerHTML=
      '<header class="sc-atlas-header">'+
        '<div><span class="sc-atlas-kicker">ARQUIVOS SHINOBI · ATLAS PÚBLICO</span><h2>Konohagakure — Vila da Folha</h2></div>'+
        '<div class="sc-atlas-header-controls"><button type="button" id="sc-atlas-close" title="Fechar atlas" aria-label="Fechar mapa de Konoha">✕</button></div>'+
      '</header>'+
      '<div class="sc-atlas-body">'+
        '<div class="sc-atlas-view" id="sc-atlas-view" aria-label="Mapa ilustrado de Konoha. Arraste para navegar e use a roda do mouse para aproximar.">'+
          '<div class="sc-atlas-world" id="sc-atlas-world"></div>'+
          '<div class="sc-atlas-compass">↑ N</div>'+
          '<div class="sc-atlas-zoom"><button type="button" id="sc-atlas-minus" aria-label="Afastar mapa">−</button><button type="button" id="sc-atlas-reset" aria-label="Enquadrar mapa">⌖</button><button type="button" id="sc-atlas-plus" aria-label="Aproximar mapa">+</button></div>'+
          '<span class="sc-atlas-hint">Arraste para explorar · scroll para zoom · clique nos locais</span>'+
        '</div>'+
        '<aside class="sc-atlas-sidebar" aria-label="Locais de Konoha">'+
          '<div class="sc-atlas-summary"><span class="eyebrow">CARTOGRAFIA DA FOLHA</span><p>Geografia inspirada nas referências clássicas de Naruto. Mapa interpretativo, não uma planta oficial em escala.</p></div>'+
          '<div class="sc-atlas-search"><input id="sc-atlas-search" type="search" placeholder="Buscar locais..." aria-label="Buscar local de Konoha"></div>'+
          '<div class="sc-atlas-list" id="sc-atlas-list"></div>'+
          '<article class="sc-atlas-info" id="sc-atlas-info" aria-live="polite"></article>'+
        '</aside>'+
      '</div>'+
      '<footer class="sc-atlas-footer">Mapa disponível para todos os participantes · O atlas não altera a cena do VTT</footer>';
    stage.append(panel);
    const viewport=$('sc-atlas-view'),world=$('sc-atlas-world'),list=$('sc-atlas-list'),info=$('sc-atlas-info');
    world.innerHTML=svgMap();
    const markerMap=new Map();
    let scale=1,fit=1,tx=0,ty=0,drag=null,selected='';
    function applyTransform(){world.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';}
    function resetView(){
      if(!viewport.clientWidth||!viewport.clientHeight)return;
      fit=Math.min((viewport.clientWidth-25)/W,(viewport.clientHeight-25)/H);
      scale=fit;tx=(viewport.clientWidth-W*scale)/2;ty=(viewport.clientHeight-H*scale)/2;
      applyTransform();
    }
    function zoom(factor,cx=viewport.clientWidth/2,cy=viewport.clientHeight/2){
      const next=Math.max(fit*.75,Math.min(fit*4.5,scale*factor));
      const wx=(cx-tx)/scale,wy=(cy-ty)/scale;
      tx=cx-wx*next;ty=cy-wy*next;scale=next;applyTransform();
    }
    function focusLocation(p){
      const newScale=Math.max(scale,fit*1.55);
      scale=Math.min(fit*3,newScale);
      tx=viewport.clientWidth*.48-p.x*scale;
      ty=viewport.clientHeight*.47-p.y*scale;
      applyTransform();
    }
    function selectLocation(p,focus){
      selected=p.id;
      markerMap.forEach((b,k)=>b.classList.toggle('active',k===selected));
      for(const b of list.querySelectorAll('button'))b.classList.toggle('active',b.dataset.location===selected);
      info.replaceChildren();
      const type=document.createElement('span');type.className='sc-atlas-type';type.textContent=p.type;
      const heading=document.createElement('h3');heading.textContent=p.name;
      const body=document.createElement('p');body.textContent=p.description;
      const note=document.createElement('p');note.className='sc-atlas-note';note.textContent=p.note;
      info.append(type,heading,body,note);
      if(focus)focusLocation(p);
    }
    function renderList(){
      const q=($('sc-atlas-search').value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      list.replaceChildren();
      let results=0;
      for(const p of LOCATIONS){
        const hay=(p.name+' '+p.type).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        const show=!q||hay.includes(q);
        markerMap.get(p.id).hidden=!show;
        if(!show)continue;
        results++;
        const b=document.createElement('button');
        b.type='button';b.dataset.location=p.id;b.classList.toggle('active',p.id===selected);
        const name=document.createElement('strong');name.textContent=p.name;
        const meta=document.createElement('small');meta.textContent=p.type;
        b.append(name,meta);
        b.addEventListener('click',()=>selectLocation(p,true));
        list.append(b);
      }
      if(!results){
        const empty=document.createElement('p');empty.style.cssText='font-size:12px;padding:8px;color:#91846e';
        empty.textContent='Nenhum local encontrado.';list.append(empty);
      }
    }
    for(const p of LOCATIONS){
      const pin=document.createElement('button');
      pin.className='sc-atlas-pin';pin.type='button';
      pin.style.left=p.x+'px';pin.style.top=p.y+'px';
      pin.setAttribute('aria-label','Ver '+p.name);
      const dot=document.createElement('span');dot.className='sc-atlas-pin-dot';dot.textContent=p.symbol;
      const label=document.createElement('span');label.className='sc-atlas-pin-text';label.textContent=p.name;
      pin.append(dot,label);
      pin.addEventListener('click',()=>selectLocation(p,false));
      world.append(pin);markerMap.set(p.id,pin);
    }
    function setOpen(open){
      panel.hidden=!open;
      toggle.setAttribute('aria-expanded',String(open));
      if(open){requestAnimationFrame(()=>{resetView();renderList();selectLocation(LOCATIONS.find(p=>p.id===selected)||LOCATIONS[1],false);});}
      else toggle.focus({preventScroll:true});
    }
    toggle.addEventListener('click',()=>setOpen(panel.hidden));
    $('sc-atlas-close').addEventListener('click',()=>setOpen(false));
    $('sc-atlas-plus').addEventListener('click',()=>zoom(1.28));
    $('sc-atlas-minus').addEventListener('click',()=>zoom(1/1.28));
    $('sc-atlas-reset').addEventListener('click',resetView);
    $('sc-atlas-search').addEventListener('input',renderList);
    viewport.addEventListener('wheel',e=>{
      e.preventDefault();
      const r=viewport.getBoundingClientRect();
      zoom(e.deltaY<0?1.13:1/1.13,e.clientX-r.left,e.clientY-r.top);
    },{passive:false});
    viewport.addEventListener('pointerdown',e=>{
      if(e.button!==0||e.target.closest('button'))return;
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,tx,ty};
      viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging');
    });
    viewport.addEventListener('pointermove',e=>{
      if(!drag||drag.id!==e.pointerId)return;
      tx=drag.tx+e.clientX-drag.x;ty=drag.ty+e.clientY-drag.y;applyTransform();
    });
    function stopDrag(e){
      if(!drag||drag.id!==e.pointerId)return;
      drag=null;viewport.classList.remove('dragging');
      if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);
    }
    viewport.addEventListener('pointerup',stopDrag);
    viewport.addEventListener('pointercancel',stopDrag);
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!panel.hidden){setOpen(false);e.stopPropagation();}
    },true);
    // Atualizar enquadramento depois de redimensionamentos de painel e janela.
    if(typeof ResizeObserver!=='undefined'){
      const ro=new ResizeObserver(()=>{if(!panel.hidden&&!drag)resetView();});
      ro.observe(viewport);
    }else window.addEventListener('resize',()=>{if(!panel.hidden)resetView();});
    renderList();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();