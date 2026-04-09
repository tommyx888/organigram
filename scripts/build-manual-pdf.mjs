import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { execFileSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const docsDir = path.join(root, "docs");
const mdPath = path.join(docsDir, "POUZIVATELSKA_PRIRUCKA.md");

const { marked } = await import("marked");

let md = fs.readFileSync(mdPath, "utf8");
md = md.replace(/!\[([^\]]*)\]\((manual\/[^)\s]+)\)/g, (_, alt, rel) => {
  const imgPath = path.join(docsDir, rel);
  if (!fs.existsSync(imgPath)) {
    console.warn("Missing image:", rel);
    return `![${alt}](${rel})`;
  }
  const b64 = fs.readFileSync(imgPath).toString("base64");
  return `![${alt}](data:image/png;base64,${b64})`;
});

const body = marked.parse(md, { async: false });
const html = `<!DOCTYPE html>
<html lang="sk">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Používateľská príručka — Artifex Organigram</title>
<style>
  body { font-family: "Segoe UI", system-ui, sans-serif; max-width: 820px; margin: 36px auto; padding: 0 24px;
    line-height: 1.55; color: #1a1a1a; font-size: 11pt; }
  h1 { font-size: 22pt; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-top: 0; }
  h2 { font-size: 14pt; margin-top: 28px; page-break-after: avoid; }
  img { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 6px; margin: 12px 0;
    page-break-inside: avoid; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.95em; }
  hr { margin: 22px 0; border: none; border-top: 1px solid #e2e8f0; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; margin: 12px 0; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
  th { background: #f8fafc; }
  ul { padding-left: 1.2em; }
  @media print { body { margin: 0; max-width: none; } }
</style>
</head>
<body>
${body}
</body>
</html>`;

const htmlPath = path.join(docsDir, "POUZIVATELSKA_PRIRUCKA-print.html");
fs.writeFileSync(htmlPath, html, "utf8");

const pdfPath = path.join(docsDir, "POUZIVATELSKA_PRIRUCKA.pdf");
const fileUrl = pathToFileURL(htmlPath).href;

const chromeCandidates = [
  process.env.CHROME_PATH,
  path.join(process.env["ProgramFiles"] || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
  path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
  path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  path.join(process.env["ProgramFiles"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
].filter(Boolean);

let chrome = chromeCandidates.find((p) => p && fs.existsSync(p));
if (!chrome) {
  console.error("Nenašiel sa Chrome ani Edge. Nastavte CHROME_PATH.");
  process.exit(1);
}

try {
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      `--print-to-pdf=${pdfPath}`,
      "--print-to-pdf-no-header",
      fileUrl,
    ],
    { stdio: "inherit" },
  );
  fs.unlinkSync(htmlPath);
  console.log("PDF:", pdfPath);
} catch (e) {
  console.error(e);
  process.exit(1);
}
