(function(){
  'use strict';
  // Adaptação progressiva: conserva pontos, navegação e dados do atlas anterior.
  const $=id=>document.getElementById(id);
  function start(){
    const stage=$('stage'),atlas=$('sc-konoha-atlas'),oldToggle=$('sc-konoha-atlas-toggle');
    const sceneIdentity=$('scene-open-library'),toolbar=stage?.querySelector('.stage-controls');
    if(!stage||!atlas||!oldToggle||!sceneIdentity||!toolbar||$('sc-vtt-view-switch'))return;
    const switcher=document.createElement('div');
    switcher.id='sc-vtt-view-switch';switcher.setAttribute('role','tablist');
    switcher.setAttribute('aria-label','Visualização central da mesa');
    const sceneButton=document.createElement('button');
    const atlasButton=document.createElement('button');
    function setupButton(button,label,icon,id){
      button.type='button';button.id=id;button.setAttribute('role','tab');
      button.innerHTML='<span class="sc-view-icon" aria-hidden="true">'+icon+'</span><span class="sc-view-label">'+label+'</span>';
      button.setAttribute('aria-label',label);
      switcher.appendChild(button);
    }
    setupButton(sceneButton,'Cena ativa','◈','sc-vtt-view-scene');
    setupButton(atlasButton,'Mapa de Konoha','葉','sc-vtt-view-atlas');
    sceneIdentity.insertAdjacentElement('afterend',switcher);
    const detailsToggle=document.createElement('button');
    detailsToggle.id='sc-atlas-locations-toggle';detailsToggle.type='button';
    detailsToggle.setAttribute('aria-expanded','false');detailsToggle.textContent='⌕ Explorar locais';
    atlas.appendChild(detailsToggle);
    let mode='scene';
    function showDetails(show){
      atlas.classList.toggle('sc-atlas-details-open',show);
      detailsToggle.setAttribute('aria-expanded',String(show));
      detailsToggle.textContent=show?'✕ Fechar locais':'⌕ Explorar locais';
    }
    detailsToggle.addEventListener('click',()=>{
      showDetails(!atlas.classList.contains('sc-atlas-details-open'));
    });
    const world=$('sc-atlas-world');
    const pins=world?[...world.querySelectorAll('.sc-atlas-pin')]:[];
    let paintingReady=false;
    // Este endereço já está preparado para receber a ilustração original.
    // Na falta do arquivo, mantém o atlas anterior, sem bloquear o VTT.
    if(world){
      const painting=new Image();
      painting.className='sc-atlas-painting';
      painting.alt='';
      painting.decoding='async';
      painting.onload=()=>{
        if(!painting.naturalWidth)return;
        const firstPin=world.querySelector('.sc-atlas-pin');
        if(firstPin)world.insertBefore(painting,firstPin);
        else world.append(painting);
        world.classList.add('sc-atlas-has-art');
        paintingReady=true;
        // Marcadores reposicionados sobre a pintura (1200×820).
        const coords={
          monumento:[597,86],gabinete:[604,217],academia:[307,239],hospital:[866,340],
          ichiraku:[550,449],mercado:[587,388],hyuga:[1035,371],uchiha:[203,430],
          santuario:[1050,415],campo:[161,244],arena:[1046,226],portao:[595,682],cemiterio:[985,555]
        };
        for(const pin of pins){
          const text=pin.getAttribute('aria-label')||'';
          const list={
            'Monumento Hokage':'monumento','Gabinete do Hokage':'gabinete','Academia Ninja':'academia',
            'Hospital de Konoha':'hospital','Ichiraku Ramen':'ichiraku','Centro Comercial':'mercado',
            'Distrito Hyūga':'hyuga','Distrito Uchiha':'uchiha','Santuário Naka':'santuario',
            'Campo de Treinamento':'campo','Arena de Exames':'arena','Portão Principal':'portao',
            'Memorial da Vila':'cemiterio'
          };
          for(const [name,key] of Object.entries(list)){
            if(text.endsWith(name)){
              pin.style.left=coords[key][0]+'px';pin.style.top=coords[key][1]+'px';
              break;
            }
          }
        }
      };
      painting.onerror=()=>{paintingReady=false;};
      painting.src='./assets/konoha_atlas_arte.avif';
    }
    function setView(next){
      if(next===mode){
        if(next==='atlas'&&atlas.hidden)oldToggle.click();
        return;
      }
      if(next==='atlas'){
        if(atlas.hidden)oldToggle.click();
        stage.classList.add('sc-atlas-mode');
        mode='atlas';
      }else{
        stage.classList.remove('sc-atlas-mode');
        if(!atlas.hidden)oldToggle.click();
        showDetails(false);
        mode='scene';
      }
      sceneButton.setAttribute('aria-selected',String(mode==='scene'));
      atlasButton.setAttribute('aria-selected',String(mode==='atlas'));
      sceneButton.tabIndex=mode==='scene'?0:-1;
      atlasButton.tabIndex=mode==='atlas'?0:-1;
      stage.setAttribute('data-stage-view',mode);
      stage.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('resize'));
    }
    sceneButton.addEventListener('click',()=>setView('scene'));
    atlasButton.addEventListener('click',()=>setView('atlas'));
    switcher.addEventListener('keydown',e=>{
      if(e.key==='ArrowLeft'){e.preventDefault();setView('scene');sceneButton.focus();}
      if(e.key==='ArrowRight'){e.preventDefault();setView('atlas');atlasButton.focus();}
    });
    atlas.querySelectorAll('.sc-atlas-pin').forEach(pin=>pin.addEventListener('click',()=>showDetails(true)));
    atlas.querySelector('#sc-atlas-view')?.addEventListener('pointerdown',e=>{
      if(!e.target.closest('.sc-atlas-pin')&&!e.target.closest('.sc-atlas-zoom'))showDetails(false);
    },true);
    atlas.querySelector('#sc-atlas-list')?.addEventListener('click',e=>{
      if(e.target.closest('button'))showDetails(true);
    });
    window.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&mode==='atlas'&&!atlas.hidden){
        if(atlas.classList.contains('sc-atlas-details-open')){
          e.stopImmediatePropagation();
          e.preventDefault();
          showDetails(false);
        }else{
          e.stopPropagation();
          setView('scene');
          sceneButton.focus();
        }
      }
    },true);
    // O script legado pode fechar o atlas com Escape; sincroniza os dois modos.
    document.addEventListener('keyup',()=>{
      if(mode==='atlas'&&atlas.hidden)setView('scene');
    });
    const watch=new MutationObserver(()=>{
      if(mode==='atlas'&&atlas.hidden){
        mode='scene';stage.classList.remove('sc-atlas-mode');
        sceneButton.setAttribute('aria-selected','true');
        atlasButton.setAttribute('aria-selected','false');
      }
    });
    watch.observe(atlas,{attributes:true,attributeFilter:['hidden']});
    sceneButton.setAttribute('aria-selected','true');
    atlasButton.setAttribute('aria-selected','false');
    sceneButton.tabIndex=0;atlasButton.tabIndex=-1;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();