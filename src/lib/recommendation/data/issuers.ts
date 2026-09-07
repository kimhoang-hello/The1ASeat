import { id, type Issuer, type IssuerId } from "../types";

/**
 * Nhà phát hành của các sản phẩm site đang có. Tên viết ĐÚNG như trên site,
 * kèm ®/™ — `audit:trademarks` học thương hiệu từ chính nội dung, nên một tên
 * viết trần ở đây về sau sẽ dạy nó sai.
 */
export const ISSUERS: Issuer[] = [
  {
    id: id<IssuerId>("amex"),
    name: "American Express®",
    country: "CA",
    officialUrl: "https://www.americanexpress.com/ca/",
  },
  {
    id: id<IssuerId>("td"),
    name: "TD®",
    country: "CA",
    officialUrl: "https://www.td.com/ca/en/personal-banking/products/credit-cards",
  },
  {
    id: id<IssuerId>("rbc"),
    name: "RBC®",
    country: "CA",
    officialUrl: "https://www.rbcroyalbank.com/credit-cards/",
  },
  {
    id: id<IssuerId>("cibc"),
    name: "CIBC®",
    country: "CA",
    officialUrl: "https://www.cibc.com/en/personal-banking/credit-cards.html",
  },
  {
    id: id<IssuerId>("scotiabank"),
    name: "Scotiabank®",
    country: "CA",
    officialUrl: "https://www.scotiabank.com/ca/en/personal/credit-cards.html",
  },
  {
    id: id<IssuerId>("bmo"),
    name: "BMO®",
    country: "CA",
    officialUrl: "https://www.bmo.com/main/personal/credit-cards/",
  },
  {
    id: id<IssuerId>("national-bank"),
    name: "National Bank®",
    country: "CA",
    officialUrl: "https://www.nbc.ca/personal/credit-cards.html",
  },
  {
    id: id<IssuerId>("wealthsimple"),
    name: "Wealthsimple®",
    country: "CA",
    officialUrl: "https://www.wealthsimple.com/en-ca/product/card",
  },
  {
    // Neo phát hành thẻ United® MileagePlus® tại Canada; United® là chủ chương
    // trình điểm, không phải nhà phát hành thẻ.
    id: id<IssuerId>("neo"),
    name: "Neo Financial™",
    country: "CA",
    officialUrl: "https://www.neofinancial.com/",
  },
];
