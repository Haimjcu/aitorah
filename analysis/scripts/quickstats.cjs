const fs=require('fs');
const ss=fs.readFileSync('analysis/data/study_sessions.jsonl','utf8').split('\n').filter(Boolean).map(JSON.parse);
const qa=fs.readFileSync('analysis/data/qa_pairs.jsonl','utf8').split('\n').filter(Boolean).map(JSON.parse);
const userTurns=[]; let turnsPerSession=[];
for(const s of ss){const m=Array.isArray(s.messages)?s.messages:[]; const u=m.filter(x=>x.role==='user'); turnsPerSession.push(u.length); u.forEach(x=>userTurns.push(String(x.content||'')));}
const qs=qa.map(q=>q.question);
function lang(t){
  const heb=(t.match(/[֐-׿]/g)||[]).length, cyr=(t.match(/[Ѐ-ӿ]/g)||[]).length, lat=(t.match(/[A-Za-z]/g)||[]).length, ara=(t.match(/[؀-ۿ]/g)||[]).length;
  const other=(t.match(/[^\u0000-ɏ֐-׿Ѐ-ӿ\s\d\p{P}\p{S}]/gu)||[]).length;
  if(heb>lat&&heb>cyr){ if(/\b(איז|נישט|ניט|דער|מיר|וואס|וויאזוי|פון|אויף|זיין|דאס|האבן)\b/.test(t)||/[ײױװ]|וו|יי/.test(t)&&/\b(איז|נישט|וואס|פון|דאס)\b/.test(t)) return 'yiddish?'; return 'hebrew'; }
  if(cyr>lat) return 'russian/cyrillic'; if(ara>0) return 'arabic-script'; if(other>3) return 'other-script';
  const l=t.toLowerCase();
  if(/\b(qué|cómo|por qué|cuál|es|está|los|las|del|para|una)\b/.test(l)&&/[áéíóúñ¿¡]|\b(qué|cómo|cuál|porque)\b/.test(l)) return 'spanish?';
  if(/\b(qu'|est-ce|pourquoi|comment|les|des|une|dans|est)\b/.test(l)&&/[àâçéèêëîïôûù]|\b(est-ce|pourquoi|quelle|quel)\b/.test(l)) return 'french?';
  if(/\b(ist|und|warum|nicht|der|die|das)\b/.test(l)&&/\b(warum|nicht|ist)\b/.test(l)) return 'german?';
  if(/\b(o que|por que|não|você)\b/.test(l)) return 'portuguese?';
  return lat>0?'english/latin':'unknown';
}
const tally=(arr)=>arr.reduce((a,t)=>(a[lang(t)]=(a[lang(t)]||0)+1,a),{});
const avg=turnsPerSession.reduce((a,b)=>a+b,0)/turnsPerSession.length;
console.log('sessions',ss.length,'user turns',userTurns.length,'avg turns/session',avg.toFixed(1),'single-turn sessions',turnsPerSession.filter(n=>n<=1).length);
console.log('session user-turn languages',tally(userTurns));
console.log('qa question languages',tally(qs));
const qaByYear=qa.reduce((a,q)=>{const y=String(q.created_at).slice(0,7);a[y]=(a[y]||0)+1;return a},{}); console.log('qa by month',qaByYear);
for(const k of ['yiddish?','russian/cyrillic','spanish?','french?','german?','portuguese?','arabic-script','other-script']){const ex=[...userTurns,...qs].filter(t=>lang(t)===k).slice(0,3).map(t=>t.slice(0,90).replace(/\n/g,' ')); if(ex.length) console.log(k,'=>',ex);}
