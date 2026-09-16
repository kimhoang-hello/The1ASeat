/**
 * Kết nối MySQL/MariaDB của Hostinger — chỗ lưu người dùng thật của Phase 5.
 *
 * User chốt MySQL của Hostinger ngày 15/09/2026 (xem HANDOFF): cùng nhà cung
 * cấp, chung máy với site, không thêm chi phí. Hostinger nói "MySQL" nhưng gói
 * web hosting chạy MariaDB, và phiên bản chỉ biết khi có credentials thật — nên
 * mọi câu SQL ở đây nằm trong tập con chung của MariaDB 10.6+ và MySQL 8, và
 * KHÔNG dùng hàm JSON nào (MariaDB `JSON` chỉ là LONGTEXT).
 *
 * Tách khỏi các kho vì hai kho (lượt chạy, trạng thái người dùng) dùng CHUNG
 * một pool và một lịch sử schema; mỗi kho tự mở pool thì 75 kết nối của gói
 * Business chia đôi mà không ai biết.
 *
 * KHÔNG TIN MẶC ĐỊNH CỦA SERVER, vì không kiểm được server production từ đây:
 *
 *  - `sql_mode` đặt lại mỗi kết nối. Không có STRICT thì một id dài quá cột bị
 *    CẮT im lặng, và hai id khác nhau thành một khoá — `getRun` trả về lượt
 *    chạy của người khác (đúng lỗi `safeName` của kho file sinh ra để chặn).
 *  - Cột khoá khai `ascii_bin` tường minh. Collation mặc định của MariaDB 11
 *    là `utf8mb4_uca1400_ai_ci` — không phân biệt hoa thường, không phân biệt
 *    dấu: `Run_A` và `run_a` là CÙNG một khoá chính.
 */

import { createPool, type Pool, type PoolOptions, type RowDataPacket } from "mysql2/promise";

