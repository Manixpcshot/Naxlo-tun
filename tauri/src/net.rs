//! Network probes — port of `src/main/lib/net.ts`.

use std::sync::atomic::{AtomicU16, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use serde_json::Value;

use crate::l10n::{l, LString};
use crate::models::PublicIdentity;
use crate::util::now_ms;

pub struct ProbeResult {
    pub ok: bool,
    pub status: u16,
    pub ms: u64,
    pub error: Option<LString>,
}

pub struct Throughput {
    pub ok: bool,
    pub bytes: u64,
    pub ms: u64,
    pub status: u16,
}

fn proxy_client(host: &str, port: u16, timeout: Option<Duration>) -> Result<reqwest::Client, LString> {
    let proxy = reqwest::Proxy::http(format!("http://{}:{}", host, port))
        .map_err(|e| l(&format!("ساخت پروکسی ناموفق: {}", e), &format!("Failed to build a proxy: {}", e)))?;
    let mut builder = reqwest::Client::builder().proxy(proxy).user_agent("naxlo/1.0");
    if let Some(t) = timeout {
        builder = builder.timeout(t);
    }
    builder
        .build()
        .map_err(|e| l(&format!("ساخت کلاینت شبکه ناموفق: {}", e), &format!("Failed to create an HTTP client: {}", e)))
}

/// TCP connect latency probe; `None` on failure/timeout (mirrors `tcpPing`).
pub async fn tcp_ping(address: &str, port: u16, timeout_ms: u64) -> Option<u64> {
    if address.is_empty() {
        return None;
    }
    let started = Instant::now();
    let target = (address.to_string(), port);
    let connect = tokio::time::timeout(Duration::from_millis(timeout_ms), tokio::net::TcpStream::connect(target))
        .await
        .ok()?;
    connect.ok()?;
    Some(started.elapsed().as_millis() as u64)
}

pub async fn port_in_use(host: &str, port: u16) -> bool {
    tcp_ping(host, port, 500).await.is_some()
}

/// Poll until the local HTTP proxy port accepts connections (mirrors `waitForPort`).
pub async fn wait_for_port(host: &str, port: u16, timeout_ms: u64) -> bool {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    loop {
        if tcp_ping(host, port, 600).await.is_some() {
            return true;
        }
        if Instant::now() >= deadline {
            return false;
        }
        tokio::time::sleep(Duration::from_millis(180)).await;
    }
}

/// Single HTTP request through the local proxy (mirrors `requestThroughProxy`).
pub async fn request_through_proxy(host: &str, port: u16, url: &str, timeout_ms: u64) -> ProbeResult {
    let started = Instant::now();
    let client = match proxy_client(host, port, Some(Duration::from_millis(timeout_ms))) {
        Ok(c) => c,
        Err(e) => {
            return ProbeResult { ok: false, status: 0, ms: 0, error: Some(e) };
        }
    };
    match client.get(url).send().await {
        Ok(resp) => {
            let ms = started.elapsed().as_millis() as u64;
            let status = resp.status().as_u16();
            ProbeResult { ok: status < 400, status, ms, error: None }
        }
        Err(e) => {
            let message = if e.is_timeout() {
                l("مهلت تست اتصال تمام شد", "Connection test timed out")
            } else {
                l(
                    &format!("تست اتصال ناموفق بود: {}", e),
                    &format!("Connection test failed: {}", e),
                )
            };
            ProbeResult { ok: false, status: 0, ms: started.elapsed().as_millis() as u64, error: Some(message) }
        }
    }
}

/// Download up to `max_bytes` through the proxy to measure throughput.
/// A timeout with a meaningful partial download still counts (TS parity).
pub async fn measure_throughput(host: &str, port: u16, url: &str, max_bytes: u64, timeout_ms: u64) -> Throughput {
    let started = Instant::now();
    let bytes_seen = Arc::new(AtomicU64::new(0));
    let status_seen = Arc::new(AtomicU16::new(0));

    let client = match proxy_client(host, port, None) {
        Ok(c) => c,
        Err(_) => {
            return Throughput { ok: false, bytes: 0, ms: 0, status: 0 };
        }
    };

    let bytes_cell = bytes_seen.clone();
    let status_cell = status_seen.clone();
    let fut = async move {
        let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
        let status = resp.status().as_u16();
        status_cell.store(status, Ordering::SeqCst);
        if status >= 400 {
            return Err(format!("HTTP {}", status));
        }
        let mut stream = resp.bytes_stream();
        let mut count: u64 = 0;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            count += chunk.len() as u64;
            bytes_cell.store(count, Ordering::SeqCst);
            if count >= max_bytes {
                break;
            }
        }
        Ok::<u64, String>(count)
    };

    match tokio::time::timeout(Duration::from_millis(timeout_ms), fut).await {
        Ok(Ok(count)) => Throughput {
            ok: true,
            bytes: count,
            ms: started.elapsed().as_millis() as u64,
            status: status_seen.load(Ordering::SeqCst),
        },
        Ok(Err(_)) => Throughput {
            ok: false,
            bytes: bytes_seen.load(Ordering::SeqCst),
            ms: started.elapsed().as_millis() as u64,
            status: status_seen.load(Ordering::SeqCst),
        },
        Err(_) => {
            // Timed out — a partial download of at least 64 KiB still counts.
            let partial = bytes_seen.load(Ordering::SeqCst);
            Throughput {
                ok: partial > 64 * 1024,
                bytes: partial,
                ms: started.elapsed().as_millis() as u64,
                status: status_seen.load(Ordering::SeqCst),
            }
        }
    }
}

fn str_field(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn parse_ipwhois(value: &Value) -> Option<PublicIdentity> {
    let ip = str_field(value, "ip")?;
    Some(PublicIdentity {
        ip,
        country: str_field(value, "country"),
        country_code: str_field(value, "country_code"),
        city: str_field(value, "city"),
        asn: value.pointer("/connection/org").and_then(|v| v.as_str()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        checked_at: 0,
    })
}

fn parse_freeipapi(value: &Value) -> Option<PublicIdentity> {
    let ip = str_field(value, "ipAddress").or_else(|| str_field(value, "ip"))?;
    Some(PublicIdentity {
        ip,
        country: str_field(value, "countryName"),
        country_code: None,
        city: str_field(value, "cityName"),
        asn: None,
        checked_at: 0,
    })
}

fn parse_ipify(value: &Value) -> Option<PublicIdentity> {
    let ip = str_field(value, "ip")?;
    Some(PublicIdentity { ip, country: None, country_code: None, city: None, asn: None, checked_at: 0 })
}

/// Public identity through the local proxy: ipwho.is → freeipapi → ipify.
pub async fn fetch_identity(host: &str, port: u16, timeout_ms: u64) -> Option<PublicIdentity> {
    let client = proxy_client(host, port, Some(Duration::from_millis(timeout_ms))).ok()?;
    let providers: Vec<(&str, fn(&Value) -> Option<PublicIdentity>)> = vec![
        ("https://ipwho.is/", parse_ipwhois),
        ("https://freeipapi.com/api/json", parse_freeipapi),
        ("https://api.ipify.org?format=json", parse_ipify),
    ];
    for (url, parse) in providers {
        let Ok(resp) = client.get(url).send().await else { continue };
        if !resp.status().is_success() {
            continue;
        }
        let Ok(value) = resp.json::<Value>().await else { continue };
        if let Some(mut identity) = parse(&value) {
            identity.checked_at = now_ms();
            return Some(identity);
        }
    }
    None
}
