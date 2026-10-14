# rustproof — Implementation Spec (public repo)

This is the build-facing spec for the **`rustproof`** repository: a public, Apache-2.0 monorepo holding the Rust CLI, the Claude Code plugin, the brick library, `rustproof-std`, the Lean helpers and the toolchain image. It lives at `design-docs/rustproof-spec.md`, and `CLAUDE.md` points to it (snippet at the end).

The product design document (`rustproof-design.md`) explains *why*. The companion **`rustproof-platform-spec.md`** covers the private platform repo (the website, the API and MCP server, the DBOS workers, Postgres, Railway). This file says *what to build in this repo, in what order, and how to know it's done*.

---

## 0. Rules for the agent (read first)

1. **Build the vertical slice first.** Get the Fibonacci example (Milestone 1) working end to end, offline, before generalizing anything.
2. **This repo must be useful without an account.** Every command except `login`, `--prover platform` and `beads sync` works with no network, or with only the user's own Mistral key.
3. **Never weaken a spec to make a proof pass.** Do not edit theorem statements under `.rustproof/specs/`. If a spec looks wrong, stop and ask.
4. **No escape hatches.** Never introduce `sorry`, `admit`, new `axiom` declarations, or `native_decide`. `rustproof check` must stay green.
5. **The patched tree is what ships.** Extraction, proofs, tests and release builds all run against the same materialized patched tree, and its hash is recorded. Never prove one tree and build another.
6. **Every pipeline primitive is a `rustproof step`** (§4.2): idempotent, keyed by content hash, JSON in and out. The platform orchestrates by calling these; nothing in the pipeline is reachable only from inside the binary.
7. **Show, don't claim.** Every "it works" is backed by a command and its output.
8. **Pin every toolchain.** Rust (stable for the CLI; the nightly Charon requires), Lean and Mathlib (the release-candidate toolchain and Mathlib revision pinned by Aeneas's `backends/lean`), Charon, Aeneas.
9. **Use the status vocabulary exactly** as defined in §7, everywhere: CLI output, JSON, mod UI.
10. **Generated files are never hand-edited.** Aeneas output and patches are regenerated, not patched by hand.
11. **Keep `crates/rustproof-core` inside the Aeneas subset.** It is proven as-is (M6).
12. **Nothing from the platform repo is a dependency.** The platform depends on this repo (pinned releases, schemas, the toolchain image), never the reverse.
13. **Small steps.** One component per PR. Tests in the same PR as the code.

---

## 1. What this repo is

rustproof takes a Rust workspace, classifies every function as provable, patchable or excluded, patches the patchable ones into the Aeneas subset at build time using a library of **bricks**, extracts the patched tree to Lean 4 (Charon → Aeneas), proposes theorems that a human approves, generates proofs (Leanstral), verifies them with the Lean kernel, and builds and ships the patched tree. I/O and other excluded code stay outside the proof boundary and are covered by tests.

This repository is the whole pipeline and everything a developer runs locally:

| Component | Where | What it is |
| --- | --- | --- |
| `rustproof` CLI | `crates/rustproof-cli` | One Rust binary per platform: the pipeline, the step protocol, local approvals, the local MCP server, the hook entry points |
| Pipeline | `crates/rustproof-pipeline` | The primitives, the step cache, the step protocol |
| Bricks | `crates/rustproof-bricks` | Rewrite patterns with proof templates |
| Verified components | `crates/rustproof-std` + `lean/RustproofStd` | Functions proven once, with their theorems |
| Proven core | `crates/rustproof-core` | The status machine, policy verdict, exit codes, check conclusion, manifest validation; proven by rustproof |
| Prover | `crates/rustproof-prover` | The `Prover` trait and the Leanstral agent loop |
| Claude Code plugin | `plugin/` | Skills, settings hooks, the mod, MCP and LSP config |
| Toolchain image | `images/toolchain` | Pinned Rust nightly, Charon, Aeneas, Lean, Mathlib cache, the CLI; published to a public registry |
| Schemas | `schemas/` | MCP tool schemas, the step protocol, and the slice of the platform API the CLI depends on |
| Python adapter | `crates/rustproof-python` | Span discovery, extension scaffolding, guarded patches, differential tests for Python projects |
| Examples | `examples/fib-rs`, `examples/billing-py` | The Milestone 1 crate and the Milestone 10 FastAPI app |

The private **platform** (website, API and MCP server, DBOS workers, Postgres) orchestrates this pipeline durably in the cloud, runs it on every PR, and hosts proof search for users without their own Mistral key. It depends on this repo through pinned releases; this repo never depends on it.

**License:** Apache-2.0, matching Aeneas, Charon and Leanstral.

---

## 2. Stack

| Component | Choice |
| --- | --- |
| CLI | One Rust binary: `clap`, `tokio`, `reqwest`, `keyring`, `serde`. Release builds per platform (for example with `dist`), published as GitHub releases and in the toolchain image. |
| Rust analysis | `syn` for scanning and patching (bricks are AST rewrites). A `syn` scan yields candidates; extraction with Charon confirms what's extractable. |
| Local runs | A content-addressed step cache under `.rustproof/state/` (§4.3). No database, no daemon. |
| Prover | The `Prover` trait with `leanstral-api` (Mistral's hosted endpoint, the user's key), `manual`, and `platform` (§9) |
| Differential and property tests | `proptest` (generated inputs from function signatures); `cargo-mutants` for mutation |
| Proof toolchain | Charon, Aeneas, Lean 4 + Lake + Mathlib, pinned in `images/toolchain` |
| Claude Code mod | TypeScript hooks module in `plugin/` |

Keep the `Prover` interface model-agnostic.

### 2.1 Where each tool runs

Charon and Aeneas are heavy to install (Aeneas is OCaml and is easiest through Nix). So:

- **Scanning and patching** run anywhere the CLI runs; they need only `syn`.
- **Extraction (Charon + Aeneas)** runs in the toolchain image this repo publishes (`images/toolchain/`), locally through Docker/Podman when available, or on the platform's workers, which build on the same image.
- **Checking (Lean + Lake)** runs locally. Aeneas's Lean library depends on Mathlib, so `rustproof doctor --install` installs elan, the pinned Lean toolchain (a release candidate, as pinned by Aeneas), and runs `lake exe cache get` for Mathlib's prebuilt artifacts (several GB on first install). Checking is cheap after that.
- **Proof search** runs wherever the CLI runs. `--prover leanstral-api` calls Mistral's hosted Leanstral endpoint with your own key, `--prover manual` reads proofs written by hand in `.rustproof/proofs/` (how M0's hand proof is checked), and `--prover platform` asks the rustproof platform to run it for you. The agent loop that drives Leanstral lives in this repo (§9), so the open-source CLI is complete on its own.

---

## 3. Repo layout

