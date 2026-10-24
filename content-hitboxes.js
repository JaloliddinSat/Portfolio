// Shared by cursor effects and particle collisions. Coordinates are document-relative,
// with an optional vertical origin for content that moves during the hero transition.
export function collectContentHitboxes(content, originY = 0) {
  if (!content) return [];
  const solidSelector = '.resume-item, .project-card, .experience-skill-pill, .project-showcase-skill';
  const elements = content.querySelectorAll(`${solidSelector}, .section-title, .subsection-title, h2, h3, p, li, img, video, .stepnote-splat-stage`);
  const boxes = [];
  for (const element of elements) {
    if (element.parentElement?.closest(solidSelector)) continue;
    if (!element.getClientRects().length) continue;
    let rects;
    if (element.matches('p, h2, h3, li') && !element.matches(solidSelector)) {
      const range = document.createRange();
      range.selectNodeContents(element);
      rects = range.getClientRects();
    } else {
      rects = [element.getBoundingClientRect()];
    }
    for (const rect of rects) {
      if (rect.width < 1 || rect.height < 1) continue;
      boxes.push({ left: rect.left + scrollX, right: rect.right + scrollX,
        top: rect.top + scrollY - originY, bottom: rect.bottom + scrollY - originY });
    }
  }
  return boxes;
}
