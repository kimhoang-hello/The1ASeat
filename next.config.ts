import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.ctfassets.net" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },

  async redirects() {
    return [
      // www.ghe1a.com used to serve the whole site at 200 alongside the apex
      // domain, so every page existed at two URLs and Google had to guess
      // which one to index. Send www to the apex permanently.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.ghe1a.com" }],
        destination: "https://ghe1a.com/:path*",
        permanent: true,
      },
      // /blog/chuyen-muc is only a container for the category archives below
      // it; on its own it would fall through to /blog/[slug] and 404.
      {
        source: "/blog/chuyen-muc",
        destination: "/blog",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