```
rustproof/
├── Cargo.toml                  # Rust workspace
├── LICENSE                     # Apache-2.0
├── crates/
│   ├── rustproof-cli/          # the `rustproof` binary: commands, step protocol, hooks, local MCP
│   ├── rustproof-pipeline/     # primitives, step cache, step protocol types
│   ├── rustproof-bricks/       # the brick library: rewrite patterns + proof templates
│   ├── rustproof-std/          # verified components, with their Lean theorems
│   ├── rustproof-prover/       # Prover trait: leanstral-api (the agent loop), manual, platform client
│   ├── rustproof-core/         # pure decisions in the Aeneas subset (proven as-is, M6)
│   └── rustproof-python/       # Python front end: candidates, scaffold, guarded patches, differential tests
├── plugin/                     # Claude Code plugin, including the mod (see §8)
├── lean/
│   └── RustproofStd/           # shared Lean helpers, tactics, and rustproof-std theorems
├── images/
│   └── toolchain/              # Dockerfile: pinned Rust nightly, Charon, Aeneas, Lean, Mathlib cache, CLI
├── schemas/
│   ├── mcp/                    # MCP tool schemas shared by `rustproof mcp` and the platform's server
│   ├── steps/                  # step protocol request/response schemas (§4.2)
│   └── platform-api/           # the slice of the platform's OpenAPI the CLI depends on (contract tests)
├── examples/
│   ├── fib-rs/                 # Milestone 1 reference crate (the vibe-coded fib)
│   └── billing-py/             # Milestone 10 reference app (FastAPI with `prorate`)
└── docs/
```

---

## 4. The pipeline

### 4.1 Primitives (each is an idempotent step)

