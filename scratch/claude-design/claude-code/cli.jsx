const {useState,useEffect,useRef}=React;
const G=RP.GLYPH;
const pad=(s,n)=>(s+' '.repeat(n)).slice(0,Math.max(n,s.length));
function statusLines(all,counts){const rows=all.map(o=>{const ex=o.state==='excluded'?o.reason:o.patch?`patch ${o.patch.brick}`:o.kind==='changed'&&o.state==='needs_review'?'spec changed':o.state==='searching'?`${o.progress.attempt}/${o.progress.of}`:o.state==='counterexample'?o.counterexample.input:o.state==='weak_spec'?'1 mutant survives':o.state==='stale'?`source changed ${o.hash}→`:o.state==='proven'?`${o.timing.prove||'—'}s${o.liveState?'':' · cache'}`:o.state==='needs_review'?'new spec':'';return `  ${G[o.state]} ${pad(o.theorem||o.fn,24)} ${pad(o.crate+'::'+o.module+'::'+o.fn,42)} ${pad(RP.LABEL[o.state].toLowerCase(),15)} ${ex}`});
const order=['proven','needs_review','counterexample','weak_spec','searching','checking','stale','excluded'];const sum=order.filter(k=>counts[k]).map(k=>`${counts[k]} ${RP.LABEL[k].toLowerCase()}`).join(' · ');
const block=(counts.counterexample||0)+(counts.failing||0)+(counts.stale||0);
return [...rows,'',`${all.length} obligations · ${sum}`,`verdict: ${block?`block (${[counts.counterexample&&`${counts.counterexample} counterexample`,counts.failing&&`${counts.failing} failing`,counts.stale&&`${counts.stale} stale`].filter(Boolean).join(', ')})`:'pass'}`]}
function Prompt({children}){return <div className="cmd"><span className="ps">$</span> {children}</div>}
function Out({lines,dim}){return <pre className={'out'+(dim?' dim':'')}>{lines.join('\n')}</pre>}
function App(){
const {all,ui,counts,user}=RP.useStore();const sc=ui.scenario;
const fib=all.find(o=>o.id==='fib');
const [ans,setAns]=useState('');const [showDiff,setShowDiff]=useState(false);const [declined,setDeclined]=useState(false);const inp=useRef();
useEffect(()=>{setAns('');setDeclined(false);setShowDiff(false)},[sc]);
const submit=e=>{e.preventDefault();const a=ans.trim().toLowerCase();if(a==='y'||a==='yes')RP.act.approve('fib','terminal');else if(a==='d')setShowDiff(true);else setDeclined(true);setAns('')};
const head=`rustproof 0.2.1 · retry-ai/rustproof · ${RP.RUN.trigger.branch} · tree ${RP.RUN.tree}`;
return <div className="wrap">
<div className="pagehead"><a className="wordmark" href="../index.html"><i>∎</i>rustproof</a><span className="c3">/</span><span>CLI output · monochrome + status glyphs</span></div>
<div className="term cli" onClick={()=>inp.current?.focus()} data-note="CLI: no color, glyphs carry state. One line per obligation; summary and verdict last. Columns: glyph, theorem, path, state, detail.">
<div className="tbody">
{sc==='firstrun'&&<><Prompt>rustproof init</Prompt><Out lines={[head,'','scanning workspace (4 crates, 47 fns)…','','  31 provable   as written','   6 patchable  range-to-while ×4 · isolate-io ×2','  10 excluded   I/O ×5 · async ×3 · unsafe ×1 · unsupported type ×1 (tokio::sync::Mutex)','','wrote .rustproof/manifest.toml · .rustproof/lean/ (Lake project, Aeneas output in Generated/)','','next: rustproof spec propose <fn>   or ask Claude to propose theorems for the 6 that matter most']}/><Prompt><span className="cursor">▌</span></Prompt></>}
{sc==='empty'&&<><Prompt>rustproof spec</Prompt><Out lines={[head,'','  ● nothing needs review · 12 proven · 0 stale','','verdict: pass']}/><Prompt><span className="cursor">▌</span></Prompt></>}
{sc==='error'&&<><Prompt>rustproof prove</Prompt><Out lines={['✕ not logged in. Proof search runs on rustproof cloud; checking works offline (rustproof check).','  → rustproof login']}/><Prompt>rustproof login</Prompt><Out lines={['opening https://rustproof.dev/cli/auth?code=K7F2-9QXT in your browser…','waiting for the browser (loopback 127.0.0.1:52114)…','✕ could not reach api.rustproof.dev: dial tcp: i/o timeout (10 s)','  checking still works offline: rustproof check','  retry with --no-browser to paste the code by hand']}/><Prompt>rustproof check</Prompt><Out lines={['  ● check_ok_sound          checked 0.9s · cache','  ● proven_requires_check   checked 1.1s · cache','  ✕ percent_bounded         proof does not check (Lean: unsolved goals at line 14)','','3 checked · 2 ok · 1 failing','verdict: block (1 failing)']}/><Prompt><span className="env">RUSTPROOF_AGENT=1</span> rustproof spec approve fib_spec</Prompt><Out lines={['✕ approvals come from people.','  this shell is driven by an agent (RUSTPROOF_AGENT=1 set by the Claude Code plugin).','  ask the user to approve in /proofs, in the dashboard, or in the PR review.']}/><Prompt><span className="cursor">▌</span></Prompt></>}
{sc==='loading'&&<><Prompt>rustproof events --follow</Prompt><Out lines={[head,'','14:02:11  ◌ merge_sorted_spec   searching 1/5   worker us-east-1/3','14:02:38  ◌ merge_sorted_spec   searching 2/5','14:03:04  ◌ merge_sorted_spec   searching 3/5   (template: sorted-merge invariant)',...(fib.liveState?[`14:03:12  ${G[fib.state]} fib_spec            ${fib.state==='proven'?'proven ∎   4.2s search · 1.4s check':fib.state+(fib.progress?` ${fib.progress.attempt}/${fib.progress.of}`:'')}`]:[]),'▌ following… ctrl-c to stop']}/></>}
{sc==='live'&&<>
<Prompt>rustproof status</Prompt><Out lines={[head,'',...statusLines(all,counts)]}/>
<Prompt>rustproof spec approve fib_spec</Prompt>
<Out lines={[`fib_spec · ${fib.file}:${fib.line} · patch memo-to-accumulator (differential: 10,000 inputs agree, 0.8s)`,'',`  ${fib.spec.english}`,'',...fib.spec.lean.split('\n').slice(5).map(l=>'  '+l),'',`  △ fib(94) overflows u64 → precondition n ≤ 93`]}/>
{showDiff&&<Out dim lines={RP.diffLines(fib.src,fib.patch.after).map(r=>`  ${r.t==='add'?'+':r.t==='del'?'-':' '} ${r.s}`)}/>}
{fib.state==='needs_review'&&!declined&&<form className="cmd q" onSubmit={submit} data-note="Interactive approve: y approves (recorded as 'terminal'), d prints the patch diff, anything else declines. The acting user comes from the OS-keychain session."><span>Approve as {user.handle}? [y/N/d]</span> <input ref={inp} value={ans} onChange={e=>setAns(e.target.value)} autoFocus aria-label="answer"/></form>}
{fib.state==='needs_review'&&declined&&<><Out lines={['  not approved. fib_spec stays ◆ needs review.']}/><Prompt><span className="cursor">▌</span></Prompt></>}
{fib.liveState&&<><Out lines={[`  ◆ → ◌  fib_spec approved by ${fib.approval.by} (${fib.approval.where}) · proof search queued · ${RP.RUN.id}`,...(fib.state==='searching'?[`  ◌ searching ${fib.progress.attempt}/${fib.progress.of} · Leanstral · template memo-to-accumulator`]:fib.state==='checking'?['  ◌ searching 5/5 · proof found','  ◌ checking · Lean kernel · local']:['  ◌ searching 5/5 · proof found',`  ● fib_spec proven ∎ · ${fib.timing.prove}s search · ${fib.timing.check}s check · no sorry · axioms ⊆ allowed · tree ${RP.RUN.tree}`])]}/>{fib.state==='proven'&&<Prompt><span className="cursor">▌</span></Prompt>}</>}
</>}
</div></div>
<div className="t-small c3">Type <code>y</code> at the prompt to approve from the terminal. The same approval appears in the dashboard, the mod and the PR.</div>
</div>}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
