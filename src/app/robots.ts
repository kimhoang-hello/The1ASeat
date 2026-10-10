import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/subscriber-email";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Route handlers, not pages: nothing here renders anything a searcher
      // would want, and /api/revalidate & friends are secret-gated anyway.
      //
      // `_rsc=`: payload RSC mà `<Link>` prefetch. Googlebot render trang với
      // khung nhìn cao bằng cả trang, nên MỌI link — kể cả footer — đều "trong
      // tầm nhìn" và bị prefetch mỗi lượt render. Crawl stats 90 ngày tới
      // 06/10/2026: 948/987 mẫu "Other file type" là `?_rsc=`, khoảng 29% tổng
      // lượt crawl, trong khi HTML chỉ 15% và 69 trang còn "Discovered —
      // currently not indexed". Chặn không đổi gì ở kết quả render: nội dung
      // nằm sẵn trong HTML, payload RSC của chính trang đang render được nhúng
      // inline, prefetch hỏng thì router chỉ bỏ qua.
      disallow: ["/api/", "/*_rsc="],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
