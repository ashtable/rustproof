use assert_cmd::cargo::cargo_bin_cmd;

#[test]
fn version_prints_the_binary_name_and_the_workspace_version() {
    cargo_bin_cmd!("rustproof")
        .arg("--version")
        .assert()
        .success()
        .stdout("rustproof 0.0.0\n");
}
