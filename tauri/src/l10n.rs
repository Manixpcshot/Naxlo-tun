//! Trilingual strings (Persian / English / Turkish), mirroring
//! `src/shared/i18n.ts`.
//!
//! `l(fa, en)` looks the English text up in the generated Turkish table
//! below; interpolated messages use `lt(fa, en, tr)` with an explicit
//! Turkish variant. Missing translations fall back to English in the UI.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct LString {
    pub fa: String,
    pub en: String,
    /// Turkish variant; `None` makes the renderer fall back to English.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tr: Option<String>,
}

pub fn l(fa: &str, en: &str) -> LString {
    LString { fa: fa.to_string(), en: en.to_string(), tr: tr_map(en).map(str::to_string) }
}

/// Like `l`, with an explicit Turkish variant for interpolated messages.
pub fn lt(fa: &str, en: &str, tr: &str) -> LString {
    LString { fa: fa.to_string(), en: en.to_string(), tr: Some(tr.to_string()) }
}

impl LString {
    /// Command errors travel as a JSON-serialized LString; the UI shim parses
    /// it back into a `{ fa, en, tr? }` object (same shape the Electron bridge
    /// throws).
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| "{\"fa\":\"خطا\",\"en\":\"Error\"}".to_string())
    }
}

pub fn err_str(message: LString) -> String {
    message.to_json()
}

/* ------------------- generated Turkish table (static texts) -------------- */

