//! Proxy-link parser — port of `src/main/lib/parseConfig.ts`.

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use percent_encoding::percent_decode_str;

use crate::ids::stable_id_len;
use crate::models::ServerConfig;
use crate::util::now_ms;

pub struct ParseResult {
    pub server: ServerConfig,
    pub warnings: Vec<String>,
}

const LINK_SCHEMES: [&str; 9] = ["vless", "vmess", "trojan", "ss", "ssh", "hy2", "hysteria2", "wg", "tuic"];

fn network_alias(value: &str) -> &'static str {
    match value.to_ascii_lowercase().as_str() {
        "tcp" | "xudp" => "tcp",
        "ws" | "websocket" => "ws",
        "grpc" | "gun" | "multi" => "grpc",
        "h2" | "http" => "h2",
        "quic" => "quic",
        "kcp" | "mkcp" => "kcp",
        "splithttp" => "splithttp",
        "xhttp" => "xhttp",
        _ => "tcp",
    }
}

fn security_alias(value: &str) -> Option<&'static str> {
    match value.to_ascii_lowercase().as_str() {
        "none" | "" => Some("none"),
        "tls" => Some("tls"),
        "xtls" => Some("xtls"),
        "reality" | "recon" => Some("reality"),
        _ => None,
    }
}

pub fn parse_proxy_link(link: &str, source: &str) -> Option<ParseResult> {
    let raw = link.trim();
    if raw.is_empty() {
        return None;
    }
    let scheme_end = raw.find("://")?;
    let scheme = raw[..scheme_end].to_ascii_lowercase();
    let mut result = match scheme.as_str() {
        "vless" => parse_vless(raw),
        "trojan" => parse_trojan(raw),
        "vmess" => parse_vmess(raw),
        "ss" | "shadowsocks" => Some(unsupported(
            "shadowsocks",
            raw,
            "پروتکل Shadowsocks در این نسخه پشتیبانی نمی‌شود",
        )),
        _ => Some(unsupported(
            "unknown",
            raw,
            &format!("پروتکل «{}» شناخته نشد", scheme),
        )),
    }?;
    result.server.source = source.to_string();
    Some(result)
}

fn unsupported(protocol: &str, raw: &str, reason: &str) -> ParseResult {
    let name = name_from(raw);
    let name = if name.is_empty() { "کانفیگ ناشناخته".to_string() } else { name };
    ParseResult {
        warnings: vec![reason.to_string()],
        server: ServerConfig {
            id: fingerprint(protocol, raw),
            name,
            protocol: protocol.to_string(),
            supported: false,
            unsupported_reason: Some(reason.to_string()),
            address: String::new(),
            port: 0,
            credential: String::new(),
            security: "none".into(),
            network: "unknown".into(),
            added_at: now_ms(),
            source: "subscription".into(),
            subscription_id: None,
            latency_ms: None,
            latency_at: None,
            ..ServerConfig::default()
        },
    }
}

/* ------------------------------------------------------------- query utils */

type Params = Vec<(String, String)>;

fn parse_query(query: &str) -> Params {
    let mut out = Params::new();
    for pair in query.split('&') {
        if pair.is_empty() {
            continue;
        }
        let mut it = pair.splitn(2, '=');
        let key = it.next().unwrap_or("");
        let value = it.next().unwrap_or("");
        out.push((form_decode(key), form_decode(value)));
    }
    out
}

fn form_decode(value: &str) -> String {
    percent_decode_str(&value.replace('+', " "))
        .decode_utf8_lossy()
        .into_owned()
}

/// WHATWG application/x-www-form-urlencoded serializer (URLSearchParams.toString()).
fn form_encode(value: &str) -> String {
    let mut out = String::new();
    for byte in value.bytes() {
        match byte {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'*' | b'-' | b'.' | b'_' => out.push(byte as char),
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{:02X}", byte)),
        }
    }
    out
}

fn params_to_string(params: &Params) -> String {
    params
        .iter()
        .map(|(k, v)| format!("{}={}", form_encode(k), form_encode(v)))
        .collect::<Vec<_>>()
        .join("&")
}

fn get_param<'a>(params: &'a Params, key: &str) -> Option<&'a str> {
    params.iter().find(|(k, _)| k == key).map(|(_, v)| v.as_str())
}

fn nonempty<'a>(params: &'a Params, key: &str) -> Option<&'a str> {
    get_param(params, key).filter(|v| !v.is_empty())
}

