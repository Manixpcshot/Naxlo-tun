//! Network probes — port of `src/main/lib/net.ts`.

use std::sync::atomic::{AtomicU16, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use serde_json::Value;

use crate::l10n::{l, lt, LString};
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
        .map_err(|e| lt(&format!("ساخت پروکسی ناموفق: {}", e), &format!("Failed to build a proxy: {}", e), &format!("Proxy oluşturulamadı: {}", e)))?;
    let mut builder = reqwest::Client::builder().proxy(proxy).user_agent("naxlo/1.0");
    if let Some(t) = timeout {
        builder = builder.timeout(t);
    }
    builder
        .build()
        .map_err(|e| lt(&format!("ساخت کلاینت شبکه ناموفق: {}", e), &format!("Failed to create an HTTP client: {}", e), &format!("HTTP istemcisi oluşturulamadı: {}", e)))
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
                lt(
                    &format!("تست اتصال ناموفق بود: {}", e),
                    &format!("Connection test failed: {}", e),
                    &format!("Bağlantı testi başarısız: {}", e),
                )
            };
            ProbeResult { ok: false, status: 0, ms: started.elapsed().as_millis() as u64, error: Some(message) }
        }
    }
}

/* ------------------------------------------------- adaptive speed test */
/* Mirrors `src/shared/speed.ts`: probe → ladder size → parallel streams,
   steady-state rate (slow-start ramp excluded). */

pub const SPEED_PROBE_BYTES: u64 = 2 * 1024 * 1024;
pub const SPEED_PROBE_MS: u64 = 4_000;
pub const SPEED_MAIN_MS: u64 = 8_000;
pub const SPEED_RAMP_MS: u64 = 1_500;
pub const SPEED_STREAMS: usize = 4;
const SPEED_LADDER_MB: [u64; 5] = [8, 16, 32, 64, 100];
const SPEED_MAX_MB: u64 = 100;
const TELE2_SIZES_MB: [u64; 4] = [10, 20, 50, 100];

/// Transfer size (MiB) for the main phase, from the probe rate.
pub fn pick_size_mb(probe_mbps: f64) -> u64 {
    if !probe_mbps.is_finite() || probe_mbps <= 0.0 {
        return SPEED_LADDER_MB[0];
    }
    let ideal = probe_mbps * (SPEED_MAIN_MS as f64 / 1000.0) / 8.0;
    for step in SPEED_LADDER_MB {
        if (step as f64) >= ideal {
            return step;
        }
    }
    SPEED_MAX_MB
}

/// Steady-state rate: only bytes/time after the slow-start ramp.
pub fn steady_mbps(total_bytes: u64, ramp_bytes: u64, total_ms: u64) -> f64 {
    let ms = ((total_ms as i64) - (SPEED_RAMP_MS as i64)).max(200) as f64;
    let bytes = total_bytes.saturating_sub(ramp_bytes) as f64;
    ((bytes * 8.0 / ms / 1000.0) * 10.0).round() / 10.0
}

