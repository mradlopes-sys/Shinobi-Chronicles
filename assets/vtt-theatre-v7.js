// Shinobi Chronicles — elenco do Teatro controlado diretamente pela Campanha.
export function createTheatre({stage,onChange,isAdmin,publishPortrait,previewPortrait}){
  const css=document.createElement('style');
  css.textContent=`
#sc-theatre{position:absolute;inset:0;z-index:4;display:none;overflow:hidden;pointer-events:none;align-items:flex-end;justify-content:space-around;padding:76px 2% 0;gap:0;background:linear-gradient(180deg,transparent 54%,#02080710 73%,#02080770)}
#sc-theatre.open{display:flex}
#sc-theatre .stage-character{position:relative;isolation:isolate;flex:1 1 0;min-width:0;max-width:450px;height:100%;pointer-events:none}
#sc-theatre .stage-character.preparing{opacity:0}
#sc-theatre .stage-character.entering{animation:sc-cast-enter .46s cubic-bezier(.2,.85,.27,1.08) both}
#sc-theatre .stage-character.leaving{animation:sc-cast-leave .34s ease-in both;pointer-events:none!important}
#sc-theatre .stage-character img{position:absolute;max-width:none;max-height:none;display:block;opacity:0;pointer-events:none;user-select:none;filter:drop-shadow(0 12px 13px #0008);transition:opacity .23s ease}
#sc-theatre .stage-character img.ready{opacity:1}
#sc-theatre .stage-name{position:absolute;left:50%;transform:translateX(-50%);z-index:3;display:block;max-width:96%;padding:5px 10px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;border:1px solid #b29b7580;border-radius:16px;background:#13241ee9;color:#f6e8ce;font:600 11px/1.2 system-ui,sans-serif;text-align:center;box-shadow:0 5px 15px #0006}
#sc-theatre .stage-tools{position:absolute;left:50%;transform:translateX(-50%);z-index:5;display:flex;gap:3px;align-items:center;justify-content:center;padding:4px;border:1px solid #ad936788;border-radius:10px;background:#15271fea;backdrop-filter:blur(9px);box-shadow:0 8px 24px #020a0870;pointer-events:auto}
#sc-theatre:not(.master) .stage-tools{display:none!important}
#sc-theatre .stage-tools button{width:23px;height:25px;min-width:23px;border:1px solid #80917b70;border-radius:6px;padding:0;line-height:1;background:#344b3c;color:#ebdfc8;font:700 12px Georgia,serif;cursor:pointer;transition:transform .17s,background .17s,border-color .17s}
#sc-theatre .stage-tools button:hover,#sc-theatre .stage-tools button:focus-visible{background:#796341;border-color:#e4c490;transform:translateY(-2px)}
#sc-theatre .stage-tools button.active{background:#a2814d;color:#fff5d7;border-color:#efc994}
#sc-theatre .stage-tools button.remove{color:#f0b1a4;border-color:#a9766988}
#sc-theatre .stage-tools button.remove:hover{background:#893e35;color:white}
#sc-theatre .placeholder{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:min(78%,170px);height:190px;display:grid;place-items:center;border-radius:80px 80px 0 0;background:linear-gradient(150deg,#4d5c4d,#273a30);color:#dec59b;font:600 46px Georgia,serif}
@keyframes sc-cast-enter{0%{transform:translateY(24px) scale(.93);opacity:0;filter:blur(4px)}100%{transform:translateY(0) scale(1);opacity:1;filter:blur(0)}}
@keyframes sc-cast-leave{0%{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}100%{opacity:0;transform:translateY(24px) scale(.94);filter:blur(4px)}}
@media(max-width:700px){#sc-theatre{padding:55px 1% 0}#sc-theatre .stage-tools{gap:2px;padding:3px}#sc-theatre .stage-tools button{width:20px;min-width:20px;height:23px}#sc-theatre .stage-name{font-size:9px;padding:4px 6px}}
@media(prefers-reduced-motion:reduce){#sc-theatre .stage-character.entering,#sc-theatre .stage-character.leaving{animation:none!important}#sc-theatre .stage-character img,#sc-theatre .stage-tools button{transition:none!important}}
`;
  document.head.append(css);
  const overlay=document.createElement('div');
  overlay.id='sc-theatre';
  overlay.setAttribute('aria-label','Teatro da campanha');
  stage.append(overlay);
  const variants=['casual','ninja','triste','ferido','grave'];
  const icons={casual:'☀',ninja:'忍',triste:'☂',ferido:'✚',grave:'!'};
  const labels={casual:'Casual',ninja:'Traje ninja',triste:'Triste',ferido:'Ferido',grave:'Gravemente ferido'};
  const validImage=v=>typeof v==='string'&&(/^https:\/\/[^\s"'<>]+$/i.test(v)||/^data:image\/(png|jpeg|webp);base64,/i.test(v));
  let state={enabled:false,cast:[]},actors=[],queue=Promise.resolve();
  const published=new Map(),vitals=new Map(),figures=new Map(),bounds=new Map(),pendingAdds=new Set();
  const displayCache=new Map();
  const hasActor=id=>state.cast.some(x=>x.id===id);
  const actorInfo=id=>actors.find(x=>x.id===id);
  const allowed=id=>actorInfo(id)?.variants||[];
  const warn=msg=>{if(msg)console.warn('Teatro Shinobi:',msg)};
  const clean=raw=>({
    enabled:!!raw?.enabled,
    cast:(Array.isArray(raw?.cast)?raw.cast:[])
      .filter(x=>x&&typeof x.id==='string').slice(0,6)
      .map(x=>({id:x.id.slice(0,110),name:String(x.name||'Shinobi').slice(0,70),
        variant:variants.includes(x.variant)?x.variant:'ninja',auto:x.auto!==false}))
  });
  function save(patch){
    if(!isAdmin())return Promise.resolve(false);
    const previous=state,next=clean({...state,...patch});
    state=next;render();
    const task=queue.catch(()=>{}).then(()=>onChange({enabled:next.enabled,cast:next.cast}));
    queue=task;
    return task.then(()=>true).catch(e=>{
      if(JSON.stringify(state)===JSON.stringify(next)){state=previous;render()}
      warn(e.message);return false;
    });
  }
  function effective(actor){
    if(!actor.auto)return actor.variant;
    const v=vitals.get(actor.id);if(!v||v.max<=0)return actor.variant;
    if(v.current/v.max<=.25)return 'grave';
    if(v.current/v.max<=.5)return 'ferido';
    return actor.variant;
  }
  function sourceFor(actor){
    const data=published.get(actor.id),want=effective(actor),images=data?.variants||{};
    const order=[want,actor.variant,'ninja','casual','triste','ferido','grave'];
    for(const key of order)if(validImage(images[key]))return images[key];
    if(validImage(data?.image))return data.image;
    if(isAdmin())for(const key of order){
      const src=previewPortrait?.(actor.id,key);if(validImage(src))return src;
    }
    return '';
  }
  // Mede o alfa somente para alinhar imagens inteiras; nada é recortado nem regravado.
  function visibleBox(img,src){
    if(bounds.has(src))return bounds.get(src);
    const w=img.naturalWidth,h=img.naturalHeight,full={left:0,bottom:h,width:w,height:h};
    try{
      const k=Math.min(1,440/Math.max(w,h)),cw=Math.max(1,Math.round(w*k)),ch=Math.max(1,Math.round(h*k));
      const c=document.createElement('canvas');c.width=cw;c.height=ch;
      const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,cw,ch);
      const bytes=g.getImageData(0,0,cw,ch).data;let l=cw,r=-1,t=ch,b=-1;
      for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
        if(bytes[(y*cw+x)*4+3]<24)continue;
        l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
      }
      if(r>=0&&b>=0){
        const result={left:l*w/cw,bottom:(b+1)*h/ch,width:(r-l+1)*w/cw,height:(b-t+1)*h/ch};
        bounds.set(src,result);
        if(bounds.size>45)bounds.delete(bounds.keys().next().value);
        return result;
      }
    }catch(e){/* Fonte HTTPS sem CORS: usa proporção original sem mexer na arte. */}
    bounds.set(src,full);return full;
  }
  function fit(){
    if(!state.cast.length)return;
    const height=stage.clientHeight;
    const items=state.cast.map(a=>figures.get(a.id)).filter(Boolean).map(fig=>{
      const img=fig.querySelector('img.ready');
      return img?.naturalWidth&&fig.clientWidth?{fig,img,box:visibleBox(img,fig._source)}:null;
    }).filter(Boolean);
    const desired=Math.min(height*.39,285);
    const common=Math.min(desired,...items.map(item=>
      item.fig.clientWidth*(state.cast.length>=4?1.04:1.12)*item.box.height/Math.max(1,item.box.width)
    ));
    if(!Number.isFinite(common)||common<=0)return;
    for(const a of state.cast){
      const fig=figures.get(a.id);if(!fig)continue;
      const name=fig.querySelector('.stage-name'),tools=fig.querySelector('.stage-tools');
      if(name)name.style.bottom=Math.min(height-30,common+12)+'px';
      if(tools)tools.style.bottom=Math.min(height-64,common+40)+'px';
      const placeholder=fig.querySelector('.placeholder');
      if(placeholder)placeholder.style.height=common+'px';
      const img=fig.querySelector('img.ready');if(!img?.naturalWidth)continue;
      const box=visibleBox(img,fig._source),k=common/Math.max(1,box.height);
      img.style.width=img.naturalWidth*k+'px';img.style.height=img.naturalHeight*k+'px';
      img.style.left=(fig.clientWidth/2-(box.left+box.width/2)*k)+'px';
      img.style.bottom=(-(img.naturalHeight-box.bottom)*k)+'px';
    }
  }
  function reveal(fig){
    if(fig.dataset.entered==='yes')return;
    fig.dataset.entered='yes';fig.classList.remove('preparing');fig.classList.add('entering');
    setTimeout(()=>fig.classList.remove('entering'),510);
  }
  async function selectVariant(id,variant){
    if(!isAdmin()||!hasActor(id)||!allowed(id).includes(variant))return false;
    const a=state.cast.find(x=>x.id===id);
    if(a.variant===variant&&!a.auto)return true;
    try{
      if(!validImage(published.get(id)?.variants?.[variant]))await publishPortrait(id,variant);
      return await save({cast:state.cast.map(x=>x.id===id?{...x,variant,auto:false}:x)});
    }catch(e){warn(e.message);return false}
  }
  async function addActor(id){
    if(!isAdmin()||!id||pendingAdds.has(id))return false;
    const actor=actorInfo(id);
    if(!actor){warn('Personagem indisponível.');return false}
    if(hasActor(id)){warn('Personagem já está no Teatro.');return false}
    if(state.cast.length>=6){warn('Limite de 6 personagens no palco.');return false}
    const variant=['ninja','casual','triste','ferido','grave'].find(k=>actor.variants.includes(k));
    if(!variant){warn('É necessário enviar uma imagem na ficha.');return false}
    pendingAdds.add(id);
    try{
      await publishPortrait(id,variant);
      return await save({enabled:true,cast:[...state.cast,{id,name:actor.name,variant,auto:true}]});
    }catch(e){warn(e.message);return false}
    finally{pendingAdds.delete(id)}
  }
  function removeActor(id){
    if(!isAdmin()||!hasActor(id))return Promise.resolve(false);
    const cast=state.cast.filter(a=>a.id!==id);
    return save({enabled:cast.length>0,cast});
  }
  function stageTools(fig,actor){
    const bar=fig.querySelector('.stage-tools');bar.replaceChildren();bar.hidden=!isAdmin();
    if(!isAdmin())return;
    bar.setAttribute('aria-label','Visuais de '+actor.name);
    const visible=effective(actor);
    for(const key of variants.filter(k=>allowed(actor.id).includes(k))){
      const b=document.createElement('button');b.type='button';b.textContent=icons[key];
      b.className=visible===key?'active':'';
      b.title=labels[key];b.setAttribute('aria-label','Mostrar '+actor.name+': '+labels[key]);
      b.setAttribute('aria-pressed',String(visible===key));
      b.onclick=e=>{e.stopPropagation();void selectVariant(actor.id,key)};
      bar.append(b);
    }
    const remove=document.createElement('button');remove.type='button';remove.className='remove';
    remove.textContent='×';remove.title='Retirar do Teatro';
    remove.setAttribute('aria-label','Retirar '+actor.name+' do Teatro');
    remove.onclick=e=>{e.stopPropagation();void removeActor(actor.id)};
    bar.append(remove);
  }
  // Remove SOMENTE o fundo branco conectado às bordas, sem cortar o retrato.
  // É uma cópia de visualização; o PNG/WebP original permanece intacto na ficha.
  function displayArt(source){
    if(displayCache.has(source))return displayCache.get(source);
    const task=new Promise(resolve=>{
      const image=new Image();
      if(source.startsWith('https://'))image.crossOrigin='anonymous';
      image.onerror=()=>resolve(source);
      image.onload=()=>{
        try{
          const w=image.naturalWidth,h=image.naturalHeight;
          if(!w||!h){resolve(source);return}
          const factor=Math.min(1,1200/Math.max(w,h));
          const cw=Math.max(1,Math.round(w*factor)),ch=Math.max(1,Math.round(h*factor));
          const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
          const g=canvas.getContext('2d',{willReadFrequently:true});
          if(!g){resolve(source);return}
          g.drawImage(image,0,0,cw,ch);
          const pixels=g.getImageData(0,0,cw,ch),rgba=pixels.data;
          const nearWhite=p=>{
            const i=p*4,r=rgba[i],green=rgba[i+1],b=rgba[i+2];
            return rgba[i+3]>=225&&r>=219&&green>=219&&b>=207
              && Math.max(r,green,b)-Math.min(r,green,b)<38;
          };
          let opaqueEdges=0,whiteEdges=0,total=0;
          const stride=Math.max(1,Math.floor(Math.min(cw,ch)/140));
          const sample=p=>{
            total++;
            const alpha=rgba[p*4+3];
            if(alpha>=225){opaqueEdges++;if(nearWhite(p))whiteEdges++}
          };
          for(let x=0;x<cw;x+=stride){sample(x);sample((ch-1)*cw+x)}
          for(let y=0;y<ch;y+=stride){sample(y*cw);sample(y*cw+cw-1)}
          // Só detecta fundos claros que realmente ocupem a maioria das bordas.
          if(opaqueEdges/total<.88||whiteEdges/total<.72){resolve(source);return}
          const seen=new Uint8Array(cw*ch),queue=new Uint32Array(cw*ch);
          let head=0,tail=0;
          const enqueue=p=>{
            if(p<0||p>=seen.length||seen[p]||!nearWhite(p))return;
            seen[p]=1;queue[tail++]=p;
          };
          for(let x=0;x<cw;x++){enqueue(x);enqueue((ch-1)*cw+x)}
          for(let y=0;y<ch;y++){enqueue(y*cw);enqueue(y*cw+cw-1)}
          while(head<tail){
            const p=queue[head++],x=p%cw,y=(p/cw)|0;
            rgba[p*4+3]=0;
            if(x>0)enqueue(p-1);
            if(x<cw-1)enqueue(p+1);
            if(y>0)enqueue(p-cw);
            if(y<ch-1)enqueue(p+cw);
          }
          // Fundos que cobrem poucos pixels não justificam uma conversão.
          if(tail<cw*ch*.1){resolve(source);return}
          g.putImageData(pixels,0,0);
          const result=canvas.toDataURL('image/png');
          resolve(result.startsWith('data:image/png;')?result:source);
        }catch(error){
          // CORS e imagens que não permitem acesso aos pixels usam a fonte original.
          resolve(source);
        }
      };
      image.src=source;
    });
    displayCache.set(source,task);
    if(displayCache.size>16)displayCache.delete(displayCache.keys().next().value);
    return task;
  }
  function loadArt(fig,actor){
    const source=sourceFor(actor);
    if(!source){
      for(const img of fig.querySelectorAll('img'))img.remove();
      fig._source='';fig._originalSource='';fig._pending='';
      if(!fig.querySelector('.placeholder')){
        const p=document.createElement('span');p.className='placeholder';p.textContent='忍';fig.prepend(p);
      }
      reveal(fig);fit();return;
    }
    if(fig._originalSource===source){fit();return}
    if(fig._pending===source)return;
    // Enquanto o próximo retrato carrega, o anterior permanece integralmente
    // visível. Cliques sucessivos não podem apagar ou recriar o personagem.
    fig._pending=source;
    void displayArt(source).then(prepared=>{
      if(fig._pending!==source||figures.get(actor.id)!==fig)return;
      const img=new Image();
      img.draggable=false;img.alt='Retrato de '+actor.name;img.decoding='async';
      img.onload=()=>{
        if(fig._pending!==source||figures.get(actor.id)!==fig)return;
        const previous=Array.from(fig.querySelectorAll('img,.placeholder'));
        fig._source=prepared;fig._originalSource=source;fig._pending='';
        img.className='ready';
        img.style.opacity='0';
        fig.prepend(img);
        fit();reveal(fig);
        requestAnimationFrame(()=>{
          if(figures.get(actor.id)!==fig||fig._originalSource!==source)return;
          img.style.opacity='1';
        });
        // Não remover a arte anterior antes de a nova estar visível.
        setTimeout(()=>{
          if(figures.get(actor.id)!==fig||fig._originalSource!==source)return;
          for(const old of previous)old.remove();
          img.style.opacity='';
          fit();
        },300);
      };
      img.onerror=()=>{
        if(fig._pending===source){fig._pending='';reveal(fig)}
      };
      img.src=prepared;
    }).catch(()=>{
      if(fig._pending===source)fig._pending='';
      reveal(fig);
    });
  }
  function newFigure(actor){
    const fig=document.createElement('div');fig.className='stage-character preparing';fig.dataset.actor=actor.id;
    const label=document.createElement('span');label.className='stage-name';label.textContent=actor.name;
    const bar=document.createElement('div');bar.className='stage-tools';bar.setAttribute('role','group');
    fig.append(label,bar);return fig;
  }
  function render(){
    const active=new Set(state.cast.map(a=>a.id));
    for(const [id,fig] of figures){
      if(active.has(id)){fig.classList.remove('leaving');continue}
      if(fig.classList.contains('leaving'))continue;
      fig.classList.remove('preparing','entering');fig.classList.add('leaving');
      setTimeout(()=>{
        if(hasActor(id)||figures.get(id)!==fig)return;
        fig.remove();figures.delete(id);
        if(!state.cast.length)overlay.classList.remove('open');
      },370);
    }
    overlay.classList.toggle('open',(state.enabled&&state.cast.length>0)||figures.size>0);
    overlay.classList.toggle('master',isAdmin());
    if(!state.enabled){requestAnimationFrame(fit);return}
    for(const actor of state.cast){
      let fig=figures.get(actor.id);
      if(!fig){fig=newFigure(actor);figures.set(actor.id,fig)}
      overlay.append(fig);fig.classList.remove('leaving');
      const name=fig.querySelector('.stage-name');if(name)name.textContent=actor.name;
      stageTools(fig,actor);loadArt(fig,actor);
    }
    requestAnimationFrame(fit);
  }
  new ResizeObserver(()=>{if(state.enabled)requestAnimationFrame(fit)}).observe(stage);
  return {
    hasActor,
    addActor,
    removeActor,
    selectVariant,
    setState(value){
      const next=clean(value||{});
      if(JSON.stringify(state)===JSON.stringify(next))return;
      state=next;render();
    },
    setActors(value){
      actors=(Array.isArray(value)?value:[]).filter(a=>a?.id).map(a=>({
        id:String(a.id),name:String(a.name||'Shinobi'),category:a.category==='npc'?'npc':'player',
        variants:Array.isArray(a.variants)?a.variants.filter(k=>variants.includes(k)):[]
      }));
      render();
    },
    setPortrait(id,data,variant){
      if(data&&typeof data==='object'&&!Array.isArray(data)){
        const images=Object.fromEntries(Object.entries(data).filter(([k,v])=>variants.includes(k)&&validImage(v)));
        published.set(id,{variants:images,variant});
      }else if(validImage(data))published.set(id,{image:data,variant,variants:{[variant]:data}});
      else published.delete(id);
      render();
    },
    setVital(id,value){
      if(value&&Number.isFinite(Number(value.current))&&Number(value.max)>0)
        vitals.set(id,{current:Number(value.current),max:Number(value.max)});
      else vitals.delete(id);
      render();
    },
    refresh:render
  };
}