fn first_of<'a>(values: &[Option<&'a str>]) -> Option<&'a str> {
    values.iter().copied().flatten().find(|v| !v.is_empty())
}

fn bool_param(values: &[Option<&str>]) -> Option<bool> {
    let v = first_of(values)?;
    Some(matches!(
        v.to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "multi" | "multimode" | "gun"
    ))
}

fn int_param(values: &[Option<&str>]) -> Option<u32> {
    let v = first_of(values)?;
    let n: f64 = v.parse().ok()?;
    if n.is_finite() && n > 0.0 {
        Some(n.floor() as u32)
    } else {
        None
    }
}

fn split_list(value: Option<&str>) -> Option<Vec<String>> {
    let v = value?;
    if v.is_empty() {
        return None;
    }
    let parts: Vec<String> = v.split(',').map(|p| p.trim().to_string()).filter(|p| !p.is_empty()).collect();
    if parts.is_empty() {
        None
    } else {
        Some(parts)
    }
}

fn split_authority(authority: &str) -> (String, u16) {
    let mut host = authority;
    let mut port = 443u16;
    if let Some(rest) = host.strip_prefix('[') {
        if let Some(close) = rest.find(']') {
            let literal = &rest[..close];
            let tail = &rest[close + 1..];
            let parsed = tail.strip_prefix(':').and_then(|t| t.parse::<u16>().ok());
            return (literal.to_string(), parsed.unwrap_or(443));
        }
    }
    if let Some(idx) = host.rfind(':') {
        if idx > 0 {
            let maybe = &host[idx + 1..];
            if !maybe.is_empty() && maybe.bytes().all(|b| b.is_ascii_digit()) {
                if let Ok(p) = maybe.parse::<u16>() {
                    port = p;
                    host = &host[..idx];
                }
            }
        }
    }
    let decoded = strict_percent_decode(host).unwrap_or_else(|| host.to_string());
    (decoded, port)
}

fn strict_percent_decode(value: &str) -> Option<String> {
    percent_decode_str(value).decode_utf8().ok().map(|c| c.into_owned())
}

fn has_percent_seq(value: &str) -> bool {
    let b = value.as_bytes();
    (0..b.len().saturating_sub(2))
        .any(|i| b[i] == b'%' && b[i + 1].is_ascii_hexdigit() && b[i + 2].is_ascii_hexdigit())
}

fn decode_fragment(fragment: &str) -> String {
    let Some(once) = strict_percent_decode(fragment) else {
        return fragment.to_string();
    };
    if has_percent_seq(&once) {
        strict_percent_decode(&once).unwrap_or(once)
    } else {
        once
    }
}

fn name_from(raw: &str) -> String {
    match raw.find('#') {
        Some(idx) => decode_fragment(&raw[idx + 1..]),
        None => String::new(),
    }
}

fn fingerprint(protocol: &str, seed: &str) -> String {
    stable_id_len(&format!("{}|{}", protocol, seed), 16)
}

fn validate(server: &mut ServerConfig, warnings: &mut Vec<String>) {
    if server.security == "reality" && server.pbk.is_none() {
        warnings.push("کلید عمومی REALITY (pbk) در لینک وجود ندارد".into());
        server.supported = false;
        server.unsupported_reason = Some("کانفیگ REALITY بدون کلید عمومی کامل نیست".into());
    }
    if server.security == "tls" && server.sni.is_none() {
        server.sni = Some(server.address.clone());
        warnings.push("SNI در لینک نبود؛ از آدرس سرور استفاده شد".into());
    }
    if server.network == "ws" && server.path.is_none() {
        server.path = Some("/".into());
    }
    if server.network == "grpc" && server.service_name.is_none() {
        warnings.push("serviceName برای gRPC خالی است".into());
    }
}

/* ------------------------------------------------------------------ vless */

