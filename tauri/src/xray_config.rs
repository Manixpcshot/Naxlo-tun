//! Xray config builder — port of `src/main/lib/xray/config.ts`.
//! The Rust edition runs Xray in local-proxy mode only (SOCKS + HTTP inbounds).

use serde_json::{json, Value};

use crate::l10n::{l, LString};
use crate::models::ServerConfig;
use crate::settings::Settings;

fn has(v: &Option<String>) -> bool {
    v.as_ref().map(|s| !s.is_empty()).unwrap_or(false)
}

fn or_default(v: &Option<String>, default: &str) -> String {
    if has(v) {
        v.clone().unwrap()
    } else {
        default.to_string()
    }
}

pub fn build_xray_config(server: &ServerConfig, settings: &Settings) -> Value {
    let listen = if settings.listen_address.is_empty() {
        "127.0.0.1".to_string()
    } else {
        settings.listen_address.clone()
    };

    let inbounds = json!([
        {
            "tag": "naxlo-socks",
            "listen": listen,
            "port": settings.socks_port,
            "protocol": "socks",
            "settings": { "auth": "noauth", "udp": true, "ip": listen, "userLevel": 8 },
            "sniffing": {
                "enabled": true,
                "destOverride": ["http", "tls", "quic"],
                "metadataOnly": false,
                "routeOnly": false
            }
        },
        {
            "tag": "naxlo-http",
            "listen": listen,
            "port": settings.http_port,
            "protocol": "http",
            "settings": { "timeout": 360, "userLevel": 8 },
            "sniffing": {
                "enabled": true,
                "destOverride": ["http", "tls", "quic"],
                "metadataOnly": false
            }
        }
    ]);

    let outbounds = json!([
        build_outbound(server, settings),
        json!({ "tag": "naxlo-direct", "protocol": "freedom", "settings": { "domainStrategy": "AsIs", "redirect": "", "userLevel": 8 } }),
        json!({ "tag": "naxlo-block", "protocol": "blackhole", "settings": { "response": { "type": "http" } } })
    ]);

    json!({
        "log": {
            "access": "",
            "error": "",
            "loglevel": settings.xray_log_level,
            "dnsLog": false,
            "maskAddress": "quarter"
        },
        "inbounds": inbounds,
        "outbounds": outbounds,
        "routing": build_routing(&settings.route_mode, settings.block_ads),
        "policy": {
            "levels": {
                "8": {
                    "handshake": 4,
                    "connIdle": 300,
                    "uplinkOnly": 1,
                    "downlinkOnly": 1,
                    "statsUserUplink": false,
                    "statsUserDownlink": false,
                    "bufferSize": 10240
                }
            },
            "system": {
                "statsInboundUplink": false,
                "statsInboundDownlink": false,
                "statsOutboundUplink": false,
                "statsOutboundDownlink": false
            }
        }
    })
}

fn build_outbound(server: &ServerConfig, settings: &Settings) -> Value {
    let protocol = match server.protocol.as_str() {
        "trojan" => "trojan",
        "vmess" => "vmess",
        _ => "vless",
    };
    json!({
        "tag": "naxlo-proxy",
        "protocol": protocol,
        "settings": build_protocol_settings(server),
        "streamSettings": build_stream_settings(server, settings),
        "mux": build_mux(server, settings)
    })
}

fn build_protocol_settings(server: &ServerConfig) -> Value {
    match server.protocol.as_str() {
        "trojan" => json!({
            "servers": [{
                "address": server.address,
                "port": server.port,
                "password": server.credential,
                "level": 8
            }]
        }),
        "vmess" => json!({
            "vnext": [{
                "address": server.address,
                "port": server.port,
                "users": [{
                    "id": server.credential,
                    "security": or_default(&server.encryption, "auto"),
                    "level": 8,
                    "alterations": 0
                }]
            }]
        }),
        _ => json!({
            "vnext": [{
                "address": server.address,
                "port": server.port,
                "users": [{
                    "id": server.credential,
                    "level": 8,
                    "flow": server.flow.clone().unwrap_or_default(),
                    "encryption": or_default(&server.encryption, "none")
                }]
            }]
        }),
    }
}

fn build_mux(server: &ServerConfig, settings: &Settings) -> Value {
    let enabled = server.mux.unwrap_or(settings.mux_enabled);
    if !enabled {
        return json!({ "enabled": false, "concurrency": -1 });
    }
    let raw = server.mux_concurrency.unwrap_or(settings.mux_concurrency);
    let concurrency = raw.clamp(1, 128);
    json!({ "enabled": true, "concurrency": concurrency, "xudpConcurrency": raw })
}

