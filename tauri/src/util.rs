//! Small helpers shared across modules.

use std::time::{SystemTime, UNIX_EPOCH};

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// `n` random bytes as lowercase hex (used for file names and toast ids).
pub fn rand_hex(n: usize) -> String {
    let mut buf = vec![0u8; n];
    if getrandom::getrandom(&mut buf).is_err() {
        // Fall back to time-based material; never used for secrets.
        let seed = now_ms() as u64;
        for (i, byte) in buf.iter_mut().enumerate() {
            *byte = ((seed >> ((i % 8) * 8)) & 0xff) as u8;
        }
    }
    buf.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Fill a buffer with cryptographically secure random bytes.
pub fn random_bytes(buf: &mut [u8]) -> Result<(), String> {
    getrandom::getrandom(buf).map_err(|e| e.to_string())
}

/// Basename of a path string (handles both `/` and `\` separators).
pub fn file_name_of(path: &str) -> String {
    let trimmed = path.trim_end_matches(['/', '\\']);
    match trimmed.rsplit_once(['/', '\\']) {
        Some((_, name)) => name.to_string(),
        None => trimmed.to_string(),
    }
}

pub fn contains_ignore_case(haystack: &str, needles: &[&str]) -> bool {
    let lower = haystack.to_ascii_lowercase();
    needles.iter().any(|n| lower.contains(&n.to_ascii_lowercase()))
}
