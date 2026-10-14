const {useState,useEffect}=React;
const G=RP.GLYPH,L=RP.LABEL;
function inline(s){return RP.esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/~~([^~]+)~~/g,'<del>$1</del>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>')}
function md(src){const lines=src.split('\n');let out='',i=0;while(i<lines.length){const l=lines[i];
if(l.startsWith('```')){const lang=l.slice(3).trim();let j=i+1,buf=[];while(j<lines.length&&!lines[j].startsWith('```')){buf.push(lines[j]);j++}out+=`<pre class="md-code ${lang}">${buf.map(b=>lang==='diff'?`<span class="${b[0]==='+'?'add':b[0]==='-'?'del':''}">${RP.esc(b)}</span>`:(lang==='lean'?RP.hlLean(b):RP.hlRust(b))).join('\n')}</pre>`;i=j+1;continue}
if(/^#{1,6} /.test(l)){const n=l.match(/^#+/)[0].length;out+=`<h${n}>${inline(l.slice(n+1))}</h${n}>`;i++;continue}
if(l.startsWith('|')){let j=i,rows=[];while(j<lines.length&&lines[j].startsWith('|')){rows.push(lines[j]);j++}const cells=r=>r.slice(1,-1).split('|').map(c=>c.trim());const head=cells(rows[0]);const body=rows.slice(2).map(cells);out+=`<table><thead><tr>${head.map(h=>`<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${body.map(r=>`<tr>${r.map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;i=j;continue}
if(l.startsWith('> ')){let j=i,buf=[];while(j<lines.length&&lines[j].startsWith('> ')){buf.push(lines[j].slice(2));j++}out+=`<blockquote>${inline(buf.join(' '))}</blockquote>`;i=j;continue}
if(l.startsWith('- ')){let j=i,buf=[];while(j<lines.length&&lines[j].startsWith('- ')){buf.push(lines[j].slice(2));j++}out+=`<ul>${buf.map(b=>`<li>${inline(b)}</li>`).join('')}</ul>`;i=j;continue}
if(l==='---'){out+='<hr>';i++;continue}
if(l.startsWith('<sub>')){out+=`<p class="sub">${inline(l.replace(/<\/?sub>/g,''))}</p>`;i++;continue}
if(l.trim()===''){i++;continue}
let j=i,buf=[];while(j<lines.length&&lines[j].trim()!==''&&!/^(#|\||>|-|```|<sub>)/.test(lines[j])){buf.push(lines[j]);j++}out+=`<p>${inline(buf.join(' '))}</p>`;i=j}return out}
function stickyMarkdown(all,counts){const r=RP.RUN;const specs=all.filter(o=>o.id==='fib'||o.id==='verdict');const cx=all.filter(o=>o.state==='counterexample');const block=(counts.counterexample||0)+(counts.failing||0)+(counts.stale||0);const waiting=specs.filter(o=>o.state==='needs_review').length;
const rev=o=>o.state==='needs_review'?(o.changesRequested?`changes requested by @${o.changesRequested.by}`:'waiting'):o.approval?`approved by @${o.approval.by} (${o.approval.where})`:`approved by @${o.approvedStatic?.by}`;
const fib=specs[0],ver=specs[1];
return `## rustproof · PR #${r.trigger.pr} · tree \`${r.tree}\`

**Verdict: ${block?'✕ Block':waiting?'◆ Waiting':'● Pass'}** — ${[block&&`${block} blocking`,waiting&&`${waiting} spec${waiting>1?'s':''} waiting for review`,counts.searching&&`${counts.searching} searching`].filter(Boolean).join(', ')||'all obligations proven'}. Commit \`${r.trigger.commit}\` → patched tree \`${r.tree}\`.

### Specs

| | Theorem | Function | Change | Review |
|---|---|---|---|---|
${specs.map(o=>`| ${G[o.state]} | \`${o.theorem}\` | \`${o.crate}::${o.fn}\` | ${o.kind} | ${rev(o)} |`).join('\n')}

#### \`${fib.theorem}\` (new)

> ${fib.spec.english}

\`\`\`lean
${fib.spec.lean.split('\n').slice(5).join('\n')}
\`\`\`

△ Precondition \`n ≤ 93\`: fib(94) overflows u64. The counterexample finder reported it; no unit test would.

#### \`${ver.theorem}\` (changed)

> ~~${ver.specPrev.english}~~ → ${ver.spec.english}

\`\`\`diff
${RP.diffLines(ver.specPrev.lean,ver.spec.lean).map(x=>(x.t==='add'?'+':x.t==='del'?'-':' ')+x.s).join('\n')}
\`\`\`

### Patches

| Brick | Function | Differential tests | Lines |
|---|---|---|---|
| \`${fib.patch.brick}\` | \`examples/fib::fib\` | ${fib.patch.diffTests.inputs.toLocaleString()} inputs agree · ${(fib.patch.diffTests.ms/1000).toFixed(1)} s | −17 +12 |

\`\`\`diff
${RP.diffLines(fib.src,fib.patch.after).map(x=>(x.t==='add'?'+':x.t==='del'?'-':' ')+x.s).join('\n')}
\`\`\`

### Counterexamples

| | Theorem | Input | Expected | Actual |
|---|---|---|---|---|
${cx.map(o=>`| ✕ | \`${o.theorem}\` | \`${o.counterexample.input}\` | ${o.counterexample.expected} | ${o.counterexample.actual} |`).join('\n')}

