use clap::Parser;

/// Prove the Rust you ship.
#[derive(Parser)]
// clap takes its name from the package (`rustproof-cli`) unless told otherwise.
#[command(name = "rustproof", version)]
struct Cli {}

fn main() {
    Cli::parse();
}