| Step | Does |
| --- | --- |
| `scan` | Parse the workspace with `syn`; build the call graph; classify every function as a candidate: `provable` (in the subset as written), `patchable` (a brick applies), or `excluded` (I/O, unsafe, FFI, async/concurrency, interior mutability, trait objects, or library types with no model and no brick). Record the reason for every exclusion. `extract` confirms or downgrades candidates: a `provable` candidate that fails extraction becomes `patchable` if a brick applies, else `excluded: unsupported`. Compute `source_hash` per function as the hash of its normalized `syn` item plus its workspace callees', so formatting and comment edits change nothing. |
| `rank` | Score by provability and value (call frequency, public API, criticality) |
| `patch` | For each patchable function, instantiate the chosen brick and write `.rustproof/patches/<fn>.patch`. Provable functions get an empty patch. Materialize the patched tree at `target/rustproof/tree/` (§4.6). Record `patched_hash` = hash of the patched tree's tracked files, excluding the manifest. |
| `extract` | On the patched tree: `charon cargo --preset=aeneas` → `.llbc`; `aeneas -backend lean` → `.rustproof/lean/Generated/`. Excluded functions are declared opaque to Charon (`[package.metadata.charon] opaque = [...]` in the patched tree's `Cargo.toml`, or `#[charon::opaque]`; never `--exclude`, which drops the item and breaks references), so extraction of the rest proceeds and each excluded callee becomes a declared signature in the generated Lean. Record `lean_hash` per obligation = hash of its generated Lean plus its callees'. |
| `propose_specs` | First run a short failure search on the patched function (`proptest`, panics and overflow) to find the input boundary. Then write the theorem as a Lean `Prop` in `.rustproof/specs/` with the precondition, a plain-English docstring, and any counterexample attached as evidence; status `needs_review`. A revision (`rustproof spec propose --revise <fn> --note "…"`) rewrites the proposal and returns it to `needs_review`. |
| `prove` | Run proof search through the `Prover` trait (`manual`, `agent`, `leanstral-api`, or `platform`, §9); a brick's proof template is passed as the starting skeleton; write proofs of exactly those `Prop`s to `.rustproof/proofs/` |
| `check` | `lake build` + policy checks (§4.5) |
| `mutate` | Behavior-changing mutants of the patched Rust (`cargo-mutants`), re-extract, re-check; a proof that still checks against a mutant marks `weak_spec`. Discard mutants the differential tests can't tell apart. This is a heuristic for specs that don't constrain the code, not a completeness check. |
| `counterexample` | Property-based search (`proptest`) and fuzzing for a failing input. The oracle is the spec's reference definition when it is computable (rustproof compiles it to Rust, or evaluates it with Lean `#eval`); otherwise only panics and overflow are detectable, and the obligation says so. |
| `build` | `cargo build --release` on the patched tree with overflow checks scoped to workspace members (§4.6); stamp the artifact with `patched_hash` |
| `test` | Differential tests per patch: before and after on the same inputs, exhaustive when the precondition's domain is small, sampled otherwise, with a time budget per call so a slow "before" is reported rather than hung. "Agree" means equal results, or both fail. Then the project's own tests against the patched tree. |
| `report` | Update the manifest and status; print the step result as JSON for whoever is orchestrating (the CLI itself, the mod, or the platform's workers) |

Steps are idempotent and keyed by content hashes, so a repeated step is a cache hit.

### 4.2 The step protocol

Every primitive is callable as `rustproof step <name> --json`, which is how the platform's workers (Python, DBOS) orchestrate the pipeline without re-implementing any of it.

- **Input:** a JSON object on stdin (or `--input file.json`) matching `schemas/steps/<name>.request.json`: the repo root, the obligation ids, and the hashes the caller already knows.
- **Output:** a JSON object on stdout matching `schemas/steps/<name>.response.json`: `ok`, the new status per obligation, the hashes produced (`source_hash`, `patched_hash`, `lean_hash`, `spec_hash`), the artifacts written (paths under `.rustproof/`), `cache_hit`, and a human-readable `summary`. Diagnostics go to stderr.
- **Idempotent and content-keyed:** running a step twice with the same input returns the same output, and the second run reports `cache_hit: true` from the step cache (§4.3). This is what makes a DBOS step wrapping a CLI call safe to retry.
- **Exit codes:** a step exits 0 whenever it ran and returned an authoritative response, including domain outcomes such as a failed check or "needs review"; the response's `ok` is the domain result. A non-zero exit means the step itself could not run (for example `10`, auth required). The verdict codes 1 to 5 of §6 belong to the ordinary commands, not to `rustproof step`.
- **No network unless asked.** Only `prove` with `--prover agent`, `leanstral-api`, or `platform` talks to the network, and only to the endpoint named.

The ordinary commands (`rustproof patch`, `rustproof check`, …) are thin wrappers that call the same steps and print a human summary.

### 4.3 Local runs and the approval waits

Locally there is no engine. Each step's output is cached under `.rustproof/state/` by content hash, so a rerun skips finished work. A pending approval is simply `needs_review` in the manifest: `rustproof spec approve` or `rustproof patch approve` records the approval and continues the pipeline from where it stopped. Killing the CLI mid-run loses nothing, because the next run resumes from the last completed step.

The local flow of one obligation:

```text
patch → (patch approval, if the policy requires it) → extract → propose_specs
  → (spec approval) → prove → check
  → on failure: counterexample, then a revised spec goes back to approval
  → mutate → test → report
```

The platform runs the same primitives in the same order as a durable workflow (see the platform spec); the difference is only who waits for approvals and who remembers progress.

Keep local fast paths (`status`, hooks) free of any startup cost: no extraction, no network.

**v1 runs proof search either on the user's own Mistral key or on the platform.** Assume platform users trust it with their code and proofs; privacy controls come later.

### 4.4 Aeneas profile

Track the supported Rust subset as a versioned profile (`aeneas_profile` in the manifest) and test every brick against it. At the time of writing Aeneas's README lists as unsupported: unsafe code, concurrency, some loop shapes (`return` inside nested loops; `break`/`continue` to an outer loop), and instantiating generics with mutable borrows. It only knows the library types it has models for (no `HashMap`). Treat library coverage as the main constraint, and Charon's self-described beta status as part of the trust base. Re-check the current Aeneas README when bumping versions. Charon marks items opaque with `--opaque`, `#[charon::opaque]`, or `[package.metadata.charon] opaque = [...]`; M0 confirms that an opaque callee becomes a declared signature in the generated Lean that the policy check can whitelist (§4.5).

### 4.5 Policy checks (`rustproof check`)

- No `sorry` or `admit` under `.rustproof/specs/`, `.rustproof/proofs/`, or `.rustproof/lean/Generated/` (not under `.lake/`, which holds Mathlib)
- For every proof theorem, `#print axioms` reports only `propext`, `Classical.choice`, `Quot.sound`, and the declared signatures Aeneas generated for this obligation's excluded callees (its trust base, listed in the manifest). Anything else fails. This also catches `sorryAx` and `native_decide` (which shows up as `Lean.ofReduceBool`, or, at Lean 4.35, as an axiom named `<theorem>._native.native_decide.ax_*`); plain `decide` is fine.
- Every approved spec has exactly one proof whose type is that spec.
- No proof file redefines or shadows a spec.
- Every obligation's `lean_hash` matches the Lean its proof was checked against. A changed `source_hash` marks it `stale` until re-extraction; if the `lean_hash` comes back unchanged, the proof is kept and the obligation returns to `proven` without a new search. `patched_hash` is a build stamp, not a staleness trigger. The build refuses while anything is `stale`.

### 4.6 The patched tree and overflow checks

`rustproof build` copies the repository's tracked files (`git ls-files`; never `target/` or `.git/`) to `target/rustproof/tree/`, applies every patch, adds a `rustproof-std` dependency to the workspace when any patch uses a verified component, and runs `cargo build --release --manifest-path target/rustproof/tree/Cargo.toml` with `--config 'profile.release.package.<member>.overflow-checks=true'` for each workspace member, so overflow checks apply to the project's own crates and not to third-party dependencies, and no `[profile]` table is rewritten. The resulting artifact is stamped with `patched_hash` (a `rustproof.json` next to the binary and an embedded `--version` line).

Which mode a repo uses is recorded in the manifest (`mode = "patched-tree" | "commit"`). In patched-tree mode the "proven code is the running code" guarantee requires release builds to go through `rustproof build`; `rustproof init` says so, writes a GitHub Actions snippet, and recommends commit mode for new code.

Overflow checks are on so the runtime matches Aeneas's model, which treats overflow as a failure. Without them, a release build would wrap silently outside a theorem's precondition.

`rustproof build --commit` applies the patches to the source tree in place instead, for teams that prefer one tree. After `--commit`: each affected obligation's `patch` becomes empty, `brick` is kept as provenance, `classification` becomes `provable`, `source_hash` and `patched_hash` are recomputed, and because the generated Lean is byte-identical the `lean_hash` and the proof are kept, so nothing is re-proven.

### 4.7 Bricks

A brick is a Rust module in `crates/rustproof-bricks` with:

- `matches(fn) -> Option<Site>`: whether the brick applies to a function (`syn`-level pattern)
- `rewrite(site) -> Patch`: the instantiated rewrite
- `template() -> ProofTemplate`: the invariant shape and tactic skeleton for proofs of the rewritten form
- `version`: bumping it re-patches and re-proves every instance

Built-in bricks for M1 and M7: `memo-to-accumulator`, `extract-inner-loop`, `remove-labeled-break`, `range-to-while`, `isolate-io`. Bricks that introduce helpers name them `<fn>__inner`, `<fn>__pure`, etc., keep them private, and record them in the manifest (`helpers`), so a brick version bump that renames a helper re-proposes the affected specs instead of silently breaking them. Verified components in `crates/rustproof-std` carry their theorems in `lean/RustproofStd/` and are swapped in by `use-verified-component` bricks, which also add the `rustproof-std` dependency to the patched tree (and to the source tree in commit mode). Charon translates `rustproof-std` like any workspace crate, and its generated names map to the theorems in `lean/RustproofStd/` by a fixed convention that CI checks.

Every brick has a test that: applies it to a fixture, checks the output extracts under the pinned profile, and runs a differential test between fixture and output.

### 4.8 Lean project setup

```toml
# .rustproof/lean/lakefile.toml
name = "RustproofProject"

[[require]]
name = "aeneas"
git = { url = "https://github.com/AeneasVerif/aeneas", subDir = "backends/lean" }
rev = "<pinned commit>"
```

Copy `lean-toolchain` from the pinned Aeneas `backends/lean`. Aeneas's own backend uses a `lakefile.lean`; use whichever form the pinned Lake accepts and treat `lake update` output as the source of truth (verify the `require` syntax in M0). Commit `lake-manifest.json`; gitignore `.rustproof/lean/.lake/`.

### 4.9 Spec and proof shape

```lean
-- .rustproof/specs/Fib.lean   (CODEOWNERS: humans only)
import Generated.Fib
namespace Spec

def fibSpec : Nat → Nat
  | 0 => 0
  | 1 => 1
  | n + 2 => fibSpec (n + 1) + fibSpec n

/-- For every 64-bit integer n where n ≤ 93, fib(n) returns the n-th Fibonacci number. -/
def fib : Prop :=
  ∀ n : U64, n.val ≤ 93 →
    ∃ r, Generated.fib n = ok r ∧ r.val = fibSpec n.val

end Spec
```

```lean
-- .rustproof/proofs/Fib.lean  (the bot may edit)
import Specs.Fib
theorem Proof.fib : Spec.fib := by
  intro n h
  -- remaining tactics generated by `rustproof prove` from the
  -- memo-to-accumulator brick's loop-invariant template
```

The docstring on the spec is its plain-English reading and is what the pane and the PR comment show first. Names and namespaces are illustrative; match what the pinned Aeneas version generates.

### 4.10 Python source adapter (inter-op ports)

Python projects use the same pipeline with a front end in `crates/rustproof-python`. A port produces a Rust crate, and from `extract` on nothing is Python-specific.

| Step | Does |
| --- | --- |
| `python candidates` | Parse the project (tree-sitter-python for structure; a helper run with the project's own interpreter for `ast` and type hints). Find contiguous spans with a clean dataflow boundary (inputs are the variables read, outputs the variables written and used afterward) that are pure, fully type-hinted, and free of I/O, globals, shared mutable containers, string indexing, and exceptions crossing the boundary. Prefer whole loops over loop bodies. Rank them. Record `source_hash` per span. |
| `python scaffold <span>` | Create or extend the crate `.rustproof/crates/<module>/`: a PyO3 module, a function stub whose Rust signature is derived from the hints (`int` → `u64` or `i64` as chosen, `list[int]` → `Vec<i64>`, `str` → `&str`), the differential-test harness, and the build-time patch with a guard placeholder. Writes `language`, `span` and `extension` to the manifest. |
| `python port <span>` | Model-assisted (§4.11): the agent writes the Rust body inside the provable subset, guided by the `port-python` skill. `python check` validates it. |
| `python check <span>` | Build the extension into the project's virtualenv (`maturin develop`), `scan` the port for subset membership, and run the differential test: Hypothesis generates inputs from the hints; the original span and the port must agree, or both must fail. Time both and report the speedup; fail a slower port unless `--allow-slower` is passed. |

Then the Rust pipeline runs on the crate: `extract` → `propose_specs` → `prove` → `check` → `mutate` → `test`.

**Guards.** The patch dispatches on the approved precondition, generated as Python from the spec so that unbounded Python ints never reach a conversion error. Inside it the extension is called; outside it the original Python body runs. `rustproof build` materializes the patched Python tree under `target/rustproof/tree/`, builds the wheel with maturin, and stamps both with `patched_hash`. In commit mode the patched Python replaces the source and the crate stays under `.rustproof/crates/`.

**Exceptions and panics.** Ported functions return `Result` wherever the model says failure, and the PyO3 layer maps `Err` to the matching Python exception (`OverflowError`, `ZeroDivisionError`, `ValueError`). The extension is built with overflow checks on, so a panic can only mean a bug in the port, and it surfaces as `PanicException`, never as a wrong number.

**Performance.** The boundary costs about 30 ns per call plus a few ns per argument (measured on PyO3 0.29). Work that stays inside Rust runs roughly 60× faster than the Python loop it replaces; a per-element call from a Python loop is slower than leaving the loop in Python. Hence whole-loop candidates and the slowdown check.

**Manifest.** An obligation from a Python span has `language = "python"`, `span = { file = "billing/prorate.py", lines = [3, 4] }`, `extension = "crates/billing"`, and the usual fields. Its `classification` is `patchable` by definition (the patch is the port), and its function is the Rust port.

### 4.11 Model-assisted steps

Three kinds of step need a model: `propose_specs` (the theorem and its plain-English reading), `python port` (the Rust body), and the explanations (`explain_failure`, `explain_patch`). The CLI runs them through a `Model` interface with three implementations: `session`, where the agent in the Claude Code session does the work through the relevant skill and the CLI only validates the result; `api`, a provider behind `RUSTPROOF_MODEL_API_KEY` for headless runs; and `platform`, which asks the rustproof platform. Proof search is separate (§9). `scan`, `patch`, `extract`, `check`, `build` and `test` never need a model.

---

## 5. `.rustproof/` layout and manifest

```
.rustproof/
├── .gitignore            # state/, lean/.lake/
├── manifest.toml
├── patches/              # one patch per obligation (may be empty); Python patches are guarded inter-op calls
├── crates/               # ported Rust for Python projects (PyO3 extension crates)
├── lean/                 # Lake project; Generated/ is Aeneas output
├── specs/                # theorem statements (CODEOWNERS-protected)
├── proofs/               # generated proofs
└── state/                # local step cache (never committed)
```

```toml
# .rustproof/manifest.toml
version = 2
mode = "patched-tree"            # patched-tree | commit
aeneas_profile = "2026.10"
bricks_version = "0.1.0"
patched_hash = "sha256:…"        # build stamp: hash of the patched tree's tracked files, excluding this file

[patch_policy]
builtin = "auto"                 # auto | required (per-org override on the platform)
custom = "required"              # custom bricks always require approval

[[obligation]]
id = "fib_rs::fib"
source = "src/lib.rs"
source_hash = "sha256:…"         # normalized syn item of the function plus its workspace callees
lean_hash = "sha256:…"           # generated Lean for the function and its callees; what the proof is keyed to
classification = "patchable"     # provable | patchable | excluded
exclusion_reason = ""            # io | unsafe | ffi | async | interior-mutability | trait-object | unsupported | rejected
brick = "memo-to-accumulator@1"
brick_origin = "builtin"         # builtin | custom
helpers = []                     # private helper fns the brick introduced
patch = "patches/fib_rs__fib.patch"
patch_approved_by = ""           # empty when the policy is auto
trust_base = []                  # declared signatures of excluded callees this proof assumes
spec = "specs/Fib.lean#Spec.fib"
spec_hash = "sha256:…"
proof = "proofs/Fib.lean#Proof.fib"
status = "proven"
spec_approved_by = "github:ash"
spec_approved_via = "pane"       # pane | tty | dashboard | pr-review (pane and tty are advisory)
spec_approved_at = "2026-10-13T08:00:00Z"
```

The manifest is the source of truth for obligations in the repo. The platform's `approvals` table is the source of truth for who approved what, and the platform's bot commits that record into the manifest so the two match. The step cache is execution history, not product state.

---

## 6. CLI

| Command | Does | Notes |
| --- | --- | --- |
| `rustproof login [--device]` | Browser OAuth (PKCE, loopback redirect); `--device` for a device-code flow on headless machines | Token in the OS keychain (`keyring`); `RUSTPROOF_TOKEN` overrides both for CI |
| `rustproof logout`, `whoami` | Session management | |
| `rustproof auth header` | Prints `{"Authorization":"Bearer …"}` | For MCP clients that connect to the platform's server directly; refreshes if needed |
| `rustproof doctor [--install]` | Checks and installs local toolchain pieces | Lean via elan; extraction image via Docker/Podman |
| `rustproof init` | Runs `init_repo`; creates `.rustproof/` | `--json` for agents; prints coverage: provable / patchable / excluded with reasons |
| `rustproof scan` | Re-classifies functions | Fast; no extraction |
| `rustproof patch [fn…]` | Applies bricks, writes patches, materializes the tree | `--brick <name>` to choose; `patch approve <fn>` / `patch reject <fn>` |
| `rustproof diff [fn…]` | Shows before/after for a function | `--json` for the mod |
| `rustproof spec propose [fn…]` | Proposes specs (`needs_review`); `--revise <fn> --note "…"` rewrites a proposal after "Request changes" | Never approves |
| `rustproof spec approve <fn>` | Records the approval and continues the pipeline locally, or forwards it to the platform when the obligation runs there | Requires a TTY, or `--via pane` from the mod (§8.6) |
| `rustproof prove [fn…]` | Runs or requests proof search | `--prover manual \| agent \| leanstral-api \| platform` (§9); `platform` returns a run id, `--wait` blocks |
| `rustproof check` | `lake build` + policy checks | Local; no network |
| `rustproof build [--commit]` | Materializes and builds the patched tree; `--commit` applies patches in place | Refuses stale obligations |
| `rustproof test` | Differential tests per patch + project tests on the patched tree | |
| `rustproof status` | Obligations and states | `--brief`, `--json`; no engine, no network |
| `rustproof events --follow --json` | Streams status changes | Feeds the mod |
| `rustproof resume` | Continues interrupted local runs from the step cache | |
| `rustproof step <name> --json` | Runs one pipeline primitive under the step protocol (§4.2) | What the platform's workers call; also useful for scripting |
| `rustproof verdict --json` | Maps obligation statuses to a check conclusion and exit code, using the proven `rustproof-core` | What the platform's GitHub check reports |
| `rustproof mcp` | Local stdio MCP server | Implements the schemas in `schemas/mcp/`; the platform's server implements the same ones |
| `rustproof hook <event>` | Entry points for settings hooks and the mod | Reads hook JSON on stdin; fast path |
| `rustproof python candidates` | Finds and ranks portable spans in a Python project | `--json` |
| `rustproof python scaffold <span>` | Creates the PyO3 crate stub, the differential-test harness and the guarded patch | |
| `rustproof python check <span>` | Builds the extension, checks the port is in the subset, runs the differential test, reports speed | Fails a slower port unless `--allow-slower` |
| `rustproof beads sync` | Publishes "needs you" items as beads issues | Later milestone (§11) |

**Exit codes:** `0` ok · `1` failing or counterexample · `2` policy violation · `3` needs review · `4` stale · `5` weak spec (only with `--strict`; otherwise a warning and `0`) · `10` auth required. Worst wins when several apply.

Plain output: one line per obligation (`<glyph> <fn id>  <state>`), summary line last, understandable without color.

---

## 7. Status vocabulary

| Machine name | Label | Glyph | Meaning |
| --- | --- | --- | --- |
| `proven` | Proven | `●` | Spec approved; proof checked by the Lean kernel against the current patched tree |
| `checking` | Checking | `◌` | Verification running |
| `searching` | Searching | `◌` | Proof search or repair running |
| `needs_review` | Needs review | `◆` | A spec, or a patch that requires approval, is waiting for a person (`reason: spec | patch`) |
| `failing` | Failing | `✕` | Proof doesn't check; repair hasn't succeeded |
| `counterexample` | Counterexample | `✕` | A concrete input breaks the claim |
| `weak_spec` | Weak spec | `△` | Spec still holds for a mutant |
| `stale` | Stale | `↻` | The function or a callee changed since its proof was checked; cleared automatically if re-extraction yields the same Lean |
| `excluded` | Excluded | `○` | Outside the proof boundary (`reason: io | unsafe | ffi | async | interior-mutability | trait-object | unsupported | rejected`) |

---

## 8. Claude Code plugin

The plugin has two layers:

- **The floor: settings hooks, skills, MCP, LSP.** These work wherever the plugin loads, including where an organization has turned user mods off.
- **The ceiling: the rustproof mod.** A TypeScript hooks module that runs inside Claude Code and draws rustproof's interface: a status band, a proof pane, in-terminal spec and patch review, live run progress, and "more provable" nudges.

### 8.1 Layout

```
plugin/
├── .claude-plugin/plugin.json      # includes "types": "./types/index.d.ts"
├── bin/rustproof                   # shim → ~/.rustproof/bin/rustproof
├── hooks/
│   ├── hooks.json                  # "modules": ["./register.ts"] + settings hooks (the floor)
│   ├── register.ts                 # the rustproof mod
│   └── register.test.ts            # run with `claude plugin test`
├── types/index.d.ts                # PluginState declarations for $.state
├── skills/
│   ├── login/SKILL.md              # /rustproof:login
│   ├── init/SKILL.md               # /rustproof:init (onboarding steps 3–8)
│   ├── make-provable/SKILL.md      # how to write Rust inside the subset; the bricks as idioms
│   ├── port-python/SKILL.md        # how to port a Python span into the subset (types, Result, no HashMap)
│   └── write-spec/SKILL.md         # how to propose good specs
├── scripts/session-start.sh        # install or update the pinned CLI binary
├── .mcp.json
└── .lsp.json
```

Plugin name is `rustproof`, so skills are `/rustproof:login` and `/rustproof:init`. Prefer `skills/` over `commands/` for new plugins.

### 8.2 CLI installation

The `bin/` shim execs `~/.rustproof/bin/rustproof`, downloading the pinned release binary first if it's missing, so it also works when the `local` MCP server starts at connect time, before any hook. The SessionStart settings hook updates the binary when it's outdated, so the CLI and plugin never drift. The CLI lives in its own home rather than the plugin directory because the plugin root changes on update and the binary is shared with terminal use. Plugins with a top-level `bin/` work in Claude Code but aren't installed by claude.ai; Claude Code is the target.

### 8.3 The rustproof mod: surfaces

| Surface | How | What it shows |
| --- | --- | --- |
| Status band | `ui.render` on `AbovePrompt` | One line, only when something needs attention or a run is active, worst first: `rustproof∎  ✕ 1 counterexample  ◆ 1 needs review  ◌ searching 3/5  ● 12 proven`. Digit hotkeys `1`–`4` open the pane on a tab. |
| Proof pane | `/proofs` command (registered with `immediate: true`, so it opens while Claude works) → `$.ui.open({ id: 'rustproof', title: 'rustproof', focus: true, closeOnEscape: true })` | Tabs: `1` Obligations, `2` Needs you, `3` Run, `4` Coverage |
| Spec review | The "Needs you" tab | The before/after diff with the brick named (`Code`), the theorem's plain-English reading (`Markdown`) and Lean (`Code`), and buttons `a` Approve, `r` Request changes, `c` Show counterexample |
| Patch review | The "Needs you" tab, when a patch requires approval | The diff, the brick's description, the differential-test summary, and buttons `a` Approve, `x` Reject (exclude), `b` Choose another brick |
| "More provable" nudge | After a `.rs` edit that scans as `patchable` or `excluded` | For the person: a one-line `$.ui.log` (`rustproof: fib is patchable (memo-to-accumulator). Write it as an accumulator loop to skip the patch.`). For Claude: `$.ui.log` is not sent to the model, so the same text is returned as hook context by the PostToolUse settings hook (§8.8) and appended to the tool result by the mod's `tool.call` hook. The skill `make-provable` has the idiom. |
| Run progress | `Spinner` suffix | `<verb> · rustproof searching 3/5…` while a proof run is active; the verb is Claude Code's own spinner word, only the suffix is ours |
| Tool rows | `ToolUse` / `ToolResult` for `mcp__plugin_rustproof_local__*` | A compact status row (`◌ request_proofs · fib_rs::fib · run r_82f`) instead of raw JSON |
| Turn summary | `turn.complete` returning `{ text }` | `rustproof: 2 obligations changed · 1 needs review` |
| Notices | `$.ui.toast`, `$.ui.status` | "Proof found: fib_rs::fib"; a persistent status line during long runs |
| Coverage | `Raster` in the terminal, `Svg` elsewhere | Per-module heat map colored by the worst status in the module |

Keep the band quiet when everything is proven. The band is shared with other mods, so compose with theirs (`await next(e)` inside a `Box`) instead of replacing it.

### 8.4 The rustproof mod: guards and reactions

| Event | Matcher | Behavior |
| --- | --- | --- |
| `tool.call` | `{ tool: ['Edit', 'Write'] }` | Deny edits to `.rustproof/specs/**`, `.rustproof/patches/**`, `.rustproof/manifest.toml` and `.rustproof/lean/Generated/**` with an instruction Claude can act on ("Specs need human approval. Propose a change with `rustproof spec propose`."). After allowed edits to `.rs` files, `await next(e)`, then run `rustproof hook post-edit --json`: re-scan the touched functions, mark changed obligations `stale`, and append the "more provable" nudge to the tool result so Claude reads it. |
| `tool.call` | `{ tool: 'Bash' }` | Deny commands whose argv runs `rustproof` with `spec approve` or `patch approve` (after resolving simple aliases). Advisory; see §8.6. |
| both of the above | `.catch` | Fail closed: deny if the guard throws or times out |
| `session.start` | — | Register `/proofs`; load state; poll `rustproof status --json` with `$.clock.every` (every 2 s while a run is active, 15 s otherwise). Don't start a never-ending `$.process.spawn` here: Claude Code awaits this hook before the first prompt. |
| `classic.SessionStart` | `{ source: ['clear', 'resume', 'fork'] }` | Reload `$.state` from the CLI after `/clear`, `/resume`, `/branch` |
| `turn.complete` | — | Summary line when obligations changed during the turn |

The Stop gate stays a settings hook (§8.8) so it holds even where mods are off.

### 8.5 The rustproof mod: state

- `$.state` (reactive, declared in `types/index.d.ts`): `counts`, `activeRun`, `needsYou`, `tab`. Writing them redraws the band and pane automatically.
- `$.store` (persists between sessions): last-open tab, dismissed hints.
- The CLI and manifest remain the source of truth; the mod only mirrors them.

```typescript
// plugin/types/index.d.ts
declare module 'claude-code' {
  interface PluginState {
    'rustproof': {
      counts: Record<'proven' | 'checking' | 'searching' | 'needs_review' | 'failing' | 'counterexample' | 'weak_spec' | 'stale' | 'excluded', number>
      activeRun: { id: string; done: number; total: number } | null
      needsYou: { fn: string; reason: 'spec' | 'patch' }[]
      // counts covers every status; checking and excluded included
      tab: 'obligations' | 'needs-you' | 'run' | 'coverage'
    }
  }
}
```

### 8.6 Approval from the pane

Pressing Approve runs `rustproof spec approve <fn> --via pane` (or `rustproof patch approve <fn> --via pane`) through `$.process.run`. Claude can't press a mod's button, and the mod denies Claude's Bash calls that try to approve, so approvals from the pane come from a person. This is defense in depth, not a security boundary: an agent with shell access can fake a TTY or edit the manifest. So local approvals are recorded with their origin (`pane`, `tty`, `dashboard`, `pr-review`) and treated as advisory; the enforced gate is the PR review, with `.rustproof/specs/`, `.rustproof/patches/` and `.rustproof/manifest.toml` under CODEOWNERS.

### 8.7 The mod: where it draws, requirements, review

- Draws in the Claude Code terminal (v2.1.287+) and the Desktop app's Code tab. Per the published mods reference: `Pane`, `AbovePrompt` and `Spinner` draw in the terminal and on Desktop; `Raster` is terminal only; `Svg` is Desktop only. Nothing draws in VS Code, `claude -p`, Agent SDK or cloud sessions: hooks run there, so fall back to `$.ui.log` lines and a text reply from `/proofs`. Check `e.surface` before choosing elements.
- The mod calls only `$.process.run` / `$.process.spawn` (the rustproof CLI), `$.state`, `$.store`, `$.clock`, `$.command`, and `$.ui`. No `$.http`: all network traffic goes through the CLI. This keeps `claude plugin validate` output short enough for a security team to review.
- CI runs `claude plugin validate --strict plugin/` and `claude plugin test plugin/`. Give every control a `key` so tests can press it.
- Hooks have a 10-second own-time limit; long work happens in the CLI, and waiting on `$.process.run` doesn't count against it.

### 8.8 Settings hooks (the floor)

In `hooks/hooks.json` alongside `modules`. Use exec form with `args`.

| Event | Matcher | Command | Behavior |
| --- | --- | --- | --- |
| `SessionStart` | — | `scripts/session-start.sh` | Install or update the CLI binary; one-line status |
| `PreToolUse` | `Write\|Edit` | `rustproof hook pre-edit` | Deny edits to specs, patches, the manifest and generated Lean (duplicates the mod guard where mods are off) |
| `PreToolUse` | `Bash` | `rustproof hook pre-bash` | Deny `rustproof spec approve` and `rustproof patch approve` from Claude (advisory) |
| `PostToolUse` | `Write\|Edit` | `rustproof hook post-edit` | Re-scan touched `.rs` files; mark `stale`; return the "more provable" nudge as `additionalContext` so Claude reads it, with or without the mod |
| `Stop` | — | `rustproof hook stop` | Block once per turn (honor `stop_hook_active`) when this turn's edits left a previously proven obligation `failing`, or a `sorry` exists in proofs, with a message naming the obligation. `stale` and `needs_review` go in the summary and don't block. Never block in headless runs. |

See the Claude Code hooks reference for the exact deny and block response formats.

### 8.9 MCP servers

```json
{
  "mcpServers": {
    "local": {
      "command": "rustproof",
      "args": ["mcp"]
    },
    "lean-lsp": {
      "command": "uvx",
      "args": ["lean-lsp-mcp"]
    }
  }
}
```

The plugin ships this `local` stdio entry permanently and never a `cloud` HTTP entry: all network traffic goes through the CLI (§8.7), and the tool namespace stays `mcp__plugin_rustproof_local__*`, so hook matchers never change. Verify the `lean-lsp-mcp` launch command against its README.

### 8.10 Remote MCP tools

| Tool | Purpose |
| --- | --- |
| `scan_repo` | Classify functions; return coverage and reasons |
| `patch_fn` | Apply a brick to one function; returns the before/after diff |
| `propose_specs` | Propose theorem statements with plain-English readings |
| `approve_spec`, `approve_patch` | Approve. Set `_meta["anthropic/requiresUserInteraction"] = true` so a person confirms every call in every permission mode. For surfaces without the mod. |
| `request_proofs` | Start proof search; returns a run id immediately |
| `get_run` / `get_obligation` | Poll status, logs, attempts |
| `find_counterexample` | Search for a failing input |
| `explain_failure` | Plain-language diagnosis of a failing obligation |
| `explain_patch` | Which brick, why, and what the differential tests covered |

These tools are defined once, as JSON schemas in `schemas/mcp/`. The platform's server implements them over its API; `rustproof mcp` implements the same schemas locally where no account is needed (`scan_repo`, `patch_fn`, `explain_patch`) and forwards the rest. One conformance test in this repo runs the same calls against both servers.

Long work returns a run id and is polled. Claude Code also moves MCP calls that run past two minutes into the background. Plugin server tools are namespaced (`mcp__plugin_rustproof_local__<tool>`); use full names in matchers and permission rules.

### 8.11 LSP

```json
{
  "lean": {
    "command": "lake",
    "args": ["serve"],
    "extensionToLanguage": { ".lean": "lean" },
    "workspaceFolder": "${CLAUDE_PROJECT_DIR}/.rustproof/lean"
  }
}
```

Diagnostics are pushed into Claude's context after edits, so broken proofs are visible without anyone asking.

### 8.12 Approval paths, summarized

1. The pane's Approve button (§8.6)
2. `rustproof spec approve` / `rustproof patch approve` in a real terminal (TTY confirmation)
3. The `approve_spec` / `approve_patch` MCP tools (always prompt a person)
4. The dashboard's spec and patch review screens
5. The CODEOWNERS review on the PR that changes `.rustproof/specs/` (final gate for specs)

---

## 9. Prover interface

```rust
pub trait Prover {
    /// Runs an agent loop against the obligation's Lean workspace (Lean LSP available),
    /// yielding attempts. The caller kernel-checks every attempt before it counts.
    fn prove(
        &self,
        goal: &ProofGoal,
        template: Option<&ProofTemplate>,
        workspace: &LeanWorkspace,
        budget: Budget,
    ) -> BoxStream<'_, ProofAttempt>;
}
```

Implementations in `crates/rustproof-prover`:

- `Agent`: the agent loop, with `lean-lsp-mcp` as the agent's tools, against any OpenAI-compatible chat-completions endpoint with tool calling (`RUSTPROOF_PROVER_URL`, `RUSTPROOF_PROVER_MODEL`, `RUSTPROOF_PROVER_API_KEY`), for example a self-hosted Leanstral from the open weights. The loop lives here, in Rust, so the platform's workers run proof search by calling `rustproof step prove`; there is one implementation of the loop.
- `LeanstralApi`: a preset of `Agent` for Mistral's API, using the key in `MISTRAL_API_KEY`. The model id must be set in `RUSTPROOF_PROVER_MODEL`; there is no default, because Mistral's hosted Leanstral ids are retired.
- `Manual`: reads `.rustproof/proofs/`; tests and M0.
- `Platform`: a client of the platform's API (§10) that requests a run and polls it; for users who'd rather not hold a Mistral key.

Default resolution: `--prover`, else `RUSTPROOF_PROVER`, else `manual` when the obligation has a proof file, else `agent` when configured; otherwise `prove` stops with a configuration error that says how to set a prover up. `platform` is never chosen implicitly, because it sends code off the machine.

Whether the model uses a brick's proof template well is an M0 measurement: pass it as the initial proof skeleton and compare pass rates with and without.

---

## 10. Contract with the platform

The CLI is a client of the platform; the platform is never a dependency of this repo. The contract lives here, in `schemas/`, and the platform runs this repo's contract tests in its CI against a pinned tag.

| What | Where it's defined | Used by |
| --- | --- | --- |
| Step protocol | `schemas/steps/` | The platform's workers call `rustproof step <name> --json` |
| MCP tools | `schemas/mcp/` | `rustproof mcp` (local) and the platform's MCP server |
| Platform API slice | `schemas/platform-api/openapi.json` | `rustproof login`, `--prover platform`, `spec approve` forwarding, `auth header` |
| Status vocabulary and `verdict` | `crates/rustproof-core` | The platform relays `rustproof verdict` output; it never computes a verdict itself |
| Toolchain image | `images/toolchain` | The platform's worker image builds `FROM` it |

Authentication: `rustproof login` runs the platform's OAuth flow (authorization code + PKCE with a loopback redirect, or `--device` for a device-code flow) against the platform's authorization server (WorkOS AuthKit, with GitHub as the sign-in); the CLI keeps that token in the OS keychain and never sees a GitHub token. `RUSTPROOF_TOKEN` overrides it for CI. The plugin has no remote MCP entry (§8.9); other MCP clients that connect to the platform's server directly can get the header from `rustproof auth header`.

The platform's base URL defaults to `https://api.rustproof.dev` and is overridable with `RUSTPROOF_API_URL`, so the CLI works against staging and, later, self-hosted platforms.

---

## 11. Integrations

**Beads and Gas City.** Beads is a git-backed work tracker for coding agents; Gas City builds its orchestration on it. rustproof doesn't build on beads (the manifest is the source of truth, and the platform's workflows provide execution guarantees beads doesn't). Instead, `rustproof beads sync` publishes each obligation that needs a person (`needs_review`, `counterexample`, `weak_spec`) as a beads issue and closes it when resolved. A Gas City pack can follow.

---

## 12. Milestones (this repo)

Milestone numbers are shared with the platform spec so cross-references hold. M3, M4, M5, M9 and M11 live there.

| # | Milestone | Done when |
| --- | --- | --- |
| M0 | Toolchain spike | Pinned toolchain image builds; hand-written iterative `fib` → Charon → Aeneas → Lean; hand proof of `fib_spec` checks with `--prover manual`; `#print axioms` shows only the three standard axioms. Charon's opaque marking confirmed on a crate with an I/O function, and the generated declaration for the opaque callee whitelists cleanly. The configured prover endpoint is probed and the result recorded: with a working endpoint (self-hosted or other), `fib_spec` pass rates are measured with and without the brick's template; otherwise the record says "no hosted Leanstral available; manual used". |
| M1 | Vertical slice on `examples/fib-rs` | All M1 criteria below pass locally, offline except for the prover call |
| M2 | Claude Code plugin and mod | All M2 criteria below pass in a fresh Claude Code session |
| M6 | Dogfood: rustproof proves rustproof | All M6 criteria below pass on this repo |
| M7 | Legacy mode and the brick library | `rustproof init` on three real open-source crates reports coverage; the five built-in bricks and the first `rustproof-std` components ship; mutation checks; Aeneas profile versioning |
| M8 | Integrations | `rustproof beads sync`; Gas City pack |
| M10 | Python inter-op path | All M10 criteria below pass on `examples/billing-py` |

### M1 acceptance criteria

`examples/fib-rs` is a crate containing the memoized `fib` from the design document and a `main` that prints `fib(10)`.

- [ ] `rustproof init` classifies `fib` as `patchable` (brick `memo-to-accumulator`) and `main` as `excluded` (`io`)
- [ ] `rustproof patch` writes the patch, materializes `target/rustproof/tree/`, records `patched_hash`, and `rustproof diff fib` shows the accumulator version
- [ ] The differential test runs both versions on generated `n` in `0..=93` and they agree
- [ ] A spec with the `n ≤ 93` precondition and a plain-English docstring is proposed with status `needs_review`, and the pipeline stops there
- [ ] `rustproof spec approve` refuses when stdin is not a TTY and `--via pane` is absent
- [ ] Approving continues the pipeline from where it stopped, including after the CLI process was killed
- [ ] Every primitive runs under the step protocol: `rustproof step <name> --json` with the same input twice returns the same output and reports a cache hit the second time
- [ ] Killing `rustproof init` mid-run and running it again resumes from the last completed step without repeating it (step cache hits)
- [ ] `rustproof check` passes with a proof from `--prover manual`, or from `agent` or `leanstral-api` when a working endpoint is configured; record which
- [ ] `rustproof check` fails (exit 2) when a `sorry` is inserted, and when a new `axiom` is added
- [ ] Editing `fib` in the source marks it `stale`, and `rustproof build` refuses (exit 4)
- [ ] Without the guard, the counterexample search reports `fib(94)`
- [ ] `rustproof build` produces a binary stamped with `patched_hash`; running it prints `55`; `fib(94)` in the patched release build panics instead of wrapping
- [ ] `rustproof build --commit` rewrites `src/lib.rs` to the accumulator version, the patch becomes empty, and the obligation stays `proven` (same `lean_hash`)

### M2 acceptance criteria

- [ ] `/rustproof:init` works in a fresh session without an account; `/rustproof:login` works against the platform's staging environment once M3 exists
- [ ] The band appears when something needs review and stays hidden when all obligations are proven
- [ ] `/proofs` opens the pane while Claude is mid-turn
- [ ] Writing the memoized `fib` triggers the "more provable" nudge naming `memo-to-accumulator`, and Claude's next message shows it read the nudge; writing the accumulator version triggers nothing
- [ ] Pressing Approve in the pane moves the obligation to `searching`, then `proven`
- [ ] Claude's attempt to edit a spec or a patch is denied with an actionable message, with and without the mod loaded
- [ ] Claude's attempt to run `rustproof spec approve` is denied
- [ ] The Stop hook blocks once when an edit leaves a proven obligation `failing`, and does not block on `stale`
- [ ] `claude plugin validate --strict plugin/` and `claude plugin test plugin/` pass

### M10 acceptance criteria (Python inter-op)

`examples/billing-py` is a small FastAPI app with a `prorate(amount_cents, days_used, days_in_period)` function and a handler that calls it.

- [ ] `rustproof python candidates` finds `prorate` and excludes the handler (`io`)
- [ ] `rustproof python scaffold prorate` produces a crate that builds into the project's virtualenv with maturin, a Hypothesis harness, and a patch with a guard placeholder
- [ ] After the port, `rustproof python check prorate` passes: the port is in the subset, the differential test agrees on every generated input inside the precondition, and the timing is reported
- [ ] The proposed spec carries `0 < d`, `u ≤ d` and the product-fits precondition, with `prorate(100, 1, 0)` attached as evidence
- [ ] The obligation reaches `proven`
- [ ] `rustproof build` produces the patched tree and the wheel, both stamped with `patched_hash`; the app's own test suite passes against the patched tree; a request with `days_in_period = 0` behaves exactly as before, because the guard routes it to the original Python
- [ ] A deliberately wrong port (truncating where Python floors, on a negative input) is caught by the differential test, not by the proof

### M6 acceptance criteria (rustproof proves rustproof)

Keep these functions pure and typed in `crates/rustproof-core` from the start, written directly in the Aeneas subset so no patch is needed:

- `next_status(...)`: the status state machine
- `exit_code(statuses)`: the exit-code mapping
- `validate_manifest(manifest)`: structural checks on the manifest
- `policy_verdict(axioms, markers)`: whether a proof's axioms and markers pass policy
- `check_conclusion(statuses)`: obligation statuses → GitHub check conclusion

Commands, the pipeline, subprocess calls, and file and network code are the shell, and so are the manifest parser, the webhook handler, the database and the relay. The proven parts are the pure decision functions. The Python API's authorization decision (`can_approve`) stays in Python in v1 and is unproven.

Criteria:

- [ ] `rustproof init` on the rustproof workspace classifies every `rustproof-core` function as `provable` with an empty patch
- [ ] Approved specs include: a function is `proven` only if its spec is approved and its proof checked; a source-hash mismatch always yields `stale`; any `sorry` or disallowed axiom always fails policy; any `failing`, `counterexample`, or `stale` obligation never yields `success`
- [ ] All `rustproof-core` obligations are `proven`, and released CLI binaries are built from the proven tree
- [ ] The landing page demo uses this repo as its example

---

## 13. Paste into `CLAUDE.md`

```markdown
# rustproof

Read design-docs/rustproof-spec.md before starting any task. Key rules:

- Build Milestone 1 (examples/fib-rs) end to end, offline, before generalizing.
- Every command except login, --prover platform and beads sync must work without an account.
- The patched tree is what ships: extract, prove, test and build the same tree, and record its hash.
- Every primitive is a `rustproof step`: idempotent, content-keyed, JSON in and out.
- Never edit .rustproof/specs/, .rustproof/patches/, .rustproof/manifest.toml or .rustproof/lean/Generated/ by hand. If a spec looks wrong, stop and ask.
- Never add sorry, admit, axiom, or native_decide. `rustproof check` must pass.
- Keep crates/rustproof-core inside the Aeneas subset.
- A Python port is a patch: guarded, differential-tested, and shown as a diff. The proof is about the Rust.
- Nothing from the platform repo is a dependency.
- Back every claim with a command and its output.
- Use the status vocabulary from §7 exactly.
- Toolchains are pinned; don't upgrade them as a side effect.
```

---

## References

- Aeneas (supported subset, Lean setup): https://github.com/AeneasVerif/aeneas
- Charon: https://github.com/AeneasVerif/charon
- Leanstral: https://mistral.ai/news/leanstral/
- Claude Code plugins reference: https://code.claude.com/docs/en/plugins-reference
- Claude Code mods: https://code.claude.com/docs/en/plugins/mods/overview
- Mods reference (events, render sites, elements, limits): https://code.claude.com/docs/en/plugins/mods/reference
- Claude Code MCP (OAuth, `headersHelper`, plugin servers, `requiresUserInteraction`): https://code.claude.com/docs/en/mcp
- Claude Code hooks reference: https://code.claude.com/docs/en/hooks
- cargo-mutants: https://github.com/sourcefrog/cargo-mutants
- Beads: https://github.com/steveyegge/beads
