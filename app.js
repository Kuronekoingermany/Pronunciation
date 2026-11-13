const $=id=>document.getElementById(id);
function tokens(s){return s.replace(/[’‘]/g,"'").match(/[a-zA-Z0-9]+(?:['-][a-zA-Z0-9]+)*/g)||[]}
const KEY='read-aloud-articles-v1';let articles=[],selected,active=false,stopping=false,started=0,elapsed=0,ticker,session,practiceGeneration=0,audioUrl,finalText='',interim='',mode='',stopFallback;
try{const raw=localStorage.getItem(KEY);articles=raw?JSON.parse(raw):[{id:'welcome',title:'A moment to notice',text:'Every day offers a chance to notice something new. On the way to work, we might see a different color in the sky or hear a bird we have never noticed before. These small moments can change the way we experience familiar places.\n\nLearning a language also begins with attention. We listen to the rhythm of a sentence, try a new expression, and discover another way to share an idea. Progress does not always arrive in a dramatic moment. Sometimes, it is simply the feeling that the words come a little more naturally than they did yesterday.'}];if(!Array.isArray(articles)||articles.some(a=>typeof a.text!=='string'||typeof a.title!=='string'||tokens(a.text).length>2000))throw Error()}catch{articles=[];$('status').textContent='保存された記事を読み込めなかった。バックアップから復元できる。'}selected=articles[0]?.id;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(articles));return true}catch{$('status').textContent='記事を保存できなかった。ブラウザーの保存設定を確認し、バックアップを取得してほしい。';return false}}
function current(){return articles.find(a=>a.id===selected)}
function reset(){stopModelSpeech();practiceGeneration++;finalText='';interim='';elapsed=0;$('timer').innerHTML='00:00<span>.0</span>';$('results').hidden=true;$('transcript').textContent='読み上げた英語がここに表示される。';$('playback').hidden=true;if(audioUrl){const player=$('playback');player.pause();player.removeAttribute('src');player.load();URL.revokeObjectURL(audioUrl);audioUrl=null}}
function render(){const a=current();$('count').textContent=articles.length;$('articles').replaceChildren();articles.forEach(x=>{const b=document.createElement('button');b.className='article'+(x.id===selected?' selected':'');b.disabled=active||stopping;const title=document.createElement('strong'),meta=document.createElement('span');title.textContent=x.title;meta.textContent=tokens(x.text).length+' WORDS';b.append(title,meta);b.onclick=()=>{selected=x.id;reset();render()};$('articles').append(b)});$('title').textContent=a?.title||'自分の英文で、はじめよう';$('passage').textContent=a?.text||'';$('empty').hidden=!!a;$('words').textContent=a?tokens(a.text).length+' words • English reading':'';['start','timerOnly'].forEach(id=>$(id).disabled=!a||active||stopping);$('delete').disabled=!a||active||stopping;$('add').disabled=active||stopping;$('language').disabled=active||stopping;$('stop').disabled=!active;$('import').disabled=active||stopping;}
$('font').oninput = event => { $('passage').style.fontSize = event.target.value + 'px'; };
$('add').onclick = () => {
  $('articleForm').reset();
  $('formNote').textContent = '英語の文章をそのまま登録できる。';
  $('editor').showModal();
};
$('cancel').onclick = () => $('editor').close();
$('articleForm').onsubmit = event => {
  event.preventDefault();
  const title = $('newTitle').value.trim();
  const text = $('newText').value.trim();
  const count = tokens(text).length;
  if (!title || !count || count > 2000) {
    $('formNote').textContent = 'タイトルと、1〜2,000語の英文を入力してほしい。';
    return;
  }

  const chunks = $('splitArticle').checked ? splitArticle(text) : [text];
  const newArticles = chunks.map((chunk, index) => {
    const suffix = chunks.length > 1 ? ` (${index + 1}/${chunks.length})` : '';
    return {id: crypto.randomUUID(), title: title.slice(0, 120 - suffix.length) + suffix, text: chunk};
  });
  const previous = articles;
  articles = [...newArticles, ...articles];
  if (!persist()) {
    articles = previous;
    $('formNote').textContent = '記事を保存できなかった。ブラウザーの保存設定を確認してほしい。';
    return;
  }
  selected = newArticles[0].id;
  reset();
  render();
  $('editor').close();
  $('status').textContent = `${newArticles.length}件の記事を登録した。`;
};
$('delete').onclick=()=>{if(confirm('この記事を削除する？')){articles=articles.filter(a=>a.id!==selected);selected=articles[0]?.id;persist();reset();render()}};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(articles,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='read-aloud-articles.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};$('import').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>2000000)throw Error();const list=JSON.parse(await f.text());if(!Array.isArray(list)||list.length>200||list.some(a=>typeof a.title!=='string'||!a.title.trim()||typeof a.text!=='string'||!tokens(a.text).length||tokens(a.text).length>2000))throw Error();articles.push(...list.map(a=>({id:crypto.randomUUID(),title:a.title.slice(0,120),text:a.text})));selected=selected||articles[0]?.id;persist();render();$('status').textContent=list.length+'件の記事を追加した。'}catch{$('status').textContent='バックアップを読み込めなかった。記事の JSON ファイルを確認してほしい。'}e.target.value=''};
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
function transcript(){ $('transcript').replaceChildren(document.createTextNode(finalText));if(interim){const em=document.createElement('em');em.textContent=' '+interim;$('transcript').append(em)}}
function clock(){elapsed=(performance.now()-started)/1000;const s=Math.floor(elapsed);$('timer').innerHTML=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')+'<span>.'+Math.floor((elapsed%1)*10)+'</span>';const target=Number($('target').value);$('targetNote').textContent=target&&elapsed>=target?'目標時間に到達（計測は継続中）':''}
function appendRecognized(text) {
  const phrase = text.trim();
  if (!phrase || finalText.length >= 24000) return;
  finalText += (finalText ? ' ' : '') + phrase.slice(0, 24000 - finalText.length);
}

// iPad can identify itself as a desktop Mac when requesting desktop sites.
function usesAppleMobileAudio() {
  const {userAgent = '', platform = '', maxTouchPoints = 0} = navigator;
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

function releaseSession() {
  const previous = session;
  session = null;
  if (!previous) return;
  clearTimeout(previous.restartTimer);
  clearTimeout(previous.cueTimeout);
  if (previous.cue) {
    previous.cue = null;
    synthesis.cancel();
  }
  const recognition = previous.recognition;
  if (recognition) {
    recognition.onresult = recognition.onerror = recognition.onend = null;
    try { recognition.abort(); } catch {}
  }
  try {
    if (previous.recorder?.state === 'recording') previous.recorder.stop();
  } catch {} finally {
    previous.stream?.getTracks().forEach(track => track.stop());
  }
}

let modelSpeech = null;
const synthesis = window.speechSynthesis;

function finishModelSpeech(playback, message = '') {
  if (modelSpeech !== playback) return;
  clearInterval(playback.watchdog);
  modelSpeech = null;
  playback.button.textContent = '米語で聞く';
  $('modelSpeechStatus').textContent = message;
}

function stopModelSpeech() {
  if (!modelSpeech) return;
  finishModelSpeech(modelSpeech);
  synthesis.cancel();
}

function playModelSpeech(text, button) {
  const wasPlaying = modelSpeech?.button === button && (synthesis.speaking || synthesis.pending);
  stopModelSpeech();
  if (wasPlaying) return;
  $('playback').pause();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  const voices = synthesis.getVoices().filter(voice => /^en[-_]us$/i.test(voice.lang));
  const voice = voices.find(voice => /^(Alex|Fred|Tom|Siri Voice 1|Microsoft (David|Guy))/i.test(voice.name))
    || voices.find(voice => voice.default) || voices[0];
  if (voice) utterance.voice = voice;
  const playback = {utterance, button, queuedAt: performance.now(), started: false};
  modelSpeech = playback;
  button.textContent = '読み上げを停止';
  $('modelSpeechStatus').textContent = '';
  utterance.onstart = () => { playback.started = true; };
  utterance.onend = () => finishModelSpeech(playback);
  const errorMessage = '読み上げを再生できなかった。「米語で聞く」で再試行できる。';
  utterance.onerror = () => finishModelSpeech(playback, errorMessage);
  // Some browsers become idle without delivering the utterance's end event.
  playback.watchdog = setInterval(() => {
    playback.started ||= synthesis.speaking && !synthesis.paused;
    if (playback.started && !synthesis.speaking && !synthesis.pending) {
      finishModelSpeech(playback);
    } else if (!playback.started && performance.now() - playback.queuedAt >= 5000) {
      finishModelSpeech(playback, errorMessage);
      synthesis.cancel();
    }
  }, 250);
  try {
    if (synthesis.paused) synthesis.resume();
    synthesis.speak(utterance);
  } catch { utterance.onerror(); }
}

function renderSentenceScores(sentences, result, transcriptText) {
  const list = $('sentenceScores');
  list.replaceChildren();
  $('modelSpeechStatus').textContent = synthesis && window.SpeechSynthesisUtterance
    ? '' : 'このブラウザーでは見本音声の読み上げを利用できない。';
  const recognized = alignTranscript(sentences, result.anchors, transcriptText);
  let offset = 0;
  for (const [index, sentence] of sentences.entries()) {
    const matched = result.accepted.slice(offset, offset + sentence.words.length).filter(Boolean).length;
    offset += sentence.words.length;
    const item = document.createElement('li');
    const score = document.createElement('strong');
    score.className = 'sentence-score';
    score.textContent = `一致率 ${relaxedScore(matched, sentence.words.length)}%`;
    const columns = document.createElement('div');
    columns.className = 'sentence-columns';
    for (const [label, value] of [['原文', sentence.text], ['認識された英文', recognized[index]]]) {
      const column = document.createElement('div');
      const heading = document.createElement('b');
      heading.textContent = label;
      const line = document.createElement('p');
      if (value) line.lang = 'en';
      line.textContent = value || '対応する認識結果なし';
      column.append(heading, line);
      if (label === '原文') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'model-speech';
        button.textContent = '米語で聞く';
        button.disabled = !synthesis || !window.SpeechSynthesisUtterance;
        button.onclick = () => playModelSpeech(sentence.text, button);
        column.append(button);
      }
      columns.append(column);
    }
    item.append(score, columns);
    list.append(item);
  }
}

function finish() {
  if (!stopping) return;
  clearTimeout(stopFallback);
  const error = session?.error;
  appendRecognized(interim);
  interim = '';
  releaseSession();
  stopping = false;
  transcript();
  $('live').textContent = '終了';
  render();
  if (mode === 'timer') {
    $('status').textContent = 'タイマー練習を終了。書き起こし・採点は行っていない。';
    return;
  }
  const spoken = tokens(finalText).slice(0, 3000);
  if (!spoken.length) {
    $('status').textContent = error || (usesAppleMobileAudio()
      ? '英語の認識結果が返らなかった。もう一度試しても続く場合は、ブラウザーまたはアプリを完全に終了して開き直してほしい。'
      : '英語を認識できなかった。マイクとブラウザーの設定を確認してほしい。');
    return;
  }
  const article = current().text;
  const sentences = splitSentences(article).map(text => ({text, words: tokens(text)})).filter(s => s.words.length);
  const result = compare(sentences.flatMap(s => s.words), spoken);
  $('score').textContent = result.score;
  $('wpm').textContent = elapsed > 0 ? Math.round(spoken.length * 60 / elapsed) : '—';
  renderSentenceScores(sentences, result, finalText);
  $('results').hidden = false;
  $('status').textContent = error ? `${error} 聞き取れた範囲で集計した。` : '全体と文ごとの一致率を表示した。';
}

function stop() {
  if (!active) return;
  clock();
  active = false;
  stopping = true;
  clearInterval(ticker);
  clearTimeout(session?.restartTimer);
  $('status').textContent = '最後の認識結果を処理中…';
  render();
  const recognition = session?.recognition;
  if (!recognition) { finish(); return; }
  stopFallback = setTimeout(finish, 2500);
  try { recognition.stop(); } catch { finish(); }
}

function startClock() {
  active = true;
  started = performance.now();
  ticker = setInterval(clock, 100);
  $('live').textContent = mode === 'speech' ? '聞き取り中' : 'タイマー';
  render();
}

function startRecognition(reading) {
  const recognition = new Recognition();
  reading.recognition = recognition;
  recognition.lang = reading.language;
  recognition.continuous = true;
  recognition.interimResults = true;
  const isCurrent = () => session === reading && reading.recognition === recognition;
  let finalizedThrough = 0;
  recognition.onresult = event => {
    if (!isCurrent()) return;
    interim = '';
    for (let i = Math.max(event.resultIndex, finalizedThrough); i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        appendRecognized(result[0].transcript);
        finalizedThrough = i + 1;
      } else {
        interim += `${result[0].transcript.trim()} `;
      }
    }
    transcript();

  };
  recognition.onerror = event => {
    if (!isCurrent() || event.error === 'no-speech' || event.error === 'aborted') return;
    const messages = {
      'not-allowed': 'マイクまたは音声認識へのアクセスが拒否された。',
      network: '音声認識サービスに接続できない。',
      'audio-capture': 'マイクを利用できない。',
      'service-not-allowed': '音声認識サービスを利用できない。',
    };
    reading.error = messages[event.error] || '音声認識が中断された。';
    stop();
  };
  recognition.onend = () => {
    if (!isCurrent()) return;
    reading.recognition = null;
    if (stopping) { finish(); return; }
    appendRecognized(interim);
    interim = '';
    transcript();
    if (active) reading.restartTimer = setTimeout(() => {
      if (session !== reading || !active) return;
      beginRecognition(reading, false);
    }, 200);
  };
  recognition.start();
}

function beginRecognition(reading, playCue = true) {
  const listen = () => {
    if (session !== reading || !active) return;
    try {
      startRecognition(reading);
      if (!reading.listeningSince) {
        reading.listeningSince = performance.now();
        started = reading.listeningSince;
      }
      $('status').textContent = '音読を聞き取り中。読み終わったら「終了して比較」。';
    } catch {
      reading.error = '音声認識を開始できなかった。もう一度試してほしい。';
      stop();
    }
  };
  if (!playCue || !reading.naturalEnd || !synthesis || !window.SpeechSynthesisUtterance) {
    listen();
    return;
  }
  const cue = new window.SpeechSynthesisUtterance('Go.');
  cue.lang = 'en-US';
  reading.cue = cue;
  $('status').textContent = '「Go」のあとに読み始めてほしい。iPhone・iPadでは書き起こしと比較を行う。';
  const ready = () => {
    if (session !== reading || reading.cue !== cue) return;
    reading.cue = null;
    clearTimeout(reading.cueTimeout);
    listen();
  };
  cue.onend = ready;
  cue.onerror = ready;
  reading.cueTimeout = setTimeout(() => {
    if (reading.cue !== cue) return;
    cue.onend = cue.onerror = null;
    synthesis.cancel();
    ready();
  }, 4000);
  try {
    if (synthesis.paused) synthesis.resume();
    synthesis.speak(cue);
  } catch { ready(); }
}

async function start(kind) {
  if (active || stopping) return;
  if (kind === 'speech' && !Recognition) {
    $('status').textContent = 'このブラウザーは音声認識に非対応。Safari または Chrome で開くか、タイマーのみを利用してほしい。';
    return;
  }
  reset();
  mode = kind;
  $('targetNote').textContent = '';
  if (kind === 'timer') {
    startClock();
    $('status').textContent = 'タイマーを計測中。';
    return;
  }
  const reading = {
    generation: practiceGeneration,
    language: $('language').value,
    naturalEnd: usesAppleMobileAudio(),
  };
  session = reading;
  if (reading.naturalEnd) {
    // Let Web Speech be the only microphone consumer on Apple mobile browsers.
    startClock();
    beginRecognition(reading);
    return;
  }
  stopping = true;
  render();
  $('status').textContent = 'マイクへのアクセスを待機中…';
  try {
    reading.stream = await navigator.mediaDevices.getUserMedia({audio: true});
    if (window.MediaRecorder) {
      try {
        const recorder = new window.MediaRecorder(reading.stream);
        const chunks = [];
        reading.recorder = recorder;
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onstop = () => {
          if (reading.generation !== practiceGeneration || !chunks.length) return;
          audioUrl = URL.createObjectURL(new Blob(chunks, {type: recorder.mimeType}));
          $('playback').src = audioUrl;
          $('playback').hidden = false;
        };
        recorder.start();
      } catch { reading.recorder = null; }
    }
    startRecognition(reading);
    stopping = false;
    startClock();
    $('status').textContent = '音読を聞き取り中。読み終わったら「終了して比較」。';
  } catch {
    releaseSession();
    stopping = false;
    active = false;
    clearInterval(ticker);
    render();
    $('status').textContent = '音声認識を開始できなかった。マイクの許可と対応ブラウザーを確認してほしい。';
  }
}
$('start').onclick=()=>start('speech');$('timerOnly').onclick=()=>start('timer');$('stop').onclick=stop;window.addEventListener('beforeunload',e=>{if(active||stopping){e.preventDefault();e.returnValue=''}});render();
