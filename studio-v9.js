(() => {
"use strict";
(function(root){
const jp=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
function separate(text){if(!jp.test(text)&&!/^\s*(?:English|Japanese|Translation)\s*[:：]?\s*$/im.test(text)&&!/^\s*(?:sources?|references?)\s*[:：]/im.test(text))return {text:String(text).trim()};const en=[];for(let line of String(text).split(/\r?\n/)){line=line.trim();if(!line){if(en.length&&en[en.length-1]!=='')en.push('');continue}if(/^(?:出典|参考文献|source|references?)\s*[:：]/i.test(line)||/^(?:英語|英文|日本語|和訳|English|Japanese|Translation)\s*[:：]?$/i.test(line)||/^\d+[.)．]?\s*$/.test(line))continue;line=line.replace(/^\d+[.)．]\s*/,'');const parts=line.match(/[^。！？]+[。！？]*|[。！？]+/g) || [];for(const part of parts){const s=part.trim();if(!s)continue;if(jp.test(s)){const lead=s.match(/^(.+?[.!?])\s*(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/u);if(lead){en.push(lead[1]);}}else if(/[A-Za-z]/.test(s))en.push(s)}}return {text:en.join('\n').replace(/\n{3,}/g,'\n\n').trim()}}
function prepare(text,split,splitter){const clean=separate(text).text;return !clean?[]:(split?splitter(clean):[clean]).map(text=>({text}));}
root.Bilingual={separate,prepare};})(window);
function splitArticle(text) {
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('en', {granularity: 'sentence'}) : null;
  const units = [];
  for (const paragraph of text.trim().split(/\r?\n(?:[^\S\r\n]*\r?\n)+/)) {
    const sentences = segmenter
      ? Array.from(segmenter.segment(paragraph), item => item.segment)
      : (paragraph.match(/[^.!?]*[.!?]+(?:[”’'\"])?|[^.!?]+$/g) || [paragraph]);
    for (const [index, sentence] of sentences.entries()) {
      const separator = units.length && index === 0 ? '\n\n' : '';
      units.push({text: separator + sentence, count: tokens(sentence).length, paragraphEnd: index === sentences.length - 1});
    }
  }

  // Find the best set of boundaries for the whole article, so a short tail
  // can be rebalanced with an earlier chunk instead of being split blindly.
  const costs = new Array(units.length + 1).fill(Infinity);
  const next = new Array(units.length);
  costs[units.length] = 0;
  for (let start = units.length - 1; start >= 0; start--) {
    let count = 0;
    for (let end = start; end < units.length; end++) {
      count += units[end].count;
      if (count > 160 && end > start) break;
      const deviation = Math.max(0, 40 - count, count - 80);
      const penalty = deviation ? 1000 + deviation ** 2 : 0;
      const boundaryCost = units[end].paragraphEnd ? 0 : 18;
      const total = penalty + boundaryCost + (count - 60) ** 2 / 100 + costs[end + 1];
      if (total < costs[start]) {
        costs[start] = total;
        next[start] = end + 1;
      }
    }
  }
  const chunks = [];
  for (let start = 0; start < units.length; start = next[start]) {
    const chunk = units.slice(start, next[start]).map(unit => unit.text).join('').trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

function splitSentences(text){const seg=typeof Intl.Segmenter==='function'?new Intl.Segmenter('en',{granularity:'sentence'}):null;return text.split(/\r?\n/).flatMap(line=>seg?Array.from(seg.segment(line),x=>x.segment.trim()):(line.match(/[^.!?]+(?:[.!?]+|$)/g)||[]).map(x=>x.trim())).filter(Boolean)}

window.ReadingCompare=(()=>{
const nums='zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(' ');
const contractions={"can't":"cannot","won't":"willnot","shan't":"shallnot","i'm":"iam","let's":"letus"};
function norm(x){x=x.toLowerCase().replace(/[’‘]/g,"'");if(/^\d+$/.test(x)&&+x<nums.length)return nums[+x];return (contractions[x]||x.replace(/n't$/,'not').replace(/'re$/,'are').replace(/'ve$/,'have').replace(/'ll$/,'will').replace(/'m$/,'am')).replace(/[-']/g,'');}
const equal=(a,b)=>norm(a)===norm(b);
function compare(ref,heard){const a=ref.map(norm),b=heard.map(norm),n=a.length,m=b.length,w=m+1,trace=new Uint8Array((n+1)*w);let prev2=null,prev=Float64Array.from({length:w},(_,j)=>j);for(let j=1;j<=m;j++)trace[j]=3;for(let i=1;i<=n;i++){const curr=new Float64Array(w);curr[0]=i;trace[i*w]=2;for(let j=1;j<=m;j++){let cost=prev[j-1]+(a[i-1]===b[j-1]?0:1),op=1;function take(v,k){if(v<cost){cost=v;op=k}}take(prev[j]+1,2);take(curr[j-1]+1,3);if(j>=2&&a[i-1]===b[j-2]+b[j-1])take(prev[j-2],4);if(i>=2&&a[i-2]+a[i-1]===b[j-1])take(prev2[j-1],5);curr[j]=cost;trace[i*w+j]=op;}prev2=prev;prev=curr;}const ops=[];let i=n,j=m;while(i||j){const op=trace[i*w+j];if(op===1){ops.push({r:i-1,rc:1,h:j-1,hc:1,ok:a[i-1]===b[j-1]});i--;j--}else if(op===2){ops.push({r:i-1,rc:1,h:j,hc:0,ok:false});i--}else if(op===3){ops.push({r:i,rc:0,h:j-1,hc:1,ok:false});j--}else if(op===4){ops.push({r:i-1,rc:1,h:j-2,hc:2,ok:true});i--;j-=2}else if(op===5){ops.push({r:i-2,rc:2,h:j-1,hc:1,ok:true});i-=2;j--}else throw Error('alignment');}return ops.reverse();}
function evaluate(sentences,heard){const ref=sentences.flatMap(s=>s.words),ops=compare(ref,heard),owner=[];sentences.forEach((s,k)=>s.words.forEach(()=>owner.push(k)));const rows=sentences.map(s=>({accepted:0,missing:[],parts:[],total:s.words.length}));for(const o of ops){const k=owner[Math.min(o.r,ref.length-1)]??0,row=rows[k];if(!row)continue;if(o.ok)for(let d=0;d<o.rc;d++)rows[owner[o.r+d]].accepted++;if(!o.hc)row.missing.push(ref[o.r]);for(let d=0;d<o.hc;d++)row.parts.push({word:heard[o.h+d],different:!o.ok});}return {rows,score:Math.round(100*rows.reduce((s,r)=>s+r.accepted,0)/Math.max(1,ref.length))};}
return {evaluate,norm};})();

const dictionaryURL = new URL('./pronunciation-dictionary.js', document.currentScript.src).href;
let dictionaryRequest;
function loadPronunciationDictionary() {
  if (window.CMU_DICT) return Promise.resolve(window.CMU_DICT);
  if (!dictionaryRequest) {
    dictionaryRequest = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = dictionaryURL;
      function finish() {
        clearTimeout(timeout);
        script.remove();
        if (window.CMU_DICT) resolve(window.CMU_DICT);
        else reject(new Error('dictionary'));
      }
      const timeout = setTimeout(finish, 15000);
      script.onload = script.onerror = finish;
      document.head.append(script);
    }).catch(error => {
      dictionaryRequest = undefined;
      throw error;
    });
  }
  return dictionaryRequest;
}

(()=>{
const m={AA:'ɑ',AE:'æ',AH:'ʌ',AO:'ɔ',AW:'aʊ',AY:'aɪ',B:'b',CH:'tʃ',D:'d',DH:'ð',EH:'ɛ',ER:'ɝ',EY:'eɪ',F:'f',G:'ɡ',HH:'h',IH:'ɪ',IY:'i',JH:'dʒ',K:'k',L:'l',M:'m',N:'n',NG:'ŋ',OW:'oʊ',OY:'ɔɪ',P:'p',R:'ɹ',S:'s',SH:'ʃ',T:'t',TH:'θ',UH:'ʊ',UW:'u',V:'v',W:'w',Y:'j',Z:'z',ZH:'ʒ'};
const vowel=/[012]$/;const weak={and:'AH0 N',to:'T AH0',of:'AH0 V',a:'AH0',an:'AH0 N',was:'W AH0 Z',for:'F ER0',can:'K AH0 N',the:'DH AH0'};
const functionWords=new Set('a an the and or but of to for in on at by with from as is am are was were be been being it its he she they we you i my your his her their our that this these those can could would should will have has had do does did when where which who'.split(' '));
const letters={A:'EY1',B:'B IY1',C:'S IY1',D:'D IY1',E:'IY1',F:'EH1 F',G:'JH IY1',H:'EY1 CH',I:'AY1',J:'JH EY1',K:'K EY1',L:'EH1 L',M:'EH1 M',N:'EH1 N',O:'OW1',P:'P IY1',Q:'K Y UW1',R:'AA1 R',S:'EH1 S',T:'T IY1',U:'Y UW1',V:'V IY1',W:'D AH1 B AH0 L Y UW0',X:'EH1 K S',Y:'W AY1',Z:'Z IY1'};
const initialisms=new Set('AI US USA UK EU UN BBC CNN FBI CIA CEO DNA RNA GPS USB HTML PDF IT TV PC GPU CPU WHO'.split(' '));
function lookup(w){if(initialisms.has(w)){return [...w].map((c,i)=>letters[c].replace(/1/g,i===w.length-1?'1':'2')).join(' ')}return window.CMU_DICT?.[w.toLowerCase().replace(/’/g,"'")]?.[0]||''}
function ipa(p){const a=p.split(' '),n=a.filter(x=>vowel.test(x)).length,marks={};let prev=-1;for(let i=0;i<a.length;i++)if(vowel.test(a[i])){let j=prev+1;if(prev>=0)j=Math.max(j,i-1);if(n>1&&a[i].endsWith('1'))marks[j]='ˈ';if(n>1&&a[i].endsWith('2'))marks[j]='ˌ';prev=i}return a.map((x,i)=>(marks[i]||'')+(x==='AH0'?'ə':x==='ER0'?'ɚ':m[x.replace(/[012]$/,'')]||x)).join('')}
// Orthographic syllables are heuristic; if spelling cannot be aligned, keep the word intact.
function highlight(w,p){if(!p||functionWords.has(w.toLowerCase()))return document.createTextNode(w);const nuclei=p.split(' ').filter(x=>vowel.test(x));let start=0,end=w.length;const groups=[...w.matchAll(/[aeiouy]+/gi)];if(nuclei.length>1){if(groups.length===nuclei.length+1&&/e$/i.test(w))groups.pop();const idx=nuclei.findIndex(x=>x.endsWith('1'));if(groups.length!==nuclei.length||idx<0)return document.createTextNode(w);const g=groups[idx];start=idx===0?0:Math.max(groups[idx-1].index+groups[idx-1][0].length,g.index-1);end=idx===groups.length-1?w.length:Math.max(g.index+g[0].length,groups[idx+1].index-1)}const frag=document.createDocumentFragment(),strong=document.createElement('strong');strong.textContent=w.slice(start,end).toUpperCase();frag.append(w.slice(0,start),strong,w.slice(end));return frag}
window.addPronunciationGuide=function(col,text){const b=document.createElement('button');b.type='button';b.textContent='IPA・発音ガイド';b.className='model-speech';const panel=document.createElement('div');panel.hidden=true;panel.style.cssText='margin-top:8px;padding:14px;background:#e9eeef;border-radius:9px;overflow-wrap:anywhere';b.setAttribute('aria-expanded','false');b.onclick=async()=>{
panel.hidden=!panel.hidden;
b.setAttribute('aria-expanded',String(!panel.hidden));
if(panel.hidden||panel.dataset.ready)return;
b.disabled=true;
panel.textContent='発音辞書を読み込み中…';
try { await loadPronunciationDictionary(); } catch {
  panel.textContent='発音辞書を読み込めなかった。もう一度開いて再試行できる。';
  return;
} finally { b.disabled=false; }
panel.textContent='';
panel.dataset.ready='1';
const parts=text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*|[0-9]+(?:[.,][0-9]+)*|[^\w\s]/g)||[],entries=parts.map(lookup);const heading=t=>{const h=document.createElement('b');h.textContent=t;return h};const line=document.createElement('div'),phon=document.createElement('div');line.style.cssText='font-size:1.05em;line-height:1.9;margin:8px 0 16px';phon.style.cssText='font-size:1.2em;line-height:1.9;margin-top:8px';let group=[],join=false;function flush(){if(!group.length)return;const row=document.createElement('div');row.textContent='/'+group.join('')+'/';phon.append(row);group=[];join=false}parts.forEach((w,i)=>{const p=entries[i],next=entries[i+1],k=w.toLowerCase(),pause=/^[,;:.!?]$/.test(w);if(pause){line.append(w,/^[.!?]$/.test(w)?' //':' /',document.createElement('br'));flush();return}if(i&&!/^[,;:.!?]$/.test(parts[i-1]))line.append(' ');line.append(highlight(w,p));let q=weak[k]||p;if(k==='the'&&next&&vowel.test(next.split(' ')[0]))q='DH IY0';const value=q?ipa(q):'['+w+']';group.push((group.length?(join?'‿':' '):'')+value);join=!!(q&&next&&!vowel.test(q.slice(q.lastIndexOf(' ')+1))&&vowel.test(next.split(' ')[0]));});flush();panel.append(heading('① 強勢・意味のまとまり（推定）'),line,heading('② 米語IPA'),phon);};col.append(b,panel);};
})();

(() => {
  'use strict';
  const vowels={AA:'ア',AE:'ア',AH:'ア',AO:'オー',AW:'アウ',AY:'アイ',EH:'エ',ER:'アー',EY:'エイ',IH:'イ',IY:'イー',OW:'オウ',OY:'オイ',UH:'ウ',UW:'ウー'};
  const c={B:'ブ',CH:'チ',D:'ド',DH:'ズ',F:'フ',G:'グ',HH:'ハ',JH:'ジ',K:'ク',L:'ル',M:'ム',N:'ン',NG:'ング',P:'プ',R:'ル',S:'ス',SH:'シュ',T:'ト',TH:'ス',V:'ヴ',W:'ウ',Y:'イ',Z:'ズ',ZH:'ジュ'};
  const rows={B:'バ ビ ブ ベ ボ',D:'ダ ディ ドゥ デ ド',F:'ファ フィ フ フェ フォ',G:'ガ ギ グ ゲ ゴ',HH:'ハ ヒ フ ヘ ホ',K:'カ キ ク ケ コ',L:'ラ リ ル レ ロ',M:'マ ミ ム メ モ',N:'ナ ニ ヌ ネ ノ',P:'パ ピ プ ペ ポ',R:'ラ リ ル レ ロ',S:'サ スィ ス セ ソ',SH:'シャ シ シュ シェ ショ',T:'タ ティ トゥ テ ト',TH:'サ スィ ス セ ソ',DH:'ザ ズィ ズ ゼ ゾ',V:'ヴァ ヴィ ヴ ヴェ ヴォ',W:'ワ ウィ ウ ウェ ウォ',Y:'ヤ イ ユ イェ ヨ',Z:'ザ ズィ ズ ゼ ゾ',CH:'チャ チ チュ チェ チョ',JH:'ジャ ジ ジュ ジェ ジョ',ZH:'ジャ ジ ジュ ジェ ジョ'};
  const patterns={AA:[0,''],AE:[0,''],AH:[0,''],AO:[4,'ー'],AW:[0,'ウ'],AY:[0,'イ'],EH:[3,''],ER:[0,'ー'],EY:[3,'イ'],IH:[1,''],IY:[1,'ー'],OW:[4,'ウ'],OY:[4,'イ'],UH:[2,''],UW:[2,'ー']};
  const overrides={a:'ア',an:'アン',and:'アン',of:'アヴ',to:'トゥ',for:'ファー',our:'アウア',are:'アー',have:'ハヴ',will:'ウィル',with:'ウィズ',that:'ザット',the:'ザ'};
  function convert(phones){const p=phones.map(x=>x.replace(/[012]/g,'')); let out=''; for(let i=0;i<p.length;i++){const x=p[i],y=p[i+1]; if(rows[x]&&patterns[y]){const [n,end]=patterns[y];out+=rows[x].split(' ')[n]+end;i++;}else out+=vowels[x]||c[x]||'';}return out;}
  async function convertSentence(text){const dict=await loadPronunciationDictionary();const parts=text.match(/[a-zA-Z]+(?:['’][a-zA-Z]+)*|\d+(?:\.\d+)?|[^\s]/g)||[];return parts.map((p,i)=>{if(/^[.!?]$/.test(p))return '//';if(/^[,;:—]$/.test(p))return '/';const w=p.toLowerCase().replace(/’/g,"'");const next=dict[(parts[i+1]||'').toLowerCase().replace(/’/g,"'")]?.[0]?.split(" ");if(w==='the'&&next&&vowels[next[0].replace(/[012]/g,'')])return 'ジ';return overrides[w]||(dict[w]?.[0]?convert(dict[w][0].split(" ")):p);}).join(' ');}
  function addButton(container,sentence){const b=document.createElement('button'),p=document.createElement('p');b.type='button';b.className='model-speech';b.textContent='カタカナ';b.style.marginLeft='8px';b.setAttribute('aria-expanded','false');p.lang='ja';p.hidden=true;Object.assign(p.style,{fontSize:'0.95rem',lineHeight:'1.9',background:'rgba(128,128,128,0.08)',borderRadius:'8px',padding:'10px'});b.onclick=async()=>{p.hidden=!p.hidden;b.setAttribute('aria-expanded',String(!p.hidden));if(p.hidden||p.dataset.loaded)return;b.disabled=true;p.textContent='発音を変換中…';try{p.textContent=await convertSentence(sentence);p.dataset.loaded='true';}catch{p.textContent='発音辞書を読み込めなかった。もう一度開いて再試行できる。';}finally{b.disabled=false;}};container.append(b,p);}
  window.Katakana={convertSentence,addButton};
})();

const $=id=>document.getElementById(id);
function tokens(s){return s.replace(/[’‘]/g,"'").match(/[a-zA-Z0-9]+(?:['-][a-zA-Z0-9]+)*/g)||[]}
const KEY='read-aloud-articles-v1';let articles=[],selected,active=false,stopping=false,started=0,elapsed=0,ticker,session,finalText='',interim='',mode='',stopFallback;
const sampleArticles = [{id:'welcome',title:'A moment to notice',text:'Every day offers a chance to notice something new. On the way to work, we might see a different color in the sky or hear a bird we have never noticed before. These small moments can change the way we experience familiar places.\n\nLearning a language also begins with attention. We listen to the rhythm of a sentence, try a new expression, and discover another way to share an idea. Progress does not always arrive in a dramatic moment. Sometimes, it is simply the feeling that the words come a little more naturally than they did yesterday.'}];
const writeWarning = 'この環境では端末に保存できなかった。このタブを閉じる前に、記事をバックアップしてほしい。';
let storageReadable = false;
function newArticleId() {
  return window.crypto && typeof window.crypto.randomUUID === 'function'
    ? window.crypto.randomUUID() : 'article-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}
function validArticle(article) {
  return article && typeof article.title === 'string' && !!article.title.trim() &&
    typeof article.text === 'string' && tokens(article.text).length > 0 && tokens(article.text).length <= 2000;
}
articles = sampleArticles;
try {
  const raw = localStorage.getItem(KEY);
  storageReadable = true;
  if (raw !== null) {
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) throw new Error('articles');
    articles = saved.filter(validArticle).map(a => ({...a, id: a.id || newArticleId()}));
    if (articles.length !== saved.length) $('storageStatus').textContent = '保存データの一部を読み込めなかった。';
  }
} catch {
  $('storageStatus').textContent = storageReadable
    ? '保存された記事を読み込めなかった。バックアップから復元できる。' : writeWarning;
}
selected = articles[0]?.id;

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(articles));
    $('storageStatus').textContent = '';
    return true;
  } catch {
    $('storageStatus').textContent = writeWarning;
    return false;
  }
}
function current(){return articles.find(a=>a.id===selected)}
function reset(){stopModelSpeech();finalText='';interim='';elapsed=0;$('timer').innerHTML='00:00<span>.0</span>';$('results').hidden=true;$('manualText').value='';$('transcript').textContent='読み上げた英語がここに表示される。';}
function render(){const a=current();$('count').textContent=articles.length;$('articles').replaceChildren();articles.forEach(x=>{const b=document.createElement('button');b.className='article'+(x.id===selected?' selected':'');b.disabled=active||stopping;const title=document.createElement('strong'),meta=document.createElement('span');title.textContent=x.title;meta.textContent=tokens(x.text).length+' WORDS';b.append(title,meta);b.onclick=()=>{selected=x.id;reset();render()};$('articles').append(b)});$('title').textContent=a?.title||'自分の英文で、はじめよう';$('passage').textContent=a?.text||'';$('empty').hidden=!!a;$('words').textContent=a?tokens(a.text).length+' words • English reading':'';['start','timerOnly','delete'].forEach(id=>$(id).disabled=!a||active||stopping);['add','language','import','micTest'].forEach(id=>$(id).disabled=active||stopping);$('stop').disabled=!active;$('manual').hidden=!a||active||stopping;}
$('font').oninput = e => $('passage').style.fontSize = e.target.value + 'px';
function closeEditor() {
  $('editor').hidden = true;
  $('add').focus();
}
$('add').onclick = () => {
  $('articleForm').reset();
  $('formNote').textContent = '英語の文章をそのまま登録できる。';
  $('editor').hidden = false;
  $('newTitle').focus();
};
$('cancel').onclick = closeEditor;
$('editor').onkeydown = e => { if (e.key === 'Escape') closeEditor(); };

$('articleForm').onsubmit = e => {
  e.preventDefault();
  const title = $('newTitle').value.trim();
  const clean = window.Bilingual.separate($('newText').value).text;
  const count = tokens(clean).length;
  if (!title || !count || count > 2000) {
    $('formNote').textContent = 'タイトルと、1〜2,000語の英文を入力してほしい。';
    return;
  }
  const chunks = $('splitArticle').checked ? splitArticle(clean) : [clean];
  const additions = chunks.map((text, index) => {
    const suffix = chunks.length > 1 ? ` (${index + 1}/${chunks.length})` : '';
    return {id: newArticleId(), title: title.slice(0, 120 - suffix.length) + suffix, text};
  });
  articles = [...additions, ...articles];
  selected = additions[0].id;
  const saved = persist();
  reset();
  render();
  closeEditor();
  $('status').textContent = `${additions.length}件の記事を${saved ? '登録した。' : 'このタブに一時登録した。'}`;
};
$('delete').onclick = () => {
  if (!confirm('この記事を削除する？')) return;
  articles = articles.filter(a => a.id !== selected);
  selected = articles[0]?.id;
  const saved = persist();
  reset();
  render();
  $('status').textContent = saved ? '記事を削除した。' : 'このタブの記事一覧から削除した。';
};
$('export').onclick = () => {
  const file = new Blob([JSON.stringify(articles, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'read-aloud-articles.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
function readFile(file) {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
$('import').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const list = JSON.parse(await readFile(file));
    if (active || stopping || !Array.isArray(list) || !list.every(validArticle)) throw new Error('articles');
    articles = [...articles, ...list.map(a => ({id: newArticleId(), title: a.title.slice(0, 120), text: a.text}))];
    selected = selected || articles[0]?.id;
    const saved = persist();
    render();
    $('status').textContent = `${list.length}件の記事を${saved ? '追加した。' : 'このタブに一時追加した。'}`;
  } catch {
    $('status').textContent = 'バックアップを読み込めなかった。記事のJSONファイルを選んでほしい。';
  } finally {
    e.target.value = '';
  }
};
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition,synthesis=window.speechSynthesis;let modelSpeech=null;
function transcript(){ $('transcript').replaceChildren(document.createTextNode(finalText));if(interim){const em=document.createElement('em');em.textContent=' '+interim;$('transcript').append(em)}}
function clock(){elapsed=(performance.now()-started)/1000;const s=Math.floor(elapsed);$('timer').innerHTML=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')+'<span>.'+Math.floor((elapsed%1)*10)+'</span>';const target=Number($('target').value);$('targetNote').textContent=target&&elapsed>=target?'目標時間に到達（計測は継続中）':''}
function mergeRecognition(base, next) {
  const a=tokens(base), b=tokens(next), A=a.map(x=>x.toLowerCase()), B=b.map(x=>x.toLowerCase());
  if(!b.length)return base;
  if(!a.length)return next.trim();
  // Only remove substantial exact overlap, including cumulative browser snapshots.
  for(let k=Math.min(a.length,b.length);k>=3;k--){
    if(A.slice(-k).join(' ')===B.slice(0,k).join(' '))return [...a,...b.slice(k)].join(' ');
  }
  if(b.length>=5 && (' '+A.join(' ')+' ').includes(' '+B.join(' ')+' '))return base;
  return base+' '+next.trim();
}
function appendRecognized(text){if(text.trim())finalText=mergeRecognition(finalText,text).slice(0,24000)}
function usesAppleMobileAudio(){const {userAgent='',platform='',maxTouchPoints=0}=navigator;return /iPad|iPhone|iPod/.test(userAgent)||(platform==='MacIntel'&&maxTouchPoints>1)}
function releaseSession(){const old=session;session=null;if(!old)return;clearTimeout(old.restartTimer);clearTimeout(old.startTimeout);if(old.recognition){old.recognition.onresult=old.recognition.onerror=old.recognition.onstart=old.recognition.onend=null;try{old.recognition.abort()}catch{}}}
function finishModelSpeech(p,message=''){if(modelSpeech!==p)return;clearInterval(p.watchdog);modelSpeech=null;p.button.textContent='米語で聞く';$('modelSpeechStatus').textContent=message}
function stopModelSpeech(){if(!modelSpeech)return;finishModelSpeech(modelSpeech);synthesis.cancel()}
function playModelSpeech(text,button){const was=modelSpeech?.button===button;stopModelSpeech();if(was)return;const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=Number(button.parentElement.querySelector('select.pronunciation-rate')?.value||1);const voices=synthesis.getVoices().filter(v=>/^en[-_]us$/i.test(v.lang)),voice=voices.find(v=>/^(Alex|Fred|Tom|Siri Voice 1|Microsoft (David|Guy))/i.test(v.name))||voices.find(v=>v.default)||voices[0];if(voice)u.voice=voice;const p={button,utterance:u,queuedAt:performance.now(),started:false};modelSpeech=p;button.textContent='読み上げを停止';$('modelSpeechStatus').textContent='';const msg='読み上げを再生できなかった。「米語で聞く」で再試行できる。';u.onstart=()=>p.started=true;u.onend=()=>finishModelSpeech(p);u.onerror=()=>finishModelSpeech(p,msg);p.watchdog=setInterval(()=>{p.started=p.started||(synthesis.speaking&&!synthesis.paused);if(p.started&&!synthesis.speaking&&!synthesis.pending)finishModelSpeech(p);else if(!p.started&&performance.now()-p.queuedAt>=5000){finishModelSpeech(p,msg);synthesis.cancel()}},250);try{if(synthesis.paused)synthesis.resume();synthesis.speak(u)}catch{u.onerror()}}
function renderSentenceScores(sentences,result,recognized){const list=$('sentenceScores');list.replaceChildren();$('modelSpeechStatus').textContent=synthesis&&window.SpeechSynthesisUtterance?'':'このブラウザーでは見本音声の読み上げを利用できない。';for(const [i,s] of sentences.entries()){const row=result.rows[i],matched=row.accepted;const item=document.createElement('li'),score=document.createElement('strong'),columns=document.createElement('div');score.className='sentence-score';score.textContent=`一致率 ${Math.round(100*matched/s.words.length)}%`;columns.className='sentence-columns';for(const [label,value] of [['原文',s.text],['認識された英文',recognized[i]]]){const col=document.createElement('div'),heading=document.createElement('b'),line=document.createElement('p');heading.textContent=label;if(value)line.lang='en';if(label==='原文'){line.textContent=value}else{row.parts.forEach((part,k)=>{if(k)line.append(document.createTextNode(' '));const node=document.createElement(part.different?'strong':'span');node.textContent=part.word;if(part.different)node.style.fontWeight='800';line.append(node)});if(!row.parts.length)line.textContent='対応する認識結果なし';if(row.missing.length){const missing=document.createElement('small');missing.textContent=' 脱落：'+row.missing.join(', ');missing.style.display='block';missing.style.fontWeight='700';line.append(missing)}}col.append(heading,line);if(label==='原文'){const b=document.createElement('button');b.type='button';b.className='model-speech';b.textContent='米語で聞く';b.disabled=!synthesis||!window.SpeechSynthesisUtterance;b.onclick=()=>playModelSpeech(s.text,b);col.append(b);const rate=document.createElement('select');rate.className='pronunciation-rate';rate.setAttribute('aria-label','再生速度');for(const v of [0.7,0.85,1,1.2]){const o=document.createElement('option');o.value=v;o.textContent=v+'倍';o.selected=v===1;rate.append(o)}col.append(rate);window.addPronunciationGuide(col,s.text);window.Katakana.addButton(col,s.text)}columns.append(col)}item.append(score,columns);list.append(item)}}
// Only salvage an unfinished hypothesis once, when its recognizer ends.
function salvage(){if(interim){const p=interim;interim='';appendRecognized(p)}}
function showComparison(input, seconds) {
  const spoken = tokens(input).slice(0, 3000);
  if (!spoken.length) return false;
  const sentences = splitSentences(current().text).map(text => ({text, words: tokens(text)})).filter(s => s.words.length);
  const result = window.ReadingCompare.evaluate(sentences, spoken);
  const recognized = result.rows.map(r => r.parts.map(p => p.word).join(' '));
  $('transcript').textContent = input;
  $('score').textContent = result.score;
  $('wpm').textContent = seconds > 0 ? Math.round(spoken.length * 60 / seconds) : '—';
  renderSentenceScores(sentences, result, recognized);
  $('results').hidden = false;
  return true;
}
function finish() {
  if (!stopping) return;
  clearTimeout(stopFallback);
  const error = session?.error;
  salvage();
  releaseSession();
  stopping = false;
  transcript();
  $('live').textContent = '終了';
  render();
  if (mode === 'timer') {
    $('status').textContent = 'タイマー練習を終了した。「英文を入力して比較」から書き起こしを比較できる。';
    return;
  }
  if (!showComparison(finalText, elapsed)) {
    $('status').textContent = (error || '音声認識の結果が返らなかった。') + ' タイマーや手入力で練習を続けられる。';
    $('manual').open = true;
    return;
  }
  $('status').textContent = error ? error + ' 聞き取れた範囲で集計した。' : '全体と文ごとの一致率を表示した。';
}
$('manualForm').onsubmit = e => {
  e.preventDefault();
  if (!current() || active || stopping) return;
  const ok = showComparison($('manualText').value.trim(), mode === 'timer' ? elapsed : 0);
  $('status').textContent = ok ? '入力した英文を原文と比較した。' : '比較する英文を入力してほしい。';
};
function stop(){if(!active)return;clock();active=false;stopping=true;clearInterval(ticker);clearTimeout(session?.restartTimer);$('status').textContent='最後の認識結果を処理中…';render();const r=session?.recognition;if(!r){finish();return}stopFallback=setTimeout(finish,2500);try{r.stop()}catch{finish()}}
function startClock(){active=true;started=performance.now();ticker=setInterval(clock,100);$('live').textContent=mode==='speech'?'接続中':'タイマー';render()}
function recognitionFailure(reading, message) {
  if (session !== reading || !active) return;
  reading.error = message;
  stop();
}
function startRecognition(reading) {
  if (session !== reading || !active) return;
  let recognizer;
  try {
    recognizer = new Recognition();
    reading.recognition = recognizer;
    recognizer.lang = reading.language;
    recognizer.continuous = !usesAppleMobileAudio();
    recognizer.interimResults = true;
    const valid = () => session === reading && reading.recognition === recognizer;
    const committed = new Set();
    recognizer.onstart = () => {
      if (!valid() || !active) return;
      clearTimeout(reading.startTimeout);
      if (!reading.listeningSince) {
        reading.listeningSince = performance.now();
        started = reading.listeningSince;
      }
      $('live').textContent = '聞き取り中';
      $('status').textContent = '音読を聞き取り中。読み終わったら「終了して比較」。';
    };
    recognizer.onresult = e => {
      if (!valid()) return;
      const pending = [];
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const words = r[0].transcript.trim();
        if (committed.has(i)) continue;
        if (r.isFinal) {
          appendRecognized(words);
          committed.add(i);
        } else if (words) {
          pending.push(words);
        }
      }
      if (committed.size || pending.length) reading.emptyRuns = 0;
      interim = pending.join(' ');
      transcript();
    };
    recognizer.onerror = e => {
      if (!valid() || e.error === 'no-speech' || stopping) return;
      const errors = {
        'not-allowed': 'マイクまたは音声認識へのアクセスが拒否された。サイトのマイク設定を確認してほしい。',
        'audio-capture': 'マイクを利用できない。端末のマイクまたはアプリの許可を確認してほしい。',
        'service-not-allowed': 'このブラウザーでは音声認識サービスを利用できない。',
        network: '音声認識サービスに接続できなかった。'
      };
      recognitionFailure(reading, errors[e.error] || '音声認識が中断された。');
    };
    recognizer.onend = () => {
      if (!valid()) return;
      clearTimeout(reading.startTimeout);
      reading.recognition = null;
      if (stopping) { finish(); return; }
      const gotSpeech = !!(committed.size || interim);
      salvage();
      transcript();
      reading.emptyRuns = gotSpeech ? 0 : reading.emptyRuns + 1;
      if (reading.emptyRuns >= 3) {
        recognitionFailure(reading, '音声が検出されなかった。マイク設定を確認してほしい。');
      } else if (active) {
        reading.restartTimer = setTimeout(() => startRecognition(reading), 250);
      }
    };
    reading.startTimeout = setTimeout(() => recognitionFailure(reading, '音声認識の開始を確認できなかった。'), 12000);
    recognizer.start();
  } catch {
    reading.recognition = null;
    recognitionFailure(reading, '音声認識を開始できなかった。');
  }
}
const inFrame = window.top !== window.self;
function micRestriction() {
  if (window.isSecureContext === false) return '音声認識にはHTTPSの公開URLが必要。';
  const policy = document.permissionsPolicy || document.featurePolicy;
  if (policy?.allowsFeature && !policy.allowsFeature('microphone')) {
    return inFrame ? '埋め込み画面でマイクが制限されている。「別タブで開く」から再試行してほしい。'
      : '公開先の設定でマイクが制限されている。';
  }
  return '';
}
function start(kind) {
  if (active || stopping || !current()) return;
  if (kind === 'speech') {
    const message = micRestriction() || (!Recognition ? 'このブラウザーでは自動音声認識を利用できない。' : '');
    if (message) {
      $('status').textContent = message + ' タイマーや手入力で練習を続けられる。';
      $('manual').open = true;
      return;
    }
  }
  reset();
  mode = kind;
  $('targetNote').textContent = '';
  startClock();
  if (kind === 'timer') {
    $('status').textContent = 'タイマーを計測中。';
    return;
  }
  $('live').textContent = '接続中';
  $('status').textContent = '音声認識を開始中。マイクの確認が出たら許可してほしい。';
  session = {language: $('language').value, emptyRuns: 0};
  startRecognition(session);
}
$('micTest').onclick = async () => {
  const restriction = micRestriction();
  if (restriction || !navigator.mediaDevices?.getUserMedia) {
    $('status').textContent = restriction || 'この環境ではマイク接続を確認できない。';
    return;
  }
  $('status').textContent = 'マイクへのアクセスを確認中…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    stream.getTracks().forEach(track => track.stop());
    if (!active && !stopping) $('status').textContent = 'マイクに接続できた。音声認識API：' + (Recognition ? 'あり' : 'なし');
  } catch (error) {
    if (active || stopping) return;
    const descriptions = {
      NotFoundError: '利用できるマイクが見つからなかった。',
      NotAllowedError: 'マイクへのアクセスが拒否された。',
      NotReadableError: 'マイクを使用できなかった。'
    };
    $('status').textContent = descriptions[error.name] || 'マイクに接続できなかった。';
  }
};
$('openDirect').hidden = !inFrame;
$('openDirect').onclick = () => window.open(location.href, '_blank', 'noopener');
$('start').onclick = () => start('speech');
$('timerOnly').onclick = () => start('timer');
$('stop').onclick = stop;
window.addEventListener('beforeunload', e => {
  if (active || stopping) { e.preventDefault(); e.returnValue = ''; }
});
render();
$('status').textContent = 'マイクを使う音読、またはタイマーで練習できる。';

})();
