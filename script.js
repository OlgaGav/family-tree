const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxClose = document.getElementById('lightboxClose');
function openLightbox(src, title) {
  lightboxImage.src = src;
  lightboxImage.alt = title || 'Оригинал скана';
  lightboxTitle.textContent = title || '';
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightbox.hidden = true;
  lightboxImage.src = '';
  document.body.style.overflow = '';
}
document.querySelectorAll('.image-button, .open-image').forEach((el) => {
  el.addEventListener('click', () => {
    const src = el.dataset.full;
    const title = el.dataset.title;
    if (!src) return;
    openLightbox(src, title);
  });
});
if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightbox) {
  lightbox.addEventListener('click', (e) => {
    if (e.target.dataset.close === 'true') closeLightbox();
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && lightbox && !lightbox.hidden) closeLightbox();
});