fn parse_vless(raw: &str) -> Option<ParseResult> {
    let mut warnings: Vec<String> = Vec::new();
    let rest = raw.get("vless://".len()..)?;
    let (without_fragment, fragment) = match rest.find('#') {
        Some(idx) => (&rest[..idx], decode_fragment(&rest[idx + 1..])),
        None => (rest, String::new()),
    };
    let at_index = without_fragment.rfind('@')?;
    let credential = &without_fragment[..at_index];
    let host_part = &without_fragment[at_index + 1..];
    let (authority, query) = match host_part.find('?') {
        Some(idx) => (&host_part[..idx], &host_part[idx + 1..]),
        None => (host_part, ""),
    };
    let params = parse_query(query);
    let (address, port) = split_authority(authority);
    if address.is_empty() || port == 0 {
        return None;
    }

    let network = network_alias(
        get_param(&params, "type")
            .or_else(|| get_param(&params, "network"))
            .unwrap_or("tcp"),
    );
    let security_raw = get_param(&params, "security")
        .or_else(|| get_param(&params, "tls"))
        .unwrap_or("none")
        .to_ascii_lowercase();
    let security = security_alias(&security_raw).unwrap_or("none");
    if !security_raw.is_empty() && security_alias(&security_raw).is_none() {
        warnings.push(format!("نوع امنیت «{}» ناشناخته است و «none» در نظر گرفته شد", security_raw));
    }

    let allow_insecure = matches!(
        get_param(&params, "allowInsecure").unwrap_or("").to_ascii_lowercase().as_str(),
        "1" | "true" | "yes"
    );
    if allow_insecure && security == "tls" {
        warnings.push("allowInsecure فعال است — اعتبار گواهی بررسی نمی‌شود".into());
    }

    let name = first_of(&[
        if fragment.is_empty() { None } else { Some(fragment.as_str()) },
        nonempty(&params, "remark"),
        nonempty(&params, "name"),
    ])
    .map(|s| s.to_string())
    .unwrap_or_else(|| format!("{}:{}", address, port));

    let mut server = ServerConfig {
        id: fingerprint("vless", &format!("{}:{}:{}:{}", address, port, credential, params_to_string(&params))),
        name,
        protocol: "vless".into(),
        supported: true,
        address: address.clone(),
        port,
        credential: credential.to_string(),
        flow: nonempty(&params, "flow").map(String::from),
        encryption: Some(nonempty(&params, "encryption").map(String::from).unwrap_or_else(|| "none".into())),
        security: security.to_string(),
        network: network.to_string(),
        sni: first_of(&[nonempty(&params, "sni"), nonempty(&params, "host")]).map(String::from),
        alpn: split_list(get_param(&params, "alpn")),
        fingerprint: nonempty(&params, "fp").map(String::from),
        allow_insecure: if allow_insecure { Some(true) } else { None },
        pbk: nonempty(&params, "pbk").map(String::from),
        sid: nonempty(&params, "sid").map(String::from),
        spider_x: nonempty(&params, "spx").map(String::from),
        host: nonempty(&params, "host").map(String::from),
        path: nonempty(&params, "path").map(String::from),
        service_name: nonempty(&params, "serviceName")
            .or_else(|| nonempty(&params, "serviceName "))
            .map(String::from),
        grpc_multi_mode: bool_param(&[nonempty(&params, "mode"), nonempty(&params, "multiMode")]),
        header_type: first_of(&[nonempty(&params, "headerType"), nonempty(&params, "header")]).map(String::from),
        quic_security: nonempty(&params, "quicSecurity").map(String::from),
        quic_key: nonempty(&params, "key").map(String::from),
        xhttp_mode: first_of(&[nonempty(&params, "xhttpMode"), nonempty(&params, "mode")]).map(String::from),
        mux: bool_param(&[nonempty(&params, "muxEnabled"), nonempty(&params, "mux")]),
        mux_concurrency: int_param(&[nonempty(&params, "muxConcurrency"), nonempty(&params, "xudpConcurrency")]),
        added_at: now_ms(),
        source: "subscription".into(),
        subscription_id: None,
        latency_ms: None,
        latency_at: None,
        raw: Some(raw.to_string()),
        ..ServerConfig::default()
    };
    validate(&mut server, &mut warnings);
    Some(ParseResult { server, warnings })
}

/* ----------------------------------------------------------------- trojan */

