import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored third-party copies, not this repo's source. Both are gitignored
    // and reinstalled wholesale, so their lint warnings are noise nobody can
    // act on — 152 of them, which buried anything real in `npm run lint`.
    ".claude/skills/**",
    ".impeccable/**",
    // Worktree của một phiên Claude Code khác, nằm NGAY TRONG repo
    // (`.claude/worktrees/<tên>/`) và chỉ bị loại khỏi git bằng
    // `.git/info/exclude` cục bộ. Nó là một bản checkout ĐẦY ĐỦ của chính repo
    // này, nên eslint lint mọi thứ hai lần và in ra 305 warning của một cây mã
    // không ai sửa ở đây — trong khi `src/` thật sự sạch 0 warning. Cùng lý do
    // với hai dòng trên: cảnh báo không hành động được thì nó chôn mất cảnh
    // báo thật.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
