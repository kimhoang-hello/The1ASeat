import { CONFIG } from "./config.js";

const KEY = "ghe1a.catch-the-points.v2";
export const safeScore = value => typeof value === "number" && Number.isFinite(value)
  ? Math.max(0, Math.min(CONFIG.maxScore, Math.round(value))) : 0;

// Storage access (including the localStorage getter) can throw in private/restricted contexts.
export function createProfile(getStorage = () => window.localStorage) {
  let state = { best: 0, achievements: [] };
  try {
    const saved = JSON.parse(getStorage().getItem(KEY));
    if (saved && typeof saved === "object") state = {
      best: safeScore(saved.best),
      achievements: Array.isArray(saved.achievements) ? saved.achievements.filter(id => typeof id === "string").slice(0, 20) : [],
    };
  } catch { /* In-memory records still work. */ }
  return {
    get best() { return state.best; },
    get achievements() { return [...state.achievements]; },
    record(score, achievements = []) {
      const next = safeScore(score);
      const newBest = next > state.best;
      const unlocked = achievements.filter(id => !state.achievements.includes(id));
      state = { best: Math.max(state.best, next), achievements: [...new Set([...state.achievements, ...achievements])] };
      try { getStorage().setItem(KEY, JSON.stringify(state)); } catch { /* Never block a result. */ }
      return { newBest, unlocked };
    },
  };
}
