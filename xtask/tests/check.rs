use assert_cmd::cargo::cargo_bin_cmd;

#[test]
fn check_passes_on_this_repo() {
    cargo_bin_cmd!("xtask")
        .arg("check")
        .assert()
        .success()
        .stdout("xtask check: ok\n");
}

#[test]
fn check_fails_when_core_has_a_dependency() {
    let fixture = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/manifests/core-with-dependency.toml"
    );
    cargo_bin_cmd!("xtask")
        .args(["check", "--core-manifest", fixture])
        .assert()
        .code(1)
        .stderr("rustproof-core must have zero [dependencies] (found: serde)\n");
}
