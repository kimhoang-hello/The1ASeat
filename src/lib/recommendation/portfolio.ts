/**
 * §7 Portfolio Analyzer — người này ĐANG CÓ GÌ.
 *
 * Tầng đầu tiên của engine, và tầng có luật cứng nhất: **không đếm trùng điểm
 * chuyển được**. 100K Membership Rewards® không đồng thời là 100K Aeroplan® +
 * 100K Avios® + 100K Flying Blue®. Cách file này giữ luật đó không phải bằng
 * một phép kiểm ở cuối, mà bằng HÌNH DẠNG KIỂU: `accessible` không phải một
 * bản đồ tổng cộng lại được, mà là một hàm nhận MỘT chương trình đích và trả
 * về kèm danh sách nguồn đã góp vào. Muốn cộng hai đích lại thì phải cố ý bỏ
 * qua `sources`, và lúc đó không ai gọi đó là nhầm lẫn được nữa.
 *
 * Ba khái niệm KHÔNG được gộp:
 *
 *   direct      — số dư nằm sẵn trong chính chương trình đó.
 *   accessible  — direct + phần chuyển tới được, cho MỘT đích tại một lúc.
 *   concentration — giá trị danh mục nghiêng về hệ sinh thái nào.
 *
 * Và `concentration` KHÔNG dùng `accessible`: một pool linh hoạt được chia
 * PHÂN SỐ cho các hệ sinh thái nó với tới (1/N mỗi nơi), nên tổng mọi tỷ trọng
 * luôn bằng 1. Chia nguyên vẹn cho từng nơi là đúng lỗi §7 cấm, chỉ đội lốt
 * một phép đo khác.
 */

import { activeAt, oneActiveAt } from "./temporal.ts";
import { asArray, everHeldProductIds, heldProductIds, holdsNow } from "./user.ts";
import type { DatasetIndex } from "./indexes.ts";
import type { PointsProgram, PointsProgramId, Product, ProductId } from "./types.ts";
import type { UserState } from "./user-types.ts";
import type { AccessibleBalance, BalanceKnowledge, PortfolioAnalysis } from "./engine-types.ts";

/**
 * Chặng chuyển đòi hạng thành viên KHÔNG được tính vào điểm tiếp cận được.
 *
 * `TransferPath.requiresTier` là "Avion® Elite" trên ba chặng RBC®, và mô hình
 * người dùng KHÔNG có chỗ nào khai hạng thành viên — cố ý, vì §31 không hỏi.
 * Hai hướng xử lý, và chúng không cân nhau: tính vào thì engine hứa một lượng
 * điểm mà phần lớn người đọc không với tới được, rồi để `NO_NEW_CARD` thắng
 * nhờ lời hứa đó; bỏ ra thì engine ước lượng THIẾU và cùng lắm là khuyên thừa
 * một thẻ. Bỏ ra.
 */
function isOpenToEveryone(requiresTier: string | null): boolean {
  return requiresTier === null;
}

/**
 * Đồng tiền này có LINH HOẠT THẬT không — chuyển được, và có ít nhất một chặng
 * ai cũng đi được.
 *
 * KHÔNG đọc `PointsProgram.transferable` một mình, và đây là một lỗi đã bắt
 * được trên dữ liệu thật: Marriott Bonvoy® khai `transferable: true` với ĐÚNG
 * KHÔNG chặng nào trong `transfer-paths.ts` — bộ dữ liệu nói thẳng chuyện đó
 * bằng `DataGap` `transfer_paths_unmodelled`. Đọc cái cờ thì Bonvoy® được chấm
 * linh hoạt tối đa, và trong lượt chạy đầu tiên nó đứng đầu bảng cho một người
 * muốn BAY — bằng một đồng tiền engine không biết bay đi đâu.
 *
 * Luật rút ra rộng hơn Bonvoy®: một khả năng chỉ có giá trị khi engine tra
 * được nó. Chặng chuyển chưa dựng thì đó là chỗ trống, và chỗ trống phải kéo
 * điểm XUỐNG, không được nâng lên.
 */
export function isFlexibleInPractice(
  ix: DatasetIndex,
  programId: PointsProgramId,
  asOf: string,
): boolean {
  const program = ix.programById.get(programId);
  if (program === undefined || !program.transferable) return false;
  return activeAt(ix.pathsBySource.get(programId) ?? [], asOf).some((path) =>
    isOpenToEveryone(path.requiresTier),
  );
}

