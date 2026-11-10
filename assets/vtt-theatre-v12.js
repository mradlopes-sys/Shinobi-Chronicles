// Shinobi Chronicles — elenco do Teatro controlado diretamente pela Campanha.
export function createTheatre({stage,onChange,isAdmin,publishPortrait,previewPortrait,notify}){
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
#sc-theatre .stage-name{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);z-index:5;display:block;max-width:96%;padding:1px 10px 4px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;border:0;border-radius:6px;background:linear-gradient(0deg,#0b1b17a8,#11271d63);color:#fff0da;font:400 25px/1.08 'Caveat Brush','Yuji Boku',cursive;letter-spacing:.01em;text-align:center;text-shadow:0 2px 5px #000e,0 0 10px #0007;pointer-events:none}
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
@media(max-width:700px){#sc-theatre{padding:55px 1% 0}#sc-theatre .stage-tools{gap:2px;padding:3px}#sc-theatre .stage-tools button{width:20px;min-width:20px;height:23px}#sc-theatre .stage-name{font-size:20px;padding:1px 6px 3px}}
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
  let state={enabled:false,cast:[],revision:''},actors=[],queue=Promise.resolve(),pendingWrites=0,expectedRevision='',expectedUntil=0,revisionSequence=0;
  const published=new Map(),vitals=new Map(),figures=new Map(),bounds=new Map(),pendingAdds=new Set();
  const displayCache=new Map();
  const hasActor=id=>state.cast.some(x=>x.id===id);
  const actorInfo=id=>actors.find(x=>x.id===id);
  const allowed=id=>actorInfo(id)?.variants||[];
  const warn=msg=>{if(msg){console.warn('Teatro Shinobi:',msg);if(typeof notify==='function')notify(String(msg))}};
  const clean=raw=>({
    enabled:!!raw?.enabled,
    revision:typeof raw?.revision==='string'?raw.revision.slice(0,90):'',
    cast:(Array.isArray(raw?.cast)?raw.cast:[])
      .filter(x=>x&&typeof x.id==='string').slice(0,6)
      .map(x=>({id:x.id.slice(0,110),name:String(x.name||'Shinobi').slice(0,70),
        variant:variants.includes(x.variant)?x.variant:'ninja',auto:x.auto!==false}))
  });
  function save(patch){
    if(!isAdmin())return Promise.resolve(false);
    const previous=state;
    const revision=Date.now().toString(36)+'-'+(++revisionSequence).toString(36);
    const next=clean({...state,...patch,revision});
    pendingWrites++;expectedRevision=revision;expectedUntil=Date.now()+5000;
    state=next;render();
    // Cada clique é gravado em ordem; uma escolha antiga nunca pode sobrescrever a nova.
    const task=queue.catch(()=>{}).then(()=>onChange({enabled:next.enabled,cast:next.cast,revision}));
    queue=task;
    return task.then(()=>true).catch(e=>{
      if(state.revision===revision){state=previous;expectedRevision='';expectedUntil=0;render()}
      warn(e.message);return false;
    }).finally(()=>{pendingWrites=Math.max(0,pendingWrites-1)});
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
  // Todos os retratos ocupam a mesma altura visível, ancorados no piso do palco.
  // Nome SOBREPOSTO ao corpo, sem deslocamento e sem rodapé reservado.
  function fit(){
    if(!state.cast.length)return;
    const height=stage.clientHeight;
    const desired=Math.min(height*.39,285);
    const slotWidth=Math.min(...state.cast.map(a=>figures.get(a.id)?.clientWidth||Infinity));
    const common=Math.min(desired,slotWidth*1.13);
    if(!Number.isFinite(common)||common<=0)return;
    for(const a of state.cast){
      const fig=figures.get(a.id);if(!fig)continue;
      const label=fig.querySelector('.stage-name');
      const tools=fig.querySelector('.stage-tools');
      if(label)label.style.bottom='10px';
      if(tools)tools.style.bottom=Math.min(height-64,common+38)+'px';
      const placeholder=fig.querySelector('.placeholder');
      if(placeholder)placeholder.style.height=common+'px';
      // Reposiciona AMBAS as imagens durante o crossfade. Antes só a primeira
      // era alinhada: o personagem mudava de posição ao trocar de expressão.
      for(const img of fig.querySelectorAll('img.ready')){
        if(!img.naturalWidth||!img.naturalHeight)continue;
        const box=visibleBox(img,img._preparedSource||img.src);
        const scale=common/Math.max(1,box.height);
        img.style.width=(img.naturalWidth*scale)+'px';
        img.style.height=(img.naturalHeight*scale)+'px';
        img.style.left=(fig.clientWidth/2-(box.left+box.width/2)*scale)+'px';
        img.style.bottom=(-(img.naturalHeight-box.bottom)*scale)+'px';
      }
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
    const bar=fig.querySelector('.stage-tools');bar.hidden=!isAdmin();
    const visible=effective(actor);
    const toolsKey=[isAdmin(),actor.name,visible,...allowed(actor.id)].join('|');
    // Não destruir botões em cada snapshot de HP/Firebase: isso cancelava
    // cliques no meio do pointerdown e fazia as trocas parecerem intermitentes.
    if(fig.dataset.toolsKey===toolsKey)return;
    fig.dataset.toolsKey=toolsKey;
    bar.replaceChildren();
    if(!isAdmin())return;
    bar.setAttribute('aria-label','Visuais de '+actor.name);
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
  // Transparência conservadora do papel bege ou branco conectado às bordas.
  // A ficha original não é modificada, e roupas claras não são apagadas por cor global.
  function displayArt(source){
    if(displayCache.has(source))return displayCache.get(source);
    const job=new Promise(resolve=>{
      const image=new Image();
      if(source.startsWith('https://'))image.crossOrigin='anonymous';
      image.onerror=()=>resolve(source);
      image.onload=()=>{
        try{
          const w=image.naturalWidth,h=image.naturalHeight;
          const k=Math.min(1,1100/Math.max(w,h));
          const cw=Math.max(1,Math.round(w*k)),ch=Math.max(1,Math.round(h*k));
          const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});
          if(!ctx)return resolve(source);
          ctx.drawImage(image,0,0,cw,ch);
          const data=ctx.getImageData(0,0,cw,ch),rgba=data.data;
          const rgb=p=>[rgba[p*4],rgba[p*4+1],rgba[p*4+2]];
          const neutral=p=>{
            const [r,g,b]=rgb(p);
            return rgba[p*4+3]>=225&&(r+g+b)/3>190
              && Math.max(r,g,b)-Math.min(r,g,b)<68;
          };
          const stride=Math.max(1,Math.floor(Math.min(cw,ch)/120));
          const candidates=[],edges=[];let opaque=0;
          const sample=p=>{
            edges.push(p);if(rgba[p*4+3]>=225)opaque++;
            if(neutral(p))candidates.push(rgb(p));
          };
          for(let x=0;x<cw;x+=stride){sample(x);sample((ch-1)*cw+x)}
          for(let y=0;y<ch;y+=stride){sample(y*cw);sample(y*cw+cw-1)}
          if(opaque/edges.length<.72||candidates.length/edges.length<.5)return resolve(source);
          const median=i=>{
            const values=candidates.map(a=>a[i]).sort((a,b)=>a-b);
            return values[values.length>>1];
          };
          const background=[median(0),median(1),median(2)];
          const close=p=>{
            const [r,g,b]=rgb(p);
            return rgba[p*4+3]>=75&&(r+g+b)/3>174
              && Math.max(r,g,b)-Math.min(r,g,b)<78
              && Math.max(Math.abs(r-background[0]),Math.abs(g-background[1]),Math.abs(b-background[2]))<=58;
          };
          let matching=0;for(const p of edges)if(close(p))matching++;
          if(matching/edges.length<.5)return resolve(source);
          const seen=new Uint8Array(cw*ch),queue=new Uint32Array(cw*ch);
          let head=0,tail=0;
          const add=p=>{if(seen[p]||!close(p))return;seen[p]=1;queue[tail++]=p};
          for(let x=0;x<cw;x++){add(x);add((ch-1)*cw+x)}
          for(let y=0;y<ch;y++){add(y*cw);add(y*cw+cw-1)}
          while(head<tail){
            const p=queue[head++],x=p%cw,y=(p/cw)|0;
            if(x>0)add(p-1);if(x<cw-1)add(p+1);
            if(y>0)add(p-cw);if(y<ch-1)add(p+cw);
          }
          if(tail<cw*ch*.09)return resolve(source);
          for(let i=0;i<tail;i++)rgba[queue[i]*4+3]=0;
          ctx.putImageData(data,0,0);
          let result=canvas.toDataURL('image/webp',.97);
          if(!result.startsWith('data:image/webp;'))result=canvas.toDataURL('image/png');
          resolve(result||source);
        }catch(error){resolve(source)}
      };
      image.src=source;
    });
    displayCache.set(source,job);
    if(displayCache.size>12)displayCache.delete(displayCache.keys().next().value);
    return job;
  }
  // Só há UMA troca ativa por personagem. O retrato anterior permanece na
  // tela até o próximo estar pronto; cliques rápidos cancelam resultados antigos.
  function loadArt(fig,actor){
    const source=sourceFor(actor);
    if(!source){
      if(fig._requestedSource===''&&fig.querySelector('.placeholder'))return;
      fig._requestedSource='';
      fig._loadVersion=(fig._loadVersion||0)+1;
      if(!fig.querySelector('img.ready')){
        if(!fig.querySelector('.placeholder')){
          const p=document.createElement('span');p.className='placeholder';
          p.textContent='忍';fig.prepend(p);
        }
        reveal(fig);fit();
      }
      return;
    }
    // Checagem pelo pedido (não só pela imagem já exibida): evita reiniciar
    // carregamentos durante snapshots que não alteraram a expressão.
    if(fig._requestedSource===source)return;
    fig._requestedSource=source;
    const version=fig._loadVersion=(fig._loadVersion||0)+1;
    void displayArt(source).then(prepared=>{
      if(fig._loadVersion!==version||fig._requestedSource!==source||figures.get(actor.id)!==fig)return;
      const img=new Image();
      img.alt='Retrato de '+actor.name;img.draggable=false;img.decoding='async';
      img._preparedSource=prepared;
      img.onload=()=>{
        if(fig._loadVersion!==version||fig._requestedSource!==source||figures.get(actor.id)!==fig)return;
        // A imagem foi decodificada antes de entrar no DOM.
        const previous=Array.from(fig.querySelectorAll('img,.placeholder'));
        img.className='ready';
        img.style.opacity='0';
        fig.prepend(img);
        fig._source=prepared;fig._originalSource=source;
        fit();reveal(fig);
        requestAnimationFrame(()=>{
          if(figures.get(actor.id)!==fig||!img.isConnected)return;
          img.style.opacity='1';
        });
        setTimeout(()=>{
          if(figures.get(actor.id)!==fig||fig._loadVersion!==version)return;
          for(const old of previous)old.remove();
          img.style.opacity='';
          fit();
        },260);
      };
      img.onerror=()=>{
        if(fig._loadVersion!==version)return;
        // Mantém a expressão anterior e permite nova tentativa.
        fig._requestedSource='';
        if(!fig.querySelector('img.ready')){
          const p=document.createElement('span');p.className='placeholder';
          p.textContent='忍';fig.prepend(p);
        }
        warn('Falha ao abrir imagem de '+actor.name);
        reveal(fig);fit();
      };
      img.src=prepared;
    }).catch(error=>{
      if(fig._loadVersion!==version)return;
      fig._requestedSource='';
      warn('Falha ao preparar '+actor.name+': '+(error?.message||error));
    });
  }
  function newFigure(actor){
    const fig=document.createElement('div');fig.className='stage-character preparing';fig.dataset.actor=actor.id;
    const label=document.createElement('span');label.className='stage-name';label.textContent=actor.name;
    const bar=document.createElement('div');bar.className='stage-tools';bar.setAttribute('role','group');
    fig.append(label,bar);return fig;
  }
  let lastRosterOrder='';
  function render(){
    const active=new Set(state.cast.map(a=>a.id));
    const rosterOrder=state.cast.map(a=>a.id).join('|');
    const reorder=rosterOrder!==lastRosterOrder;
    lastRosterOrder=rosterOrder;
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
      if(reorder||fig.parentNode!==overlay)overlay.append(fig);
      fig.classList.remove('leaving');
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
    getCast:()=>state.cast.map(a=>({...a})),
    reset(){
      expectedRevision='';expectedUntil=0;
      pendingWrites=0;queue=Promise.resolve();
      state=clean({});published.clear();vitals.clear();
      render();
    },
    setState(value){
      const next=clean(value||{});
      if(expectedRevision){
        if(next.revision===expectedRevision){expectedRevision='';expectedUntil=0}
        else if(pendingWrites>0||Date.now()<expectedUntil)return;
        else{expectedRevision='';expectedUntil=0}
      }
      if(JSON.stringify(next)===JSON.stringify(state))return;
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
