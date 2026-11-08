const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('index.html','utf8');
const from=html.indexOf('function canvaVectorPage(');
const to=html.indexOf('function canvaSheetView(){',from);
if(from<0||to<0)throw Error('Vector renderer missing');
const source=html.slice(from,to);
const names=['Acrobacia','Arte','Atletismo','Ciências Naturais','Concentração','Cultura','Disfarces','Escapar','Furtividade','Lidar com Animais','Mecanismos','Medicina','Ocultismo','Prestidigitação','Procurar','Prontidão','Rastrear','Venefício'];
const context=vm.createContext({SKILLS:names.map(x=>[x,'INT'])});
vm.runInContext(source+';this.build=canvaVectorPage;',context,{timeout:1500});
const clan={id:'aburame',name:'Aburame',color:'#aa8b4d',desc:'Insetos e coleta de informações.'};
fs.mkdirSync('assets/vector-check',{recursive:true});
for(let page=1;page<=4;page++){
 const svg=context.build(page,clan);
 if(!svg.startsWith('<svg')||!svg.endsWith('</svg>'))throw Error('Broken SVG');
 fs.writeFileSync('assets/vector-check/aburame-'+page+'.svg',svg);
 console.log('Page '+page+' rendered '+svg.length+' chars');
}
