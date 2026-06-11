/* AKN-RLM viva deck — minimal navigation engine */
(function () {
  const stage = document.getElementById('stage');
  const slides = Array.from(document.querySelectorAll('section.slide'));
  const chrome = document.getElementById('chrome');
  const chLabel = chrome.querySelector('.ch');
  const numLabel = chrome.querySelector('.num');
  let cur = 0;

  /* ---------- scaling ---------- */
  function fit() {
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fit);
  fit();

  /* ---------- fragments ---------- */
  function frags(i) { return Array.from(slides[i].querySelectorAll('.frag')); }

  function show(i, fromEnd) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, k) => s.classList.toggle('active', k === i));
    cur = i;
    const f = frags(i);
    f.forEach(el => el.classList.toggle('on', !!fromEnd));
    const s = slides[i];
    if (s.dataset.plain !== undefined) chrome.classList.add('hidden');
    else chrome.classList.remove('hidden');
    chLabel.textContent = s.dataset.chapter || '';
    numLabel.textContent = (i + 1) + ' / ' + slides.length;
    history.replaceState(null, '', '#' + (i + 1));
  }

  function next() {
    const f = frags(cur).filter(el => !el.classList.contains('on'));
    if (f.length) { f[0].classList.add('on'); return; }
    if (cur < slides.length - 1) show(cur + 1, false);
  }
  function prev() {
    const f = frags(cur).filter(el => el.classList.contains('on'));
    if (f.length) { f[f.length - 1].classList.remove('on'); return; }
    if (cur > 0) show(cur - 1, true);
  }

  /* ---------- input ---------- */
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' ||
        e.key === 'PageDown' || e.key === 'Enter') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp' ||
             e.key === 'Backspace') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') show(0, false);
    else if (e.key === 'End') show(slides.length - 1, true);
    else if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    }
  });
  document.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    next();
  });
  document.addEventListener('contextmenu', e => { e.preventDefault(); prev(); });

  /* ---------- start ---------- */
  const h = parseInt(location.hash.slice(1), 10);
  show(isNaN(h) ? 0 : h - 1, false);
})();
