-- Enhanced Network Tracing: Comprehensive Metrics
-- Adds HTTP headers analysis, compression stats, redirect chains,
-- protocol info, transfer sizes, connection details, and performance metrics

-- Protocol & Version Info
ALTER TABLE postee_request_spans ADD COLUMN protocol_version TEXT;
ALTER TABLE postee_request_spans ADD COLUMN http_version TEXT; -- HTTP/1.1, HTTP/2, HTTP/3

-- Compression Metrics
ALTER TABLE postee_request_spans ADD COLUMN content_encoding TEXT; -- gzip, br, deflate, identity
ALTER TABLE postee_request_spans ADD COLUMN transfer_encoding TEXT; -- chunked, compress, deflate, gzip
ALTER TABLE postee_request_spans ADD COLUMN wire_size_bytes INTEGER; -- Actual bytes transferred (compressed)
ALTER TABLE postee_request_spans ADD COLUMN decompressed_size_bytes INTEGER; -- Body size after decompression
ALTER TABLE postee_request_spans ADD COLUMN compression_ratio REAL; -- Percentage saved: (1 - wire/decompressed) * 100
ALTER TABLE postee_request_spans ADD COLUMN header_size_bytes INTEGER; -- Estimated header overhead

-- Cache Metrics
ALTER TABLE postee_request_spans ADD COLUMN cache_control TEXT; -- Cache-Control header value
ALTER TABLE postee_request_spans ADD COLUMN cache_status TEXT; -- hit, miss, stale, revalidated, none
ALTER TABLE postee_request_spans ADD COLUMN etag TEXT; -- ETag header for validation
ALTER TABLE postee_request_spans ADD COLUMN age_seconds INTEGER; -- Age header: cache age in seconds

-- Content Metadata
ALTER TABLE postee_request_spans ADD COLUMN content_type TEXT; -- Content-Type without charset
ALTER TABLE postee_request_spans ADD COLUMN charset TEXT; -- Character encoding (utf-8, etc.)
ALTER TABLE postee_request_spans ADD COLUMN server_header TEXT; -- Server identification

-- Redirect Chain Tracking
ALTER TABLE postee_request_spans ADD COLUMN redirect_count INTEGER DEFAULT 0; -- Number of redirects followed
ALTER TABLE postee_request_spans ADD COLUMN redirect_chain TEXT; -- JSON array of redirect URLs
ALTER TABLE postee_request_spans ADD COLUMN final_url TEXT; -- Final URL after all redirects

-- Connection Metadata
ALTER TABLE postee_request_spans ADD COLUMN connection_type TEXT; -- keep-alive, close, upgrade
ALTER TABLE postee_request_spans ADD COLUMN connection_reused INTEGER DEFAULT 0; -- 0=new, 1=reused (inferred from timing)
ALTER TABLE postee_request_spans ADD COLUMN proxy_used INTEGER DEFAULT 0; -- 0=direct, 1=proxied (Via header present)
ALTER TABLE postee_request_spans ADD COLUMN proxy_via TEXT; -- Via header value (proxy chain)

-- Performance Metrics
ALTER TABLE postee_request_spans ADD COLUMN retry_count INTEGER DEFAULT 0; -- Number of retry attempts
ALTER TABLE postee_request_spans ADD COLUMN bandwidth_bps REAL; -- Throughput: bytes per second
ALTER TABLE postee_request_spans ADD COLUMN header_parse_duration_ms REAL; -- Time between TTFB and headers ready

-- TLS/SSL Certificate Info
ALTER TABLE postee_request_spans ADD COLUMN tls_version TEXT; -- TLS 1.2, TLS 1.3 (if detectable)
ALTER TABLE postee_request_spans ADD COLUMN cipher_suite TEXT; -- Cipher suite if available

-- Performance Index: Query spans by duration and size for analytics
CREATE INDEX IF NOT EXISTS postee_request_spans_perf_idx
    ON postee_request_spans(total_duration_ms, wire_size_bytes);

-- Cache Analysis Index: Find cache hits/misses by endpoint
CREATE INDEX IF NOT EXISTS postee_request_spans_cache_idx
    ON postee_request_spans(request_uid, cache_status, created_at DESC);

-- Compression Analysis Index: Track compression effectiveness
CREATE INDEX IF NOT EXISTS postee_request_spans_compression_idx
    ON postee_request_spans(content_encoding, compression_ratio);