### Obligations

| ● Proven | ◆ Needs review | ✕ Counterexample | △ Weak spec | ◌ Running | ↻ Stale | ○ Excluded |
|---|---|---|---|---|---|---|
| ${counts.proven||0} | ${counts.needs_review||0} | ${counts.counterexample||0} | ${counts.weak_spec||0} | ${(counts.searching||0)+(counts.checking||0)} | ${counts.stale||0} | ${counts.excluded||0} |

<sub>Specs are approved by reviewing \`.rustproof/specs/\` in this PR (CODEOWNERS), in the dashboard, or with \`rustproof spec approve\`. Proof-only repairs are pushed to this branch by rustproof[bot]. Updated ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}.</sub>`}
function Check({title,s,summary,ann}){return <div className="check"><div className="ch"><span className="st" data-s={s}><span className="g">{G[s]}</span></span><b>{title}</b><span className="c3">{L[s]}</span><span className="c3" style={{marginLeft:'auto'}}>{s==='searching'?'in progress':'14 s'}</span></div><div className="cb" dangerouslySetInnerHTML={{__html:md(summary)}}/>{ann&&ann.length>0&&<div className="ann" data-note="Check-run annotations land on the exact Rust line in the Files tab; GitHub renders these without color.">{ann.map((a,i)=><div key={i}><code>{a.path}</code><span>{a.msg}</span></div>)}</div>}</div>}
function App(){
const {all,ui,counts,user}=RP.useStore();const sc=ui.scenario;const r=RP.RUN;
const [tab,setTab]=useState('conversation');const [raw,setRaw]=useState(false);const [reviewOpen,setReviewOpen]=useState(false);const [body,setBody]=useState('');
const specs=all.filter(o=>o.id==='fib'||o.id==='verdict');const waiting=specs.filter(o=>o.state==='needs_review');
const prApproved=specs.every(o=>o.approval&&o.approval.by==='mara'||o.approval&&o.approval.where==='PR review');
const approveAll=()=>{waiting.forEach(o=>RP.act.approve(o.id,'PR review'));if(!waiting.length)RP.toast('Review submitted · CODEOWNERS satisfied','proven');setReviewOpen(false);setBody('')};
const block=(counts.counterexample||0)+(counts.failing||0)+(counts.stale||0);
const mdSrc=sc==='empty'?`## rustproof · PR #${r.trigger.pr} · tree \`${r.tree}\`\n\n**Verdict: ● Pass** — nothing in this PR touches a proven function, and no spec changed. 12 obligations proven against \`${r.tree}\` (38/47 steps from cache).\n\n<sub>This comment updates in place on every push.</sub>`:sc==='firstrun'?`## rustproof · PR #${r.trigger.pr}\n\n**rustproof is installed on retry-ai but this repository has no \`.rustproof/\` yet.**\n\nRun \`rustproof init\` (or \`/rustproof:init\` in Claude Code) and commit the manifest. Until then, this check passes with nothing to verify.\n\n| Step | Command |\n|---|---|\n| 1 | \`claude plugin add rustproof\` |\n| 2 | \`rustproof login\` |\n| 3 | \`rustproof init\` |`:sc==='error'?`## rustproof · PR #${r.trigger.pr}\n\n**Verdict: ✕ Block** — extraction failed; nothing could be verified for \`examples/fib\`.\n\n\`\`\`\nCharon 0.1.72: could not translate HashMap::insert in fib::go\n  examples/fib/src/lib.rs:12\n  hint: brick memo-to-accumulator applies but the differential test runner timed out (worker 3, 30 s)\n\`\`\`\n\nThe gate fails closed. Re-run with \`rustproof prove --retry run_01HX4K\` or push a fix. [Debug this run](#) with the platform agent.\n\n<sub>Run \`${r.id}\` · worker ${r.worker}</sub>`:stickyMarkdown(all,counts);
const verdictState=sc==='error'?'failing':sc==='empty'||sc==='firstrun'?'proven':block?'counterexample':waiting.length?'needs_review':counts.searching?'searching':'proven';
return <div className="gh">
<div className="ghbar"><a className="wordmark" href="../index.html"><i>∎</i>rustproof</a><span className="c3">/</span><span>GitHub surfaces · Markdown only</span></div>
<div className="pr">
<div className="prh"><h1>{sc==='firstrun'?'Add CI config':r.trigger.title} <span className="c3">#{r.trigger.pr}</span></h1><div className="prm"><span className="pill">Open</span><span><b>jonas</b> wants to merge 3 commits into <code>{r.trigger.base}</code> from <code>{r.trigger.branch}</code></span></div>
<div className="tabs">{['conversation','checks','files'].map(t=><button key={t} aria-selected={tab===t} onClick={()=>setTab(t)}>{t==='conversation'?'Conversation':t==='checks'?<>Checks <span className="cnt">{sc==='firstrun'?1:3}</span></>:<>Files changed <span className="cnt">{sc==='firstrun'?1:6}</span></>}</button>)}</div></div>
{tab==='conversation'&&<div className="tl">
<div className="cmt" data-note="Sticky PR comment by rustproof[bot]: one comment, updated in place on every push. GitHub Markdown only: headings, tables, status glyphs, diff fences. No color is relied on."><div className="cmth"><span className="avatar">∎</span><b>rustproof</b><span className="bot">bot</span><span className="c3">commented · updated {RP.ago(r.startedAt)}</span><span className="seg" style={{marginLeft:'auto'}}><button aria-pressed={!raw} onClick={()=>setRaw(false)}>Rendered</button><button aria-pressed={raw} onClick={()=>setRaw(true)}>Raw Markdown</button></span></div>
{raw?<pre className="rawmd">{mdSrc}</pre>:<div className="mdb" dangerouslySetInnerHTML={{__html:md(mdSrc)}}/>}</div>
{sc==='live'&&<div className="ev">{all.filter(o=>o.approval).map(o=><div key={o.id}><span className="avatar">{RP.USERS[o.approval.by].init}</span><span><b>{o.approval.by}</b> approved <code>{o.theorem}</code> via the {o.approval.where} · {RP.ago(o.approval.at)}</span></div>)}{all.filter(o=>o.changesRequested).map(o=><div key={o.id+'c'}><span className="avatar">{RP.USERS[o.changesRequested.by].init}</span><span><b>{o.changesRequested.by}</b> requested changes on <code>{o.theorem}</code>: {o.changesRequested.note||'(no note)'}</span></div>)}</div>}
<div className="merge" data-note="Required status check. The verdict is computed and proven in the worker (verdict_pass_sound); GitHub only relays it. Specs under .rustproof/specs need a CODEOWNERS review, enforced by branch protection, not policy.">
<div className="mh"><span className="st" data-s={verdictState}><span className="g">{G[verdictState]}</span></span><div><b>{verdictState==='proven'?'All checks have passed':verdictState==='needs_review'?'Waiting for spec review':verdictState==='searching'?'Checks in progress':'Merging is blocked'}</b><div className="c2 t-small">{sc==='error'?'rustproof: extraction failed, gate fails closed':verdictState==='counterexample'?`rustproof: ${block} blocking obligation${block>1?'s':''} (counterexample)`:verdictState==='needs_review'?`rustproof: ${waiting.length} spec${waiting.length>1?'s':''} waiting · required check`:verdictState==='searching'?'rustproof: proof search running':'rustproof: verdict pass · proven against '+r.tree}</div></div></div>
{sc!=='firstrun'&&<div className="mrow"><span className="st" data-s={prApproved?'proven':'needs_review'}><span className="g">{prApproved?'●':'◆'}</span></span><div><b>Review required</b><div className="c2 t-small">{prApproved?'Code owner review satisfied by mara':<>Changes to <code>.rustproof/specs/</code> need a review from a code owner (<b>@mara</b>).</>}</div></div>{!prApproved&&<button className="btn btn-sm" style={{marginLeft:'auto'}} onClick={()=>setReviewOpen(v=>!v)} disabled={!user.owner} title={user.owner?'':'Switch to Mara in the proto bar; Jonas is not a code owner'}>{user.owner?'Review changes':'Not a code owner'}</button>}</div>}
{reviewOpen&&<div className="rv"><textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Leave a comment (optional)"/><div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><button className="btn btn-sm" onClick={()=>{setReviewOpen(false);waiting.forEach(o=>RP.act.requestChanges(o.id,body,'PR review'))}}>Request changes</button><button className="btn btn-sm btn-primary" onClick={approveAll}>Approve</button></div></div>}
<button className="btn mergebtn" disabled>{verdictState==='proven'&&prApproved?'Merge when ready':'Merge blocked'}</button>
</div></div>}
{tab==='checks'&&<div className="tl" data-note="Check runs: one per affected crate, so a counterexample in rustproof-core does not hide a waiting spec in examples/fib.">
{sc==='firstrun'?<Check title="rustproof / workspace" s="proven" summary={"No `.rustproof/` manifest in this repository. Nothing to verify; the check passes until init is committed."}/>:sc==='error'?<Check title="rustproof / examples/fib" s="failing" summary={"**Extraction failed.** Charon 0.1.72 could not translate `HashMap::insert` in `fib::go`. The gate fails closed."} ann={[{path:'examples/fib/src/lib.rs:12',msg:'unsupported: HashMap::insert has no Aeneas model · brick memo-to-accumulator applies'}]}/>:<>
<Check title="rustproof / rustproof-core" s={block?'counterexample':counts.needs_review?'needs_review':'proven'} summary={`| State | Obligations |\n|---|---|\n| ● Proven | check_ok_sound, proven_requires_check |\n| ◆ Needs review | ${all.find(o=>o.id==='verdict').state==='needs_review'?'verdict_pass_sound (changed)':'—'} |\n| ✕ Counterexample | percent_bounded |\n| △ Weak spec | rank_perm |\n| ↻ Stale | hash_tree_det |`} ann={[{path:'crates/core/src/coverage.rs:10',msg:'counterexample: percent(42_949_673, 42_949_673) — done * 100 overflows u32'},{path:'crates/core/src/rank.rs:17',msg:'weak spec: rank_perm holds when sort_by_score is a no-op'},{path:'crates/core/src/gate.rs:45',msg:'spec changed: verdict_pass_sound now covers State::Stale — needs CODEOWNERS review'}]}/>
<Check title="rustproof / examples/fib" s={all.find(o=>o.id==='fib').state} summary={all.find(o=>o.id==='fib').state==='needs_review'?"◆ `fib_spec` waiting for review. Patch `memo-to-accumulator` applied; 10,000 differential inputs agree.\n\n> For every 64-bit integer n where n ≤ 93, `fib(n)` returns the n-th Fibonacci number.":all.find(o=>o.id==='fib').state==='proven'?`● \`fib_spec\` proven ∎ against tree \`${r.tree}\` · ${all.find(o=>o.id==='fib').timing.prove} s search · ${all.find(o=>o.id==='fib').timing.check} s check`:"◌ `fib_spec` approved · proof search running"} ann={[{path:'examples/fib/src/lib.rs:3',msg:'precondition n ≤ 93: fib(94) overflows u64'}]}/>
<Check title="rustproof / rustproof-std" s="searching" summary={"◌ `merge_sorted_spec` searching 3/5 · Leanstral · worker us-east-1/3"}/></>}
</div>}
{tab==='files'&&<div className="tl"><div className="files" data-note="Files tab: specs live in their own directory under CODEOWNERS, so branch protection, not policy, enforces human review."><div className="fh"><code>.rustproof/specs/fib_spec.lean</code><span className="chip">CODEOWNERS @mara</span><span className="c3">+8</span></div><pre className="md-code lean" dangerouslySetInnerHTML={{__html:all.find(o=>o.id==='fib').spec.lean.split('\n').map(l=>`<span class="add">+${RP.hlLean(l)}</span>`).join('\n')}}/><div className="fh"><code>.rustproof/specs/verdict_pass_sound.lean</code><span className="chip">CODEOWNERS @mara</span><span className="c3">−1 +1</span></div><pre className="md-code diff">{RP.diffLines(all.find(o=>o.id==='verdict').specPrev.lean,all.find(o=>o.id==='verdict').spec.lean).map((x,i)=><span key={i} className={x.t==='add'?'add':x.t==='del'?'del':''}>{(x.t==='add'?'+':x.t==='del'?'-':' ')+x.s+'\n'}</span>)}</pre><div className="fh"><code>.rustproof/patches/fib.patch</code><span className="chip">rustproof[bot]</span><span className="c3">+29</span></div><div className="fh"><code>.rustproof/manifest.toml</code><span className="c3">+14 −2</span></div><div className="fh"><code>examples/fib/src/lib.rs</code><span className="c3">+17</span></div><div className="fh"><code>crates/core/src/gate.rs</code><span className="c3">+1 −1</span></div></div></div>}
</div></div>}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
