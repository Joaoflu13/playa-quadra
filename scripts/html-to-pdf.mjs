import { readdirSync, mkdirSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import puppeteer from "puppeteer";

const SRC = "/tmp/md2pdf_html";
const OUT = "docs/comercial/pdf";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
for (const f of readdirSync(SRC).filter((n) => n.endsWith(".html"))) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(join(SRC, f)).href, { waitUntil: "networkidle0" });
  await page.pdf({
    path: join(OUT, f.replace(/\.html$/, ".pdf")),
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.close();
  console.log("PDF:", f.replace(/\.html$/, ".pdf"));
}
await browser.close();
