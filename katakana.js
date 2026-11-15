(() => {
  'use strict';
  let pending;
  function load() {
    return pending ||= fetch('./cmudict.txt').then(r => {
      if (!r.ok) throw Error('dictionary');
      return r.text();
    }).then(t => {
      const m = new Map();
      for (const line of t.split(/\r?\n/)) {
        const [w,...p] = line.trim().split(/\s+/);
        if (w && !w.startsWith('#') && !w.startsWith(';;;') && !w.includes('(')) m.set(w.toLowerCase(),p);
      }
      return m;
    }).catch(e => { pending = null; throw e; });
  }
  const vowels={AA:'ア',AE:'ア',AH:'ア',AO:'オー',AW:'アウ',AY:'アイ',EH:'エ',ER:'アー',EY:'エイ',IH:'イ',IY:'イー',OW:'オウ',OY:'オイ',UH:'ウ',UW:'ウー'};
  const c={B:'ブ',CH:'チ',D:'ド',DH:'ズ',F:'フ',G:'グ',HH:'ハ',JH:'ジ',K:'ク',L:'ル',M:'ム',N:'ン',NG:'ング',P:'プ',R:'ル',S:'ス',SH:'シュ',T:'ト',TH:'ス',V:'ヴ',W:'ウ',Y:'イ',Z:'ズ',ZH:'ジュ'};
  const rows={B:'バ ビ ブ ベ ボ',D:'ダ ディ ドゥ デ ド',F:'ファ フィ フ フェ フォ',G:'ガ ギ グ ゲ ゴ',HH:'ハ ヒ フ ヘ ホ',K:'カ キ ク ケ コ',L:'ラ リ ル レ ロ',M:'マ ミ ム メ モ',N:'ナ ニ ヌ ネ ノ',P:'パ ピ プ ペ ポ',R:'ラ リ ル レ ロ',S:'サ スィ ス セ ソ',SH:'シャ シ シュ シェ ショ',T:'タ ティ トゥ テ ト',TH:'サ スィ ス セ ソ',DH:'ザ ズィ ズ ゼ ゾ',V:'ヴァ ヴィ ヴ ヴェ ヴォ',W:'ワ ウィ ウ ウェ ウォ',Y:'ヤ イ ユ イェ ヨ',Z:'ザ ズィ ズ ゼ ゾ',CH:'チャ チ チュ チェ チョ',JH:'ジャ ジ ジュ ジェ ジョ',ZH:'ジャ ジ ジュ ジェ ジョ'};
  const patterns={AA:[0,''],AE:[0,''],AH:[0,''],AO:[4,'ー'],AW:[0,'ウ'],AY:[0,'イ'],EH:[3,''],ER:[0,'ー'],EY:[3,'イ'],IH:[1,''],IY:[1,'ー'],OW:[4,'ウ'],OY:[4,'イ'],UH:[2,''],UW:[2,'ー']};
  const overrides={a:'ア',an:'アン',and:'アン',of:'アヴ',to:'トゥ',for:'ファー',our:'アウア',are:'アー',have:'ハヴ',will:'ウィル',with:'ウィズ',that:'ザット',the:'ザ'};
  function convert(phones){const p=phones.map(x=>x.replace(/[012]/g,'')); let out=''; for(let i=0;i<p.length;i++){const x=p[i],y=p[i+1]; if(rows[x]&&patterns[y]){const [n,end]=patterns[y];out+=rows[x].split(' ')[n]+end;i++;}else out+=vowels[x]||c[x]||'';}return out;}
  async function convertSentence(text){const dict=await load();const parts=text.match(/[a-zA-Z]+(?:['’][a-zA-Z]+)*|\d+(?:\.\d+)?|[^\s]/g)||[];return parts.map((p,i)=>{if(/^[.!?]$/.test(p))return '//';if(/^[,;:—]$/.test(p))return '/';const w=p.toLowerCase().replace(/’/g,"'");const next=dict.get((parts[i+1]||'').toLowerCase().replace(/’/g,"'"));if(w==='the'&&next&&vowels[next[0].replace(/[012]/g,'')])return 'ジ';return overrides[w]||(dict.has(w)?convert(dict.get(w)):p);}).join(' ');}
  function addButton(container,sentence){const b=document.createElement('button'),p=document.createElement('p');b.type='button';b.className='model-speech';b.textContent='カタカナ';b.style.marginLeft='8px';b.setAttribute('aria-expanded','false');p.lang='ja';p.hidden=true;Object.assign(p.style,{fontSize:'0.95rem',lineHeight:'1.9',background:'rgba(128,128,128,0.08)',borderRadius:'8px',padding:'10px'});b.onclick=async()=>{p.hidden=!p.hidden;b.setAttribute('aria-expanded',String(!p.hidden));if(p.hidden||p.dataset.loaded)return;b.disabled=true;p.textContent='発音を変換中…';try{p.textContent=await convertSentence(sentence);p.dataset.loaded='true';}catch{p.textContent='発音辞書を読み込めませんでした。';}finally{b.disabled=false;}};container.append(b,p);}
  window.Katakana={convertSentence,addButton};
})();
