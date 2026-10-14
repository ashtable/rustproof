# rustproof

**Vibe code it. Prove it.**

rustproof takes a Rust workspace, classifies every function as provable, patchable or excluded, rewrites the patchable ones into the subset that Aeneas can extract, extracts the patched tree to Lean 4 (Charon, then Aeneas), proposes theorems for a person to approve, finds proofs, checks them with the Lean kernel, and builds the same patched tree it proved. This repository is the open-source half: the `rustproof` CLI, the Claude Code plugin and mod, the brick library, the Lean helpers and the toolchain image.

## Status

Pre-release. Nothing here is usable yet. The repository holds the specification and the start of the Cargo workspace; the first milestone is an end-to-end, offline run on `examples/fib-rs`.

## Install (after the first release)

rustproof will install as a Claude Code plugin from this repository's marketplace:

```bash
claude plugin marketplace add ashtable/rustproof
claude plugin install rustproof@rustproof
```

These commands do not work yet: there is no release.

## Build from source

`rust-toolchain.toml` pins Rust 1.97.1. If rustup does not install it on first use, run `rustup toolchain install`.

```bash
cargo build --workspace
cargo test --workspace
./target/debug/rustproof --version
```

## Documentation

- [Implementation spec](design-docs/rustproof-spec.md): what this repository builds, in what order, and how to tell it is done.
- [License](LICENSE): Apache-2.0.
