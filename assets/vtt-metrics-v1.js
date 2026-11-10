// Conversões puras da régua do Shinobi Chronicles. Sem rede ou Firebase.
// Uma "célula virtual" é o intervalo de pixels calculado automaticamente
// a partir da imagem, mesmo com mapas sem grade desenhada.
export const DEFAULT_METERS_PER_CELL = 2;

export function metersPerCell(value, fallback=DEFAULT_METERS_PER_CELL) {
  if(value===null || value===undefined || value==='')return fallback;
  const n=Number(value);
  return Number.isFinite(n) && n>=0.05 && n<=1000 ? n : fallback;
}

export function pixelsToMeters(pixelDistance, cellPixels, meters) {
  const distance=Number(pixelDistance),cell=Number(cellPixels),scale=metersPerCell(meters);
  if(!Number.isFinite(distance) || !Number.isFinite(cell) || cell<=0)return 0;
  return Math.max(0, distance/cell*scale);
}

export function calibrateMetersPerCell(pixelDistance, knownMeters, cellPixels) {
  const d=Number(pixelDistance),known=Number(knownMeters),cell=Number(cellPixels);
  if(!Number.isFinite(d)||d<2||!Number.isFinite(known)||known<=0||!Number.isFinite(cell)||cell<=0)return null;
  const value=known*cell/d;
  return value>=0.05 && value<=1000 ? Math.round(value*1000)/1000 : null;
}

export function formatMeters(metres) {
  const n=Number(metres);
  if(!Number.isFinite(n) || n<0)return '— m';
  return n>=100 ? n.toLocaleString('pt-BR',{maximumFractionDigits:0})+' m' :
    n.toLocaleString('pt-BR',{minimumFractionDigits:n<10?1:0,maximumFractionDigits:1})+' m';
}

export function scaleBar(zoom,cellPixels,meters,targetPixels=94){
  const pxPerMeter=Number(zoom)*Number(cellPixels)/metersPerCell(meters);
  if(!Number.isFinite(pxPerMeter)||pxPerMeter<=0)return null;
  const desired=Math.max(.05,targetPixels/pxPerMeter);
  const mag=Math.pow(10,Math.floor(Math.log10(desired)));
  const candidates=[1,2,5,10].map(v=>v*mag);
  const value=candidates.reduce((a,b)=>Math.abs(a-desired)<Math.abs(b-desired)?a:b);
  return {metres:value,pixels:value*pxPerMeter,label:formatMeters(value)};
}
