// Normalize recognition spelling without changing the displayed transcript.
function numberWords(n){const u='zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' '),t='zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');if(n<20)return u[n];if(n<100)return t[Math.floor(n/10)]+(n%10?' '+u[n%10]:'');if(n<1000)return u[Math.floor(n/100)]+' hundred'+(n%100?' '+numberWords(n%100):'');if(n<10000)return u[Math.floor(n/1000)]+' thousand'+(n%1000?' '+numberWords(n%1000):'');return String(n)}
const expansions={"can't":"can not","cannot":"can not","won't":"will not","shan't":"shall not","i'm":"i am","you're":"you are","we're":"we are","they're":"they are","it's":"it is","that's":"that is","there's":"there is","let's":"let us","gonna":"going to","wanna":"want to"};
const sameSound=[['to','too','two'],['for','four'],['one','won'],['their','there'],['here','hear'],['right','write','rite'],['know','no'],['new','knew'],['see','sea'],['by','buy','bye'],['weather','whether'],['whole','hole'],['our','hour'],['eight','ate'],['color','colour'],['center','centre'],['favorite','favourite'],['practice','practise']];
const aliases=new Map(sameSound.flatMap(g=>g.map(w=>[w,g[0]])));
function normalized(words){return words.flatMap((word,index)=>{let s=word.toLowerCase();if(/^\d+$/.test(s)&&Number(s)<10000)s=numberWords(Number(s));s=expansions[s]||s.replace(/n't$/,' not').replace(/'re$/,' are').replace(/'ve$/,' have').replace(/'ll$/,' will');return s.split(/[ -]+/).filter(Boolean).map(v=>({value:aliases.get(v)||v.replace(/'/g,''),index}))})}
// Allow small recognition spelling differences; short words stay exact.
function nearWord(a,b){if(a===b)return true;if(Math.min(a.length,b.length)<4)return false;const limit=Math.min(a.length,b.length)>=7?2:1;if(Math.abs(a.length-b.length)>limit)return false;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=next}return prev[b.length]<=limit}
function relaxedScore(match,total){return total?Math.round(100*match/total):0}
// Sequence alignment resynchronizes after omitted words and ignores extra speech.
function compare(a,b){const A=normalized(a),B=normalized(b),n=A.length,m=B.length,cache=new Map(),equal=(x,y)=>{const k=x+"|"+y;if(!cache.has(k))cache.set(k,nearWord(x,y));return cache.get(k)},d=Array.from({length:n+1},()=>new Uint16Array(m+1));for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)d[i][j]=equal(A[i].value,B[j].value)?1+d[i+1][j+1]:Math.max(d[i+1][j],d[i][j+1]);let i=0,j=0;const hits=new Set(),anchors=[];while(i<n&&j<m){if(equal(A[i].value,B[j].value)){hits.add(i);anchors.push([A[i].index,B[j].index]);i++;j++}else if(d[i+1][j]>d[i][j+1])i++;else j++}const groups=a.map(()=>[]);A.forEach((t,k)=>groups[t.index].push(k));const accepted=groups.map(g=>g.length>0&&g.every(k=>hits.has(k)));const match=accepted.filter(Boolean).length,rows=[];a.forEach((word,k)=>{if(!accepted[k])rows.push([k+1,word,'要確認','未認識（発音の誤りとは限らない）'])});return {rows,match,accepted,anchors,score:relaxedScore(match,a.length)}}


function splitSentences(text) {
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('en', {granularity: 'sentence'}) : null;
  return text.split(/\r?\n\s*\r?\n/).flatMap(paragraph => {
    const line = paragraph.replace(/\r?\n/g, ' ');
    if (segmenter) return Array.from(segmenter.segment(line), item => item.segment.trim());
    return (line.match(/[^.!?]+(?:[.!?]+|$)/g) || []).map(s => s.trim());
  }).filter(Boolean);
}

function alignTranscript(sentences, anchors, transcript) {
  const words = [...transcript.matchAll(/[a-zA-Z0-9]+(?:['’‘-][a-zA-Z0-9]+)*/g)];
  const output = sentences.map(() => '');
  if (sentences.length === 1) return [transcript.trim()];
  if (!anchors.length || !words.length) return output;

  const sentenceByReferenceWord = sentences.flatMap((sentence, index) => sentence.words.map(() => index));
  const assignments = [];
  let previousReference = -1;
  let previousSpoken = -1;
  for (const [reference, spoken] of [...anchors, [sentenceByReferenceWord.length, words.length]]) {
    if (spoken <= previousSpoken) {
      previousReference = Math.max(previousReference, reference);
      continue;
    }
    const spokenGap = spoken - previousSpoken - 1;
    const referenceGap = Math.max(0, reference - previousReference - 1);
    for (let i = 0; i < spokenGap; i++) {
      // Use surrounding matched words to place insertions and substitutions.
      const ref = referenceGap
        ? previousReference + 1 + Math.floor(i * referenceGap / spokenGap)
        : Math.max(0, previousReference);
      assignments[previousSpoken + 1 + i] = sentenceByReferenceWord[ref];
    }
    if (spoken < words.length) assignments[spoken] = sentenceByReferenceWord[reference];
    previousReference = reference;
    previousSpoken = spoken;
  }
  for (let start = 0; start < words.length;) {
    const sentenceIndex = assignments[start];
    let end = start + 1;
    while (end < words.length && assignments[end] === sentenceIndex) end++;
    const text = transcript.slice(start === 0 ? 0 : words[start].index, words[end]?.index).trim();
    output[sentenceIndex] = text;
    start = end;
  }
  return output;
}
