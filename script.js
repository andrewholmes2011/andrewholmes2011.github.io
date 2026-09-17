const pageIndex = [
  { title: 'Home', url: 'index.html', text: 'Andrew Holmes student developer technology coding cybersecurity IT live production portfolio.' },
  { title: 'Technology FAQ', url: 'faq.html', text: 'Common computer issues slow computers Wi-Fi problems app crashes security updates and backup steps.' },
  { title: 'Technology Directory', url: 'directory.html', text: 'Resources organized by software hardware security and web development topics and skills.' },
  { title: 'Downloads', url: 'downloads.html', text: 'Download files and resources from the site including text.txt.' },
  { title: 'Streams & Live Production', url: 'streams.html', text: 'Live events and streams that Andrew has helped with using cameras and vMix.' },
  { title: 'Resume', url: 'resume.html', text: 'Andrew Holmes education experience skills and work history.' },
  { title: 'Contact', url: 'contact.html', text: 'Contact Andrew Holmes and send a message.' }
];

const menu = document.querySelector('.menu-toggle');
if (menu) {
  menu.addEventListener('click', () => {
    const links = document.querySelector('.nav-links');
    const isOpen = links.classList.toggle('open');
    menu.setAttribute('aria-expanded', isOpen);
  });
}

function renderResults(query) {
  const target = document.querySelector('#search-results');
  if (!target) return;

  const q = (query || '').trim().toLowerCase();
  const matches = q
    ? pageIndex.filter(page => (page.title + ' ' + page.text).toLowerCase().includes(q))
    : pageIndex;

  target.innerHTML = matches.length
    ? matches.map(page => `
      <article class="search-result">
        <h3><a href="${page.url}">${page.title}</a></h3>
        <p>${page.text}</p>
      </article>
    `).join('')
    : '<p class="empty">No pages matched that search.</p>';

  const count = document.querySelector('#search-count');
  if (count) {
    count.textContent = q ? `${matches.length} result${matches.length === 1 ? '' : 's'} for “${query}”` : 'All site pages';
  }
}

const params = new URLSearchParams(location.search);
if (document.querySelector('#search-results')) {
  const input = document.querySelector('#site-search');
  input.value = params.get('q') || '';
  renderResults(input.value);

  input.addEventListener('input', () => renderResults(input.value));
  document.querySelector('#search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    history.replaceState({}, '', `search.html?q=${encodeURIComponent(input.value)}`);
    renderResults(input.value);
  });
}

document.querySelectorAll('.filter').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach(item => item.classList.remove('active'));
    button.classList.add('active');

    const tag = button.dataset.tag;
    document.querySelectorAll('.directory-card').forEach(card => {
      card.hidden = tag !== 'all' && card.dataset.tag !== tag;
    });
  });
});

const modal = document.querySelector('#directory-modal');
if (modal) {
  const title = modal.querySelector('#modal-title');
  const list = modal.querySelector('#modal-list');

  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  };

  document.querySelectorAll('.directory-card--interactive').forEach(card => {
    const button = card.querySelector('.card-action');
    button.addEventListener('click', () => {
      title.textContent = card.dataset.modalTitle;
      list.innerHTML = card.dataset.modalContent
        .split('|')
        .map(item => `<li>${item}</li>`)
        .join('');
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
    });
  });

  modal.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
    }
  });
}
