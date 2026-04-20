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


const peopleSearch = document.getElementById('peopleSearch');
const peopleCounter = document.getElementById('peopleCounter');
const filterChips = document.querySelectorAll('.filter-chip');
const personCards = document.querySelectorAll('.person-card');
let activeSurnameFilter = 'all';
function updatePeopleFilter() {
  if (!personCards.length) return;
  const query = (peopleSearch?.value || '').trim().toLowerCase();
  let visible = 0;
  personCards.forEach((card) => {
    const search = card.dataset.search || '';
    const surname = card.dataset.surname || '';
    const matchesQuery = !query || search.includes(query);
    const matchesSurname = activeSurnameFilter === 'all' || surname === activeSurnameFilter;
    const show = matchesQuery && matchesSurname;
    card.classList.toggle('is-hidden', !show);
    if (show) visible += 1;
  });
  if (peopleCounter) {
    const surnameText = activeSurnameFilter === 'all' ? 'все ветви' : `ветвь «${activeSurnameFilter}»`;
    peopleCounter.textContent = `Показано карточек: ${visible}. Текущий фильтр: ${surnameText}.`;
  }
}
if (peopleSearch) peopleSearch.addEventListener('input', updatePeopleFilter);
filterChips.forEach((btn) => {
  btn.addEventListener('click', () => {
    activeSurnameFilter = btn.dataset.filter || 'all';
    filterChips.forEach((chip) => chip.classList.toggle('is-active', chip === btn));
    updatePeopleFilter();
  });
});
if (personCards.length) updatePeopleFilter();
