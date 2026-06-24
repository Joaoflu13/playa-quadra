import { marked } from "marked";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { basename, join } from "path";

const SRC = "docs/comercial";
const OUT = "/tmp/md2pdf_html";
mkdirSync(OUT, { recursive: true });

const css = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Liberation Sans', Arial, sans-serif; font-size: 11pt; color: #15202b; line-height: 1.45; }
  h1 { font-size: 19pt; color: #14241b; border-bottom: 2px solid #2e7d5b; padding-bottom: 6px; }
  h2 { font-size: 14pt; color: #1f5135; margin-top: 18px; }
  h3 { font-size: 12pt; color: #14241b; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; }
  th, td { border: 1px solid #cdd6df; padding: 6px 9px; text-align: left; font-size: 10.5pt; vertical-align: top; }
  th { background: #eef4f0; }
  code { background: #f1f4f7; padding: 1px 4px; border-radius: 3px; font-size: 10pt; }
  pre { background: #f1f4f7; padding: 10px; border-radius: 6px; white-space: pre-wrap; font-size: 9.5pt; }
  blockquote { border-left: 3px solid #2e7d5b; margin: 10px 0; padding: 2px 12px; color: #3a4a57; background: #f6faf8; }
  a { color: #1f5135; }
  strong { color: #14241b; }
  hr { border: none; border-top: 1px solid #d8e0e8; margin: 16px 0; }
`;

for (const f of readdirSync(SRC).filter((n) => n.endsWith(".md"))) {
  const md = readFileSync(join(SRC, f), "utf8");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <style>${css}</style></head><body>${marked.parse(md)}</body></html>`;
  writeFileSync(join(OUT, basename(f, ".md") + ".html"), html);
}
console.log("HTML gerado em", OUT);
