const {useState,useEffect,useMemo,useRef}=React;
function Glyph({s,spin}){return <span className="st" data-s={s}><span className={'g'+(spin&&(s==='searching'||s==='checking')?' spin':'')}>{RP.GLYPH[s]}</span></span>}
function StatusChip({s,progress}){const run=s==='searching'||s==='checking';return <span className="chip" data-s={s} data-note="StatusChip. Glyph + label from the shared status vocabulary; semantic tint is secondary, the glyph carries meaning alone."><span className={'g mono'+(run?' spin':'')} style={{display:'inline-block'}}>{RP.GLYPH[s]}</span>{RP.LABEL[s]}{progress&&s==='searching'?` ${progress.attempt}/${progress.of}`:''}</span>}
function Code({code,lang,title,diff,hl}){if(code===undefined)return null;return <div dangerouslySetInnerHTML={{__html:RP.codeHTML(code,{lang,title,diff,hlLines:hl})}}/>}
function NavItem({label,count,active,href,disabled}){return <a className={'nav-item'+(active?' active':'')} href={href||'#'} aria-disabled={disabled?'true':undefined} onClick={e=>{if(disabled)e.preventDefault()}} title={disabled?'Lands in a later round':undefined}>{label}{count?<span className="cnt">{count}</span>:null}</a>}
function Shell({active,crumbs,children}){
const {ui,user,counts}=RP.useStore();
const needs=(counts.needs_review||0)+(counts.counterexample||0)+(counts.weak_spec||0);
return <div className="shell">
<aside className="side">
<a className="wordmark" href="../index.html"><i>∎</i>rustproof</a>
<div className="org"><span className="avatar">R</span>Retry AI<span className="c3" style={{marginLeft:'auto'}}>▾</span></div>
<nav className="nav" data-note="Sidebar nav. Routes not in this round are disabled; the Needs-you count sums needs_review + counterexample + weak_spec from the store.">
<NavItem label="Home" disabled/>
<div className="nav-sec">retry-ai/rustproof</div>
<NavItem label="Overview" disabled/>
<NavItem label="Runs" disabled/>
<NavItem label="Needs you" count={needs} active={active==='needs'} href="spec-review.html"/>
<NavItem label="Settings" disabled/>
</nav>
<div className="side-foot"><span className="t-caption up c3">Patched tree · main</span><code className="t-code-sm">{RP.RUN.tree}</code></div>
</aside>
<div className="main">
<header className="topbar">{crumbs.map((c,i)=><React.Fragment key={i}>{i>0&&<span className="sep">/</span>}<span className={i===crumbs.length-1?'cur':''}>{c}</span></React.Fragment>)}
<div className="right"><span className="who"><span className="avatar">{user.init}</span>{user.name}<span className="c3">· {user.role}</span></span></div></header>
{children}
</div></div>}
Object.assign(window,{Glyph,StatusChip,Code,Shell,NavItem});
