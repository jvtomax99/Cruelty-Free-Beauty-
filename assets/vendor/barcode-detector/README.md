# Barcode reader (vendored)

Used by `scan.js` only on phones without a built-in barcode reader (iPhone Safari).

- `barcode-detector.js`: `barcode-detector` 3.2.3, `dist/iife/ponyfill.js`, from npm. MIT (`LICENSE-barcode-detector`).
- `zxing_reader.wasm`: `zxing-wasm` 3.1.6, `dist/reader/zxing_reader.wasm`, from npm. SHA-256
  `5003fb4b88c4fbd1fd518a2fd8c8ad365c519e183a08c03a322dddfea3cea84e`, the hash `barcode-detector` 3.2.3 expects.
  zxing-wasm is MIT (`LICENSE-zxing-wasm`); the reader inside it is zxing-cpp, Apache 2.0 (`LICENSE-zxing-cpp`).

To update: `npm pack barcode-detector zxing-wasm`, copy the same two files, keep the versions matched
(barcode-detector's `ZXING_WASM_VERSION` must equal the zxing-wasm version), bump `CACHE_VERSION` in `sw.js`.