fn parse_trojan(raw: &str) -> Option<ParseResult> {
    let mut warnings: Vec<String> = Vec::new();
    let rest = raw.get("trojan://".len()..)?;
    let (body, fragment) = match rest.find('#') {
        Some(idx) => (&rest[..idx], decode_fragment(&rest[idx + 1..])),
        None => (rest, String::new()),
    };
    let at_index = body.rfind('@')?;
    let credential = &body[..at_index];
    let host_part = &body[at_index + 1..];
    let (authority, query) = match host_part.find('?') {
        Some(idx) => (&host_part[..idx], &host_part[idx + 1..]),
        None => (host_part, ""),
    };
    let params = parse_query(query);
    let (address, port) = split_authority(authority);
    if address.is_empty() || port == 0 {
        return None;
    }
    let network = network_alias(
        get_param(&params, "type")
            .or_else(|| get_param(&params, "network"))
            .unwrap_or("tcp"),
    );
    let security = security_alias(get_param(&params, "security").unwrap_or("tls")).unwrap_or("tls");
    let allow_insecure = matches!(
        get_param(&params, "allowInsecure").unwrap_or("").to_ascii_lowercase().as_str(),
        "1" | "true"
    );
    let name = first_of(&[
        if fragment.is_empty() { None } else { Some(fragment.as_str()) },
        nonempty(&params, "remark"),
    ])
    .map(String::from)
    .unwrap_or_else(|| format!("{}:{}", address, port));

    let mut server = ServerConfig {
        id: fingerprint("trojan", &format!("{}:{}:{}", address, port, credential)),
        name,
        protocol: "trojan".into(),
        supported: true,
        address: address.clone(),
        port,
        credential: credential.to_string(),
        security: security.to_string(),
        network: network.to_string(),
        sni: first_of(&[nonempty(&params, "sni"), nonempty(&params, "peer")]).map(String::from),
        alpn: split_list(get_param(&params, "alpn")),
        fingerprint: nonempty(&params, "fp").map(String::from),
        allow_insecure: if allow_insecure { Some(true) } else { None },
        path: nonempty(&params, "path").map(String::from),
        host: nonempty(&params, "host").map(String::from),
        service_name: nonempty(&params, "serviceName").map(String::from),
        grpc_multi_mode: bool_param(&[nonempty(&params, "mode")]),
        added_at: now_ms(),
        source: "subscription".into(),
        subscription_id: None,
        latency_ms: None,
        latency_at: None,
        raw: Some(raw.to_string()),
        ..ServerConfig::default()
    };
    validate(&mut server, &mut warnings);
    Some(ParseResult { server, warnings })
}

/* ------------------------------------------------------------------ vmess */

fn value_to_string(value: Option<&serde_json::Value>) -> String {
    match value {
        Some(serde_json::Value::String(s)) => s.clone(),
        Some(serde_json::Value::Number(n)) => n.to_string(),
        Some(serde_json::Value::Bool(b)) => b.to_string(),
        _ => String::new(),
    }
}

