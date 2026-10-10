import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07110F",
        }}
      >
        <svg width="128" height="128" viewBox="0 0 32 32">
          <path d="M16 3.6 27 8v8.6c0 6.6-4.4 11-11 13.2C9.4 27.6 5 23.2 5 16.6V8L16 3.6z" fill="#2DD4BF" />
          <circle cx="16" cy="15.4" r="3.7" fill="#F6C453" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
