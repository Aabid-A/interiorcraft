// An explicit scroll root alone does not account for that root leaving the viewport.
export function observeCatalogVisibility(element: Element, root: Element, onVisible: (visible: boolean) => void) {
  if (typeof IntersectionObserver === "undefined") return () => {};

  let inScrollRegion = false;
  let inViewport = false;
  let active = true;
  let visible = false;
  const update = (entries: IntersectionObserverEntry[], viewport: boolean) => {
    if (!active) return;
    const entry = entries.find((candidate) => candidate.target === element);
    if (!entry) return;
    const intersects = entry.isIntersecting && entry.intersectionRatio > 0 &&
      entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0;
    if (viewport) inViewport = intersects;
    else inScrollRegion = intersects;
    const next = inScrollRegion && inViewport;
    if (visible !== next) {
      visible = next;
      onVisible(next);
    }
  };
  const scrollObserver = new IntersectionObserver((entries) => update(entries, false), {
    root, rootMargin: "0px", threshold: 0,
  });
  const viewportObserver = new IntersectionObserver((entries) => update(entries, true), {
    root: null, rootMargin: "0px", threshold: 0,
  });
  scrollObserver.observe(element);
  viewportObserver.observe(element);
  return () => {
    active = false;
    scrollObserver.disconnect();
    viewportObserver.disconnect();
  };
}