/** Định giá đang hiệu lực của một chương trình, `null` khi chưa có dòng nào. */
export function centsPerPoint(
  ix: DatasetIndex,
  programId: PointsProgramId,
  asOf: string,
): number | null {
  const rows = ix.valuationsByProgram.get(programId) ?? [];
  const row = oneActiveAt(rows, asOf);
  return row?.centsPerPoint ?? null;
}

/**
 * Số dư dùng được của MỘT dòng — hoặc `null` khi dòng đó không đáng tin.
 *
 * Số âm và số không hữu hạn bị coi là CHƯA BIẾT, không phải là giá trị. Không
 * có phép kiểm này thì một dòng `-50,000` (validator đã cấm, nhưng engine
 * không gọi validator) đi thẳng vào mẫu số của phép đo tập trung và đẩy
 * `flexibilityScore` lên 2.12 — một tỷ trọng lớn hơn 1, rồi lan sang
 * `needs.portfolio.flexibility` và mọi chiến lược đọc nó.
 */
function usableBalance(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * Số dư của một chương trình — ba trạng thái, xem `BalanceKnowledge`.
 *
 * GOM MỌI DÒNG của cùng một chương trình. Dữ liệu người dùng đến từ database,
 * và không gì trong `UserDataSource` hứa mỗi chương trình chỉ có một dòng.
 * Hai dòng 100,000 Membership Rewards® mà cộng lại thành 200,000 là ĐÚNG phép
 * đếm trùng §7 sinh ra để cấm — chỉ đến từ một hướng không ai canh.
 *
 * Hai dòng nói HAI SỐ KHÁC NHAU là dữ liệu tự mâu thuẫn: trả về `unknown`
 * chứ không chọn bừa một số. Chọn bừa là biến một mâu thuẫn thành một con số
 * trông chắc chắn.
 */
export function balanceKnowledge(state: UserState, programId: PointsProgramId): BalanceKnowledge {
  const rows = asArray(state.balances).filter((entry) => entry?.programId === programId);
  if (rows.length === 0) return { kind: "absent" };
  const values = [...new Set(rows.map((row) => usableBalance(row.balance)))];
  if (values.length === 1 && values[0] !== null) return { kind: "known", points: values[0] };
  const known = values.filter((value): value is number => value !== null);
  // Mọi dòng đọc được đều nói cùng một số → dùng nó. Lệch nhau, hoặc có dòng
  // không đọc được → chưa biết.
  if (known.length === 1 && values.length === 1) return { kind: "known", points: known[0] };
  return { kind: "unknown" };
}

/**
 * Điểm với tới được MỘT chương trình đích.
 *
 * Gọi nó nhiều lần cho nhiều đích là hợp lệ; CỘNG kết quả lại thì không. Đó
 * chính là chỗ §7 cấm, và `sources` có mặt để phép cộng sai đó nhìn thấy được:
 * hai kết quả cùng liệt kê `amex-mr` là hai kết quả đang tranh nhau cùng một
 * đồng điểm.
 */
export function accessibleFor(
  state: UserState,
  ix: DatasetIndex,
  programId: PointsProgramId,
  asOf: string,
): AccessibleBalance {
  const own = balanceKnowledge(state, programId);
  const direct = own.kind === "known" ? own.points : 0;
  let hasUnknownSource = own.kind === "unknown";

  let viaTransfer = 0;
  const sources: PointsProgramId[] = [];

  // Duyệt trên tập chương trình ĐÃ GOM, không trên các dòng thô: hai dòng cùng
  // một chương trình sẽ góp hai lần vào `viaTransfer`, và đó là phép đếm trùng
  // §7 cấm, đến từ phía dữ liệu thay vì phía chặng chuyển.
  const sourcePrograms = [
    ...new Set(
      asArray(state.balances)
        .map((row) => row?.programId)
        .filter((value): value is PointsProgramId => value != null),
    ),
  ].sort();

  for (const sourceProgramId of sourcePrograms) {
    if (sourceProgramId === programId) continue;
    const source = ix.programById.get(sourceProgramId);
    // Chỉ chương trình `transferable` mới sinh ra điểm tiếp cận được — luật
    // này đã được validator của Phase 1 cưỡng chế ở phía dữ liệu, nhưng phép
    // kiểm ở đây rẻ và nó là luật của §7, không phải của một file seed.
    if (source === undefined || !source.transferable) continue;

    const paths = activeAt(ix.pathsBySource.get(sourceProgramId) ?? [], asOf).filter(
      (path) => path.destinationProgramId === programId && isOpenToEveryone(path.requiresTier),
    );
    if (paths.length === 0) continue;

    // Nhiều chặng cùng cặp nguồn–đích thì lấy tỷ lệ TỐT NHẤT: người dùng chọn
    // được, và chọn cái tệ hơn là ước lượng thiếu không có lý do.
    const bestRatio = Math.max(...paths.map((path) => path.ratioTo / path.ratioFrom));
    sources.push(sourceProgramId);
    const held = balanceKnowledge(state, sourceProgramId);
    if (held.kind === "known") viaTransfer += Math.floor(held.points * bestRatio);
    else hasUnknownSource = true;
  }

  sources.sort();
  return {
    programId,
    direct,
    viaTransfer,
    total: direct + viaTransfer,
    sources,
    hasUnknownSource,
  };
}

/**
 * Hệ sinh thái mà một đồng điểm của chương trình này rốt cuộc thuộc về.
 *
 * Chương trình KHÔNG chuyển được thì thuộc về chính nó. Chương trình chuyển
 * được thì giá trị của nó được chia ĐỀU cho các hệ sinh thái nó với tới —
 * `1/N` mỗi nơi, không phải nguyên vẹn mỗi nơi.
 *
 * Vì sao chia đều chứ không đánh trọng số: engine không biết người dùng sẽ
 * chuyển đi đâu, và mọi phép đoán ở đây (theo định giá, theo mục tiêu) đều
 * đang trả lời một câu hỏi khác — "nên chuyển đi đâu" — bằng một phép đo lẽ ra
 * chỉ mô tả hiện trạng. Chia đều là cách duy nhất giữ tổng bằng 1 mà không
 * lén đưa một khuyến nghị vào phép đo.
 *
 * GIỚI HẠN ĐÃ BIẾT: hệ sinh thái ở đây là CHƯƠNG TRÌNH, không phải liên minh.
 * Aeroplan® và United® MileagePlus® cùng Star Alliance™ nhưng được đếm thành
 * hai. Phase 1 không có cột liên minh, và bịa ra một bảng liên minh trong
 * engine là đúng thứ ranh giới dữ liệu/logic của repo này từ chối. Hệ quả là
 * tập trung bị ĐO THIẾU chứ không đo thừa — tức engine khuyên đa dạng hoá ít
 * hơn mức đáng, chứ không ép người dùng đa dạng hoá vô cớ.
 */
function ecosystemShares(
  program: PointsProgram,
  ix: DatasetIndex,
  asOf: string,
): Map<string, number> {
  if (!program.transferable) return new Map([[program.id as string, 1]]);

  const destinations = new Set(
    activeAt(ix.pathsBySource.get(program.id) ?? [], asOf)
      .filter((path) => isOpenToEveryone(path.requiresTier))
      .map((path) => path.destinationProgramId as string),
  );
  // Chuyển được mà chưa dựng chặng nào (Bonvoy® hôm nay) thì nó tự là một hệ
  // sinh thái. Trả về map rỗng ở đây sẽ làm giá trị của nó BIẾN MẤT khỏi mẫu
  // số, và mọi tỷ trọng khác phình lên.
  if (destinations.size === 0) return new Map([[program.id as string, 1]]);

  const share = 1 / destinations.size;
  return new Map([...destinations].map((destination) => [destination, share]));
}

/**
 * Toàn bộ bức tranh danh mục.
 *
 * `asOf` bắt buộc: định giá điểm CÓ PHIÊN BẢN (Phase 1), và một phép đo tập
 * trung tính bằng định giá hôm nay cho một lượt chạy tháng trước là một câu
 * trả lời không dựng lại được.
 */
export function analyzePortfolio(
  state: UserState,
  ix: DatasetIndex,
  asOf: string,
): PortfolioAnalysis {
  const direct = new Map<PointsProgramId, BalanceKnowledge>();
  let knownValueCents = 0;
  let hasUnknownBalance = false;
  let flexibleValueCents = 0;
  const byEcosystem = new Map<string, number>();

  // Sắp theo `programId` trước khi duyệt: các dòng tới từ một truy vấn
  // database, và truy vấn không hứa thứ tự nào. Cùng lý do `userGaps` phải
  // sắp — hai trạng thái giống hệt nhau không được cho hai kết quả khác nhau.
  // Tập chương trình đã GOM, sắp cố định. Duyệt các dòng thô ở đây sẽ cộng hai
  // lần giá trị của một chương trình có hai dòng — và tệ hơn `direct` (một
  // `Map`) chỉ giữ dòng cuối, nên bản đồ số dư và tổng giá trị nói hai chuyện
  // khác nhau về cùng một danh mục.
  const programIds = [
    ...new Set(
      asArray(state.balances)
        .map((row) => row?.programId)
        .filter((value): value is PointsProgramId => value != null),
    ),
  ].sort();

  for (const programId of programIds) {
    const known = balanceKnowledge(state, programId);
    if (known.kind !== "known") {
      direct.set(programId, { kind: "unknown" });
      hasUnknownBalance = true;
      continue;
    }
    direct.set(programId, known);

    const program = ix.programById.get(programId);
    const cpp = centsPerPoint(ix, programId, asOf);
    // Chương trình lạ hoặc chưa có định giá: đếm là CÓ số dư (dòng `direct` ở
    // trên) nhưng không đưa vào phép đo tập trung. Gán một định giá mặc định ở
    // đây là bịa ra một con số rồi lấy chính nó kết luận danh mục nghiêng đi
    // đâu — xem `typicalAmount` của khoảng mở, cùng một cái bẫy.
    if (program === undefined || cpp === null) continue;

    const valueCents = known.points * cpp;
    knownValueCents += valueCents;
    if (isFlexibleInPractice(ix, programId, asOf)) flexibleValueCents += valueCents;

    for (const [ecosystem, share] of ecosystemShares(program, ix, asOf)) {
      byEcosystem.set(ecosystem, (byEcosystem.get(ecosystem) ?? 0) + valueCents * share);
    }
  }

  const concentration = [...byEcosystem]
    .map(([ecosystem, valueCents]) => ({
      ecosystem,
      valueCents,
      share: knownValueCents > 0 ? valueCents / knownValueCents : 0,
    }))
    // Giảm dần theo tỷ trọng, hoà thì theo tên: hai hệ sinh thái bằng nhau
    // đúng đến từng cent là chuyện có thật khi số dư tròn, và thứ tự Map là
    // thứ tự chèn, tức thứ tự database.
    .sort((a, b) => (b.share !== a.share ? b.share - a.share : a.ecosystem < b.ecosystem ? -1 : 1));

  const held = [...heldProductIds(state)]
    .map((productId) => ix.productById.get(productId))
    .filter((product): product is Product => product !== undefined)
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  const earnedPrograms = new Set<PointsProgramId>();
  for (const product of held) {
    if (product.pointsProgramId !== null) earnedPrograms.add(product.pointsProgramId);
  }

  return {
    direct,
    knownValueCents,
    hasUnknownBalance,
    balancesUndeclared: state.declared?.balances !== true,
    cardsUndeclared: state.declared?.cards !== true,
    concentration,
    // Kẹp về [0,1]: nó là một TỶ TRỌNG, và mọi tầng sau đọc nó như vậy.
    flexibilityScore:
      knownValueCents > 0 ? Math.min(1, Math.max(0, flexibleValueCents / knownValueCents)) : 0,
    earnedPrograms,
    heldProducts: held,
  };
}

/** Tỷ trọng của hệ sinh thái lớn nhất, `null` khi chưa biết số dư nào. */
export function topEcosystemShare(portfolio: PortfolioAnalysis): number | null {
  if (portfolio.concentration.length === 0) return null;
  return portfolio.concentration[0].share;
}

/** Sản phẩm người dùng TỪNG giữ, kể cả đã đóng — `closed` và `previously_held`
 *  cùng nghĩa. Dùng cho luật welcome offer, không dùng để loại ứng viên. */
export function pastProductIds(state: UserState): Set<ProductId> {
  return everHeldProductIds(state);
}

/** Sản phẩm đang giữ — §16 Rule 5 loại chúng khỏi danh sách thẻ mới. */
export function currentProductIds(state: UserState): Set<ProductId> {
  const ids = new Set<ProductId>();
  for (const card of asArray(state.cards)) {
    if (card?.productId != null && holdsNow(card)) ids.add(card.productId);
  }
  return ids;
}
