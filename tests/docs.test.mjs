import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TOOL=path.join(ROOT,'tools/docs.mjs');
const RENDERER=path.join(ROOT,'workbench/js/app/markdown.js');
function render(text,options={}){
 assert.ok(fs.existsSync(RENDERER),'Markdown renderer is available');
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(RENDERER,'utf8'),sandbox);
 assert.equal(typeof sandbox.window.PBMarkdown?.render,'function');
 return sandbox.window.PBMarkdown.render(text,{path:'docs/design/first.md',docs:[{path:'docs/design/first.md'},{path:'docs/design/next.md'}],...options});
}
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pb-docs-'));
 const write=(name,text)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
 write('docs/design/z-last.md','# Last\n\n[First](a-first.md#start)\n');
 write('docs/design/a-first.md','# First\n\n![image](images/sample.png)\n');
 write('docs/design/images/sample.png','public fixture image');
 write('docs/design/gameplay/loop.md','# Loop\n');
 write('docs/design/future/note.md','No heading here.\n');
 return {root,write,run:command=>spawnSync(process.execPath,[TOOL,command,'--root',root],{encoding:'utf8'}),clean:()=>fs.rmSync(root,{recursive:true,force:true})};
}
function readBundle(root){const box={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'workbench/data/docs.js'),'utf8'),box);return JSON.parse(JSON.stringify(box.window.PB_DOCS));}

test('build scans nested documents, assigns groups and stable paths, and preserves identical output mtime',()=>{
 const f=fixture();try{
  const first=f.run('build');assert.equal(first.status,0,first.stderr);
  const output=path.join(f.root,'workbench/data/docs.js'),data=readBundle(f.root);
  assert.deepEqual(data.docs.map(({path,group,title})=>({path,group,title})),[
   {path:'docs/design/a-first.md',group:'美术与界面',title:'First'},
   {path:'docs/design/z-last.md',group:'美术与界面',title:'Last'},
   {path:'docs/design/gameplay/loop.md',group:'玩法设计',title:'Loop'},
   {path:'docs/design/future/note.md',group:'future',title:'note'},
  ]);
  assert.equal(data.docs[0].text,'# First\n\n![image](images/sample.png)\n');
  const before=fs.statSync(output).mtimeMs;assert.equal(f.run('build').status,0);assert.equal(fs.statSync(output).mtimeMs,before);
  assert.equal(f.run('check').status,0);
 }finally{f.clean();}
});

test('check rejects a missing bundle and documents changed after the last build',()=>{
 const f=fixture();try{
  let check=f.run('check');assert.notEqual(check.status,0);assert.match(check.stderr,/bundle|build|构建/i);
  assert.equal(f.run('build').status,0);
  f.write('docs/design/a-first.md','# Changed\n');check=f.run('check');assert.notEqual(check.status,0);assert.match(check.stderr,/stale|build|陈旧|构建/i);
  assert.equal(f.run('build').status,0);assert.equal(f.run('check').status,0);
 }finally{f.clean();}
});

test('check detects missing local links and images while ignoring code examples and external URLs',()=>{
 const f=fixture();try{
  f.write('docs/design/a-first.md','# First\n\n[broken](missing.md#part) ![broken image](images/missing.png)\n\n```jsonc\n{"example":"[fake](not-a-link.md)"}\n```\n\n`[also fake](not-a-link-2.md)` [web](https://example.test/not-in-repo)\n');
  assert.equal(f.run('build').status,0);const check=f.run('check');assert.notEqual(check.status,0);assert.match(check.stderr,/missing\.md/);assert.match(check.stderr,/images\/missing\.png/);assert.doesNotMatch(check.stderr,/not-a-link|example\.test/);
 }finally{f.clean();}
});

test('check only warns about repository escapes and validates URL-encoded local paths',()=>{
 const f=fixture();try{
  f.write('docs/design/a-first.md','# First\n\n[game](../../../private-game/design.md) [spaced](images/hello%20world.png)\n');
  f.write('docs/design/images/hello world.png','fixture');assert.equal(f.run('build').status,0);
  const check=f.run('check');assert.equal(check.status,0,check.stderr);assert.match(check.stderr,/warn|警告/i);assert.match(check.stderr,/private-game/);
 }finally{f.clean();}
});

test('headings return a unique readable table of contents including formatted text',()=>{
 const result=render('# One\n\n## **重复** 标题\n\n## 重复 标题\n\n## one\n\n## one-2\n\n## one');
 assert.deepEqual(JSON.parse(JSON.stringify(result.headings)),[
  {id:'one',text:'One',level:1},{id:'重复-标题',text:'重复 标题',level:2},{id:'重复-标题-2',text:'重复 标题',level:2},
  {id:'one-2',text:'one',level:2},{id:'one-2-2',text:'one-2',level:2},{id:'one-3',text:'one',level:2},
 ]);
 assert.match(result.html,/<h2 id="重复-标题"><strong>重复<\/strong> 标题<\/h2>/);
});