fn tele2_size_mb(size_mb: u64) -> u64 {
    let mut pick = TELE2_SIZES_MB[0];
    for size in TELE2_SIZES_MB {
        if size <= size_mb {
            pick = size;
        }
    }
    pick
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum SpeedBase {
    Own,
    Cloudflare,
    Tele2,
}

/// Measurement URL of one base for a given transfer size (MiB).
pub fn speed_url(base: SpeedBase, size_mb: u64, nonce: i64) -> String {
    let bytes = size_mb * 1024 * 1024;
    match base {
        SpeedBase::Own => {
            if size_mb <= 10 {
                format!("https://vpn.naxlo.ir/speedtest.bin?r={}", nonce)
            } else {
                format!("https://vpn.naxlo.ir/speedtest.php?bytes={}&r={}", bytes, nonce)
            }
        }
        SpeedBase::Cloudflare => format!("https://speed.cloudflare.com/__down?bytes={}", bytes),
        SpeedBase::Tele2 => format!("https://speedtest.tele2.net/{}MB.zip", tele2_size_mb(size_mb)),
    }
}

pub struct SpeedOutcome {
    pub ok: bool,
    pub mbps: f64,
    pub bytes: u64,
    pub ms: u64,
    pub size_mb: u64,
    pub streams: usize,
}

/// One stream: pulls bytes until its cap or the shared deadline. When
/// `counter` is set every chunk also lands in the phase-wide total.
async fn stream_download(
    host: String,
    port: u16,
    url: String,
    cap_bytes: u64,
    deadline: Instant,
    counter: Option<Arc<AtomicU64>>,
) -> Throughput {
    let started = Instant::now();
    let client = match proxy_client(&host, port, None) {
        Ok(c) => c,
        Err(_) => return Throughput { ok: false, bytes: 0, ms: 0, status: 0 },
    };
    let result = async move {
        let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
        let status = resp.status().as_u16();
        if status >= 400 {
            return Err(format!("HTTP {}", status));
        }
        let mut stream = resp.bytes_stream();
        let mut count: u64 = 0;
        loop {
            let next = tokio::time::timeout_at(tokio::time::Instant::from_std(deadline), stream.next()).await;
            match next {
                Ok(Some(Ok(chunk))) => {
                    count += chunk.len() as u64;
                    if let Some(cell) = &counter {
                        cell.fetch_add(chunk.len() as u64, Ordering::SeqCst);
                    }
                    if count >= cap_bytes {
                        break;
                    }
                }
                Ok(Some(Err(e))) => return Err(e.to_string()),
                Ok(None) | Err(_) => break,
            }
        }
        Ok::<(u64, u16), String>((count, status))
    }
    .await;
    let ms = started.elapsed().as_millis() as u64;
    match result {
        Ok((count, status)) => Throughput { ok: count > 0, bytes: count, ms, status },
        // The counter lives inside the stream future; on error the
        // phase-wide total (if any) still holds what other streams pulled.
        Err(_) => Throughput { ok: false, bytes: 0, ms, status: 0 },
    }
}

/// speedtest.net-style measurement (TS parity with `runSpeedTest`).
pub async fn run_speed_test(host: &str, port: u16) -> SpeedOutcome {
    let nonce = now_ms();
    for base in [SpeedBase::Own, SpeedBase::Cloudflare, SpeedBase::Tele2] {
        let probe_deadline = Instant::now() + Duration::from_millis(SPEED_PROBE_MS);
        let probe = stream_download(
            host.to_string(),
            port,
            speed_url(base, 2, nonce),
            SPEED_PROBE_BYTES,
            probe_deadline,
            None,
        )
        .await;
        if !probe.ok || probe.bytes < 64 * 1024 || probe.ms == 0 {
            continue;
        }
        let probe_mbps = (probe.bytes as f64) * 8.0 / (probe.ms as f64) / 1000.0;
        let size_mb = pick_size_mb(probe_mbps);

        let started = Instant::now();
        let deadline = started + Duration::from_millis(SPEED_MAIN_MS);
        let total = Arc::new(AtomicU64::new(0));
        let mut handles = Vec::with_capacity(SPEED_STREAMS);
        for _ in 0..SPEED_STREAMS {
            handles.push(tokio::spawn(stream_download(
                host.to_string(),
                port,
                speed_url(base, size_mb, nonce),
                size_mb * 1024 * 1024,
                deadline,
                Some(total.clone()),
            )));
        }
        tokio::time::sleep(Duration::from_millis(SPEED_RAMP_MS)).await;
        let ramp = total.load(Ordering::SeqCst);
        let mut any_ok = false;
        for handle in handles {
            if let Ok(r) = handle.await {
                if r.ok {
                    any_ok = true;
                }
            }
        }
        let elapsed = started.elapsed().as_millis() as u64;
        let bytes = total.load(Ordering::SeqCst);
        if !any_ok || bytes < 256 * 1024 {
            continue;
        }
        return SpeedOutcome {
            ok: true,
            mbps: steady_mbps(bytes, ramp, elapsed),
            bytes,
            ms: elapsed,
            size_mb,
            streams: SPEED_STREAMS,
        };
    }
    SpeedOutcome { ok: false, mbps: 0.0, bytes: 0, ms: 0, size_mb: 0, streams: 0 }
}

#[cfg(test)]
mod speed_tests {
    use super::*;

    #[test]
    fn ladder_follows_the_probe_rate() {
        assert_eq!(pick_size_mb(1.0), 8);
        assert_eq!(pick_size_mb(10.0), 16);
        assert_eq!(pick_size_mb(40.0), 64);
        assert_eq!(pick_size_mb(500.0), 100);
        assert_eq!(pick_size_mb(-5.0), 8);
    }

    #[test]
    fn steady_rate_excludes_the_ramp() {
        // 8 s window, 1.5 s ramp: 80 MB total, 10 MB during ramp.
        let mbps = steady_mbps(80 * 1024 * 1024, 10 * 1024 * 1024, 8000);
        assert!((mbps - 90.3).abs() < 0.5, "mbps={}", mbps);
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
