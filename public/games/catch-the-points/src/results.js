import { PROGRAMS, ITEMS } from "./config.js";
import { icon } from "./icons.js";

export function renderBreakdown(programStats, bonusStats) {
  const body = document.getElementById("program-breakdown");
  body.replaceChildren();
  const entries = [
    ...PROGRAMS.map((program) => ({ ...program, ...programStats[program.id] })),
    ...Object.entries(bonusStats).map(([id, tally]) => ({
      ...ITEMS[id],
      ...tally,
    })),
  ];
  for (const entry of entries) {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    const name = document.createElement("span");
    name.className = "program-name";
    if (entry.asset) {
      const logo = document.createElement("img");
      logo.className = `program-logo logo-${entry.id}`;
      logo.src = entry.asset;
      logo.alt = "";
      name.append(logo);
    } else name.append(icon(entry.icon));
    name.append(
      entry.name === "WELCOME BONUS"
        ? "Welcome Bonus"
        : entry.name === "TRANSFER BONUS"
          ? "Transfer Bonus"
          : entry.name,
    );
    label.append(name);
    const count = document.createElement("td");
    count.textContent = entry.catches.toLocaleString();
    const points = document.createElement("td");
    points.textContent = entry.points.toLocaleString();
    row.append(label, count, points);
    body.append(row);
  }
}
