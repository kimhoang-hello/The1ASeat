import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { t } from "@/lib/t";

export const alt = "Ghế 1A";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const site = t("site");

export default async function Image() {
  const [heading, body, logo] = await Promise.all([
    readFile(join(process.cwd(), "assets/og-heading.woff")),
    readFile(join(process.cwd(), "assets/og-body.woff")),
    readFile(join(process.cwd(), "public/images/logo.png"), "base64"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f2a4a",
          fontFamily: "Be Vietnam Pro",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 172,
            height: 172,
            borderRadius: 40,
            background: "#faf6ec",
            marginBottom: 32,
          }}
        >
          <img
            src={`data:image/png;base64,${logo}`}
            width={120}
            height={121}
            alt=""
          />
        </div>
        <div
          style={{
            fontFamily: "Be Vietnam Pro",
            fontSize: 96,
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          {site("name")}
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 36,
            fontWeight: 600,
            color: "#c9d3de",
          }}
        >
          {site("tagline")}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        // Hai file trong `assets/` là Be Vietnam Pro cắt về ĐÚNG các ký tự của
        // tên site + tagline (kể cả khoảng trắng không ngắt dòng của "Ghế 1A").
        // Đổi chữ trên ảnh thì phải cắt lại, không thì satori vẽ ô vuông.
        { name: "Be Vietnam Pro", data: heading, style: "normal", weight: 700 },
        { name: "Be Vietnam Pro", data: body, style: "normal", weight: 600 },
      ],
    }
  );
}