fn tr_map(en: &str) -> Option<&'static str> {
    let tr = match en {
        "AES-encrypted zips are not supported; save the archive with a classic (ZipCrypto) password" => "AES ile şifrelenmiş zip dosyaları desteklenmiyor; arşivi klasik (ZipCrypto) bir parolayla kaydedin",
        "Add a subscription first" => "Önce bir abonelik ekleyin",
        "Another operation is already running" => "Başka bir işlem zaten sürüyor",
        "App window not found" => "Uygulama penceresi bulunamadı",
        "Applying the system proxy failed" => "Sistem proxy'si uygulanamadı",
        "Auto-connect skipped" => "Otomatik bağlantı atlandı",
        "Certificate/TLS error while contacting the subscription server" => "Abonelik sunucusuna bağlanırken sertifika/TLS hatası",
        "Config credential is empty" => "Yapılandırma kimlik bilgisi boş",
        "Connect first to run a speed test" => "Hız testi için önce bağlanın",
        "Connected" => "Bağlanıldı",
        "Connection dropped" => "Bağlantı koptu",
        "Connection lost — the proxy stopped responding" => "Bağlantı kaybedildi — proxy yanıt vermeyi durdurdu",
        "Connection test failed" => "Bağlantı testi başarısız",
        "Connection test timed out" => "Bağlantı testi zaman aşımına uğradı",
        "Connection to the subscription server was refused" => "Abonelik sunucusuna bağlantı reddedildi",
        "Core checksum verification failed — please download again" => "Çekirdek sağlama doğrulaması başarısız — lütfen yeniden indirin",
        "Core download failed" => "Çekirdek indirmesi başarısız",
        "Core executable not found after extraction" => "Çıkarma sonrası çekirdek yürütülebilir dosyası bulunamadı",
        "Core extraction failed" => "Çekirdek çıkarma işlemi başarısız",
        "Could not reach the subscription server" => "Abonelik sunucusuna ulaşılamadı",
        "Could not read the archive" => "Arşiv okunamadı",
        "Could not resolve the subscription host" => "Abonelik ana makine adı çözümlenemedi",
        "Disconnected" => "Bağlantı kesildi",
        "Downloading the Xray core" => "Xray çekirdeği indiriliyor",
        "Downloading the Xray core failed" => "Xray çekirdeğinin indirilmesi başarısız oldu",
        "Downloading the Xray core timed out after five minutes" => "Xray çekirdeğinin indirilmesi beş dakika sonra zaman aşımına uğradı",
        "Failed to close the window" => "Pencere kapatılamadı",
        "Failed to configure the system proxy" => "Sistem proxy yapılandırması başarısız",
        "Failed to read the system proxy state" => "Sistem proxy durumu okunamadı",
        "Failed to restore the system proxy" => "Sistem proxy ayarları geri yüklenemedi",
        "Failover failed" => "Yedek sunucuya geçiş başarısız",
        "Fetching the subscription timed out" => "Abonelik alımı zaman aşımına uğradı",
        "File not found" => "Dosya bulunamadı",
        "Invalid subscription URL (must start with http:// or https://)" => "Geçersiz abonelik bağlantısı (http:// veya https:// ile başlamalı)",
        "Latency test finished" => "Gecikme testi tamamlandı",
        "Local proxy failed to start — the inbound port is not responding" => "Yerel proxy başlatılamadı — giriş portu yanıt vermiyor",
        "No configs were found in the file" => "Dosyada yapılandırma bulunamadı",
        "No configs were found in the response" => "Yanıtta yapılandırma bulunamadı",
        "No server is selected" => "Seçili sunucu yok",
        "No server selected" => "Sunucu seçilmedi",
        "No supported server is available for auto selection" => "Otomatik seçim için desteklenen sunucu yok",
        "No valid config was found in the payload" => "Yükte geçerli yapılandırma bulunamadı",
        "No valid proxy links were found in the response" => "Yanıtta geçerli proxy bağlantısı bulunamadı",
        "Not a valid zip archive" => "Geçerli bir zip arşivi değil",
        "On first run the official Xray core is downloaded and verified." => "İlk çalıştırmada resmî Xray çekirdeği indirilir ve doğrulanır.",
        "Only http and https links are supported" => "Yalnızca http ve https bağlantıları desteklenir",
        "Opening this address is not allowed" => "Bu adresin açılmasına izin verilmiyor",
        "Operation in progress" => "İşlem sürüyor",
        "Panic disconnect completed" => "Acil bağlantı kesme tamamlandı",
        "Pick a config from the server list first." => "Önce sunucu listesinden bir yapılandırma seçin.",
        "Please wait for the current task to finish." => "Lütfen geçerli görevin bitmesini bekleyin.",
        "PowerShell execution timed out" => "PowerShell yürütmesi zaman aşımına uğradı",
        "Previous server stopped answering — auto switch" => "Önceki sunucu yanıt vermeyi durdurdu — otomatik geçiş",
        "REALITY public key is missing" => "REALITY genel anahtarı eksik",
        "Reconnecting" => "Yeniden bağlanılıyor",
        "Server address is empty" => "Sunucu adresi boş",
        "Server not found" => "Sunucu bulunamadı",
        "Server port is invalid" => "Sunucu portu geçersiz",
        "Server test finished" => "Sunucu testi tamamlandı",
        "Speed test failed — measurement servers are unreachable" => "Hız testi başarısız — ölçüm sunucularına ulaşılamıyor",
        "Subscription URL is empty" => "Abonelik bağlantısı boş",
        "Subscription fetch timed out" => "Abonelik alımı zaman aşımına uğradı",
        "Subscription host not found (DNS)" => "Abonelik ana makinesi bulunamadı (DNS)",
        "Subscription link not found (404)" => "Abonelik bağlantısı bulunamadı (404)",
        "Subscription not found" => "Abonelik bulunamadı",
        "Subscription not found (404)" => "Abonelik bulunamadı (404)",
        "Subscription server error (5xx)" => "Abonelik sunucu hatası (5xx)",
        "Subscription server rate-limited the request (429)" => "Abonelik sunucusu isteği hız sınırına takıldı (429)",
        "Switching servers…" => "Sunucu değiştiriliyor…",
        "System proxy could not be applied" => "Sistem proxy'si uygulanamadı",
        "System proxy is not supported on this platform" => "Sistem proxy'si bu platformda desteklenmiyor",
        "System proxy is only supported on Windows" => "Sistem proxy'si yalnızca Windows'ta destekleniyor",
        "TLS error while contacting the subscription server" => "Abonelik sunucusuna bağlanırken TLS hatası",
        "TUN mode needs administrator rights — allow the elevated relaunch from the Settings page" => "TUN modu yönetici hakları gerektirir — Ayarlar sayfasından yönetici olarak yeniden başlatmaya izin verin",
        "TUN mode needs administrator rights — reopen Naxlo as administrator." => "TUN modu yönetici hakları gerektirir — Naxlo'yu yönetici olarak yeniden açın.",
        "The UAC prompt was dismissed — staying in the current instance" => "UAC istemi kapatıldı — geçerli örnekte kalınıyor",
        "The Xray core archive is not a valid zip" => "Xray çekirdeği arşivi geçerli bir zip değil",
        "The Xray core digest did not match; the download was rejected" => "Xray çekirdeği özeti eşleşmedi; indirme reddedildi",
        "The Xray core exited unexpectedly" => "Xray çekirdeği beklenmedik şekilde kapandı",
        "The Xray core is ready" => "Xray çekirdeği hazır",
        "The Xray executable was not found in the archive" => "Xray yürütülebilir dosyası arşivde bulunamadı",
        "The app is not ready yet" => "Uygulama henüz hazır değil",
        "The archive was empty" => "Arşiv boştu",
        "The connection mode changed — the tunnel is being rebuilt." => "Bağlantı modu değişti — tünel yeniden kuruluyor.",
        "The dialog failed" => "İletişim kutusu başarısız oldu",
        "The link for this config is unavailable" => "Bu yapılandırmanın bağlantısı kullanılamıyor",
        "The local proxy did not start in time" => "Yerel proxy zamanında başlamadı",
        "The local proxy is running — you can point apps at the HTTP port manually." => "Yerel proxy çalışıyor — uygulamaları el ile HTTP portuna yönlendirebilirsiniz.",
        "The proxy failed repeated health checks" => "Proxy tekrarlanan sağlık kontrollerinde başarısız oldu",
        "The proxy stopped responding — switching servers" => "Proxy yanıt vermeyi durdurdu — sunucu değiştiriliyor",
        "The response was empty" => "Yanıt boştu",
        "The selected file is not a valid Xray core" => "Seçilen dosya geçerli bir Xray çekirdeği değil",
        "The server answered with JSON — the subscription link is probably wrong" => "Sunucu JSON ile yanıt verdi — abonelik bağlantısı muhtemelen yanlış",
        "The subscription response was empty" => "Abonelik yanıtı boştu",
        "The subscription server denied access (401/403)" => "Abonelik sunucusu erişimi reddetti (401/403)",
        "The zip archive is corrupted (bad CRC)" => "Zip arşivi bozuk (hatalı CRC)",
        "The zip archive is malformed" => "Zip arşivi hatalı biçimlenmiş",
        "This file is password-protected; enter its password via \"Import from file\" so it can be stored" => "Bu dosya parolayla korunuyor; saklanabilmesi için parolasını \"Dosyadan içe aktar\" ile girin",
        "This happens only once" => "Bu yalnızca bir kez olur",
        "Too many requests — try again in a moment" => "Çok fazla istek — birazdan yeniden deneyin",
        "Update check failed" => "Güncelleme denetimi başarısız",
        "Update found" => "Güncelleme bulundu",
        "Update installation failed" => "Güncelleme kurulumu başarısız",
        "Update ready to install" => "Güncelleme kurulmaya hazır",
        "Wintun driver checksum verification failed — please retry the download" => "Wintun sürücüsü sağlama doğrulaması başarısız — lütfen indirmeyi yeniden deneyin",
        "Xray core download timed out" => "Xray çekirdeği indirmesi zaman aşımına uğradı",
        "Xray core is ready" => "Xray çekirdeği hazır",
        "serviceName is missing for gRPC" => "gRPC için serviceName eksik",
        "Auto-picked: {}" => "Otomatik seçildi: {}",
        "Clipboard write failed: {}" => "Panoya kopyalanamadı: {}",
        "Connection test failed: {}" => "Bağlantı testi başarısız: {}",
        "Extraction failed: {}" => "Çıkarma işlemi başarısız: {}",
        "Failed to build a proxy: {}" => "Proxy oluşturulamadı: {}",
        "Failed to create a directory: {}" => "Dizin oluşturulamadı: {}",
        "Failed to create an HTTP client: {}" => "HTTP istemcisi oluşturulamadı: {}",
        "Failed to create the core directory: {}" => "Çekirdek dizini oluşturulamadı: {}",
        "Failed to download the Xray core: {}" => "Xray çekirdeği indirilemedi: {}",
        "Failed to minimize the window" => "Pencere simge durumuna alınamadı",
        "Failed to read the archive: {}" => "Arşiv okunamadı: {}",
        "Failed to run PowerShell: {}" => "PowerShell çalıştırılamadı: {}",
        "Failed to run gsettings: {}" => "gsettings çalıştırılamadı: {}",
        "Failed to run networksetup: {}" => "networksetup çalıştırılamadı: {}",
        "Failed to start the Xray core: {}" => "Xray çekirdeği başlatılamadı: {}",
        "Failed to write a file: {}" => "Dosya yazılamadı: {}",
        "HTTP {} while downloading the Xray core" => "Xray çekirdeği indirilirken HTTP {} hatası",
        "Port {} is already in use by another app" => "{} portu başka bir uygulama tarafından kullanılıyor",
        "Subscription access denied ({})" => "Abonelik erişimi reddedildi ({})",
        "Subscription fetch failed: {}" => "Abonelik alımı başarısız: {}",
        "Subscription server error ({})" => "Abonelik sunucu hatası ({})",
        "The Xray core exited unexpectedly (code {})" => "Xray çekirdeği beklenmedik şekilde kapandı (kod {})",
        "Unexpected subscription response ({})" => "Beklenmeyen abonelik yanıtı ({})",
        "Xray core download interrupted: {}" => "Xray çekirdeği indirmesi kesintiye uğradı: {}",
        "{} of {} servers were reachable" => "{} / {} sunucuya ulaşılabildi",
        "{} • {}ms" => "{} • {}ms",
        _ => return None,
    };
    Some(tr)
}
