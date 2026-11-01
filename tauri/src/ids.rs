//! Stable, non-sensitive identifiers derived from secrets (never log inputs).

use sha2::{Digest, Sha256};

/// sha256(input) truncated — safe to store/log because it cannot be reversed.
pub fn stable_id(input: &str) -> String {
    stable_id_len(input, 12)
}

pub fn stable_id_len(input: &str, len: usize) -> String {
    let hex = format!("{:x}", Sha256::digest(input.as_bytes()));
    hex.chars().take(len).collect()
}
