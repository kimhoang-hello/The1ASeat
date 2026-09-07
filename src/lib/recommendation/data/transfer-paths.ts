import { id, type TransferPath, type TransferPathId, type PointsProgramId } from "../types.ts";

const AMEX_SOURCE = "https://global.americanexpress.com/rewards/transfer";
const RBC_SOURCE = "https://www.rbcrewards.com/";

/**
 * Chặng chuyển điểm một bước.
 *
 * Tỷ lệ và điều kiện lấy nguyên từ `lib/transfer-partners.ts` — bảng đó đã
 * được kiểm tại nguồn của chính nhà phát hành (Amex 04/08/2026, RBC đối chiếu
 * chéo vì RBC không công bố), và chép lại số ở đây thay vì tự tra lần nữa là
 * cố ý: hai chỗ tự tra độc lập là hai chỗ sẽ lệch nhau. `audit:reco-data` so
 * hai bảng và báo khi có chặng chỉ tồn tại ở một bên.
 *
 * CHỈ những chương trình engine V1 quan tâm (spec §33) có mặt ở đây. Hilton,
 * Delta và Accor có trong bảng transfer-partners nhưng không nằm trong phạm vi
 * V1, nên vắng mặt là CÓ CHỦ Ý, không phải thiếu — validator biết điều đó và
 * không báo động.
 *
 * Chưa có chặng nào rời `bonvoy` dù Bonvoy chuyển sang hãng bay được
 * (60,000 → 25,000 miles + 5,000 thưởng). Chuyển kiểu đó gần như luôn lỗ, và
 * seed nó vào đây sẽ khiến engine coi mọi số dư Bonvoy là điểm bay tiếp cận
 * được — hệt loại lỗi đếm trùng mà §7 cấm, chỉ khác là tự gây ra. Thêm khi
 * nào Phase 3 có chỗ phạt tỷ lệ chuyển xấu.
 */
export const TRANSFER_PATHS: TransferPath[] = [
  {
    id: id<TransferPathId>("amex-mr-aeroplan"),
    sourceProgramId: "amex-mr" as PointsProgramId,
    destinationProgramId: "aeroplan" as PointsProgramId,
    ratioFrom: 1000,
    ratioTo: 1000,
    conditionText: null,
    effectiveFrom: "2026-08-04",
    effectiveTo: null,
    sourceUrl: AMEX_SOURCE,
    verifiedAt: "2026-08-04",
    confidence: "verified",
  },
  {
    id: id<TransferPathId>("amex-mr-avios"),
    sourceProgramId: "amex-mr" as PointsProgramId,
    destinationProgramId: "avios" as PointsProgramId,
    ratioFrom: 1000,
    ratioTo: 1000,
    conditionText: null,
    effectiveFrom: "2026-08-04",
    effectiveTo: null,
    sourceUrl: AMEX_SOURCE,
    verifiedAt: "2026-08-04",
    confidence: "verified",
  },
  {
    id: id<TransferPathId>("amex-mr-flying-blue"),
    sourceProgramId: "amex-mr" as PointsProgramId,
    destinationProgramId: "flying-blue" as PointsProgramId,
    ratioFrom: 1000,
    ratioTo: 1000,
    conditionText: null,
    effectiveFrom: "2026-08-04",
    effectiveTo: null,
    sourceUrl: AMEX_SOURCE,
    verifiedAt: "2026-08-04",
    confidence: "verified",
  },
  {
    id: id<TransferPathId>("amex-mr-asia-miles"),
    sourceProgramId: "amex-mr" as PointsProgramId,
    destinationProgramId: "asia-miles" as PointsProgramId,
    ratioFrom: 1000,
    ratioTo: 750,
    conditionText: null,
    effectiveFrom: "2026-08-04",
    effectiveTo: null,
    sourceUrl: AMEX_SOURCE,
    verifiedAt: "2026-08-04",
    confidence: "verified",
  },
  {
    id: id<TransferPathId>("amex-mr-bonvoy"),
    sourceProgramId: "amex-mr" as PointsProgramId,
    destinationProgramId: "bonvoy" as PointsProgramId,
    ratioFrom: 1000,
    ratioTo: 1200,
    conditionText: null,
    effectiveFrom: "2026-08-04",
    effectiveTo: null,
    sourceUrl: AMEX_SOURCE,
    verifiedAt: "2026-08-04",
    confidence: "verified",
  },
  {
    id: id<TransferPathId>("avion-avios"),
    sourceProgramId: "avion" as PointsProgramId,
    destinationProgramId: "avios" as PointsProgramId,
    ratioFrom: 1000,
    ratioTo: 1000,
    conditionText: "Chỉ Avion® Elite",
    effectiveFrom: "2026-08-04",
    effectiveTo: null,
    sourceUrl: RBC_SOURCE,
    verifiedAt: "2026-08-04",
    confidence: "estimated",
  },
  {
    id: id<TransferPathId>("avion-asia-miles"),
    sourceProgramId: "avion" as PointsProgramId,
    destinationProgramId: "asia-miles" as PointsProgramId,
    ratioFrom: 1000,
    ratioTo: 1000,
    conditionText: "Chỉ Avion® Elite",
    effectiveFrom: "2026-08-04",
    effectiveTo: null,
    sourceUrl: RBC_SOURCE,
    verifiedAt: "2026-08-04",
    confidence: "estimated",
  },
  {
    id: id<TransferPathId>("avion-aadvantage"),
    sourceProgramId: "avion" as PointsProgramId,
    destinationProgramId: "aadvantage" as PointsProgramId,
    ratioFrom: 1000,
    ratioTo: 700,
    conditionText: "Chỉ Avion® Elite",
    effectiveFrom: "2026-08-04",
    effectiveTo: null,
    sourceUrl: RBC_SOURCE,
    verifiedAt: "2026-08-04",
    confidence: "estimated",
  },
  {
    id: id<TransferPathId>("avion-westjet"),
    sourceProgramId: "avion" as PointsProgramId,
    destinationProgramId: "westjet" as PointsProgramId,
    ratioFrom: 1000,
    ratioTo: 1000,
    conditionText: "Mọi hạng Avion®",
    effectiveFrom: "2026-08-04",
    effectiveTo: null,
    sourceUrl: RBC_SOURCE,
    verifiedAt: "2026-08-04",
    confidence: "estimated",
  },
];