test('paragraphs, emphasis, inline code and separators render without interpreting HTML',()=>{
 const {html}=render('A **bold** and *italic*, __strong__ and _emphasis_ with `a < b & c`.\nsecond line\n\n---\n\n<script>alert("x")</script> <img src=x onerror=alert(1)>');
 assert.match(html,/<p>A <strong>bold<\/strong> and <em>italic<\/em>, <strong>strong<\/strong> and <em>emphasis<\/em> with <code>a &lt; b &amp; c<\/code>\.\s+second line<\/p>/);
 assert.match(html,/<hr\s*\/?\s*>/);assert.match(html,/&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);assert.doesNotMatch(html,/<script|<img src=x|onerror="/);
});

test('fenced jsonc code preserves literal Markdown and escapes code characters',()=>{
 const {html}=render('```jsonc\n{ "html": "<script>", "link": "[x](missing.md)" }\n```');
 assert.match(html,/<pre><code class="language-jsonc">\{ &quot;html&quot;: &quot;&lt;script&gt;&quot;, &quot;link&quot;: &quot;\[x\]\(missing\.md\)&quot; \}\n<\/code><\/pre>/);assert.doesNotMatch(html,/<a |<script/);
});

test('ordered and unordered lists retain nested lists inside their parent items',()=>{
 const {html}=render('1. First\n   - Child **one**\n   - Child two\n2. Second\n\n- Parent\n  1. Nested\n  2. Again\n- Last');
 assert.match(html,/<ol><li>First<ul><li>Child <strong>one<\/strong><\/li><li>Child two<\/li><\/ul><\/li><li>Second<\/li><\/ol>/);
 assert.match(html,/<ul><li>Parent<ol><li>Nested<\/li><li>Again<\/li><\/ol><\/li><li>Last<\/li><\/ul>/);
});

test('tables render header/body cells, escaped pipes and alignment without splitting inline code',()=>{
 const {html}=render('| Name | Value |\n| :--- | ---: |\n| **One** | `a|b` |\n| x\\|y | <tag> |');
 assert.match(html,/<table><thead><tr><th[^>]*>Name<\/th><th[^>]*>Value<\/th><\/tr><\/thead><tbody>/);assert.match(html,/<strong>One<\/strong>/);assert.match(html,/<code>a\|b<\/code>/);assert.match(html,/>x\|y<\/td>/);assert.match(html,/&lt;tag&gt;/);assert.equal((html.match(/<td\b/g)||[]).length,4);
});

test('blockquotes render multiline paragraphs and nested list content',()=>{
 const {html}=render('> A **note**\n> on two lines\n>\n> - quoted list');
 assert.match(html,/<blockquote><p>A <strong>note<\/strong>\s+on two lines<\/p><ul><li>quoted list<\/li><\/ul><\/blockquote>/);
});

test('links resolve documents, fragments and files from the current document directory',()=>{
 const {html}=render('[Next](next.md#details) [Here](#one) [File](../../workbench/index.html) [Web](https://example.test?a=1&b=2) [Outside](../../../game/plan.md)');
 assert.match(html,/<a href="#docs\/design\/next\.md#details">Next<\/a>/);assert.match(html,/<a href="#docs\/design\/first\.md#one">Here<\/a>/);assert.match(html,/<a href="\.\.\/workbench\/index\.html">File<\/a>/);assert.match(html,/href="https:\/\/example\.test\?a=1&amp;b=2"/);assert.match(html,/\[Outside\]\(\.\.\/\.\.\/\.\.\/game\/plan\.md\)/);
});

test('images resolve relative URLs and unsafe links and image protocols stay inert',()=>{
 const {html}=render('![Palette](images/palette.png "Art") [bad](javascript:alert(1)) ![bad](data:image/svg+xml;base64,AAAA) [bad2](vbscript:msgbox(1))');
 assert.match(html,/<a href="\.\.\/docs\/design\/images\/palette\.png"[^>]*><img src="\.\.\/docs\/design\/images\/palette\.png" alt="Palette" title="Art"[^>]*><\/a>/);assert.doesNotMatch(html,/(href|src)="(?:javascript|data|vbscript):/i);
});

test('Markdown destinations support balanced parentheses and HTML attribute escaping',()=>{
 const {html}=render('[Diagram](images/diagram(1).png "A & B") ["quoted"](next.md)');
 assert.match(html,/href="\.\.\/docs\/design\/images\/diagram\(1\)\.png" title="A &amp; B"/);assert.match(html,/>&quot;quoted&quot;<\/a>/);
});

test('heading text preserves literal underscores and hashes while removing only Markdown decoration',()=>{
 const result=render('# C#\n\n## `snake_case` and **bold_text** ##\n\n## plain_word');
 assert.deepEqual(JSON.parse(JSON.stringify(result.headings)).map(item=>item.text),['C#','snake_case and bold_text','plain_word']);
 assert.match(result.html,/<h1 id="c">C#<\/h1>/);
});
