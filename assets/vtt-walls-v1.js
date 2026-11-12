// Shinobi Chronicles · paredes e visão, inspirado nas ferramentas do Foundry VTT.
// Segmentos normalizados por cena; dados persistidos no documento compartilhado
// vttRooms/{room}.theatre.wallsMap. Sem dependência do Foundry ou novas coleções.
export const WALL_PRESETS=[
  {id:'solid',name:'Parede sólida',color:'#e3c493',movement:true,vision:'block'},
  {id:'window',name:'Janela',color:'#80c9de',movement:true,vision:'near'},
  {id:'door',name:'Porta',color:'#b08dde',movement:true,vision:'block'},
  {id:'secret',name:'Porta secreta',color:'#d38c92',movement:true,vision:'block'},
  {id:'invisible',name:'Parede invisível',color:'#79c7ad',movement:true,vision:'none'},
  {id:'ethereal',name:'Parede ilusória',color:'#bc9cde',movement:false,vision:'block'},
  {id:'terrain',name:'Terreno / obstáculo',color:'#bdad77',movement:true,vision:'limited'}
];
const kinds=new Set(WALL_PRESETS.map(x=>x.id)),validDirs=new Set(['both','left','right']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const norm=v=>clamp(n(v),0,1);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const maxWalls=180;
const distSeg=(px,py,ax,ay,bx,by)=>{
  const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
  const t=len?clamp(((px-ax)*dx+(py-ay)*dy)/len,0,1):0;
  return Math.hypot(px-ax-t*dx,py-ay-t*dy);
};
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
// Ray r=o+tv, segment s=a+u(b-a); t is in map pixels if v is unit length.
function rayHit(ox,oy,dx,dy,ax,ay,bx,by){
  const sx=bx-ax,sy=by-ay,den=cross(dx,dy,sx,sy);
  if(Math.abs(den)<1e-9)return Infinity;
  const qx=ax-ox,qy=ay-oy;
  const t=cross(qx,qy,sx,sy)/den,u=cross(qx,qy,dx,dy)/den;
  return t>.0001&&u>=-.00001&&u<=1.00001?t:Infinity;
}
const intersects=(a,b,c,d)=>{
  const dx=b.x-a.x,dy=b.y-a.y;
  return rayHit(a.x,a.y,dx,dy,c.x,c.y,d.x,d.y)<.99999;
};
function normalizeWall(v){
  if(!v||typeof v!=='object'||!kinds.has(v.type))return null;
  if(![v.x1,v.y1,v.x2,v.y2].every(x=>Number.isFinite(Number(x))))return null;
  const x1=norm(v.x1),y1=norm(v.y1),x2=norm(v.x2),y2=norm(v.y2);
  if(Math.hypot(x2-x1,y2-y1)<.0004)return null;
  const id=typeof v.id==='string'&&/^[A-Za-z0-9_-]{5,32}$/.test(v.id)?v.id:null;
  if(!id)return null;
  const state=['closed','open','locked'].includes(v.state)?v.state:'closed';
  return {id,type:v.type,x1,y1,x2,y2,state,dir:validDirs.has(v.dir)?v.dir:'both'};
}
function normalizeScene(value){
  const walls=Array.isArray(value?.walls)?value.walls.map(normalizeWall).filter(Boolean).slice(0,maxWalls):[];
  const used=new Set();
  return {walls:walls.filter(w=>{if(used.has(w.id))return false;used.add(w.id);return true}),
    vision:value?.vision===true,range:clamp(Math.round(n(value?.range)||10),2,30)};
}
export function createWallTools({
  getAdmin,getUid,getSceneId,getRoom,getMap,getCell,getZoom,getTokens,isHidden,
  saveFields,notify,redraw,onModeActivated,sendDoorRequest
}){
  let data={},mode='',kind='solid',selected='',pending=null,busy=false,snap=true,revision=0,doorBusy=false;
  const current=()=>getSceneId()||'';
  const scene=()=>data[current()]||{walls:[],vision:false,range:10};
  const img=()=>getMap();
  const pixels=()=>({w:img()?.naturalWidth||0,h:img()?.naturalHeight||0});
  const isDoor=w=>w?.type==='door'||w?.type==='secret';
  const typeName=t=>WALL_PRESETS.find(x=>x.id===t)?.name||'Parede';
  const isEditing=()=>mode==='wall-select'||mode==='wall-draw';
  let lastScene='';
  function setData(raw){
    if(current()!==lastScene){lastScene=current();mode='';pending=null;selected=''}
    if(!busy){
      const next={};if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
        for(const [key,v] of Object.entries(raw).slice(0,80))
          if(key&&key.length<=120)next[key]=normalizeScene(v);
      }
      data=next;revision++;
      if(selected&&!scene().walls.some(w=>w.id===selected))selected='';
    }
  }
  const wPix=(wall,w,h)=>({id:wall.id,type:wall.type,state:wall.state,dir:wall.dir,
    x1:wall.x1*w,y1:wall.y1*h,x2:wall.x2*w,y2:wall.y2*h});
  function editPoint(x,y){
    const {w,h}=pixels();if(!w||!h)return null;
    let px=clamp(x,0,w),py=clamp(y,0,h);
    if(snap){
      const step=Math.max(4,(Number(getCell())||64)/2);
      px=clamp(Math.round(px/step)*step,0,w);
      py=clamp(Math.round(py/step)*step,0,h);
    }
    return {x:norm(px/w),y:norm(py/h)};
  }
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,9);
  async function saveScene(next){
    if(!getAdmin()||!getRoom()||!current()||busy)return false;
    const before=data,nextData={...data,[current()]:normalizeScene(next)};
    busy=true;data=nextData;revision++;redraw();
    try{
      await saveFields({'theatre.wallsMap':nextData});return true;
    }catch(error){data=before;revision++;notify('Não foi possível salvar paredes: '+error.message);return false}
    finally{busy=false;redraw()}
  }
  function panelHTML(){
    if(!getAdmin()||!current())return '';
    const cfg=scene(),chosen=cfg.walls.find(w=>w.id===selected);
    return '<section class="sc-wall-panel" aria-label="Camada de paredes">'+
      '<div class="sc-battle-head"><small>CAMADA DO MESTRE · VISÃO E COLISÃO</small><h3>Arquitetura da cena</h3>'+
      '<p>Arraste para criar segmentos; selecione uma linha e arraste suas pontas para corrigir o traçado. Jogadores não veem as linhas.</p></div>'+
      '<div class="sc-wall-presets">'+WALL_PRESETS.map(x=>
        '<button type="button" data-wall-kind="'+x.id+'" class="sc-wall-preset'+(mode==='wall-draw'&&kind===x.id?' active':'')+
        '" title="'+esc(x.name)+'"><span style="--wall-color:'+x.color+'"></span>'+esc(x.name)+'</button>').join('')+'</div>'+
      '<div class="sc-wall-tools"><button id="sc-wall-select" type="button" class="sc-battle-secondary'+(mode==='wall-select'?' active':'')+
        '">⌖ Selecionar / editar</button><button id="sc-wall-stop" type="button" class="sc-battle-secondary"'+(!isEditing()?' disabled':'')+
        '>✓ Finalizar desenho</button></div>'+
      '<label class="sc-wall-toggle"><input type="checkbox" id="sc-wall-snap"'+(snap?' checked':'')+'> Alinhar pontas à meia célula</label>'+
      '<div class="sc-wall-options"><label><input type="checkbox" id="sc-wall-vision"'+(cfg.vision?' checked':'')+
        '> Visão automática dos personagens</label>'+
      '<label>Alcance <select id="sc-wall-range">'+[4,6,8,10,12,16,20,25,30].map(v=>
        '<option value="'+v+'"'+(cfg.range===v?' selected':'')+'>'+v+' células</option>').join('')+'</select></label></div>'+
      '<p class="sc-battle-note">Ative a névoa de guerra para usar visão automática. Janelas permitem enxergar de perto; portas abertas liberam visão e movimento.</p>'+
      (chosen?
        '<div class="sc-wall-selected"><strong>Segmento selecionado</strong><small>'+esc(typeName(chosen.type))+
        '</small><label>Tipo <select id="sc-wall-edit-type">'+WALL_PRESETS.map(x=>
          '<option value="'+x.id+'"'+(x.id===chosen.type?' selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label>'+
        (isDoor(chosen)?'<label>Porta <select id="sc-wall-door-state">'+
          [['closed','Fechada'],['open','Aberta'],['locked','Trancada']].map(([v,t])=>
          '<option value="'+v+'"'+(chosen.state===v?' selected':'')+'>'+t+'</option>').join('')+'</select></label>':'')+
        '<label>Direção <select id="sc-wall-direction">'+[['both','Ambos os lados'],['left','Lado esquerdo'],['right','Lado direito']].map(([v,t])=>
          '<option value="'+v+'"'+(chosen.dir===v?' selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
        '<button id="sc-wall-delete" type="button" class="sc-battle-secondary">✕ Remover segmento</button></div>':'')+
      '<div class="sc-wall-tools"><button id="sc-wall-undo" type="button" class="sc-battle-secondary"'+(!cfg.walls.length?' disabled':'')+
        '>↶ Desfazer última parede</button><button id="sc-wall-clear" type="button" class="sc-battle-secondary"'+(!cfg.walls.length?' disabled':'')+
        '>Limpar paredes</button></div>'+
      '<p class="sc-battle-note">'+cfg.walls.length+' segmento(s) nesta cena. As paredes são vinculadas ao mapa ativo.</p></section>';
  }
  function bind(){
    if(!getAdmin())return;
    const $=id=>document.getElementById(id);
    const bindChange=(id,fn)=>{const el=$(id);if(el)el.onchange=fn};
    const bindClick=(id,fn)=>{const el=$(id);if(el)el.onclick=fn};
    for(const button of document.querySelectorAll('[data-wall-kind]'))button.onclick=()=>{
      kind=button.dataset.wallKind;mode='wall-draw';pending=null;selected='';
      onModeActivated();redraw();refreshUI();
    };
    bindClick('sc-wall-select',()=>{mode=mode==='wall-select'?'':'wall-select';pending=null;onModeActivated();refreshUI();redraw()});
    bindClick('sc-wall-stop',()=>{cancel();refreshUI()});
    bindChange('sc-wall-snap',e=>{snap=e.target.checked});
    bindChange('sc-wall-vision',e=>void update({vision:e.target.checked}));
    bindChange('sc-wall-range',e=>void update({range:Number(e.target.value)}));
    bindChange('sc-wall-edit-type',e=>void changeSelected({type:e.target.value}));
    bindChange('sc-wall-door-state',e=>void changeSelected({state:e.target.value}));
    bindChange('sc-wall-direction',e=>void changeSelected({dir:e.target.value}));
    bindClick('sc-wall-delete',()=>void removeSelected());
    bindClick('sc-wall-undo',async()=>{
      const a=scene().walls;if(!a.length)return;
      if(selected===a[a.length-1].id)selected='';
      await saveScene({...scene(),walls:a.slice(0,-1)});refreshUI();
    });
    bindClick('sc-wall-clear',async()=>{
      if(!window.confirm('Apagar todas as paredes desta cena?'))return;
      selected='';await saveScene({...scene(),walls:[]});refreshUI();
    });
  }
  function refreshUI(){
    const root=document.getElementById('sc-walls-container');
    if(!root)return;
    root.innerHTML=panelHTML();bind();
  }
  async function update(fields){if(await saveScene({...scene(),...fields}))refreshUI()}
  async function changeSelected(fields){
    if(!selected)return;
    const a=scene().walls.map(w=>w.id===selected?{...w,...fields}:w);
    if(await saveScene({...scene(),walls:a}))refreshUI();
  }
  async function removeSelected(){
    if(!selected)return;const id=selected;selected='';
    await saveScene({...scene(),walls:scene().walls.filter(w=>w.id!==id)});refreshUI();
  }
  function nearby(x,y){
    const {w,h}=pixels();if(!w||!h)return null;
    let choice=null,distance=18/Math.max(.25,Number(getZoom())||1);
    for(const v of scene().walls){
      const q=wPix(v,w,h),d=distSeg(x,y,q.x1,q.y1,q.x2,q.y2);
      if(d<distance){distance=d;choice=v}
    }
    return choice;
  }
  function pointerDown(x,y){
    if(!isEditing()||!getAdmin())return false;
    const p=editPoint(x,y);
    if(!p)return true;
    if(mode==='wall-select'){
      const chosen=nearby(x,y);selected=chosen?.id||'';
      pending=null;
      if(chosen){
        const size=pixels(),v=wPix(chosen,size.w,size.h);
        const max=11/Math.max(.2,Number(getZoom())||1);
        const a=Math.hypot(x-v.x1,y-v.y1),b=Math.hypot(x-v.x2,y-v.y2);
        if(Math.min(a,b)<=max)pending={edit:chosen.id,endpoint:a<=b?'a':'b',start:p,end:p};
      }
      refreshUI();redraw();return true;
    }
    pending={start:p,end:p};redraw();return true;
  }
  function pointerMove(x,y){
    if(!pending)return false;
    pending.end=editPoint(x,y)||pending.end;
    return true;
  }
  async function pointerUp(x,y){
    if(!isEditing())return false;
    if(mode==='wall-select'){
      if(!pending?.edit)return true;
      pending.end=editPoint(x,y)||pending.end;
      const {edit,endpoint,start,end}=pending;
      pending=null;
      const size=pixels();
      if(Math.hypot((start.x-end.x)*size.w,(start.y-end.y)*size.h)<5){redraw();return true}
      const updated=scene().walls.map(w=>w.id===edit?
        {...w,...(endpoint==='a'?{x1:end.x,y1:end.y}:{x2:end.x,y2:end.y})}:w);
      await saveScene({...scene(),walls:updated});refreshUI();return true;
    }
    if(mode!=='wall-draw'||!pending)return true;
    pending.end=editPoint(x,y)||pending.end;
    const {start,end}=pending;pending=null;
    const {w,h}=pixels();
    if(Math.hypot((start.x-end.x)*w,(start.y-end.y)*h)<8){redraw();return true}
    if(scene().walls.length>=maxWalls){notify('Limite de paredes deste mapa atingido.');return true}
    const wall={id:uid(),type:kind,x1:start.x,y1:start.y,x2:end.x,y2:end.y,state:'closed',dir:'both'};
    const ok=await saveScene({...scene(),walls:[...scene().walls,wall]});
    if(ok){selected=wall.id;refreshUI()}
    return true;
  }
  function cancel(){
    if(!isEditing()&&!pending)return false;
    mode='';pending=null;selected='';redraw();return true;
  }
  function active(){return isEditing()}
  const mapSegments=()=>{
    const {w,h}=pixels();if(!w||!h)return[];
    return scene().walls.map(wall=>wPix(wall,w,h));
  };
  function activeFor(wall,ox,oy){
    if(wall.state==='open'&&(wall.type==='door'||wall.type==='secret'))return false;
    if(wall.dir==='both')return true;
    const side=cross(wall.x2-wall.x1,wall.y2-wall.y1,ox-wall.x1,oy-wall.y1);
    return wall.dir==='left'?side>=0:side<=0;
  }
  function moveBlocked(ax,ay,bx,by){
    if(!scene().walls.length)return false;
    const a={x:ax,y:ay},b={x:bx,y:by};
    for(const w of mapSegments()){
      if(!activeFor(w,ax,ay))continue;
      if(w.type==='ethereal')continue;
      if(intersects(a,b,{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}))return true;
    }
    return false;
  }

  // Portas: o mestre aciona livremente; jogadores precisam estar junto a um token próprio
  // e não podem operar portas secretas fechadas nem portas trancadas.
  const centerDoor=w=>({x:(w.x1+w.x2)/2,y:(w.y1+w.y2)/2});
  function ownerAtDoor(wall){
    const cell=Math.max(1,Number(getCell())||64),mid=centerDoor(wall);
    return getTokens().filter(t=>t.ownerUid===getUid()&&!isHidden(t.id)).find(t=>{
      const eye=eyeOf(t),distance=Math.hypot(eye.x-mid.x,eye.y-mid.y);
      if(distance>cell*1.75)return false;
      return !mapSegments().some(other=>other.id!==wall.id&&other.type!=='ethereal'&&
        activeFor(other,eye.x,eye.y)&&
        intersects({x:eye.x,y:eye.y},mid,{x:other.x1,y:other.y1},{x:other.x2,y:other.y2}));
    })||null;
  }
  function usableDoor(wall){
    if(!isDoor(wall))return false;
    if(getAdmin())return true;
    if(wall.type==='secret'&&wall.state!=='open')return false;
    return wall.state!=='locked'&&!!ownerAtDoor(wall);
  }
  function doorAt(x,y){
    if(!img()?.naturalWidth)return null;
    const threshold=14/Math.max(.3,Number(getZoom())||1);
    let closest=null,distance=threshold;
    for(const wall of mapSegments()){
      if(!usableDoor(wall))continue;
      const mid=centerDoor(wall),d=Math.hypot(x-mid.x,y-mid.y);
      if(d<distance){distance=d;closest=wall}
    }
    return closest;
  }
  function doorHint(x,y){
    const door=doorAt(x,y);
    if(!door)return '';
    if(door.state==='locked')return 'Porta trancada · o mestre pode destrancá-la';
    return door.state==='open'?'Clique para fechar a porta':'Clique para abrir a porta';
  }
  async function toggleDoorAt(x,y){
    const target=doorAt(x,y);if(!target||doorBusy)return false;
    if(target.state==='locked'){notify('Esta porta está trancada.');return true}
    const state=target.state==='open'?'closed':'open';
    doorBusy=true;
    try{
      if(getAdmin()){
        const result=await saveScene({...scene(),walls:scene().walls.map(w=>
          w.id===target.id?{...w,state}:w)});
        if(result)notify(state==='open'?'Porta aberta.':'Porta fechada.');
      }else{
        if(typeof sendDoorRequest!=='function')throw Error('Interações não disponíveis.');
        const own=ownerAtDoor(target);
        if(!own)return false;
        await sendDoorRequest({sceneId:current(),wallId:target.id,tokenId:own.id,state});
        notify('Interação enviada ao mestre: '+(state==='open'?'abrir':'fechar')+' porta.');
      }
    }catch(e){notify('Não foi possível interagir com a porta: '+e.message)}
    finally{doorBusy=false;redraw()}
    return true;
  }
  function drawDoorHandles(ctx,view){
    const z=Math.max(.15,Number(view?.zoom)||1);
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    for(const door of mapSegments()){
      if(!usableDoor(door))continue;
      const mid=centerDoor(door),radius=7/z;
      ctx.beginPath();ctx.arc(mid.x,mid.y,radius,0,Math.PI*2);
      ctx.fillStyle=door.state==='open'?'#527e69':door.state==='locked'?'#825451':'#bd9c66';
      ctx.strokeStyle='#fff0cd';ctx.lineWidth=1.4/z;ctx.shadowColor='#050b07aa';ctx.shadowBlur=4/z;
      ctx.fill();ctx.stroke();ctx.shadowBlur=0;
      ctx.strokeStyle='#fff6e1';ctx.lineWidth=1.5/z;ctx.beginPath();
      if(door.state==='open'){
        ctx.moveTo(mid.x-2/z,mid.y);ctx.lineTo(mid.x+2/z,mid.y);
      }else{
        ctx.moveTo(mid.x-2/z,mid.y-2/z);ctx.lineTo(mid.x+2/z,mid.y+2/z);
        ctx.moveTo(mid.x+2/z,mid.y-2/z);ctx.lineTo(mid.x-2/z,mid.y+2/z);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function blocksVision(wall,ox,oy,cell){
    if(!activeFor(wall,ox,oy))return false;
    if(wall.type==='invisible')return false;
    if(wall.type==='window'){
      return distSeg(ox,oy,wall.x1,wall.y1,wall.x2,wall.y2)>cell*2;
    }
    return true;
  }
  function rayDistance(ox,oy,dx,dy,radius,segments,cell){
    const hits=[];
    for(const w of segments){
      if(!blocksVision(w,ox,oy,cell))continue;
      const t=rayHit(ox,oy,dx,dy,w.x1,w.y1,w.x2,w.y2);
      if(t<radius&&t>.002)hits.push([t,w.type]);
    }
    hits.sort((a,b)=>a[0]-b[0]);
    let terrain=0;
    for(const [t,type] of hits){
      if(type==='terrain'){terrain++;if(terrain<2)continue}
      return t;
    }
    return radius;
  }
  const eyeOf=t=>{const c=Math.max(1,Number(getCell())||64);return {x:(n(t.x)+.5)*c,y:(n(t.y)+.75)*c}};
  function ownedEyes(){
    const user=getUid();
    if(!user)return[];
    return getTokens().filter(t=>t.ownerUid===user&&!isHidden(t.id)).slice(0,6).map(eyeOf);
  }
  function visionActive(){return scene().vision&&scene().walls.length>0}
  function visionSettings(){return scene()}
  function visibleAtWorld(x,y){
    if(!visionActive())return false;
    const {w,h}=pixels(),cell=Math.max(1,Number(getCell())||64);
    if(!w||!h)return false;
    const radius=scene().range*cell,segments=mapSegments();
    return ownedEyes().some(eye=>{
      const dx=x-eye.x,dy=y-eye.y,dist=Math.hypot(dx,dy);
      if(dist<.05)return true;
      if(dist>radius)return false;
      const nearby=segments.filter(w=>distSeg(eye.x,eye.y,w.x1,w.y1,w.x2,w.y2)<=dist+1);
      return rayDistance(eye.x,eye.y,dx/dist,dy/dist,dist,nearby,cell)>=dist-.5;
    });
  }
  function cutVision(maskCtx,cw,ch,w,h){
    if(!visionActive())return;
    const cell=Math.max(1,Number(getCell())||64);
    const radius=scene().range*cell,segments=mapSegments(),eyes=ownedEyes();
    if(!eyes.length)return;
    maskCtx.save();
    maskCtx.globalCompositeOperation='destination-out';
    maskCtx.fillStyle='#fff';
    maskCtx.setTransform(cw/w,0,0,ch/h,0,0);
    for(const eye of eyes){
      const nearby=segments.filter(w=>distSeg(eye.x,eye.y,w.x1,w.y1,w.x2,w.y2)<=radius+cell);
      const angles=[];
      const sample=72;
      for(let i=0;i<sample;i++)angles.push(i*Math.PI*2/sample);
      for(const wall of nearby){
        for(const p of [[wall.x1,wall.y1],[wall.x2,wall.y2]]){
          const angle=Math.atan2(p[1]-eye.y,p[0]-eye.x);
          const full=Math.PI*2;
          const angleNorm=v=>((v%full)+full)%full;
          angles.push(angleNorm(angle-.00014),angleNorm(angle),angleNorm(angle+.00014));
        }
      }
      angles.sort((a,b)=>a-b);
      maskCtx.beginPath();
      for(let i=0;i<angles.length;i++){
        const angle=angles[i],dx=Math.cos(angle),dy=Math.sin(angle);
        const dist=rayDistance(eye.x,eye.y,dx,dy,radius,nearby,cell);
        const x=eye.x+dx*dist,y=eye.y+dy*dist;
        if(i===0)maskCtx.moveTo(x,y);
        else maskCtx.lineTo(x,y);
      }
      maskCtx.closePath();maskCtx.fill();
    }
    maskCtx.restore();
  }
  function signature(){
    if(!visionActive())return 'none';
    return revision+':'+current()+':'+scene().range+':'+ownedEyes().map(e=>e.x.toFixed(2)+','+e.y.toFixed(2)).join('|');
  }
  function draw(ctx,view){
    if(!getAdmin()||!isEditing()){drawDoorHandles(ctx,view);return}
    const {w,h}=pixels();if(!w||!h)return;
    const scale=Math.max(.12,view?.zoom||1);
    ctx.save();ctx.lineCap='round';
    for(const v of scene().walls){
      const q=wPix(v,w,h),def=WALL_PRESETS.find(x=>x.id===v.type);
      ctx.strokeStyle=v.id===selected?'#fff1c1':def?.color||'#d8bd8f';
      ctx.lineWidth=(v.id===selected?4:2.8)/scale;
      ctx.setLineDash(v.type==='secret'?[3/scale,5/scale]:v.type==='ethereal'?[7/scale,5/scale]:[]);
      ctx.globalAlpha=isDoor(v)&&v.state==='open'?.4:1;
      ctx.beginPath();ctx.moveTo(q.x1,q.y1);ctx.lineTo(q.x2,q.y2);ctx.stroke();
      ctx.setLineDash([]);ctx.globalAlpha=1;
      if(isDoor(v)){
        ctx.fillStyle=v.state==='open'?'#a0cdb7':v.state==='locked'?'#df8c80':'#e1c08d';
        ctx.beginPath();ctx.arc((q.x1+q.x2)/2,(q.y1+q.y2)/2,6/scale,0,Math.PI*2);ctx.fill();
      }
      if(v.id===selected){
        for(const [x,y] of [[q.x1,q.y1],[q.x2,q.y2]]){
          ctx.fillStyle='#fff4da';ctx.beginPath();ctx.arc(x,y,4/scale,0,Math.PI*2);ctx.fill();
        }
      }
    }
    if(pending){
      ctx.strokeStyle='#fff0ce';ctx.lineWidth=3/scale;ctx.setLineDash([8/scale,4/scale]);
      if(pending.edit){
        const current=scene().walls.find(v=>v.id===pending.edit);
        if(current){
          const opposite=pending.endpoint==='a'?[current.x2,current.y2]:[current.x1,current.y1];
          ctx.beginPath();ctx.moveTo(opposite[0]*w,opposite[1]*h);
          ctx.lineTo(pending.end.x*w,pending.end.y*h);ctx.stroke();
        }
      }else{
        ctx.beginPath();ctx.moveTo(pending.start.x*w,pending.start.y*h);
        ctx.lineTo(pending.end.x*w,pending.end.y*h);ctx.stroke();
      }
    }
    ctx.restore();
    drawDoorHandles(ctx,view);
  }
  return {setData,panelHTML,bind,refreshUI,pointerDown,pointerMove,pointerUp,cancel,
    active,activeDraw:()=>mode==='wall-draw',activeSelect:()=>mode==='wall-select',
    draw,moveBlocked,visibleAtWorld,cutVision,signature,visionActive,visionSettings,
    doorAt,doorHint,toggleDoorAt};
}
