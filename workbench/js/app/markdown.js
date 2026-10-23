// Small, dependency-free Markdown reader for the public design documents.
(function(root){
 'use strict';
 const escape=text=>String(text).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const unescape=text=>text.replace(/\\([\\`*{}\[\]()#+.!_|>~-])/g,'$1');
 const encodePath=text=>text.split('/').map(encodeURIComponent).join('/');
 function codeSpan(text,at){
  const mark=text.slice(at).match(/^`+/)?.[0];if(!mark)return null;
  const end=text.indexOf(mark,at+mark.length);if(end<0)return null;
  let value=text.slice(at+mark.length,end).replace(/\n/g,' ');
  if(/^ .* $/.test(value)&&value.trim())value=value.slice(1,-1);
  return {end:end+mark.length,text:value};
 }
 function linkAt(text,at){
  const image=text[at]==='!'&&text[at+1]==='[',start=at+(image?1:0);if(text[start]!=='[')return null;
  let close=start+1,depth=1;
  for(;close<text.length;close++){
   if(text[close]==='\\'){close++;continue;}
   if(text[close]==='[')depth++;if(text[close]===']'&&!--depth)break;
  }
  if(depth||text[close+1]!=='(')return null;
  let end=close+2;depth=1;let quote='';
  for(;end<text.length;end++){
   const ch=text[end];if(ch==='\\'){end++;continue;}
   if(quote){if(ch===quote)quote='';continue;}
   if((ch==='"'||ch==="'")&&/\s/.test(text[end-1])){quote=ch;continue;}
   if(ch==='(')depth++;if(ch===')'&&!--depth)break;
  }
  if(depth)return null;
  const body=text.slice(close+2,end).trim();
  const target=body.match(/^<([^>]*)>(?:\s+["']([\s\S]*)["'])?$/)||body.match(/^(\S*?)(?:\s+["']([\s\S]*)["'])?$/);
  if(!target)return null;
  return {image,label:text.slice(start+1,close),target:unescape(target[1]),title:target[2]===undefined?null:unescape(target[2]),end:end+1,raw:text.slice(at,end+1)};
 }
 function resolve(target,from){
  const value=String(target).trim();
  if(/[\u0000-\u001f\u007f]/.test(value))return {kind:'unsafe'};
  const scheme=value.match(/^([a-z][a-z0-9+.-]*):/i);
  if(scheme)return /^(https?|mailto|tel)$/i.test(scheme[1])?{kind:'external',href:value}:{kind:'unsafe'};
  if(value.startsWith('//'))return {kind:'external',href:value};
  if(value.startsWith('/')||value.startsWith('\\'))return {kind:'outside'};
  const hashAt=value.indexOf('#'),hash=hashAt<0?'':value.slice(hashAt),withoutHash=hashAt<0?value:value.slice(0,hashAt);
  const queryAt=withoutHash.indexOf('?'),query=queryAt<0?'':withoutHash.slice(queryAt);
  let file=queryAt<0?withoutHash:withoutHash.slice(0,queryAt);
  try{file=decodeURIComponent(file);}catch{return {kind:'unsafe'};}
  if(/[\u0000-\u001f\u007f]/.test(file)||file.startsWith('/')||file.startsWith('\\'))return {kind:'outside'};
  const parts=file?String(from||'').split('/').slice(0,-1):[],input=file?file.replace(/\\/g,'/').split('/'):String(from||'').split('/');
  for(const part of input){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)return {kind:'outside'};parts.pop();}else parts.push(part);}
  return {kind:'local',path:parts.join('/'),query,hash};
 }
 function links(text){
  const result=[];let fence=null;
  for(const line of String(text).replace(/\r\n?/g,'\n').split('\n')){
   const mark=line.match(/^ {0,3}(`{3,}|~{3,})/);
   if(fence){if(mark&&mark[1][0]===fence[0]&&mark[1].length>=fence.length&&line.slice(mark[0].length).trim()==='')fence=null;continue;}
   if(mark){fence=mark[1];continue;}
   for(let at=0;at<line.length;){
    if(line[at]==='\\'){at+=2;continue;}
    const code=line[at]==='`'&&codeSpan(line,at);if(code){at=code.end;continue;}
    const link=linkAt(line,at);if(link){result.push({target:link.target,image:link.image});at=link.end;}else at++;
   }
  }
  return result;
 }
 function plain(text,depth=0){
  if(depth>20)return text;
  let result='';
  for(let at=0;at<text.length;){
   const link=linkAt(text,at);if(link){result+=plain(link.label,depth+1);at=link.end;continue;}
   const code=text[at]==='`'&&codeSpan(text,at);if(code){result+=code.text;at=code.end;continue;}
   if(text[at]==='\\'&&at+1<text.length){result+=text[at+1];at+=2;continue;}
   const mark=text.startsWith('**',at)?'**':text.startsWith('__',at)?'__':/[*_]/.test(text[at])?text[at]:null;
   if(mark&&!(mark==='_'&&/[\p{L}\p{N}]/u.test(text[at-1]||''))){
    const end=text.indexOf(mark,at+mark.length);
    if(end>at+mark.length&&!/\s/.test(text[at+mark.length])&&!/\s/.test(text[end-1])){result+=plain(text.slice(at+mark.length,end),depth+1);at=end+mark.length;continue;}
   }
   result+=text[at++];
  }
  return result.trim();
 }
 function render(source,options={}){
  const current=options.path||'',docPaths=new Set((options.docs||[]).map(doc=>doc.path)),headings=[],usedIds=new Set();
  if(current)docPaths.add(current);
  function inline(text,allowLinks=true,depth=0){
   if(depth>20)return escape(text);
   let html='';
   for(let at=0;at<text.length;){
    if(text[at]==='\\'&&/[\\`*{}\[\]()#+.!_|>~-]/.test(text[at+1]||'')){html+=escape(text[at+1]);at+=2;continue;}
    const code=text[at]==='`'&&codeSpan(text,at);if(code){html+='<code>'+escape(code.text)+'</code>';at=code.end;continue;}
    const link=allowLinks&&linkAt(text,at);
    if(link){
     const dest=resolve(link.target,current),title=link.title===null?'':' title="'+escape(link.title)+'"';let href='';
     if(dest.kind==='external'&&(!link.image||/^(https?:)?\/\//i.test(dest.href)))href=dest.href;
     if(dest.kind==='local')href=!link.image&&docPaths.has(dest.path)?'#docs/'+encodePath(dest.path.replace(/^docs\//,''))+dest.hash:'../'+encodePath(dest.path)+dest.query+dest.hash;
     if(!href)html+=escape(link.raw);
     else if(link.image)html+='<a href="'+escape(href)+'" class="docs-image-link"><img src="'+escape(href)+'" alt="'+escape(plain(link.label))+'"'+title+' loading="lazy"></a>';
     else html+='<a href="'+escape(href)+'"'+title+'>'+inline(link.label,false,depth+1)+'</a>';
     at=link.end;continue;
    }
    const mark=text.startsWith('**',at)?'**':text.startsWith('__',at)?'__':/[*_]/.test(text[at])?text[at]:null;
    if(mark&&!(mark==='_'&&/[\p{L}\p{N}]/u.test(text[at-1]||''))){
     const end=text.indexOf(mark,at+mark.length);
     if(end>at+mark.length&&!/\s/.test(text[at+mark.length])&&!/\s/.test(text[end-1])){const tag=mark.length===2?'strong':'em';html+='<'+tag+'>'+inline(text.slice(at+mark.length,end),allowLinks,depth+1)+'</'+tag+'>';at=end+mark.length;continue;}
    }
    html+=escape(text[at++]);
   }
   return html;
  }
  const listMatch=line=>{const match=line.match(/^(\s*)([-+*]|\d+[.)])\s+(.*)$/);return match?{indent:match[1].replace(/\t/g,'    ').length,ordered:/\d/.test(match[2]),number:parseInt(match[2],10),text:match[3]}:null;};
  const fenceMatch=line=>line.match(/^ {0,3}(`{3,}|~{3,})\s*([^\s]*)[^\n]*$/);
  const rule=line=>/^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line);
  function cells(line){
   let text=line.trim();if(text.startsWith('|'))text=text.slice(1);if(text.endsWith('|')&&!text.endsWith('\\|'))text=text.slice(0,-1);
   const out=[];let cell='',ticks='';
   for(let at=0;at<text.length;at++){
    if(text[at]==='\\'&&at+1<text.length){cell+=text[at]+text[++at];continue;}
    if(text[at]==='`'){const mark=text.slice(at).match(/^`+/)[0];ticks=ticks===mark?'':ticks||mark;cell+=mark;at+=mark.length-1;continue;}
    if(text[at]==='|'&&!ticks){out.push(cell.trim());cell='';}else cell+=text[at];
   }
   out.push(cell.trim());return out;
  }
  const tableRule=line=>{if(!line||!line.includes('|'))return null;const values=cells(line);return values.length&&values.every(value=>/^:?-{3,}:?$/.test(value))?values:null;};
  const startsBlock=(lines,at)=>/^(?: {0,3}#{1,6}\s| {0,3}>)/.test(lines[at])||fenceMatch(lines[at])||rule(lines[at])||listMatch(lines[at])||(at+1<lines.length&&lines[at].includes('|')&&tableRule(lines[at+1]));
  function blocks(lines){
   let html='',at=0;
   function list(start){
    const first=listMatch(lines[start]),tag=first.ordered?'ol':'ul';let out='<'+tag+(first.ordered&&first.number!==1?' start="'+first.number+'"':'')+'>';let next=start;
    while(next<lines.length){
     const item=listMatch(lines[next]);if(!item||item.indent!==first.indent||item.ordered!==first.ordered)break;
     out+='<li>'+inline(item.text);next++;
     while(next<lines.length){
      if(!lines[next].trim()){
       let look=next+1;while(look<lines.length&&!lines[look].trim())look++;
       const following=look<lines.length&&listMatch(lines[look]);
       if(following&&following.indent>=first.indent){next=look;continue;}break;
      }
      const nested=listMatch(lines[next]);
      if(nested&&nested.indent>first.indent){const child=list(next);out+=child.html;next=child.next;continue;}
      if(nested||lines[next].match(/^\s*/)[0].length<=first.indent)break;
      out+='\n'+inline(lines[next].trim());next++;
     }
     out+='</li>';
    }
    return {html:out+'</'+tag+'>',next};
   }
   while(at<lines.length){
    const line=lines[at];if(!line.trim()){at++;continue;}
    const fence=fenceMatch(line);
    if(fence){
     const code=[];at++;while(at<lines.length&&!new RegExp('^ {0,3}'+fence[1][0]+'{'+fence[1].length+',}\\s*$').test(lines[at]))code.push(lines[at++]);
     if(at<lines.length)at++;const language=fence[2].replace(/[^a-z0-9_-]/gi,'');
     html+='<pre><code'+(language?' class="language-'+language+'"':'')+'>'+escape(code.join('\n')+(code.length?'\n':''))+'</code></pre>';continue;
    }
    const heading=line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*$/);
    if(heading)heading[2]=heading[2].replace(/\s+#+$/, '');
    if(heading){
     const text=plain(heading[2]),base=text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\s-]/gu,'').trim().replace(/\s+/g,'-')||'section';let id=base,index=2;while(usedIds.has(id))id=base+'-'+index++;usedIds.add(id);
     headings.push({id,text,level:heading[1].length});html+='<h'+heading[1].length+' id="'+escape(id)+'">'+inline(heading[2])+'</h'+heading[1].length+'>';at++;continue;
    }
    if(rule(line)){html+='<hr>';at++;continue;}
    if(/^ {0,3}>/.test(line)){const quote=[];while(at<lines.length&&/^ {0,3}>/.test(lines[at]))quote.push(lines[at++].replace(/^ {0,3}> ?/,''));html+='<blockquote>'+blocks(quote)+'</blockquote>';continue;}
    const aligns=at+1<lines.length&&line.includes('|')&&tableRule(lines[at+1]);
    if(aligns){
     const row=cells(line),style=index=>aligns[index]?.startsWith(':')&&aligns[index]?.endsWith(':')?' style="text-align:center"':aligns[index]?.endsWith(':')?' style="text-align:right"':aligns[index]?.startsWith(':')?' style="text-align:left"':'';
     html+='<table><thead><tr>'+row.map((cell,index)=>'<th'+style(index)+'>'+inline(cell)+'</th>').join('')+'</tr></thead><tbody>';at+=2;
     while(at<lines.length&&lines[at].trim()&&lines[at].includes('|')){const values=cells(lines[at++]);html+='<tr>'+row.map((_,index)=>'<td'+style(index)+'>'+inline(values[index]||'')+'</td>').join('')+'</tr>';}
     html+='</tbody></table>';continue;
    }
    if(listMatch(line)){const result=list(at);html+=result.html;at=result.next;continue;}
    const paragraph=[line];at++;while(at<lines.length&&lines[at].trim()&&!startsBlock(lines,at))paragraph.push(lines[at++]);html+='<p>'+inline(paragraph.join('\n'))+'</p>';
   }
   return html;
  }
  const html=blocks(String(source).replace(/\r\n?/g,'\n').split('\n'));
  return {html,headings};
 }
 const api={render,links,resolve};if(root)root.PBMarkdown=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:null);