fn build_stream_settings(server: &ServerConfig, settings: &Settings) -> Value {
    let network = if server.network == "unknown" { "tcp".to_string() } else { server.network.clone() };
    let security = server.security.clone();
    let allow_insecure = server.allow_insecure.unwrap_or(settings.allow_insecure);

    let mut stream = json!({
        "network": network,
        "security": security,
        "sockopt": {
            "tcpFastOpen": false,
            "tcpNoDelay": true,
            "tcpKeepAliveInterval": 20,
            "tcpMptcp": false,
            "tcpUserTimeout": 10000
        }
    });

    let server_name = or_default(&server.sni, &server.address);
    match security.as_str() {
        "tls" => {
            let alpn: Value = if server.alpn.as_ref().map(|a| !a.is_empty()).unwrap_or(false) {
                json!(server.alpn)
            } else {
                json!(["h2", "http/1.1"])
            };
            stream["tlsSettings"] = json!({
                "serverName": server_name,
                "alpn": alpn,
                "fingerprint": or_default(&server.fingerprint, "chrome"),
                "allowInsecure": allow_insecure,
                "show": false,
                "disableSystemRoot": false,
                "rejectUnknownSni": false
            });
        }
        "reality" => {
            stream["realitySettings"] = json!({
                "serverName": server_name,
                "fingerprint": or_default(&server.fingerprint, "chrome"),
                "show": false,
                "publicKey": server.pbk.clone().unwrap_or_default(),
                "shortId": server.sid.clone().unwrap_or_default(),
                "spiderX": or_default(&server.spider_x, "/")
            });
        }
        "xtls" => {
            let alpn: Value = if server.alpn.as_ref().map(|a| !a.is_empty()).unwrap_or(false) {
                json!(server.alpn)
            } else {
                json!(["h2", "http/1.1"])
            };
            stream["xtlsSettings"] = json!({
                "serverName": server_name,
                "alpn": alpn,
                "allowInsecure": allow_insecure,
                "fingerprint": or_default(&server.fingerprint, "chrome")
            });
        }
        _ => {}
    }

    match network.as_str() {
        "tcp" => {
            stream["tcpSettings"] = json!({
                "acceptProxyProtocol": false,
                "header": { "type": or_default(&server.header_type, "none") }
            });
        }
        "ws" => {
            let mut ws = json!({
                "acceptProxyProtocol": false,
                "path": or_default(&server.path, "/")
            });
            if has(&server.host) {
                ws["headers"] = json!({ "Host": server.host.clone().unwrap() });
            }
            stream["wsSettings"] = ws;
        }
        "grpc" => {
            let authority = if has(&server.sni) {
                server.sni.clone().unwrap()
            } else {
                or_default(&server.host, "")
            };
            stream["grpcSettings"] = json!({
                "authority": authority,
                "serviceName": server.service_name.clone().unwrap_or_default(),
                "multiMode": server.grpc_multi_mode.unwrap_or(false),
                "idleTimeout": 60,
                "healthCheckTimeout": 20,
                "permitWithoutStream": false,
                "initialWindowSize": 65536
            });
        }
        "h2" => {
            let host: Value = if has(&server.host) {
                json!([server.host.clone().unwrap()])
            } else {
                json!([])
            };
            stream["httpSettings"] = json!({
                "path": or_default(&server.path, "/"),
                "host": host,
                "method": "PUT",
                "headers": {}
            });
        }
        "quic" => {
            stream["quicSettings"] = json!({
                "security": or_default(&server.quic_security, "none"),
                "key": server.quic_key.clone().unwrap_or_default(),
                "header": { "type": or_default(&server.header_type, "none") }
            });
        }
        "kcp" => {
            let mut kcp = json!({
                "mtu": 1350,
                "tti": 20,
                "uplinkCapacity": 5,
                "downlinkCapacity": 20,
                "congestion": false,
                "readBufferSize": 1,
                "writeBufferSize": 1,
                "header": { "type": or_default(&server.header_type, "none") }
            });
            if has(&server.path) {
                kcp["seed"] = json!(server.path.clone().unwrap());
            }
            stream["kcpSettings"] = kcp;
        }
        "splithttp" => {
            let host = if has(&server.host) {
                server.host.clone().unwrap()
            } else {
                or_default(&server.sni, "")
            };
            stream["splithttpSettings"] = json!({
                "path": or_default(&server.path, "/"),
                "host": host
            });
        }
        "xhttp" => {
            let host = if has(&server.host) {
                server.host.clone().unwrap()
            } else {
                or_default(&server.sni, "")
            };
            stream["xhttpSettings"] = json!({
                "host": host,
                "path": or_default(&server.path, "/"),
                "mode": or_default(&server.xhttp_mode, "auto"),
                "keepAlivePeriod": 40
            });
        }
        _ => {
            stream["tcpSettings"] = json!({ "header": { "type": "none" } });
        }
    }

    stream
}

