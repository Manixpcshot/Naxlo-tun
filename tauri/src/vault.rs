//! Encrypted vault — mirrors `src/main/lib/secretStore.ts` (AES-256-GCM path).
//!
//! The Rust edition protects the vault with a random 32-byte key file stored
//! with owner-only permissions next to it (`vault.key`, 0600). The envelope
//! format matches the Electron fallback so the shape stays familiar:
//! `{ v: 2, alg: "aes-256-gcm", data, iv, tag }` with base64 fields.

use std::fs;
use std::path::Path;

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::{Deserialize, Serialize};

use crate::models::{ServerConfig, StoredSubscription};
use crate::settings::set_owner_only;

const VAULT_VERSION: u32 = 2;

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct VaultPayload {
    /// Legacy single-subscription fields (shape parity with the Electron vault).
    pub subscription_url: Option<String>,
    pub subscription_name: Option<String>,
    pub subscriptions: Vec<StoredSubscription>,
    pub servers: Vec<ServerConfig>,
    pub pinned: Vec<String>,
    pub selected_server_id: Option<String>,
    pub last_connected_at: Option<i64>,
    pub last_updated_at: Option<i64>,
}

#[derive(Serialize, Deserialize)]
struct VaultFile {
    v: u32,
    alg: String,
    data: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    iv: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tag: Option<String>,
}

fn ensure_key(dir: &Path) -> Result<[u8; 32], String> {
    let _ = fs::create_dir_all(dir);
    let key_path = dir.join("vault.key");
    if key_path.exists() {
        let bytes = fs::read(&key_path).map_err(|e| e.to_string())?;
        if bytes.len() == 32 {
            let mut key = [0u8; 32];
            key.copy_from_slice(&bytes);
            return Ok(key);
        }
    }
    let mut key = [0u8; 32];
    crate::util::random_bytes(&mut key)?;
    fs::write(&key_path, key).map_err(|e| e.to_string())?;
    set_owner_only(&key_path);
    Ok(key)
}

pub fn load(dir: &Path) -> VaultPayload {
    let path = dir.join("vault.bin");
    if !path.exists() {
        return VaultPayload::default();
    }
    let raw = match fs::read_to_string(&path) {
        Ok(r) => r,
        Err(_) => return VaultPayload::default(),
    };
    let envelope: VaultFile = match serde_json::from_str(&raw) {
        Ok(e) => e,
        Err(_) => return VaultPayload::default(),
    };
    if envelope.v != VAULT_VERSION || envelope.alg != "aes-256-gcm" {
        return VaultPayload::default();
    }
    let (Some(iv_b64), Some(tag_b64)) = (envelope.iv, envelope.tag) else {
        return VaultPayload::default();
    };
    let Ok(key) = ensure_key(dir) else {
        return VaultPayload::default();
    };
    let (Ok(iv), Ok(data), Ok(tag)) = (B64.decode(&iv_b64), B64.decode(&envelope.data), B64.decode(&tag_b64)) else {
        return VaultPayload::default();
    };
    if iv.len() != 12 || tag.len() != 16 {
        return VaultPayload::default();
    }
    let mut combined = data;
    combined.extend_from_slice(&tag);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let Ok(plain) = cipher.decrypt(Nonce::from_slice(&iv), combined.as_ref()) else {
        return VaultPayload::default();
    };
    let Ok(json) = String::from_utf8(plain) else {
        return VaultPayload::default();
    };
    serde_json::from_str::<VaultPayload>(&json).unwrap_or_default()
}

pub fn save(dir: &Path, payload: &VaultPayload) -> Result<(), String> {
    let json = serde_json::to_string(payload).map_err(|e| e.to_string())?;
    let key = ensure_key(dir)?;
    let mut iv = [0u8; 12];
    crate::util::random_bytes(&mut iv).map_err(|e| e.to_string())?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let combined = cipher
        .encrypt(Nonce::from_slice(&iv), json.as_bytes())
        .map_err(|e| e.to_string())?;
    if combined.len() < 16 {
        return Err("encryption produced an invalid payload".into());
    }
    let (data, tag) = combined.split_at(combined.len() - 16);
    let envelope = VaultFile {
        v: VAULT_VERSION,
        alg: "aes-256-gcm".into(),
        data: B64.encode(data),
        iv: Some(B64.encode(iv)),
        tag: Some(B64.encode(tag)),
    };
    let _ = fs::create_dir_all(dir);
    let target = dir.join("vault.bin");
    let tmp = dir.join("vault.bin.tmp");
    let text = serde_json::to_string(&envelope).map_err(|e| e.to_string())?;
    fs::write(&tmp, text).map_err(|e| e.to_string())?;
    set_owner_only(&tmp);
    fs::rename(&tmp, &target).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn wipe(dir: &Path) {
    let _ = fs::remove_file(dir.join("vault.bin"));
}
