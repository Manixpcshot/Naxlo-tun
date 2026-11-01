//! Serde models mirroring `src/shared/types.ts` (camelCase on the wire).

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::l10n::LString;

/// `string | LString | null` payloads (errors, toast titles).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum LastError {
    Loc(LString),
    Text(String),
}

impl From<LString> for LastError {
    fn from(value: LString) -> Self {
        LastError::Loc(value)
    }
}
impl From<String> for LastError {
    fn from(value: String) -> Self {
        LastError::Text(value)
    }
}
impl From<&str> for LastError {
    fn from(value: &str) -> Self {
        LastError::Text(value.to_string())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct SubUserinfo {
    pub upload: u64,
    pub download: u64,
    /// 0 means unlimited.
    pub total: u64,
    /// Unix seconds; null when the panel reports no expiry.
    pub expire: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ServerConfig {
    pub id: String,
    pub name: String,
    pub protocol: String,
    pub supported: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unsupported_reason: Option<String>,
    pub address: String,
    pub port: u16,
    pub credential: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flow: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encryption: Option<String>,
    pub security: String,
    pub network: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sni: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alpn: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fingerprint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_insecure: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pbk: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spider_x: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grpc_multi_mode: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub header_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quic_security: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quic_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub xhttp_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mux: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mux_concurrency: Option<u32>,
    pub added_at: i64,
    pub source: String,
    pub subscription_id: Option<String>,
    pub latency_ms: Option<u64>,
    pub latency_at: Option<i64>,
    /// Original link — only inside the encrypted vault, never rendered unless revealed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw: Option<String>,
}

impl Default for ServerConfig {
    fn default() -> Self {
        ServerConfig {
            id: String::new(),
            name: String::new(),
            protocol: "unknown".into(),
            supported: false,
            unsupported_reason: None,
            address: String::new(),
            port: 0,
            credential: String::new(),
            flow: None,
            encryption: None,
            security: "none".into(),
            network: "unknown".into(),
            sni: None,
            alpn: None,
            fingerprint: None,
            allow_insecure: None,
            pbk: None,
            sid: None,
            spider_x: None,
            host: None,
            path: None,
            service_name: None,
            grpc_multi_mode: None,
            header_type: None,
            quic_security: None,
            quic_key: None,
            xhttp_mode: None,
            mux: None,
            mux_concurrency: None,
            added_at: 0,
            source: "subscription".into(),
            subscription_id: None,
            latency_ms: None,
            latency_at: None,
            raw: None,
        }
    }
}

/// Masked projection of a server for the renderer (`toServerView`).
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerView {
    pub pinned: bool,
    pub id: String,
    pub name: String,
    pub protocol: String,
    pub supported: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unsupported_reason: Option<String>,
    pub port: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flow: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encryption: Option<String>,
    pub security: String,
    pub network: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sni: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alpn: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fingerprint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_insecure: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spider_x: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grpc_multi_mode: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub header_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quic_security: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quic_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub xhttp_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mux: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mux_concurrency: Option<u32>,
    pub added_at: i64,
    pub source: String,
    pub subscription_id: Option<String>,
    pub latency_ms: Option<u64>,
    pub latency_at: Option<i64>,
    pub address_masked: String,
    pub credential_masked: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pbk_masked: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sid_masked: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credential: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pbk: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct StoredSubscription {
    pub id: String,
    pub url: String,
    pub name: Option<String>,
    pub userinfo: Option<SubUserinfo>,
    pub updated_at: Option<i64>,
    pub last_error: Option<LastError>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
}

#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionView {
    pub id: String,
    pub name: Option<String>,
    pub masked_url: String,
    pub is_file: bool,
    pub updated_at: Option<i64>,
    pub userinfo: Option<SubUserinfo>,
    pub last_error: Option<LastError>,
    pub fetching: bool,
    pub total_configs: usize,
    pub supported_configs: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct PublicIdentity {
    pub ip: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asn: Option<String>,
    pub checked_at: i64,
}

#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CoreStatus {
    pub ready: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub source: Option<String>,
    pub downloading: bool,
    pub progress: Option<f64>,
    pub error: Option<LastError>,
}

#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateState {
    pub checking: bool,
    pub downloading: bool,
    pub progress: Option<f64>,
    pub available_version: Option<String>,
    pub downloaded_version: Option<String>,
    pub error: Option<LastError>,
    pub ready: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub connection: String,
    pub servers_revision: u64,
    pub selected_server_id: Option<String>,
    pub active_server_id: Option<String>,
    pub active_subscription_id: Option<String>,
    pub active_server_name: Option<String>,
    pub active_server_address_masked: Option<String>,
    pub socks_port: u16,
    pub http_port: u16,
    pub system_proxy_enabled: bool,
    pub system_proxy_applied: bool,
    pub started_at: Option<i64>,
    pub last_error: Option<LastError>,
    pub latency_ms: Option<u64>,
    pub identity: Option<PublicIdentity>,
    pub update: UpdateState,
    pub core: CoreStatus,
    pub subscriptions: Vec<SubscriptionView>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub id: u64,
    pub at: i64,
    pub level: String,
    pub scope: String,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Toast {
    pub id: String,
    pub kind: String,
    pub title: LastError,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<LastError>,
}

#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FetchReport {
    pub ok: bool,
    pub total: usize,
    pub supported: usize,
    pub merged: usize,
    pub error: Option<String>,
    pub warnings: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub userinfo: Option<SubUserinfo>,
}

#[derive(Clone, Debug)]
pub struct CoreLocation {
    pub path: PathBuf,
    pub version: Option<String>,
    pub source: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub platform: String,
    pub arch: String,
    pub electron: String,
    pub node: String,
    pub chrome: String,
    pub protection: String,
    pub user_data: String,
    pub logs_dir: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateInfo {
    pub current: String,
    pub latest: Option<String>,
    pub update_available: bool,
    pub release_url: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreUpdateInfo {
    pub current: Option<String>,
    pub latest: Option<String>,
    pub update_available: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeedResult {
    pub mbps: f64,
    pub bytes: u64,
    pub ms: u64,
}

/// Masked projection of a server config for the renderer (`toServerView`).
pub fn to_server_view(server: &ServerConfig, reveal: bool, pinned: bool) -> ServerView {
    let mut view = ServerView {
        pinned,
        id: server.id.clone(),
        name: server.name.clone(),
        protocol: server.protocol.clone(),
        supported: server.supported,
        unsupported_reason: server.unsupported_reason.clone(),
        port: server.port,
        flow: server.flow.clone(),
        encryption: server.encryption.clone(),
        security: server.security.clone(),
        network: server.network.clone(),
        sni: server.sni.clone(),
        alpn: server.alpn.clone(),
        fingerprint: server.fingerprint.clone(),
        allow_insecure: server.allow_insecure,
        spider_x: server.spider_x.clone(),
        host: server.host.clone(),
        path: server.path.clone(),
        service_name: server.service_name.clone(),
        grpc_multi_mode: server.grpc_multi_mode,
        header_type: server.header_type.clone(),
        quic_security: server.quic_security.clone(),
        quic_key: server.quic_key.clone(),
        xhttp_mode: server.xhttp_mode.clone(),
        mux: server.mux,
        mux_concurrency: server.mux_concurrency,
        added_at: server.added_at,
        source: server.source.clone(),
        subscription_id: server.subscription_id.clone(),
        latency_ms: server.latency_ms,
        latency_at: server.latency_at,
        address_masked: crate::mask::mask_address(&server.address),
        credential_masked: crate::mask::mask_middle(&server.credential, 4, 4),
        pbk_masked: server.pbk.as_ref().map(|p| crate::mask::mask_middle(p, 6, 4)),
        sid_masked: server.sid.as_ref().map(|s| crate::mask::mask_middle(s, 2, 2)),
        address: None,
        credential: None,
        pbk: None,
        sid: None,
        raw: None,
    };
    if reveal {
        view.address = Some(server.address.clone());
        view.credential = Some(server.credential.clone());
        view.pbk = server.pbk.clone();
        view.sid = server.sid.clone();
        view.raw = server.raw.clone();
    }
    view
}
