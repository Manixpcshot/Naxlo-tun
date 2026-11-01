//! Bilingual strings (Persian / English), mirroring `src/shared/i18n.ts`.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct LString {
    pub fa: String,
    pub en: String,
}

pub fn l(fa: &str, en: &str) -> LString {
    LString { fa: fa.to_string(), en: en.to_string() }
}

impl LString {
    /// Command errors travel as a JSON-serialized LString; the UI shim parses
    /// it back into a `{ fa, en }` object (same shape the Electron bridge throws).
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| "{\"fa\":\"خطا\",\"en\":\"Error\"}".to_string())
    }
}

pub fn err_str(message: LString) -> String {
    message.to_json()
}
