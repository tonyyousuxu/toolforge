// Runs in a CHILD PROCESS, NOT in the webpack bundle. So webpack has
// ZERO visibility into any of these require() calls. That avoids:
//   - Object.defineProperty called on non-object (pdfjs namespace wrapping)
//   - ModuleParseError (webpack trying to parse binary worker chunks)
//   - ENOENT test/data/...pdf (debug-mode guard in pdf-parse index.js)
const fs = require("fs");
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

(async () => {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    process.stderr.write("USAGE: pdf-worker.cjs <input-base64-file> <output-json-file>\n");
    process.exit(2);
  }
  const inFile = args[0];
  const outFile = args[1];
  try {
    const b64 = fs.readFileSync(inFile, "utf8").trim();
    const data = Buffer.from(b64, "base64");
    const r = await pdfParse(data);
    const out = {
      ok: true,
      numpages: r.numpages | 0,
      text: typeof r.text === "string" ? r.text : "",
      info: r.info ?? null,
    };
    fs.writeFileSync(outFile, JSON.stringify(out), "utf8");
    process.exit(0);
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    fs.writeFileSync(outFile, JSON.stringify({ ok: false, error: msg }), "utf8");
    process.exit(1);
  }
})();
