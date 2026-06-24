import sharp from "sharp";
import { writeFileSync } from "fs";

// Ícone: prédio branco com janelas/porta vazadas, sobre fundo verde da marca.
// Desenho centralizado dentro da zona segura (~80%) para ficar bom como maskable.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2e7d5b"/>
  <rect x="146" y="116" width="220" height="296" rx="8" fill="#ffffff"/>
  <g fill="#2e7d5b">
    <rect x="168" y="146" width="40" height="46" rx="3"/>
    <rect x="236" y="146" width="40" height="46" rx="3"/>
    <rect x="304" y="146" width="40" height="46" rx="3"/>
    <rect x="168" y="208" width="40" height="46" rx="3"/>
    <rect x="236" y="208" width="40" height="46" rx="3"/>
    <rect x="304" y="208" width="40" height="46" rx="3"/>
    <rect x="168" y="270" width="40" height="46" rx="3"/>
    <rect x="304" y="270" width="40" height="46" rx="3"/>
    <rect x="232" y="330" width="48" height="82" rx="4"/>
  </g>
</svg>`;

const buf = Buffer.from(svg);
await sharp(buf).resize(180, 180).png().toFile("public/apple-icon.png");
await sharp(buf).resize(512, 512).png().toFile("public/icon-512.png");
await sharp(buf).resize(192, 192).png().toFile("public/icon-192.png");
writeFileSync("public/icon.svg", svg);
console.log("Ícones gerados: apple-icon.png (180), icon-192.png, icon-512.png, icon.svg");
