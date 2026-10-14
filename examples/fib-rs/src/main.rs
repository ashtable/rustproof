fn main() {
    let arg = std::env::args().nth(1);
    if arg.as_deref() == Some("--version") {
        // `rustproof build` stamps the patched tree's hash at compile time (delta §7.12).
        let patched_hash = option_env!("RUSTPROOF_PATCHED_HASH").unwrap_or("none");
        println!(
            "fib-rs {} (patched_hash: {patched_hash})",
            env!("CARGO_PKG_VERSION")
        );
        return;
    }
    let n: u64 = match arg {
        Some(arg) => arg
            .parse()
            .expect("usage: fib-rs [n], n a non-negative integer"),
        None => 10,
    };
    println!("{}", fib_rs::fib(n));
}