fn parse_vmess(raw: &str) -> Option<ParseResult> {
    let mut warnings: Vec<String> = Vec::new();
    let body = raw.get("vmess://".len()..)?.trim();
    let json = String::from_utf8_lossy(&b64_decode_lenient(body)?).into_owned();
    let data: serde_json::Value = serde_json::from_str(&json).ok()?;

    let address = {
        let v = data
            .get("add")
            .filter(|x| !x.is_null())
            .or_else(|| data.get("addr").filter(|x| !x.is_null()));
        value_to_string(v)
    };
    let port = match data.get("port") {
        Some(serde_json::Value::Number(n)) => n.as_u64().unwrap_or(0) as u16,
        Some(serde_json::Value::String(s)) => s.trim().parse::<f64>().ok().map(|f| f as u16).unwrap_or(0),
        _ => 0,
    };
    let credential = value_to_string(data.get("id"));
    if address.is_empty() || port == 0 || credential.is_empty() {
        return None;
    }

    let security_raw = value_to_string(data.get("tls").filter(|v| !v.is_null())).to_ascii_lowercase();
    let security = if security_raw == "reality" {
        "reality"
    } else if security_raw == "tls" {
        "tls"
    } else {
        "none"
    };
    let net_raw = data.get("net").filter(|v| !v.is_null()).map(|v| value_to_string(Some(v))).unwrap_or_else(|| "tcp".into());
    let network = network_alias(&net_raw);

    let name = data
        .get("ps")
        .filter(|v| !v.is_null())
        .map(|v| value_to_string(Some(v)))
        .filter(|s| !s.is_empty())
        .or_else(|| {
            data.get("remark")
                .filter(|v| !v.is_null())
                .map(|v| value_to_string(Some(v)))
                .filter(|s| !s.is_empty())
        })
        .unwrap_or_else(|| format!("{}:{}", address, port));

    let sni_param = value_to_string(data.get("sni").filter(|v| !v.is_null()));
    let sni = if !sni_param.is_empty() {
        Some(sni_param)
    } else if security == "tls" {
        Some(address.clone())
    } else {
        None
    };
    let alpn = split_list(data.get("alpn").and_then(|v| v.as_str()));
    let fp = value_to_string(data.get("fp").filter(|v| !v.is_null()));
    let allow_insecure = matches!(data.get("allowInsecure"), Some(serde_json::Value::Bool(true)))
        || data.get("allowInsecure").and_then(|v| v.as_str()) == Some("true");
    let path = value_to_string(data.get("path").filter(|v| !v.is_null()));
    let header_type = data.get("type").and_then(|v| v.as_str()).map(String::from);

    let mut server = ServerConfig {
        id: fingerprint("vmess", &format!("{}:{}:{}", address, port, credential)),
        name,
        protocol: "vmess".into(),
        supported: true,
        address: address.clone(),
        port,
        credential,
        encryption: Some("auto".into()),
        security: security.to_string(),
        network: network.to_string(),
        sni,
        alpn,
        fingerprint: if fp.is_empty() { None } else { Some(fp) },
        allow_insecure: if allow_insecure { Some(true) } else { None },
        pbk: opt_str(value_to_string(data.get("pbk").filter(|v| !v.is_null()))),
        sid: opt_str(value_to_string(data.get("sid").filter(|v| !v.is_null()))),
        spider_x: opt_str(value_to_string(data.get("spx").filter(|v| !v.is_null()))),
        host: opt_str(value_to_string(data.get("host").filter(|v| !v.is_null()))),
        path: opt_str(path.clone()),
        service_name: if !path.is_empty() && network == "grpc" { Some(path) } else { None },
        header_type,
        added_at: now_ms(),
        source: "subscription".into(),
        subscription_id: None,
        latency_ms: None,
        latency_at: None,
        raw: Some(raw.to_string()),
        ..ServerConfig::default()
    };
    validate(&mut server, &mut warnings);
    Some(ParseResult { server, warnings })
}

fn opt_str(value: String) -> Option<String> {
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

/* ------------------------------------------------------- payload splitting */

fn line_scheme(line: &str) -> Option<&'static str> {
    let idx = line.find("://")?;
    let scheme = line[..idx].to_ascii_lowercase();
    LINK_SCHEMES.iter().copied().find(|candidate| scheme == *candidate)
}

/// Payload-level link detection (the smaller TS regex set used while decoding).
const PAYLOAD_SCHEMES: [&str; 6] = ["vless", "vmess", "trojan", "ss", "hy2", "tuic"];

pub fn is_linkish(text: &str) -> bool {
    text.lines().any(|line| {
        let t = line.trim();
        match t.find("://") {
            Some(idx) => PAYLOAD_SCHEMES.iter().any(|s| t[..idx].eq_ignore_ascii_case(s)),
            None => false,
        }
    })
}

/// Split a subscription payload into individual links (raw or base64-encoded).
pub fn extract_links(text: &str) -> Vec<String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let looks_linkish = trimmed.lines().any(|line| line_scheme(line).is_some());
    let decoded_holder: Option<String> = if !looks_linkish {
        try_decode_base64(trimmed)
    } else {
        None
    };
    let source: &str = decoded_holder.as_deref().unwrap_or(trimmed);

    let mut out = Vec::new();
    for line in source.lines() {
        let value = line.trim();
        if value.is_empty() || value.starts_with('#') || value.starts_with("//") {
            continue;
        }
        if line_scheme(value).is_none() {
            continue;
        }
        out.push(value.to_string());
    }
    out
}

/// Lenient base64 decode used by subscriptions (mirrors `tryDecodeBase64`).
pub fn try_decode_base64(input: &str) -> Option<String> {
    let compact: String = input.split_whitespace().collect();
    if compact.len() < 16 {
        return None;
    }
    if !compact.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'+' | b'/' | b'=' | b'_' | b'-')) {
        return None;
    }
    let normalized = compact.replace('-', "+").replace('_', "/");
    let pad = (4 - normalized.len() % 4) % 4;
    let padded = format!("{}{}", normalized, "=".repeat(pad));
    let bytes = B64.decode(&padded).ok()?;
    if bytes.is_empty() {
        return None;
    }
    let text = String::from_utf8(bytes).ok()?;
    let total = text.chars().count().max(1);
    let printable = text
        .chars()
        .filter(|c| *c == '\t' || *c == '\n' || *c == '\r' || (*c as u32) >= 32)
        .count();
    if (printable as f64) / (total as f64) < 0.95 {
        return None;
    }
    if text.contains('\u{FFFD}') {
        return None;
    }
    Some(text)
}

