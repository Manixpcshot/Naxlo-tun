<?php
/**
 * Naxlo on-demand measurement generator.
 *
 * The static speedtest.bin (10 MiB) covers modest lines; for fast lines the
 * apps and the web test ask for a bigger transfer (speedtest.php?bytes=N)
 * so the measurement window stays long enough to be meaningful — without
 * shipping huge binaries in the repository or the cPanel upload.
 *
 * Streams exactly N unpredictable, incompressible bytes.
 */

set_time_limit(0);
ini_set('output_buffering', '0');
ini_set('zlib.output_compression', '0');
ignore_user_abort(false);

header('Content-Type: application/octet-stream');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

$bytes = isset($_GET['bytes']) ? (int) $_GET['bytes'] : 10485760;
$bytes = max(1024, min(250 * 1048576, $bytes));
header('Content-Length: ' . $bytes);

$chunkSize = 65536;
$chunk = random_bytes($chunkSize);
$sent = 0;
while ($sent < $bytes) {
    // Refresh the pattern every MiB so no proxy/CDN can compress the stream.
    if ($sent % 1048576 === 0) {
        $chunk = random_bytes($chunkSize);
    }
    $len = min($chunkSize, $bytes - $sent);
    echo substr($chunk, 0, $len);
    $sent += $len;
    if (connection_aborted()) {
        break;
    }
    flush();
}
