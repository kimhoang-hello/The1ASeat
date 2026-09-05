export function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  // Sprite được nhúng thẳng trong index.html — Safari không đọc được
  // tham chiếu <use> sang file .svg ngoài.
  use.setAttribute("href", `#${name}`);
  svg.append(use);
  return svg;
}
