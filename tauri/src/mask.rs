//! Masking helpers — exact ports of `src/shared/mask.ts`.

pub fn mask_middle(value: &str, head: usize, tail: usize) -> String {
    if value.is_empty() {
        return String::new();
    }
    let chars: Vec<char> = value.chars().collect();
    if chars.len() <= head + tail {
        return "•".repeat(chars.len());
    }
    let bullets = std::cmp::min(12, chars.len() - head - tail);
    let mut out: String = chars[..head].iter().collect();
    out.push_str(&"•".repeat(bullets));
    out.push_str(&chars[chars.len() - tail..].iter().collect::<String>());
    out
}

pub fn mask_url(raw_url: &str) -> String {
    if raw_url.is_empty() {
        return String::new();
    }
    match url::Url::parse(raw_url) {
        Ok(u) => {
            let host = u.host_str().unwrap_or("").to_string();
            let hc: Vec<char> = host.chars().collect();
            let masked_host = if hc.len() > 8 {
                format!(
                    "{}{}{}",
                    hc[..4].iter().collect::<String>(),
                    "•".repeat(6),
                    hc[hc.len() - 4..].iter().collect::<String>()
                )
            } else {
                "•".repeat(hc.len())
            };
            let path = u.path().to_string();
            let pc: Vec<char> = path.chars().collect();
            let masked_path = if pc.len() > 2 {
                let take_end = std::cmp::min(4, pc.len());
                format!(
                    "/{}{}",
                    pc[1..take_end].iter().collect::<String>(),
                    "•".repeat(std::cmp::min(10, pc.len() - 2))
                )
            } else {
                path.clone()
            };
            let search = if u.query().is_some() { "?•••" } else { "" };
            format!("{}//{}{}{}", u.scheme(), masked_host, masked_path, search)
        }
        Err(_) => mask_middle(raw_url, 6, 3),
    }
}

pub fn mask_address(address: &str) -> String {
    if address.is_empty() {
        return String::new();
    }
    let parts: Vec<&str> = address.split('.').collect();
    if parts.len() == 4 && parts.iter().all(|p| !p.is_empty() && p.len() <= 3 && p.bytes().all(|b| b.is_ascii_digit())) {
        return format!("{}.{}.••.••", parts[0], parts[1]);
    }
    if address.contains(':') {
        let parts: Vec<&str> = address.split(':').collect();
        return if parts.len() > 2 {
            format!("{}:{}:••••", parts[0], parts[1])
        } else {
            format!("{}:••••", parts[0])
        };
    }
    mask_middle(address, 3, 3)
}

#[allow(dead_code)]
pub fn mask_ip(ip: &str) -> String {
    if ip.is_empty() {
        return String::new();
    }
    if ip.contains(':') {
        let parts: Vec<&str> = ip.split(':').collect();
        return format!("{}:{}:••••", parts[0], parts.get(1).unwrap_or(&""));
    }
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() == 4 {
        return format!("{}.{}.••.••", parts[0], parts[1]);
    }
    mask_middle(ip, 3, 2)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_like_the_ts_helpers() {
        assert_eq!(mask_middle("abcdefghijklmnop", 4, 4), "abcd••••••••mnop");
        assert_eq!(mask_middle("short", 4, 4), "•••••");
        assert_eq!(mask_address("1.2.3.4"), "1.2.••.••");
        assert_eq!(mask_address("example.com"), "exa••••••••om");
        assert_eq!(mask_url("https://example.com/sub/abcdef").contains("•"), true);
    }
}
