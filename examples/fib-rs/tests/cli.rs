//! Runs the `fib-rs` binary the way a user would. These tests live here, not in
//! `src/`, so the crate's own items stay exactly `fib` and `main`.

use std::path::Path;
use std::process::{Command, Output};

fn fib_rs(args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_fib-rs"))
        .args(args)
        .output()
        .expect("fib-rs runs")
}

fn stdout(output: &Output) -> &str {
    std::str::from_utf8(&output.stdout).expect("stdout is UTF-8")
}

#[test]
fn prints_fib_10_by_default() {
    let output = fib_rs(&[]);
    assert!(output.status.success());
    assert_eq!(stdout(&output), "55\n");
}

#[test]
fn prints_fib_93_the_largest_that_fits_in_u64() {
    let output = fib_rs(&["93"]);
    assert!(output.status.success());
    assert_eq!(stdout(&output), "12200160415121876738\n");
}

// The bug M1.13 fixes: fib(94) overflows u64. A debug build panics on the overflow;
// a release build wraps silently (the plan's acceptance runs that case with --release).
#[cfg(debug_assertions)]
#[test]
fn fib_94_overflows_and_panics_in_a_debug_build() {
    let output = fib_rs(&["94"]);
    assert_eq!(output.status.code(), Some(101));
}

#[cfg(not(debug_assertions))]
#[test]
fn fib_94_wraps_in_a_release_build() {
    let output = fib_rs(&["94"]);
    assert!(output.status.success());
    assert_eq!(stdout(&output), "1293530146158671551\n");
}

#[test]
fn version_says_none_when_built_without_a_patched_hash() {
    let output = fib_rs(&["--version"]);
    assert!(output.status.success());
    assert_eq!(stdout(&output), "fib-rs 0.1.0 (patched_hash: none)\n");
}

#[test]
fn version_shows_the_patched_hash_stamped_at_build_time() {
    let target_dir = Path::new(env!("CARGO_TARGET_TMPDIR")).join("stamped");
    let build = Command::new(env!("CARGO"))
        .args(["build", "--quiet", "--manifest-path"])
        .arg(Path::new(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml"))
        .arg("--target-dir")
        .arg(&target_dir)
        .env("RUSTPROOF_PATCHED_HASH", "sha256:abc123")
        .status()
        .expect("cargo runs");
    assert!(build.success());

    let binary = target_dir
        .join("debug")
        .join(format!("fib-rs{}", std::env::consts::EXE_SUFFIX));
    let output = Command::new(binary)
        .arg("--version")
        .output()
        .expect("the stamped fib-rs runs");
    assert_eq!(
        stdout(&output),
        "fib-rs 0.1.0 (patched_hash: sha256:abc123)\n"
    );
}
