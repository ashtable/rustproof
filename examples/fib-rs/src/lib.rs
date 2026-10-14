use std::collections::HashMap;

pub fn fib(n: u64) -> u64 {
    fn go(n: u64, memo: &mut HashMap<u64, u64>) -> u64 {
        if n < 2 {
            return n;
        }
        if let Some(&v) = memo.get(&n) {
            return v;
        }
        let v = go(n - 1, memo) + go(n - 2, memo);
        memo.insert(n, v);
        v
    }
    go(n, &mut HashMap::new())
}
