(()=>{
const KEY='rp.proto.state.v1',UIKEY='rp.proto.ui.v1';
const GLYPH={proven:'●',checking:'◌',searching:'◌',needs_review:'◆',failing:'✕',counterexample:'✕',weak_spec:'△',stale:'↻',excluded:'○'};
const LABEL={proven:'Proven',checking:'Checking',searching:'Searching',needs_review:'Needs review',failing:'Failing',counterexample:'Counterexample',weak_spec:'Weak spec',stale:'Stale',excluded:'Excluded'};
const USERS={jonas:{name:'Jonas Lind',handle:'jonas',role:'Developer',init:'JL',owner:false},mara:{name:'Mara Okafor',handle:'mara',role:'CODEOWNER · .rustproof/specs',init:'MO',owner:true}};
const RUN={id:'run_01HX4K',trigger:{kind:'pull_request',pr:212,title:'Add fib example; block stale obligations in the gate',branch:'jonas/fib-example',commit:'a3f9c1e',base:'main'},tree:'7c2e91a',startedAt:Date.now()-14*60e3,worker:'us-east-1 · worker 3',cache:{hits:38,total:47}};
const FIB_BEFORE=`use std::collections::HashMap;

pub fn fib(n: u64) -> u64 {
    fn go(n: u64, memo: &mut HashMap<u64, u64>) -> u64 {
        if n < 2 {
            return n;
        }
        if let Some(&v) = memo.get(&n) {
            return v;
        }
        let v = go(n - 1, memo) + go(n - 2, memo);
        memo.insert(n, v);
        v
    }
    go(n, &mut HashMap::new())
}`;
const FIB_AFTER=`pub fn fib(n: u64) -> u64 {
    let mut a: u64 = 0;
    let mut b: u64 = 1;
    let mut i: u64 = 0;
    while i < n {
        let next = a + b;
        a = b;
        b = next;
        i += 1;
    }
    a
}`;
const FIB_LEAN=`def fibSpec : Nat → Nat
  | 0 => 0
  | 1 => 1
  | n + 2 => fibSpec (n + 1) + fibSpec n

theorem fib_spec (n : U64) (h : n.val ≤ 93) :
    ∃ r, fib n = ok r ∧ r.val = fibSpec n.val`;
const VERDICT_SRC=`pub fn verdict(obs: &[Obligation]) -> Verdict {
    let mut i: usize = 0;
    while i < obs.len() {
        match obs[i].state {
            State::Failing | State::Counterexample | State::Stale => {
                return Verdict::Block;
            }
            _ => {}
        }
        i += 1;
    }
    Verdict::Pass
}`;
const VERDICT_LEAN=`theorem verdict_pass_sound (obs : List Obligation) :
    verdict obs = ok .pass →
    ∀ o ∈ obs, o.state ≠ .failing ∧ o.state ≠ .counterexample ∧ o.state ≠ .stale`;
const VERDICT_LEAN_PREV=`theorem verdict_pass_sound (obs : List Obligation) :
    verdict obs = ok .pass →
    ∀ o ∈ obs, o.state ≠ .failing ∧ o.state ≠ .counterexample`;
const POLICY_SRC=`pub fn check(p: &Proof, allowed: &[Axiom]) -> Result<(), PolicyError> {
    if p.has_sorry {
        return Err(PolicyError::Sorry);
    }
    let mut i: usize = 0;
    while i < p.axioms.len() {
        if !contains(allowed, p.axioms[i]) {
            return Err(PolicyError::Axiom(p.axioms[i]));
        }
        i += 1;
    }
    Ok(())
}`;
const POLICY_LEAN=`theorem check_ok_sound (p : Proof) (allowed : List Axiom) :
    check p allowed = ok (.ok ()) →
    p.hasSorry = false ∧ ∀ a ∈ p.axioms, a ∈ allowed`;
const STATUS_SRC=`pub fn next_state(cur: State, ev: Event) -> State {
    match ev {
        Event::SourceChanged => State::Stale,
        Event::SpecApproved => {
            if cur == State::NeedsReview { State::Searching } else { cur }
        }
        Event::ProofChecked => {
            if cur == State::Checking { State::Proven } else { cur }
        }
        Event::ProofFailed => State::Failing,
        Event::Counterexample => State::Counterexample,
    }
}`;
const STATUS_LEAN=`theorem source_change_is_stale (s : State) :
    next_state s .sourceChanged = ok .stale

theorem proven_requires_check (s : State) (e : Event) :
    next_state s e = ok .proven → s = .checking ∧ e = .proofChecked`;
const PERCENT_SRC=`pub fn percent(done: u32, total: u32) -> u32 {
    done * 100 / total
}`;
const PERCENT_LEAN=`theorem percent_bounded (done total : U32) (h : done.val ≤ total.val) :
    ∃ r, percent done total = ok r ∧ r.val ≤ 100`;
const RANK_SRC=`pub fn rank(cands: &[Candidate]) -> Vec<Candidate> {
    let mut out = cands.to_vec();
    sort_by_score(&mut out);
    out
}`;
const RANK_LEAN=`theorem rank_perm (cands : List Candidate) :
    ∃ r, rank cands = ok r ∧ r.length = cands.length`;
const MERGE_SRC=`pub fn merge_sorted(a: &[u32], b: &[u32]) -> Vec<u32> { /* 24 lines */ }`;
const MERGE_LEAN=`theorem merge_sorted_spec (a b : List U32) (ha : Sorted a) (hb : Sorted b) :
    ∃ r, merge_sorted a b = ok r ∧ Sorted r ∧ r ~ a ++ b`;
const PRO_PY=`# billing/prorate.py
def prorate(amount_cents: int, days_used: int, days_in_period: int) -> int:
    return amount_cents * days_used // days_in_period`;
const PRO_RS=`// .rustproof/crates/billing/src/lib.rs
pub fn prorate(amount_cents: u64, days_used: u64, days_in_period: u64) -> u64 {
    amount_cents * days_used / days_in_period
}`;
const PRO_SHIM=`# patched tree
from rustproof_ext.billing import prorate as _prorate_rs

def _prorate_ok(a: int, u: int, d: int) -> bool:          # generated from the approved spec
    return 0 < d and 0 <= u <= d and 0 <= a and a * u <= 18_446_744_073_709_551_615

def prorate(amount_cents: int, days_used: int, days_in_period: int) -> int:
    if _prorate_ok(amount_cents, days_used, days_in_period):
        return _prorate_rs(amount_cents, days_used, days_in_period)   # proven
    return amount_cents * days_used // days_in_period                 # original`;
const PRO_LEAN=`theorem prorate_spec (a u d : U64) (hd : 0 < d.val) (hu : u.val ≤ d.val)
    (hf : a.val * u.val ≤ U64.max) :
    ∃ r, prorate a u d = ok r ∧ r.val ≤ a.val`;
const APPROVE_PY=`# platform/policy/approve.py
def may_approve(role: Role, is_author: bool, owns_specs: bool) -> bool:
    return owns_specs and role in (Role.OWNER, Role.MAINTAINER) and not is_author`;
const APPROVE_RS=`pub fn may_approve(role: Role, is_author: bool, owns_specs: bool) -> bool {
    owns_specs && (role == Role::Owner || role == Role::Maintainer) && !is_author
}`;
const APPROVE_LEAN=`theorem may_approve_sound (role : Role) (is_author owns_specs : Bool) :
    may_approve role is_author owns_specs = ok true →
    owns_specs = true ∧ is_author = false ∧ (role = .owner ∨ role = .maintainer)`;
const O=o=>Object.assign({patch:null,specPrev:null,surfaced:null,counterexample:null,reason:null,revision:1},o);
const FIXTURE=[
O({id:'fib',crate:'examples/fib',module:'lib',fn:'fib',file:'examples/fib/src/lib.rs',line:3,sig:'pub fn fib(n: u64) -> u64',state:'needs_review',kind:'new',theorem:'fib_spec',src:FIB_BEFORE,patch:{brick:'memo-to-accumulator',desc:'Memoized recursion with a HashMap becomes an accumulator loop. HashMap has no Aeneas model; two accumulators need none.',after:FIB_AFTER,diffTests:{inputs:10000,agree:true,ms:812},template:'invariant: a = fibSpec i ∧ b = fibSpec (i + 1)'},spec:{english:'For every 64-bit integer n where n ≤ 93, fib(n) returns the n-th Fibonacci number.',pre:'n ≤ 93',lean:FIB_LEAN},surfaced:{title:'fib(94) overflows u64',body:'fib(93) = 12,200,160,415,121,876,738 fits in a u64. fib(94) does not. The counterexample finder reported fib(94), so the theorem carries the precondition n ≤ 93. No unit test like fib(10) == 55 would reveal this.'},hash:'c91f0a4',timing:{extract:2.4,propose:1.1}}),
O({id:'prorate',lang:'python',crate:'billing',module:'prorate',fn:'prorate',file:'billing/prorate.py',line:2,sig:'def prorate(amount_cents: int, days_used: int, days_in_period: int) -> int',state:'needs_review',kind:'new',theorem:'prorate_spec',src:PRO_PY,patch:{brick:'port-python (guarded inter-op)',afterLang:'rust',afterFile:'.rustproof/crates/billing/src/lib.rs',shim:PRO_SHIM,shimFile:'billing/prorate.py',desc:'The pure Python span is ported to Rust in the provable subset and called through a compiled extension (PyO3, maturin). The patch dispatches on the approved precondition: inside it the proven Rust runs, outside it the original Python runs unchanged.',after:PRO_RS,diffTests:{inputs:10000,agree:true,ms:1340,note:'both versions agree or both fail on every input · port 1.9× faster than the Python it replaces'},template:'arithmetic bound: a * u ≤ U64.max, 0 < d'},spec:{english:'For every amount, days used and period length where the period is at least one day, the days used don’t exceed it, and amount × days used fits in 64 bits, prorate returns at most the amount.',pre:'0 < d ∧ u ≤ d ∧ a · u ≤ U64.max',lean:PRO_LEAN},surfaced:{title:'prorate(100, 1, 0) divides by zero',body:'Two things the handler never checked: a zero-day period divides by zero, and a large amount over a long period overflows 64 bits. The failure search reported prorate(100, 1, 0) before the spec was proposed, so the precondition arrives with the theorem. Decide: reject a zero-day period at the API boundary with a 400, or keep the guarded fallback. Either way, every call inside the precondition runs proven code, and the proof says a customer is never charged more than the full amount.'},hash:'f30d2b7',timing:{extract:3.1,propose:1.4}}),
O({id:'may_approve',lang:'python',crate:'rustproof-platform',module:'policy',fn:'may_approve',file:'platform/policy/approve.py',line:2,sig:'def may_approve(role: Role, is_author: bool, owns_specs: bool) -> bool',state:'proven',kind:'approved',theorem:'may_approve_sound',src:APPROVE_PY,patch:{brick:'port-python (guarded inter-op)',afterLang:'rust',afterFile:'.rustproof/crates/policy/src/lib.rs',after:APPROVE_RS,diffTests:{inputs:10000,agree:true,ms:410},template:'boolean algebra'},spec:{english:'If the platform says a person may approve a spec, that person owns the specs directory, holds the owner or maintainer role, and did not author the change.',pre:null,lean:APPROVE_LEAN},approvedStatic:{by:'mara',at:'Sep 26'},hash:'2c8e1b5',timing:{extract:1.0,prove:9,check:0.6}}),
O({id:'verdict',crate:'rustproof-core',module:'gate',fn:'verdict',file:'crates/core/src/gate.rs',line:41,sig:'pub fn verdict(obs: &[Obligation]) -> Verdict',state:'needs_review',kind:'changed',theorem:'verdict_pass_sound',src:VERDICT_SRC,spec:{english:'verdict(obs) is Pass only if no obligation in obs is failing, has a counterexample, or is stale.',pre:null,lean:VERDICT_LEAN},specPrev:{english:'verdict(obs) is Pass only if no obligation in obs is failing or has a counterexample.',lean:VERDICT_LEAN_PREV,approvedBy:'mara',approvedAt:'Sep 30'},surfaced:{title:'The claim gets stronger',body:'Commit a3f9c1e adds State::Stale to the blocking arm. The approved theorem still holds for the new code, but it no longer says everything the code guarantees. The proposed revision adds the stale case. A strengthened spec is still a spec change, so it needs a CODEOWNER.'},hash:'e42b7d0',timing:{extract:1.9,propose:0.8}}),
O({id:'check',crate:'rustproof-core',module:'policy',fn:'check',file:'crates/core/src/policy.rs',line:12,sig:'pub fn check(p: &Proof, allowed: &[Axiom]) -> Result<(), PolicyError>',state:'proven',kind:'approved',theorem:'check_ok_sound',src:POLICY_SRC,spec:{english:'If check returns Ok, the proof contains no sorry and every axiom it uses is in the allowed set.',pre:null,lean:POLICY_LEAN},approvedStatic:{by:'mara',at:'Sep 12'},hash:'0b77f21',timing:{extract:1.2,prove:38,check:0.9}}),
O({id:'next_state',crate:'rustproof-core',module:'status',fn:'next_state',file:'crates/core/src/status.rs',line:28,sig:'pub fn next_state(cur: State, ev: Event) -> State',state:'proven',kind:'approved',theorem:'proven_requires_check',src:STATUS_SRC,spec:{english:'A changed source always yields Stale. A function becomes Proven only from Checking, on a checked proof.',pre:null,lean:STATUS_LEAN},approvedStatic:{by:'mara',at:'Sep 12'},hash:'51ac9e3',timing:{extract:1.4,prove:52,check:1.1}}),
O({id:'percent',crate:'rustproof-core',module:'coverage',fn:'percent',file:'crates/core/src/coverage.rs',line:9,sig:'pub fn percent(done: u32, total: u32) -> u32',state:'counterexample',kind:'approved',theorem:'percent_bounded',src:PERCENT_SRC,spec:{english:'For done ≤ total, percent(done, total) is at most 100.',pre:'done ≤ total',lean:PERCENT_LEAN},counterexample:{input:'percent(42_949_673, 42_949_673)',expected:'r ≤ 100',actual:'done * 100 overflows u32 (4,294,967,300 > 4,294,967,295)',line:10},approvedStatic:{by:'mara',at:'Sep 12'},hash:'9d31c58',timing:{extract:0.6,search:120}}),
O({id:'rank',crate:'rustproof-core',module:'rank',fn:'rank',file:'crates/core/src/rank.rs',line:17,sig:'pub fn rank(cands: &[Candidate]) -> Vec<Candidate>',state:'weak_spec',kind:'approved',theorem:'rank_perm',src:RANK_SRC,spec:{english:'rank returns as many candidates as it was given.',pre:null,lean:RANK_LEAN},mutant:'Replacing sort_by_score with a no-op still satisfies rank_perm. The spec says nothing about order.',approvedStatic:{by:'mara',at:'Sep 19'},hash:'77e0a12',timing:{extract:0.8,prove:14,check:0.7,mutate:41}}),
O({id:'merge_sorted',crate:'rustproof-std',module:'merge',fn:'merge_sorted',file:'crates/std/src/merge.rs',line:5,sig:'pub fn merge_sorted(a: &[u32], b: &[u32]) -> Vec<u32>',state:'searching',kind:'approved',theorem:'merge_sorted_spec',src:MERGE_SRC,spec:{english:'Merging two sorted slices yields a sorted permutation of their concatenation.',pre:'a and b sorted',lean:MERGE_LEAN},progress:{attempt:3,of:5},approvedStatic:{by:'mara',at:'Oct 2'},hash:'b8c4d19',timing:{extract:1.1}}),
O({id:'hash_tree',crate:'rustproof-core',module:'tree',fn:'hash_tree',file:'crates/core/src/tree.rs',line:33,sig:'pub fn hash_tree(files: &[File]) -> Hash',state:'stale',kind:'approved',theorem:'hash_tree_det',src:'pub fn hash_tree(files: &[File]) -> Hash { /* 18 lines */ }',spec:{english:'hash_tree is deterministic in the order-independent set of files.',pre:null,lean:'theorem hash_tree_det (a b : List File) (h : a ~ b) :\n    hash_tree a = hash_tree b'},approvedStatic:{by:'mara',at:'Sep 12'},hash:'44f2a0c',timing:{}}),
O({id:'read_manifest',crate:'rustproof-cli',module:'manifest',fn:'read_manifest',file:'crates/cli/src/manifest.rs',line:21,sig:'pub fn read_manifest(path: &Path) -> io::Result<Manifest>',state:'excluded',kind:'excluded',reason:'I/O: std::fs::read_to_string',src:'pub fn read_manifest(path: &Path) -> io::Result<Manifest> {\n    let s = std::fs::read_to_string(path)?;\n    parse_manifest(&s)\n}',spec:null,hash:'1e9fa73',timing:{}}),
O({id:'fetch_token',crate:'rustproof-cli',module:'auth',fn:'fetch_token',file:'crates/cli/src/auth.rs',line:58,sig:'pub async fn fetch_token(cfg: &Config) -> Result<Token>',state:'excluded',kind:'excluded',reason:'async + network',src:'pub async fn fetch_token(cfg: &Config) -> Result<Token> { /* 31 lines */ }',spec:null,hash:'ab10c7e',timing:{}}),
];
const load=(k,d)=>{try{return Object.assign({},d,JSON.parse(localStorage.getItem(k)||'{}'))}catch(e){return d}};
let S=load(KEY,{ob:{},events:[]});
let UI=load(UIKEY,{theme:'dark',user:'jonas',scenario:'live',annotate:false});
const subs=new Set();
const save=()=>{localStorage.setItem(KEY,JSON.stringify(S));emit()};
const emit=()=>{subs.forEach(f=>{try{f()}catch(e){}})};
const PHASES=[['searching',4200],['checking',1400]];
function derive(o){
const x=S.ob[o.id]||{};const out=Object.assign({},o,x);
if(x.approval&&o.state==='needs_review'){const el=Date.now()-x.approval.at;let acc=0,st='proven';for(const[s,d]of PHASES){acc+=d;if(el<acc){st=s;break}}out.state=st;out.liveState=true;if(st==='searching')out.progress={attempt:Math.min(5,1+Math.floor(el/900)),of:5};if(st==='proven')out.timing=Object.assign({},o.timing,{prove:Math.round(PHASES[0][1]/100)/10,check:1.4});}
return out;
}
const all=()=>FIXTURE.map(derive);
const get=id=>derive(FIXTURE.find(o=>o.id===id));
const inProgress=()=>all().some(o=>o.liveState&&o.state!=='proven');
let tick=null;const ensureTick=()=>{if(tick)return;tick=setInterval(()=>{emit();if(!inProgress()){clearInterval(tick);tick=null}},500)};
const act={
approve(id,where){const u=USERS[UI.user];S.ob[id]=Object.assign({},S.ob[id],{approval:{by:u.handle,at:Date.now(),where},changesRequested:null});S.events.unshift({t:Date.now(),id,kind:'approved',by:u.handle,where});save();ensureTick();RP.toast(`${LABEL.searching}: ${get(id).theorem} · proof search started`,'searching')},
requestChanges(id,note,where){const u=USERS[UI.user];S.ob[id]=Object.assign({},S.ob[id],{changesRequested:{by:u.handle,at:Date.now(),note,where}});S.events.unshift({t:Date.now(),id,kind:'changes_requested',by:u.handle,where,note});save();RP.toast(`Changes requested on ${get(id).theorem}`,'needs_review')},
reset(){S={ob:{},events:[]};save()}
};
const setUI=p=>{UI=Object.assign({},UI,p);localStorage.setItem(UIKEY,JSON.stringify(UI));applyUI();emit()};
function applyUI(){document.documentElement.dataset.theme=UI.theme;document.documentElement.dataset.annotate=UI.annotate?'on':'off';document.documentElement.dataset.scenario=UI.scenario;renderNotes()}
window.addEventListener('storage',e=>{if(e.key===KEY){S=load(KEY,{ob:{},events:[]});if(inProgress())ensureTick();emit()}if(e.key===UIKEY){UI=load(UIKEY,UI);applyUI();emit()}});
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const RUST_KW=/\b(pub|fn|let|mut|while|if|else|return|match|use|struct|enum|impl|for|in|loop|break|continue|self|Self|as|ref|where|async|await|unsafe|const|static|mod|crate|true|false)\b/;
function hlRust(code){return esc(code).replace(/(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b\d[\d_]*\b)|(\b[a-z_][a-z0-9_]*!)|(\b(?:pub|fn|let|mut|while|if|else|return|match|use|struct|enum|impl|for|in|loop|break|continue|self|Self|as|ref|where|async|await|unsafe|const|static|mod|crate|true|false)\b)|(\b(?:u8|u32|u64|u128|usize|i32|i64|bool|str|[A-Z][A-Za-z0-9]*)\b)|(\b[a-z_][a-z0-9_]*)(?=\()/gm,(m,c,s,n,mac,k,t,f)=>c?`<span class="cm">${c}</span>`:s?`<span class="s">${s}</span>`:n?`<span class="n">${n}</span>`:mac?`<span class="m">${mac}</span>`:k?`<span class="k">${k}</span>`:t?`<span class="ty">${t}</span>`:f?`<span class="fn">${f}</span>`:m)}
function hlPython(code){return esc(code).replace(/(#.*$)|("""[\s\S]*?"""|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d[\d_]*\b)|(\b(?:def|return|if|elif|else|raise|from|import|as|class|for|in|while|not|and|or|None|True|False|lambda|with|try|except|pass)\b)|(\b(?:int|str|bool|float|ValueError|Optional|list|dict|Role)\b)|(\b[a-z_][a-z0-9_]*)(?=\()/gm,(m,c,s,n,k,t,f)=>c?`<span class="cm">${c}</span>`:s?`<span class="s">${s}</span>`:n?`<span class="n">${n}</span>`:k?`<span class="k">${k}</span>`:t?`<span class="ty">${t}</span>`:f?`<span class="fn">${f}</span>`:m)}
function hlLean(code){return esc(code).replace(/(--.*$)|(\b\d+\b)|(\b(?:theorem|def|lemma|by|fun|ok|fail|match|with|if|then|else|let|in|where|sorry)\b)|([∃∀→∧∨¬≠≤≥∈~∎])|(\b(?:Nat|U8|U32|U64|U128|List|Prop|Type|Obligation|Proof|Axiom|State|Event|Candidate|File|Hash|Sorted|Verdict|Result)\b)|(\.[a-z][A-Za-z]*)/gm,(m,c,n,k,sym,t,ctor)=>c?`<span class="cm">${c}</span>`:n?`<span class="n">${n}</span>`:k?`<span class="k">${k}</span>`:sym?`<span class="k">${sym}</span>`:t?`<span class="ty">${t}</span>`:ctor?`<span class="s">${ctor}</span>`:m)}
function diffLines(a,b){const A=a.split('\n'),B=b.split('\n');const n=A.length,m=B.length;const L=Array.from({length:n+1},()=>new Array(m+1).fill(0));for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=A[i]===B[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);const out=[];let i=0,j=0;while(i<n&&j<m){if(A[i]===B[j]){out.push({t:'ctx',a:i+1,b:j+1,s:A[i]});i++;j++}else if(L[i+1][j]>=L[i][j+1]){out.push({t:'del',a:i+1,s:A[i]});i++}else{out.push({t:'add',b:j+1,s:B[j]});j++}}while(i<n){out.push({t:'del',a:i+1,s:A[i]});i++}while(j<m){out.push({t:'add',b:j+1,s:B[j]});j++}return out}
function codeHTML(code,{lang='rust',title,hlLines=[],start=1,diff}={}){const hl=lang==='lean'?hlLean:lang==='python'?hlPython:hlRust;let rows;if(diff){rows=diffLines(code,diff).map(r=>`<div class="row ${r.t==='ctx'?'':r.t}"><span class="ln">${r.t==='add'?r.b:r.a}</span><span class="mk">${r.t==='add'?'+':r.t==='del'?'−':' '}</span><span class="src">${hl(r.s)||' '}</span></div>`).join('')}else{rows=code.split('\n').map((l,i)=>`<div class="row${hlLines.includes(i+1)?' hl':''}"><span class="ln">${i+start}</span><span class="mk"></span><span class="src">${hl(l)||' '}</span></div>`).join('')}return `<pre class="code${lang==='lean'?' lean':''}">${title?`<header>${title}</header>`:''}<div class="body">${rows}</div></pre>`}
function toast(msg,state){let box=document.querySelector('.toasts');if(!box){box=document.createElement('div');box.className='toasts';document.body.appendChild(box)}const t=document.createElement('div');t.className='toast';t.innerHTML=`<span class="st" data-s="${state||''}"><span class="g">${GLYPH[state]||'·'}</span></span><span>${esc(msg)}</span>`;box.appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300)},3200)}
let notesTimer=null;function renderNotes(){let p=document.querySelector('.notes');if(!UI.annotate){if(p)p.remove();return}const items=[...document.querySelectorAll('[data-note]')];if(!p){p=document.createElement('aside');p.className='notes';document.body.appendChild(p)}p.innerHTML=`<div class="t-caption up c3">Handoff notes · ${items.length}</div><ol>${items.map((el,i)=>`<li><b>${i+1}</b><span>${esc(el.dataset.note)}</span></li>`).join('')}</ol>`}
function mountProto(){if(document.querySelector('.proto'))return;const d=document.createElement('div');d.className='proto';d.innerHTML=`<button class="tog" data-k="toggle" title="Prototype controls"><span class="dotk"></span>proto</button><span class="pc"><span class="sep"></span><button class="pb" data-k="theme" title="Toggle theme"></button><select data-k="user" title="Acting as"><option value="jonas">as Jonas (dev)</option><option value="mara">as Mara (codeowner)</option></select><select data-k="scenario" title="Scenario"><option value="live">live data</option><option value="loading">loading</option><option value="empty">empty</option><option value="firstrun">first run</option><option value="error">error</option></select><button class="pb" data-k="annotate">notes</button><span class="sep"></span><button class="pb" data-k="reset" title="Reset approvals">reset</button></span>`;document.body.appendChild(d);const sync=()=>{d.querySelector('[data-k=theme]').textContent=UI.theme==='dark'?'☾ dark':'☼ light';d.querySelector('[data-k=user]').value=UI.user;d.querySelector('[data-k=scenario]').value=UI.scenario;d.querySelector('[data-k=annotate]').setAttribute('aria-pressed',String(UI.annotate));d.querySelector('.tog').textContent=d.classList.contains('open')?'proto ×':`proto · ${UI.user} · ${UI.scenario}${UI.theme==='light'?' · light':''}`};sync();subs.add(sync);d.addEventListener('click',e=>{const k=e.target.closest('[data-k]')?.dataset.k;if(k==='toggle'){d.classList.toggle('open');sync()}if(k==='theme')setUI({theme:UI.theme==='dark'?'light':'dark'});if(k==='annotate')setUI({annotate:!UI.annotate});if(k==='reset'){act.reset();toast('Prototype state reset')}});d.addEventListener('change',e=>{const k=e.target.dataset.k;if(k==='user')setUI({user:e.target.value});if(k==='scenario')setUI({scenario:e.target.value})});new MutationObserver(()=>{if(!UI.annotate)return;clearTimeout(notesTimer);notesTimer=setTimeout(renderNotes,150)}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-note']})}
const ago=t=>{const s=Math.max(0,Math.round((Date.now()-t)/1000));return s<60?`${s}s ago`:s<3600?`${Math.round(s/60)}m ago`:`${Math.round(s/3600)}h ago`};
const counts=()=>{const c={};all().forEach(o=>{c[o.state]=(c[o.state]||0)+1});return c};
window.RP={GLYPH,LABEL,USERS,RUN,FIXTURE,all,get,act,counts,ago,esc,hlRust,hlLean,hlPython,diffLines,codeHTML,toast,get ui(){return UI},setUI,subscribe(f){subs.add(f);return()=>subs.delete(f)},inProgress,
useStore(){const[,f]=React.useState(0);React.useEffect(()=>RP.subscribe(()=>f(x=>x+1)),[]);return{all:all(),ui:UI,counts:counts(),user:USERS[UI.user]}}};
applyUI();if(inProgress())ensureTick();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountProto);else mountProto();
})();
