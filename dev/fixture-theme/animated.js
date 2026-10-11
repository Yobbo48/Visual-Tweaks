/* Banc « thème animé » (?vt-test=animated) : motifs courants d'un thème réel,
   dont ceux relevés sur L'Énergie des Runes (boucle `tick` qui lit la
   géométrie à chaque image, gestionnaires de défilement et de redimensionnement).
   - boucle requestAnimationFrame permanente : lecture de géométrie (parallaxe)
     puis écriture de styles en ligne sur six éléments ;
   - en-tête dont la classe suit le défilement ;
   - révélations au défilement (IntersectionObserver) ;
   - diaporama qui alterne une classe toutes les 3 s ;
   - bandeau défilant qui déplace un élément du DOM toutes les 4 s
     (comme les carrousels « en boucle ») ;
   - hauteur recalculée au redimensionnement.
   Les animations CSS infinies sont dans la feuille de la page. */
(() => {
  const hero = document.querySelector(".anim-hero");
  if (!hero) return;
  const runes = [...hero.querySelectorAll("[data-vt-rune]")];
  const header = document.querySelector(".anim-header");
  const start = performance.now();
  function tick(now) {
    const rect = hero.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, -rect.top / rect.height));
    const width = hero.clientWidth;
    runes.forEach((rune, i) => {
      const a = ((now - start) / 1000) * (0.4 + i * 0.07) + i;
      const x = ((12 + i * 14 + Math.sin(a) * 4) * width) / 100;
      const y = 160 + Math.cos(a * 1.3) * 70 - progress * 240;
      rune.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(1 + Math.sin(a * 2) * 0.1).toFixed(3)})`;
    });
    hero.style.setProperty("--progress", progress.toFixed(3));
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  addEventListener(
    "scroll",
    () => header.classList.toggle("is-scrolled", scrollY > 40),
    { passive: true },
  );
  const reveal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          reveal.unobserve(entry.target);
        }
    },
    { threshold: 0.15 },
  );
  for (const node of document.querySelectorAll(".anim-reveal"))
    reveal.observe(node);
  const slides = [...document.querySelectorAll(".anim-slide")];
  let current = 0;
  setInterval(() => {
    slides[current].classList.remove("is-active");
    current = (current + 1) % slides.length;
    slides[current].classList.add("is-active");
  }, 3000);
  const ticker = document.querySelector(".anim-ticker");
  setInterval(() => ticker.append(ticker.firstElementChild), 4000);
  const size = () => (hero.style.minHeight = `${Math.round(innerHeight * 0.5)}px`);
  addEventListener("resize", size);
  size();
})();