fn build_routing(mode: &str, block_ads: bool) -> Value {
    let mut rules: Vec<Value> = Vec::new();
    if block_ads {
        rules.push(json!({
            "type": "field",
            "outboundTag": "naxlo-block",
            "domain": ["geosite:category-ads-all"]
        }));
    }
    rules.push(json!({
        "type": "field",
        "outboundTag": "naxlo-direct",
        "ip": ["geoip:private"],
        "domain": ["geosite:private", "localhost"]
    }));
    if mode == "iran-direct" {
        rules.push(json!({
            "type": "field",
            "outboundTag": "naxlo-direct",
            "domain": ["geosite:ir", "regexp:.*\\.ir$"],
            "ip": ["geoip:ir"]
        }));
    }
    rules.push(json!({
        "type": "field",
        "outboundTag": "naxlo-proxy",
        "network": "tcp,udp"
    }));
    json!({
        "domainStrategy": "AsIs",
        "domainMatcher": "mph",
        "rules": rules
    })
}

/// Sanity checks before handing a config to Xray (port of `validateConfig`).
pub fn validate_config(server: &ServerConfig) -> Result<(), LString> {
    if !server.supported {
        let reason = server.unsupported_reason.clone();
        return Err(l(
            &reason.clone().unwrap_or_else(|| "این کانفیگ پشتیبانی نمی‌شود".into()),
            &reason.unwrap_or_else(|| "This config is not supported".into()),
        ));
    }
    if server.address.is_empty() {
        return Err(l("آدرس سرور خالی است", "Server address is empty"));
    }
    if server.port == 0 {
        return Err(l("پورت سرور معتبر نیست", "Server port is invalid"));
    }
    if server.credential.is_empty() {
        return Err(l("کلید/رمز کانفیگ خالی است", "Config credential is empty"));
    }
    if server.security == "reality" && !has(&server.pbk) {
        return Err(l("کلید عمومی REALITY موجود نیست", "REALITY public key is missing"));
    }
    if server.network == "grpc" && !has(&server.service_name) {
        return Err(l("serviceName برای gRPC موجود نیست", "serviceName is missing for gRPC"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> ServerConfig {
        ServerConfig {
            id: "abc".into(),
            name: "s".into(),
            protocol: "vless".into(),
            supported: true,
            address: "example.com".into(),
            port: 443,
            credential: "uuid".into(),
            security: "tls".into(),
            network: "ws".into(),
            sni: Some("example.com".into()),
            path: Some("/ws".into()),
            host: Some("example.com".into()),
            ..ServerConfig::default()
        }
    }

    #[test]
    fn builds_a_complete_config() {
        let cfg = build_xray_config(&sample(), &Settings::default());
        assert_eq!(cfg["inbounds"].as_array().unwrap().len(), 2);
        assert_eq!(cfg["inbounds"][0]["port"], json!(10808));
        assert_eq!(cfg["inbounds"][1]["port"], json!(10809));
        let outbound = &cfg["outbounds"][0];
        assert_eq!(outbound["protocol"], json!("vless"));
        assert_eq!(outbound["streamSettings"]["network"], json!("ws"));
        assert_eq!(outbound["streamSettings"]["wsSettings"]["headers"]["Host"], json!("example.com"));
        assert_eq!(outbound["streamSettings"]["tlsSettings"]["serverName"], json!("example.com"));
        assert_eq!(outbound["mux"]["enabled"], json!(false));
        let rules = cfg["routing"]["rules"].as_array().unwrap();
        assert_eq!(rules.last().unwrap()["outboundTag"], json!("naxlo-proxy"));
    }

    #[test]
    fn iran_direct_adds_local_rules() {
        let mut settings = Settings::default();
        settings.route_mode = "iran-direct".into();
        settings.block_ads = true;
        let cfg = build_xray_config(&sample(), &settings);
        let rules = cfg["routing"]["rules"].as_array().unwrap();
        assert_eq!(rules.len(), 4);
        assert_eq!(rules[0]["outboundTag"], json!("naxlo-block"));
        assert_eq!(rules[2]["outboundTag"], json!("naxlo-direct"));
    }
}
