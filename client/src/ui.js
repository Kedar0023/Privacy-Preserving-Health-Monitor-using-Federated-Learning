const COLORS = {
  Happy: ['#00e5a0', '#00ffb3', '#aaffd4'],
  Sad: ['#4a9eff', '#82bfff', '#c0deff'],
  Angry: ['#ff5a5a', '#ff8a8a', '#ffbfbf'],
  Tired: ['#a78bfa', '#c4b0ff', '#e0d4ff'],
  Stressed: ['#ffb347', '#ffd08a', '#ffe8c0'],
};

function spawnParticles(btn, mood) {
  const cols = COLORS[mood] || ['#00d4ff'];
  const cx = btn.offsetWidth / 2, cy = btn.offsetHeight / 2;
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    const angle = (360 / 14) * i + Math.random() * 18;
    const dist = 30 + Math.random() * 24;
    const rad = angle * Math.PI / 180;
    p.style.cssText = `left:${cx}px;top:${cy}px;background:${cols[i % cols.length]};--tx:${Math.cos(rad) * dist}px;--ty:${Math.sin(rad) * dist}px;animation-delay:${Math.random() * 0.07}s;animation-duration:${0.5 + Math.random() * 0.2}s`;
    btn.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

function spawnRipple(btn, e) {
  const r = document.createElement('span');
  r.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const sz = Math.max(rect.width, rect.height);
  r.style.cssText = `width:${sz}px;height:${sz}px;left:${e.clientX - rect.left - sz / 2}px;top:${e.clientY - rect.top - sz / 2}px`;
  btn.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

document.addEventListener('DOMContentLoaded', () => {
  let hideTimer;
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const mood = this.dataset.mood;
      const emoji = this.querySelector('.mood-emoji').textContent;

      // Reset all
      document.querySelectorAll('.mood-btn').forEach(b => {
        b.classList.remove('selected');
        const em = b.querySelector('.mood-emoji');
        const cl = em.cloneNode(true);
        em.replaceWith(cl);
      });
      this.classList.add('selected');

      spawnRipple(this, e);
      spawnParticles(this, mood);

      // Overlay
      const ov = document.getElementById('overlay');
      document.getElementById('overlay-emoji').textContent = emoji;
      document.getElementById('overlay-title').textContent = mood + ' Logged';
      ov.classList.add('active');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => ov.classList.remove('active'), 1700);

      // Status
      const st = document.getElementById('status');
      st.textContent = `${mood.toLowerCase()} · logged at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      st.classList.add('show');
      setTimeout(() => st.classList.remove('show'), 3500);
    });
  });
});
