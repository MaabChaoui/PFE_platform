/* AKN-RLM viva deck — minimal navigation engine */
(function () {
  const stage = document.getElementById('stage');
  const slides = Array.from(document.querySelectorAll('section.slide'));
  const topnav = document.getElementById('topnav');
  const chrome = document.getElementById('chrome');
  const numLabel = chrome.querySelector('.num');
  const SECTIONS = ['Landscape & Limits', 'Foundations', 'AKN-RLM', 'Results', 'Conclusion'];
  let cur = 0;

  /* ---------- top section nav ---------- */
  SECTIONS.forEach(name => {
    const s = document.createElement('span');
    s.textContent = name;
    topnav.appendChild(s);
  });
  const navItems = Array.from(topnav.children);

  /* ---------- scaling ---------- */
  function fit() {
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fit);
  fit();

  /* ---------- navigation ---------- */
  function show(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, k) => s.classList.toggle('active', k === i));
    cur = i;
    const s = slides[i];
    const plain = s.dataset.plain !== undefined;
    topnav.classList.toggle('hidden', plain);
    chrome.classList.toggle('hidden', plain);
    const sec = s.dataset.section;
    navItems.forEach((el, k) => el.classList.toggle('active', sec !== undefined && k === +sec));
    numLabel.textContent = (i + 1) + ' / ' + slides.length;
    history.replaceState(null, '', '#' + (i + 1));
  }

  function next() { show(cur + 1); }
  function prev() { show(cur - 1); }

  /* ---------- input ---------- */
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' ||
        e.key === 'PageDown' || e.key === 'Enter') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp' ||
             e.key === 'Backspace') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(slides.length - 1);
    else if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    }
  });
  document.addEventListener('contextmenu', e => e.preventDefault());

  /* ---------- start ---------- */
  const h = parseInt(location.hash.slice(1), 10);
  show(isNaN(h) ? 0 : h - 1);
})();
