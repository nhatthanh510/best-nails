import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link preview on social apps and messengers: the logo medallion and the name on the
// kiosk's espresso and gold. Built once at build time; every page inherits it from the root.
export const alt = "Best Nails Rewards";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [logo, cormorant] = await Promise.all([
    readFile(join(process.cwd(), "public/brand/logo-mark.png")),
    readFile(join(process.cwd(), "assets/fonts/CormorantGaramond-SemiBold.ttf")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 72,
          background: "radial-gradient(circle at 30% 50%, #2e2318 0%, #16110c 70%)",
          color: "#f8f2e7",
        }}
      >
        <div
          style={{
            display: "flex",
            padding: 10,
            borderRadius: 9999,
            backgroundImage: "linear-gradient(135deg, #ecd48a 0%, #d8b45c 40%, #b98f2c 100%)",
          }}
        >
          <img src={logoSrc} width={340} height={340} alt="" style={{ borderRadius: 9999 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
          <div style={{ fontFamily: "Cormorant", fontSize: 104, lineHeight: 1, letterSpacing: 1 }}>Best Nails</div>
          <div style={{ fontFamily: "Cormorant", fontSize: 64, lineHeight: 1.1, color: "#d8b45c", marginTop: 8 }}>
            Rewards
          </div>
          <div style={{ width: 120, height: 3, background: "#c9a227", margin: "36px 0 28px" }} />
          <div style={{ fontSize: 30, color: "#cbbfa9", lineHeight: 1.4 }}>
            Check in, collect points and enjoy 10% off.
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Cormorant", data: cormorant, weight: 600, style: "normal" }] },
  );
}
