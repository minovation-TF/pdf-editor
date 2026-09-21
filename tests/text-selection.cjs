const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'tmp', 'selection-qa');
const html = fs.readFileSync(path.join(root, 'pdf-editor.html'), 'utf8');
for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (/type=/.test(m[1])) continue;
  new vm.Script(m[2]);
}
(async () => {
 const server = http.createServer((req,res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root + path.sep) || !fs.existsSync(p) || !fs.statSync(p).isFile()) {res.writeHead(404).end();return;}
  res.setHeader('Content-Type', p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
 });
 await new Promise(r => server.listen(0,'127.0.0.1',r));
 const browser = await chromium.launch({channel:process.env.TEST_BROWSER || 'msedge',headless:true});
 const errors=[];
 try {
  const page=await browser.newPage({viewport:{width:1500,height:1100}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.PDF_EDITOR_CONFIG = {};'}));
  await page.goto(process.env.TEST_URL || `http://127.0.0.1:${server.address().port}/pdf-editor.html`);
  await page.locator('#file').setInputFiles(path.join(out,'fixture.pdf'));
  await page.waitForFunction(()=>window.__tool?.S.pages.length===5 && window.__tool.S.pages[0].text.dataset.renderScale===String(window.__tool.S.scale));
  const point = (text,index) => page.evaluate(({text,index})=>{
    const span=[...window.__tool.S.pages[0].text.querySelectorAll('span')].find(s=>s.textContent.startsWith(text));
    if(!span)throw new Error('Missing span: '+text);
    const node=span.firstChild, range=document.createRange();
    const n=index===-1?node.length:index;
    range.setStart(node, Math.min(n,node.length-1));range.setEnd(node,Math.min(n+1,node.length));
    const r=range.getBoundingClientRect();
    return {x:index===-1?r.right-.1:r.left+.1,y:r.top+r.height/2};
  },{text,index});
  const drag = async (from,fi,to,ti,reverse=false)=>{
    let a=await point(from,fi), b=await point(to,ti);if(reverse)[a,b]=[b,a];
    await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:15});
    assert(await page.evaluate(()=>window.getSelection().isCollapsed),'Dragging must not create browser-native selection');
    await page.mouse.up();
    try { await page.locator('#selpop').waitFor({state:'visible',timeout:5000}); }
    catch(e) { console.log('Drag failure',await page.evaluate(()=>({scale:window.__tool.S.scale,tool:window.__tool.S.tool,scroll:document.querySelector('#viewer').scrollTop,rect:window.__tool.S.pages[0].el.getBoundingClientRect().toJSON(),spans:[...window.__tool.S.pages[0].text.querySelectorAll('span')].slice(-2).map(s=>({text:s.textContent,rect:s.getBoundingClientRect().toJSON()})),model:window.__tool.S.pages[0].selectionModel?.slice(-2)})));await page.screenshot({path:path.join(out,'failure.png')});throw e; }
    assert(await page.evaluate(()=>window.getSelection().isCollapsed),'Completed selection must not open native selection menus');
  };
  await drag('간호',2,'보장 내용',-1);
  let previews=await page.locator('.text-selection-preview span').evaluateAll(es=>es.map(e=>({x:parseFloat(e.style.left)/window.__tool.S.scale,w:parseFloat(e.style.width)/window.__tool.S.scale})));
  assert.equal(previews.length,3);assert(previews.every(r=>r.x>=99 && r.x+r.w<590),'No stray selection in row-number or amount columns');
  assert.deepEqual(await page.locator('#selpop .markgroup').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label'))),['형광펜 색상','직선 밑줄 색상','물결 밑줄 색상']);
  await page.screenshot({path:path.join(out,'selection-popup.png')});
  await page.locator('#selpop .markbtn[data-mark="squiggle"]').click();
  assert.equal(await page.evaluate(()=>window.__tool.S.ann.length),1);
  assert.equal(await page.evaluate(()=>window.__tool.S.ann[0].rects.length),3);
  assert.equal(await page.locator('#list .it').count(),1);
  assert.equal(await page.locator('.hl.on').count(),3);
  assert.equal(await page.locator('.ft').count(),1);
  await page.locator('.ft [data-line-color="#1677ff"]').click();
  assert(await page.locator('.hl path').evaluateAll(es=>es.every(e=>getComputedStyle(e).stroke==='rgb(22, 119, 255)')));
  await page.locator('#undo').click();
  assert.equal(await page.evaluate(()=>window.__tool.S.ann[0].lineColor),'#e33135');
  await page.locator('#redo').click();
  await page.keyboard.press('Escape');
  await page.locator('.hl').nth(2).click();
  assert.equal(await page.locator('.hl.on').count(),3);
  await page.keyboard.press('Delete');
  assert.equal(await page.evaluate(()=>window.__tool.S.ann.length),0);
  await page.locator('#undo').click();
  assert.equal(await page.evaluate(()=>window.__tool.S.ann[0].rects.length),3);
  await drag('여러 줄',0,'두 번째',-1,true);
  await page.locator('#selpop [data-i="0"]').click();
  assert.equal(await page.evaluate(()=>window.__tool.S.ann.length),2);
  assert.equal(await page.evaluate(()=>window.__tool.S.ann[1].rects.length),2);
  await page.locator('.ft [data-color="2"]').click();
  assert.equal(await page.evaluate(()=>window.__tool.S.ann[1].color),2);
  assert.equal(await page.locator('.hl.on').count(),2);
  const word=await point('단어 더블클릭',4);await page.mouse.dblclick(word.x,word.y);
  await page.locator('#selpop').waitFor({state:'visible'});
  await page.locator('#selpop .markcolor[data-mark="underline"][data-color="#e33135"]').click();
  assert.equal(await page.evaluate(()=>window.__tool.S.ann.length),3);
  assert(await page.evaluate(()=>window.__tool.S.ann[2].label.includes('더블클릭')));
  await drag('취소와',0,'취소와',5);await page.keyboard.press('Escape');
  assert.equal(await page.locator('.text-selection-preview').count(),0);
  await drag('취소와',0,'취소와',5);
  assert((await page.evaluate(()=>{const data=new DataTransfer(),e=new ClipboardEvent('copy',{clipboardData:data,bubbles:true,cancelable:true});document.dispatchEvent(e);return data.getData('text/plain');})).startsWith('취소와'));
  await page.locator('#tools [data-t="sel"]').click();
  assert.equal(await page.locator('.text-selection-preview').count(),0);
  await page.locator('#tools [data-t="hl"]').click();
  const cancelStart=await point('취소와',0),cancelEnd=await point('취소와',8);
  await page.mouse.move(cancelStart.x,cancelStart.y);await page.mouse.down();await page.mouse.move(cancelEnd.x,cancelEnd.y,{steps:5});
  await page.keyboard.press('Escape');await page.mouse.up();
  assert.equal(await page.locator('.text-selection-preview').count(),0);
  assert.equal(await page.evaluate(()=>window.__tool.S.ann.length),3);
  await drag('취소와',0,'취소와',5);await page.locator('#zin').click();
  assert.equal(await page.locator('.text-selection-preview').count(),0);
  for(let i=0;i<3;i++)await page.locator('#zin').click();
  await page.locator('#zfit').click();
  await page.waitForFunction(()=>window.__tool.S.pages[0].text.dataset.renderScale===String(window.__tool.S.scale));
  await drag('취소와',0,'취소와',5);await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.locator('.page').first().screenshot({path:path.join(out,'editor.png')});
  // Preserve the grouped shapes on export and exercise all rotated/cropped viewports.
  await page.evaluate(()=>{const S=window.__tool.S;for(let p=2;p<=5;p++)S.ann.push({id:'qa-'+p,type:'hl',kind:'text',page:p,x:40,y:40,w:150,h:30,rects:[{x:40,y:40,w:150,h:12},{x:40,y:57,w:100,h:12}],mark:p%2?'underline':'squiggle',lineColor:'#e33135',color:0});window.__tool.select(null);});
  const download=page.waitForEvent('download');await page.locator('#save').click();await (await download).saveAs(path.join(out,'marked.pdf'));
  const result=await page.evaluate(async()=>{
    const T=window.__tool,bytes=await T.buildMarkedPdf(),doc=await pdfjsLib.getDocument({data:bytes.slice(0),useSystemFonts:true}).promise;
    const checks=[],images=[];
    for(let num=1;num<=doc.numPages;num++){
      const p=await doc.getPage(num),vp=p.getViewport({scale:2}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
      const ctx=c.getContext('2d');await p.render({canvasContext:ctx,viewport:vp}).promise;images.push(c.toDataURL('image/png'));
      const data=ctx.getImageData(0,0,c.width,c.height).data;
      for(const a of T.S.ann.filter(a=>a.page===num&&a.mark!=='highlight')){
        const paths=T.S.pages[num-1].layer.querySelectorAll(`[data-id="${a.id}"] path`);
        paths.forEach((p,i)=>{const r=a.rects[i],points=p.getAttribute('d').match(/[ML][^ML]+/g).map(s=>s.slice(1).trim().split(/\s+/).map(Number));let found=0;
          for(const [x,y] of points){let hit=false;const px=Math.round((r.x+x)*2),py=Math.round((r.y+y)*2);
            for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const off=((py+dy)*c.width+px+dx)*4,[red,g,b]=data.slice(off,off+3);if(a.lineColor==='#1677ff'?b>red+50&&b>g+25:red>g+50&&red>b+50)hit=true;}
            if(hit)found++;
          }checks.push({page:num,id:a.id,fragment:i,ratio:found/points.length});
        });
      }
    }
    await doc.destroy();const jpgs=[];
    const folder={getFileHandle:async name=>({createWritable:async()=>({write:async b=>jpgs.push({name,data:Array.from(new Uint8Array(await b.arrayBuffer()))}),close:async()=>{}})})};
    await T.exportJpg(bytes,folder,'QA');return {checks,images,jpgs};
  });
  result.images.forEach((v,i)=>fs.writeFileSync(path.join(out,`export-${i+1}.png`),Buffer.from(v.split(',')[1],'base64')));
  result.jpgs.forEach(j=>fs.writeFileSync(path.join(out,j.name),Buffer.from(j.data)));
  assert(result.checks.every(c=>c.ratio>.97));assert.equal(result.jpgs.length,5);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks:result.checks,errors},null,2));
  console.log(JSON.stringify({status:'PASS',browser:await browser.version(),nativeSelection:false,groupEdit:true,reverseDrag:true,doubleClick:true,exportChecks:result.checks,jpgPages:5,errors}));
 }catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();server.close();}
})();
