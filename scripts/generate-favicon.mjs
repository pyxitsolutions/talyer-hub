import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "talyerhub-logo-ph.png");

const squarePng = await sharp(source)
  .resize(512, 512, {
    fit: "contain",
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  })
  .png()
  .toBuffer();

const ico = await pngToIco(squarePng);

writeFileSync(join(root, "public", "favicon.ico"), ico);
writeFileSync(join(root, "src", "app", "favicon.ico"), ico);
writeFileSync(join(root, "src", "app", "icon.png"), squarePng);

console.log("Favicon updated: public/favicon.ico, src/app/favicon.ico, src/app/icon.png");
