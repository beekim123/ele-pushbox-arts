/* Offline design reader. Search updates only the directory; section routes keep the body. */
(function(root){
  'use strict';
  const el=root.PBStage.el,docs=Array.isArray(root.PB_DOCS?.docs)?root.PB_DOCS.docs:[];
  const byPath=new Map(docs.map(doc=>[doc.path,doc]));
  const searchable=new Map(docs.map(doc=>[doc.path,(doc.title+'\n'+doc.text).toLocaleLowerCase()]));
  let directory,article,toc,reading,search,count,dialog,largeImage,caption,origin;
  let current=null,query='',initialized=false;

  function decode(value){try{return decodeURIComponent(value);}catch(error){return value;}}
  function place(id){
    const [file,...section]=String(id||'').split('#');
    return {path:file?'docs/'+decode(file).replace(/^docs\//,''):docs[0]?.path,section:decode(section.join('#'))};
  }
  function href(doc,section){
    return '#docs/'+doc.path.replace(/^docs\//,'').split('/').map(encodeURIComponent).join('/')+(section?'#'+encodeURIComponent(section):'');
  }
  function marked(host,text,term){
    if(!term){host.append(document.createTextNode(text));return;}
    const lower=text.toLocaleLowerCase(),needle=term.toLocaleLowerCase();let start=0,index;
    while((index=lower.indexOf(needle,start))!==-1){
      host.append(document.createTextNode(text.slice(start,index)),el('mark',{text:text.slice(index,index+term.length)}));
      start=index+term.length;
    }
    host.append(document.createTextNode(text.slice(start)));
  }
  function snippet(doc,term){
    const text=doc.text.replace(/\s+/g,' '),index=text.toLocaleLowerCase().indexOf(term.toLocaleLowerCase());
    const start=Math.max(0,index-36),end=Math.min(text.length,Math.max(index,0)+term.length+75);
    return (start?'…':'')+text.slice(start,end)+(end<text.length?'…':'');
  }
  function renderDirectory(){
    const term=query.trim(),needle=term.toLocaleLowerCase(),matches=docs.filter(doc=>!term||searchable.get(doc.path).includes(needle));
    directory.replaceChildren();count.textContent=term?'找到 '+matches.length+' 份文档':'设计文档 '+docs.length+' 份';
    const groups=new Map();
    for(const doc of matches){
      if(!groups.has(doc.group)){
        const group=el('section',{class:'docs-group'},[el('h2',{text:doc.group})]);groups.set(doc.group,group);directory.append(group);
      }
      const title=el('strong',{});marked(title,doc.title,term);
      const link=el('a',{href:href(doc),class:'docs-entry','data-doc-path':doc.path,'aria-current':current?.path===doc.path?'page':null},[title]);
      if(term){const excerpt=el('span',{class:'docs-snippet'});marked(excerpt,snippet(doc,term),term);link.append(excerpt);}
      else link.append(el('span',{class:'docs-path',text:doc.path.replace(/^docs\/design\//,'')}));
      groups.get(doc.group).append(link);
    }
    if(!matches.length)directory.append(el('p',{class:'muted',text:'没有匹配的文档。试试标题或正文里的词。'}));
  }
  function localImage(source){
    try{
      const url=new URL(source,location.href),repo=new URL('../',location.href);
      return url.origin===repo.origin&&url.protocol===repo.protocol&&url.pathname.startsWith(repo.pathname)&&/\.(?:png|jpe?g|gif|webp|avif|bmp)$/i.test(url.pathname)?url.href:null;
    }catch(error){return null;}
  }
  function previewButton(image,label){
    const button=el('button',{type:'button',class:'docs-image-preview','aria-label':'查看大图：'+label});
    button.addEventListener('click',()=>{
      origin=button;largeImage.src=image.src;largeImage.alt=label;caption.textContent=label;dialog.showModal();
    });
    button.append(image);return button;
  }
  function prepareImages(){
    for(const link of [...article.querySelectorAll('a[href]')]){
      const source=localImage(link.getAttribute('href'));if(!source)continue;
      const image=link.querySelector('img'),label=image?.alt||link.textContent||'文档图片';
      if(image){link.replaceWith(previewButton(image,label));}
      else{
        const preview=el('img',{src:source,alt:label,loading:'lazy',decoding:'async'});
        link.after(previewButton(preview,label));
      }
    }
    for(const image of [...article.querySelectorAll('img')]){
      if(image.closest('.docs-image-preview')||!localImage(image.getAttribute('src')))continue;
      const marker=document.createTextNode('');image.before(marker);marker.replaceWith(previewButton(image,image.alt||'文档图片'));
    }
  }
  function jump(section){
    for(const heading of article.querySelectorAll('.docs-current-heading'))heading.classList.remove('docs-current-heading');
    if(!section)return;
    const target=[...article.querySelectorAll('[id]')].find(node=>node.id===section);
    if(target){target.classList.add('docs-current-heading');target.scrollIntoView({block:'start'});}
  }
  function init(){
    if(initialized)return;initialized=true;
    const box=document.getElementById('docs-root');
    search=el('input',{type:'search',id:'docs-search',placeholder:'搜索标题或正文','aria-label':'搜索文档'});
    search.addEventListener('input',()=>{query=search.value;renderDirectory();});
    count=el('p',{id:'docs-count',class:'muted',role:'status'});directory=el('nav',{id:'docs-list','aria-label':'设计文档目录'});
    const side=el('aside',{class:'docs-directory'},[el('h1',{text:'文档'}),search,count,directory]);
    article=el('article',{id:'docs-article',class:'docs-prose'});toc=el('nav',{id:'docs-toc','aria-label':'本文小节'});
    const outline=el('aside',{class:'docs-outline'},[el('h2',{text:'本文小节'}),toc]);
    reading=el('div',{class:'docs-reading'},[el('div',{class:'docs-body'},[article,outline])]);
    box.replaceChildren(side,reading);
    largeImage=el('img',{});caption=el('strong',{id:'docs-image-caption'});
    const close=el('button',{type:'button',class:'btn',text:'关闭文档大图',onclick:()=>dialog.close()});
    dialog=el('dialog',{id:'docs-lightbox',class:'docs-lightbox','aria-labelledby':'docs-image-caption'},[
      el('div',{class:'docs-lightbox-head'},[caption,close]),el('div',{class:'docs-lightbox-frame'},[largeImage]),
    ]);
    dialog.addEventListener('close',()=>{
      largeImage.removeAttribute('src');
      // Native dialog closing may queue this event after the next user action.
      // Only restore missing focus; a newly focused search field keeps it.
      const active=document.activeElement;
      if(origin?.isConnected&&(active===document.body||dialog.contains(active)))origin.focus();
      origin=null;
    });
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
    document.body.append(dialog);
  }
  function show(id){
    init();const at=place(id),doc=byPath.get(at.path);
    if(!doc){
      current=null;renderDirectory();article.removeAttribute('data-doc-path');toc.replaceChildren();
      article.replaceChildren(el('h1',{text:docs.length?'没有找到这份文档':'还没有文档数据'}),el('p',{text:docs.length?'从左侧目录选择一份文档继续阅读。':'请在仓库根目录运行 node tools/docs.mjs build 后重新打开工作台。'}));return;
    }
    if(current!==doc){
      current=doc;renderDirectory();
      const rendered=root.PBMarkdown.render(doc.text,{path:doc.path,docs});
      article.innerHTML=rendered.html;article.setAttribute('data-doc-path',doc.path);prepareImages();
      toc.replaceChildren(...rendered.headings.filter(heading=>heading.level>1).map(heading=>el('a',{href:href(doc,heading.id),'data-level':heading.level,text:heading.text})));
      reading.scrollTop=0;document.getElementById('view-docs').scrollTop=0;document.querySelector('main').scrollTop=0;
    }
    jump(at.section);
  }
  function hide(){if(dialog?.open){origin=null;dialog.close();}}
  function where(id){const doc=byPath.get(place(id).path);return {key:'docs',trail:doc?['文档',doc.title]:['文档']};}
  root.PBDocs={show,hide,where};
})(window);
