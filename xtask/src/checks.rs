//! Repo invariants that `cargo xtask check` enforces.

use toml::{Table, Value};

/// `rustproof-core` must stay dependency-free so rustproof can prove it (delta §3.2 rule 1).
///
/// `[dependencies]`, `[build-dependencies]` and their `[target.<cfg>.*]` forms all count.
/// `[dev-dependencies]` are allowed: they are built only for tests and never reach the code
/// that is extracted and proven.
pub fn zero_dependencies(manifest: &str) -> Result<(), String> {
    let manifest: Table = manifest
        .parse()
        .map_err(|error| format!("cannot parse the manifest: {error}"))?;
    let name = manifest
        .get("package")
        .and_then(|package| package.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("the crate");

    let mut found = dependency_names(&manifest);
    if let Some(targets) = manifest.get("target").and_then(Value::as_table) {
        for target in targets.values().filter_map(Value::as_table) {
            found.extend(dependency_names(target));
        }
    }

    if found.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "{name} must have zero [dependencies] (found: {})",
            found.join(", ")
        ))
    }
}

fn dependency_names(table: &Table) -> Vec<String> {
    ["dependencies", "build-dependencies"]
        .into_iter()
        .filter_map(|key| table.get(key).and_then(Value::as_table))
        .flat_map(|dependencies| dependencies.keys().cloned())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::zero_dependencies;

    #[test]
    fn a_manifest_without_dependencies_passes() {
        let manifest = "[package]\nname = \"rustproof-core\"\n";
        assert_eq!(zero_dependencies(manifest), Ok(()));
    }

    #[test]
    fn dev_dependencies_are_allowed() {
        let manifest =
            "[package]\nname = \"rustproof-core\"\n\n[dev-dependencies]\nproptest = \"1\"\n";
        assert_eq!(zero_dependencies(manifest), Ok(()));
    }

    #[test]
    fn dependencies_fail_with_the_crate_name_and_what_was_found() {
        let manifest = "[package]\nname = \"rustproof-core\"\n\n[dependencies]\nserde = \"1\"\n";
        assert_eq!(
            zero_dependencies(manifest),
            Err("rustproof-core must have zero [dependencies] (found: serde)".to_string())
        );
    }

    #[test]
    fn build_dependencies_fail() {
        let manifest = "[package]\nname = \"rustproof-core\"\n\n[build-dependencies]\ncc = \"1\"\n";
        assert!(zero_dependencies(manifest).is_err());
    }

    #[test]
    fn target_specific_dependencies_fail() {
        let manifest = "[package]\nname = \"rustproof-core\"\n\n[target.'cfg(unix)'.dependencies]\nlibc = \"0.2\"\n";
        assert!(zero_dependencies(manifest).is_err());
    }
}
