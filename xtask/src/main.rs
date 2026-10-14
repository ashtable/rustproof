//! Repo tooling, run as `cargo xtask <command>` (alias in `.cargo/config.toml`).

mod checks;

use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

const USAGE: &str = "usage: cargo xtask check [--core-manifest <path>]";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    match args.as_slice() {
        ["check"] => check(&repo_root().join("crates/rustproof-core/Cargo.toml")),
        // Lets a test point the check at a fixture manifest instead of the real one.
        ["check", "--core-manifest", path] => check(Path::new(path)),
        _ => {
            eprintln!("{USAGE}");
            ExitCode::from(2)
        }
    }
}

/// Runs every check and reports all failures, not just the first.
fn check(core_manifest: &Path) -> ExitCode {
    let mut failures = Vec::new();
    match fs::read_to_string(core_manifest) {
        Ok(text) => failures.extend(checks::zero_dependencies(&text).err()),
        Err(error) => failures.push(format!("cannot read {}: {error}", core_manifest.display())),
    }

    if failures.is_empty() {
        println!("xtask check: ok");
        ExitCode::SUCCESS
    } else {
        for failure in &failures {
            eprintln!("{failure}");
        }
        ExitCode::FAILURE
    }
}

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("xtask lives one level below the repo root")
        .to_path_buf()
}
