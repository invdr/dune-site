// Property-page photo lightbox. The gallery shows the first photos as a grid;
// this opens a full-screen viewer over *all* photos (the grid alone left the
// rest unreachable and the "Все фото" button had no behaviour at all).
export function initGallery(): void {
  const box = document.getElementById('lightbox')
  const gallery = document.getElementById('gallery')
  if (!box || !gallery) return

  let photos: string[] = []
  try {
    photos = JSON.parse(box.dataset.photos ?? '[]')
  } catch {
    photos = []
  }
  if (photos.length === 0) return

  const img = box.querySelector<HTMLImageElement>('.lbox__img')
  const counter = box.querySelector('#lboxCur')
  if (!img) return

  let index = 0

  const show = (n: number) => {
    index = (n + photos.length) % photos.length
    img.src = photos[index]!
    if (counter) counter.textContent = String(index + 1)
  }
  const open = (n: number) => {
    show(n)
    box.hidden = false
    document.body.style.overflow = 'hidden'
  }
  const close = () => {
    box.hidden = true
    document.body.style.overflow = ''
  }

  // Open at the clicked cell; the "Все фото" button and any thumb both land here.
  gallery.addEventListener('click', (event) => {
    const cell = (event.target as HTMLElement).closest('.ph')
    const cells = Array.from(gallery.querySelectorAll('.ph'))
    const at = cell ? Math.max(0, cells.indexOf(cell)) : 0
    open(Math.min(at, photos.length - 1))
  })

  box.querySelector('.lbox__close')?.addEventListener('click', close)
  box.querySelector('.lbox__prev')?.addEventListener('click', (e) => {
    e.stopPropagation()
    show(index - 1)
  })
  box.querySelector('.lbox__next')?.addEventListener('click', (e) => {
    e.stopPropagation()
    show(index + 1)
  })
  // Click on the dimmed backdrop (not the image/controls) closes.
  box.addEventListener('click', (e) => {
    if (e.target === box) close()
  })
  document.addEventListener('keydown', (e) => {
    if (box.hidden) return
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowLeft') show(index - 1)
    else if (e.key === 'ArrowRight') show(index + 1)
  })
}