/// Lenient base64 decode for vmess payloads (Node's Buffer.from semantics).
pub fn b64_decode_lenient(input: &str) -> Option<Vec<u8>> {
    let compact: String = input.split_whitespace().collect();
    let normalized = compact.replace('-', "+").replace('_', "/");
    let pad = (4 - normalized.len() % 4) % 4;
    let padded = format!("{}{}", normalized, "=".repeat(pad));
    B64.decode(&padded).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    const VLESS_TLS_WS: &str = "vless://11111111-2222-3333-4444-555555555555@example.server.com:443?encryption=none&security=tls&sni=cdn.example.com&type=ws&host=cdn.example.com&path=%2Fvless&fp=chrome#TE-Test";

    #[test]
    fn parses_vless_tls_ws() {
        let parsed = parse_proxy_link(VLESS_TLS_WS, "subscription").expect("parse");
        let s = parsed.server;
        assert_eq!(s.protocol, "vless");
        assert_eq!(s.address, "example.server.com");
        assert_eq!(s.port, 443);
        assert_eq!(s.credential, "11111111-2222-3333-4444-555555555555");
        assert_eq!(s.security, "tls");
        assert_eq!(s.network, "ws");
        assert_eq!(s.sni.as_deref(), Some("cdn.example.com"));
        assert_eq!(s.path.as_deref(), Some("/vless"));
        assert_eq!(s.name, "TE-Test");
        assert!(s.supported);
        assert_eq!(s.id.len(), 16);
    }

    #[test]
    fn reality_without_pbk_is_unsupported() {
        let link = "vless://uuid@example.com:443?security=reality&type=tcp&flow=xtls-rprx-vision#R";
        let parsed = parse_proxy_link(link, "subscription").expect("parse");
        assert!(!parsed.server.supported);
        assert!(parsed.server.unsupported_reason.is_some());
    }

    #[test]
    fn parses_vmess_base64() {
        let json = r#"{"v":"2","ps":"VM-Test","add":"vmess.example.com","port":"8443","id":"aaaa","aid":"0","net":"ws","tls":"tls","host":"h.example.com","path":"/vm"}"#;
        let b64 = B64.encode(json);
        let link = format!("vmess://{}", b64);
        let parsed = parse_proxy_link(&link, "subscription").expect("parse");
        let s = parsed.server;
        assert_eq!(s.protocol, "vmess");
        assert_eq!(s.name, "VM-Test");
        assert_eq!(s.address, "vmess.example.com");
        assert_eq!(s.port, 8443);
        assert_eq!(s.security, "tls");
        assert_eq!(s.network, "ws");
        assert_eq!(s.sni.as_deref(), Some("vmess.example.com"));
        assert_eq!(s.encryption.as_deref(), Some("auto"));
    }

    #[test]
    fn extract_links_handles_base64_payloads() {
        let payload = format!("{}\n{}", VLESS_TLS_WS, "trojan://pw@t.example.com:443#TJ");
        let encoded = B64.encode(payload.as_bytes());
        let links = extract_links(&encoded);
        assert_eq!(links.len(), 2);
        assert!(links[0].starts_with("vless://"));
        let direct = extract_links(&format!("# comment\n{}\n\nnot-a-link\n", VLESS_TLS_WS));
        assert_eq!(direct.len(), 1);
    }

    #[test]
    fn base64_detector_rejects_garbage() {
        assert!(try_decode_base64("hello world this is plain text!").is_none());
        assert!(try_decode_base64("c2hvcnQ=").is_none()); // too short
        let ok = B64.encode("vless://uuid@host:443#x".as_bytes());
        assert!(try_decode_base64(&ok).is_some());
    }

    #[test]
    fn query_roundtrip_is_stable() {
        let params = parse_query("a=1&b=hello+world&c=%2Fpath");
        assert_eq!(get_param(&params, "b"), Some("hello world"));
        assert_eq!(get_param(&params, "c"), Some("/path"));
        assert_eq!(params_to_string(&params), "a=1&b=hello+world&c=%2Fpath");
    }
}