export interface RecoDatabase {
  pool: Pool;
  /** Schema đã lên đủ migration. Gọi bao nhiêu lần cũng chỉ chạy một lần. */
  ready(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Cấu hình từ biến môi trường. `DATABASE_URL` trước; không có thì bộ `DB_*`
 * mà nút "Connect database" của Hostinger gắn cho app Node.js.
 *
 * `null` CHỈ khi không có biến database nào — người gọi quyết định đó là lỗi
 * hay là "chạy không lưu". Khai MỘT PHẦN (gõ nhầm tên `DB_NAME`, cổng không phải
 * số) là LỖI: trả `null` ở đó là lặng lẽ tắt việc lưu lượt chạy của người dùng
 * thật vì một lỗi đánh máy trong hPanel (Codex vòng 1).
 */
export function mysqlConfigFromEnv(env: Record<string, string | undefined> = process.env): string | PoolOptions | null {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const present = DB_VARS.filter((name) => env[name] !== undefined && env[name] !== "");
  if (present.length === 0) return null;
  const missing = (["DB_HOST", "DB_USER", "DB_NAME"] as const).filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Cấu hình database thiếu ${missing.join(", ")} (đã có ${present.join(", ")})`);
  }
  const port = env.DB_PORT ? Number(env.DB_PORT) : 3306;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`DB_PORT không phải cổng hợp lệ: ${JSON.stringify(env.DB_PORT)}`);
  }
  return {
    host: env.DB_HOST,
    port,
    user: env.DB_USER,
    password: env.DB_PASSWORD ?? "",
    database: env.DB_NAME,
  };
}

const DB_VARS = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"] as const;

/**
 * Tập con có ở cả MariaDB lẫn MySQL 8 (MySQL 8 từ chối `NO_AUTO_CREATE_USER`).
 * STRICT_ALL_TABLES chứ không phải STRICT_TRANS_TABLES: hai chế độ chỉ khác
 * nhau ở bảng không giao dịch, và không bảng nào của mình được phép rơi vào
 * nhánh "cắt rồi cảnh báo".
 */
const SESSION_SQL_MODE = "STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION";

export function openRecoDatabase(config: string | PoolOptions): RecoDatabase {
  const base: PoolOptions = typeof config === "string" ? { uri: config } : config;
  const pool = createPool({
    ...base,
    // Reset lúc trả kết nối về pool đưa biến phiên về mặc định của server, mà
    // sự kiện "connection" chỉ nổ cho kết nối MỚI — STRICT/UTC mất từ lần mượn
    // thứ hai (Codex vòng 2). Cấm hẳn, kể cả khi cấu hình truyền vào bật nó.
    resetOnRelease: false,
    charset: "utf8mb4",
    // Gói Business cho 75 kết nối mỗi user database, chung cho mọi tiến trình
    // của site. Năm là đủ cho lượt ghi một-câu-trả-lời-một-lượt-chạy.
    connectionLimit: base.connectionLimit ?? 5,
    // Không cột ngày nào được đọc ra để tính toán; chuỗi thì không lệch múi giờ.
    dateStrings: true,
  });
  // Lệnh này xếp hàng TRƯỚC mọi truy vấn trên kết nối mới (mysql2 chạy lệnh
  // của một kết nối theo đúng thứ tự gửi), nên không truy vấn nào chạy dưới
  // sql_mode của server. Lệnh gãy thì PHÁ kết nối: truy vấn đang xếp sau nó
  // nổ lỗi, thay vì chạy tiếp trong chế độ cắt-im-lặng.
  //
  // Nghe trên pool LÕI: sự kiện này đưa ra kết nối kiểu callback, dù kiểu của
  // pool promise khai nó là kết nối promise.
  pool.pool.on("connection", (connection) => {
    connection.query(`SET SESSION sql_mode = '${SESSION_SQL_MODE}', time_zone = '+00:00'`, (error) => {
      if (error) connection.destroy();
    });
  });

  let migrated: Promise<void> | null = null;
  return {
    pool,
    ready() {
      // Lỗi thì quên promise đi: một lần server chưa lên không được biến thành
      // "không bao giờ lưu được" cho tới lần deploy sau.
      migrated ??= migrate(pool).catch((error: unknown) => {
        migrated = null;
        throw error;
      });
      return migrated;
    },
    close: () => pool.end(),
  };
}

/* ------------------------------------------------------------------ *
 * Schema
 * ------------------------------------------------------------------ */

interface Migration {
  id: number;
  name: string;
  /**
   * DDL của MySQL/MariaDB KHÔNG nằm trong giao dịch: một migration gãy giữa
   * chừng để lại nửa schema. Nên mỗi câu phải chạy lại được (`IF NOT EXISTS`)
   * — lần chạy sau đi tiếp từ chỗ gãy thay vì nổ ở câu đầu. Lưu ý cho migration
   * về sau: `ADD COLUMN IF NOT EXISTS` chỉ MariaDB có, MySQL 8 thì không.
   *
   * Một migration đã chạy trên database THẬT thì ĐÓNG BĂNG: sửa nó tại chỗ thì
   * database đó đã ghi sổ id này và không bao giờ nhận phần sửa. Đổi schema là
   * thêm migration mới. (Migration 1 được sửa tại chỗ một lần, 15/09/2026, khi
   * chưa có database bền nào chạy nó.)
   */
  statements: string[];
}

const KEY = "CHARACTER SET ascii COLLATE ascii_bin";

/**
 * Schema nằm trong code chứ không trong file `.sql`: app tự lên schema lúc kết
 * nối đầu tiên, trên chính máy Hostinger — nơi không có shell để chạy một
 * lệnh migrate, và nơi bundler của Next không biết phải mang theo file lạ.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    id: 1,
    name: "recommendation_runs (§20), bộ dữ liệu theo dấu vân tay, trạng thái người dùng",
    statements: [
      // Bộ dữ liệu ~300 KB JSON, gzip còn ~19 KB. Nén ở app vì MariaDB không
      // nén LONGTEXT — Postgres jsonb nén được 5.1× (đo 15/09/2026), ở đây
      // không có ai làm hộ.
      `CREATE TABLE IF NOT EXISTS reco_datasets (
        fingerprint VARCHAR(64) ${KEY} NOT NULL,
        body LONGBLOB NOT NULL,
        inserted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (fingerprint)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
      // `body` là bản ghi §20 NGUYÊN VẸN (gzip của JSON). Các cột còn lại là
      // BẢN SAO để lọc và sắp, tính bằng đúng `summarize()` mà hai kho kia
      // dùng — không cột nào là nguồn sự thật.
      //
      // `created_at` là CHUỖI ISO nguyên văn của bản ghi, không phải DATETIME:
      // `listRuns` phải sắp y hệt kho bộ nhớ (so chuỗi), và đổi sang DATETIME
      // là thêm một phép chuyển múi giờ có thể lệch.
      `CREATE TABLE IF NOT EXISTS reco_runs (
        id VARCHAR(128) ${KEY} NOT NULL,
        user_id VARCHAR(128) ${KEY} NULL,
        created_at VARCHAR(40) NOT NULL,
        data_snapshot_at VARCHAR(40) NOT NULL,
        engine_version VARCHAR(32) NOT NULL,
        rule_version VARCHAR(32) NOT NULL,
        dataset_fingerprint VARCHAR(64) ${KEY} NOT NULL,
        primary_action VARCHAR(191) NULL,
        confidence VARCHAR(32) NULL,
        body LONGBLOB NOT NULL,
        inserted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY reco_runs_by_user (user_id, created_at, id),
        KEY reco_runs_by_time (created_at, id),
        -- Lượt chạy thiếu bộ dữ liệu không chạy lại được (luật 3 của RunStore).
        CONSTRAINT reco_runs_dataset FOREIGN KEY (dataset_fingerprint) REFERENCES reco_datasets (fingerprint)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
      // Chỉ bản MỚI NHẤT của mỗi người. Lịch sử không mất: mỗi lượt chạy chép
      // nguyên trạng thái nó đã đọc vào `input_snapshot`.
      //
      // `version` cho phép ghi có điều kiện — hai tab cùng trả lời câu hỏi thì
      // tab chậm hơn được báo xung đột thay vì lặng lẽ xoá câu trả lời của tab
      // kia.
      `CREATE TABLE IF NOT EXISTS reco_user_states (
        user_id VARCHAR(128) ${KEY} NOT NULL,
        version INT UNSIGNED NOT NULL,
        state MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    ],
  },
  {
    id: 2,
    name: "lời giải thích Phase 6 (§28) — câu đã hiện, theo lượt chạy",
    statements: [
      // Một dòng cho mỗi (lượt chạy, mục tiêu, payload) — payload đổi khi offer
      // trên Contentful đổi trong ngày, xem `explainPrimaryAction`. `body` là
      // bản ghi nguyên vẹn (payload gửi đi, JSON nhận về, câu đã hiện); các cột
      // còn lại là bản sao để lọc. Vài KB một dòng — không nén.
      //
      // Khoá ngoại tới `reco_runs`: một lời giải thích không có lượt chạy đứng
      // sau là một câu không tra ngược được về quyết định nó kể lại.
      `CREATE TABLE IF NOT EXISTS reco_explanations (
        run_id VARCHAR(128) ${KEY} NOT NULL,
        goal_index TINYINT UNSIGNED NOT NULL,
        payload_fingerprint VARCHAR(64) ${KEY} NOT NULL,
        status VARCHAR(16) NOT NULL,
        model VARCHAR(64) NOT NULL,
        prompt_version VARCHAR(32) NOT NULL,
        created_at VARCHAR(40) NOT NULL,
        body MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        inserted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (run_id, goal_index, payload_fingerprint),
        CONSTRAINT reco_explanations_run FOREIGN KEY (run_id) REFERENCES reco_runs (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    ],
  },
];

const LOCK = "ghe1a_reco_migrate";

async function migrate(pool: Pool): Promise<void> {
  const connection = await pool.getConnection();
  try {
    // Hai tiến trình Next khởi động cùng lúc thì một người chạy, người kia đợi
    // rồi thấy mọi thứ đã xong.
    const [lock] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?, 30) AS got", [LOCK]);
    if (Number(lock[0]?.got) !== 1) throw new Error("migrate: không lấy được khoá sau 30 giây");
    try {
      await connection.query(
        `CREATE TABLE IF NOT EXISTS reco_schema_migrations (
          id INT UNSIGNED NOT NULL,
          name VARCHAR(191) NOT NULL,
          applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
      );
      const [rows] = await connection.query<RowDataPacket[]>("SELECT id FROM reco_schema_migrations");
      const applied = new Set(rows.map((row) => Number(row.id)));
      for (const migration of MIGRATIONS) {
        if (applied.has(migration.id)) continue;
        for (const statement of migration.statements) await connection.query(statement);
        await connection.query("INSERT INTO reco_schema_migrations (id, name) VALUES (?, ?)", [
          migration.id,
          migration.name,
        ]);
      }
    } finally {
      await connection.query("SELECT RELEASE_LOCK(?)", [LOCK]);
    }
  } finally {
    connection.release();
  }
}

/* ------------------------------------------------------------------ *
 * Dùng chung cho hai kho
 * ------------------------------------------------------------------ */

/** Lỗi khoá chính trùng — một mã cho cả MariaDB lẫn MySQL. */
export function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: string; errno?: number })?.code === "ER_DUP_ENTRY";
}

const shared = globalThis as typeof globalThis & { __ghe1aRecoDb?: RecoDatabase | null };

/**
 * Một pool cho cả tiến trình. Giữ trên `globalThis` vì `next dev` nạp lại
 * module sau mỗi lần sửa file — mỗi lần một pool mới là cạn 75 kết nối trong
 * một buổi chiều. `null` = chưa cấu hình database.
 */
export function recoDatabaseFromEnv(): RecoDatabase | null {
  if (shared.__ghe1aRecoDb === undefined) {
    const config = mysqlConfigFromEnv();
    shared.__ghe1aRecoDb = config === null ? null : openRecoDatabase(config);
  }
  return shared.__ghe1aRecoDb;
}
