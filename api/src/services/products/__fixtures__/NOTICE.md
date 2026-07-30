# Fixture provenance

`heic-probe-sample.heic` — real HEIC (HEVC-coded HEIF) sample used only to verify
whether the deployed Sharp/libvips build can actually decode HEIC pixel data at
startup (a static capability flag alone can report a false positive on hosts whose
libheif build lacks the HEVC decoder plugin). Not user data; never served to clients.

Source: `examples/example.heic` from the libheif project
(https://github.com/strukturag/libheif), used here as a small, freely redistributable
test asset for capability probing only.
