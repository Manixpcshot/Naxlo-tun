//! Parsers for subscription metadata headers — port of `src/main/lib/submeta.ts`.

use crate::models::SubUserinfo;
use crate::parse::b64_decode_lenient;

/// Parse the standard `subscription-userinfo` header:
/// `upload=123; download=456; total=7890; expire=1735689600`
pub fn parse_subscription_userinfo(header: Option<&str>) -> Option<SubUserinfo> {
    let header = header?;
    let mut out: Vec<(String, f64)> = Vec::new();
    for part in header.split(|c| c == ';' || c == ',') {
        let pieces: Vec<&str> = part.split('=').collect();
        let key = pieces.first().map(|k| k.trim()).unwrap_or("");
        let value = pieces.get(1).map(|v| v.trim()).unwrap_or("");
        if key.is_empty() || value.is_empty() {
            continue;
        }
        if let Ok(num) = value.parse::<f64>() {
            if num.is_finite() {
                out.push((key.to_ascii_lowercase(), num));
            }
        }
    }
    let get = |k: &str| out.iter().find(|(key, _)| key == k).map(|(_, v)| *v);
    if get("upload").is_none() && get("download").is_none() && get("total").is_none() {
        return None;
    }
    let expire = match get("expire") {
        Some(v) if v != 0.0 => Some(v.round() as i64),
        _ => None,
    };
    Some(SubUserinfo {
        upload: get("upload").unwrap_or(0.0).max(0.0) as u64,
        download: get("download").unwrap_or(0.0).max(0.0) as u64,
        total: get("total").unwrap_or(0.0).max(0.0) as u64,
        expire,
    })
}

/// Parse the `profile-title` header (plain, `text:` or `base64:` payloads).
pub fn parse_profile_title(header: Option<&str>) -> Option<String> {
    let mut value = header?.trim().to_string();
    if value.is_empty() {
        return None;
    }
    let lower = value.to_ascii_lowercase();
    if lower.starts_with("base64:") {
        if let Some(bytes) = b64_decode_lenient(&value[7..]) {
            let decoded = String::from_utf8_lossy(&bytes).trim().to_string();
            if !decoded.is_empty() {
                value = decoded;
            }
        }
    } else if lower.starts_with("text:") {
        value = value[5..].to_string();
    }
    if let Ok(decoded) = percent_encoding::percent_decode_str(&value).decode_utf8() {
        let decoded = decoded.into_owned();
        if !decoded.is_empty() {
            value = decoded;
        }
    }
    // Collapse newlines the same way the TS parser does.
    let mut cleaned = String::new();
    let mut prev_nl = false;
    for ch in value.chars() {
        if ch == '\r' || ch == '\n' {
            if !prev_nl {
                cleaned.push(' ');
            }
            prev_nl = true;
        } else {
            cleaned.push(ch);
            prev_nl = false;
        }
    }
    let cleaned = cleaned.trim().to_string();
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_userinfo_header() {
        let info = parse_subscription_userinfo(Some(
            "upload=1073741824; download=2147483648; total=10737418240; expire=1767225600",
        ))
        .expect("userinfo");
        assert_eq!(info.upload, 1073741824);
        assert_eq!(info.total, 10737418240);
        assert_eq!(info.expire, Some(1767225600));
        assert!(parse_subscription_userinfo(Some("foo=bar")).is_none());
    }

    #[test]
    fn parses_profile_titles() {
        assert_eq!(parse_profile_title(Some("text:My%20Panel")).as_deref(), Some("My Panel"));
        assert_eq!(parse_profile_title(Some("Plain Title")).as_deref(), Some("Plain Title"));
        let encoded = {
            use base64::Engine as _;
            base64::engine::general_purpose::STANDARD.encode("پنل测试".as_bytes())
        };
        assert_eq!(
            parse_profile_title(Some(&format!("base64:{}", encoded))).as_deref(),
            Some("پنل测试")
        );
    }
}
