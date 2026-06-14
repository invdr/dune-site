// Compact fixtures mirroring sellox.ru's real markup patterns: Yoast og:* meta,
// the JSON-LD breadcrumb whose last crumb is the complex name, "₽/м²" + "от N м²"
// facts, a "Год сдачи" row, WordPress upload images (with theme chrome and size
// variants to exercise filtering/dedup), and a trailing "related listings"
// widget linking to other /property/ slugs. The live crawl in development
// validated the real pages; these keep the unit suite fast and offline.

export const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://sellox.ru/property/zhk-prestizh-v-groznom/</loc></url>
  <url><loc>https://sellox.ru/property/zhk-rivera/</loc></url>
  <url><loc>https://sellox.ru/property-types/flats/</loc></url>
  <url><loc>https://sellox.ru/property/zhk-dubaiskie-doma/</loc></url>
</urlset>`

// Grozny complex: ruble per-m² price, gallery + theme chrome + size variants,
// amenities, installment, and a related widget that must be excluded.
export const GROZNY_HTML = `<!doctype html><html><head>
<title>ЖК Престиж в Грозном | Sellox | Вся недвижимость в ЧР.</title>
<meta property="og:title" content="ЖК Престиж в Грозном | Sellox | Вся недвижимость в ЧР." />
<meta property="og:description" content="ЖК Престиж в Грозном — комфортабельные дома на новом проспекте Путина." />
<meta property="og:image" content="https://sellox.ru/wp-content/uploads/2024/07/ЖК-Престиж-1.webp" />
<script type="application/ld+json">{"@graph":[{"@type":"BreadcrumbList","itemListElement":[
{"@type":"ListItem","position":1,"name":"Главная страница","item":"https://sellox.ru/"},
{"@type":"ListItem","position":2,"name":"свойства","item":"https://sellox.ru/property/"},
{"@type":"ListItem","position":3,"name":"ЖК Престиж"}]}]}</script>
</head><body>
<main>
  <h1>ЖК Престиж в Грозном</h1>
  <div class="price">68,000₽/м²</div>
  <div class="area">от 47 м²</div>
  <div class="facts">Год сдачи: 2026</div>
  <p>ЖК Престиж в Грозном представляет собой современный жилой комплекс, который сочетает в себе высший уровень комфорта и стильный дизайн. Расположен на новом проспекте Путина, он обеспечивает отличное качество жизни для своих жителей и продуманную инфраструктуру.</p>
  <p>На первых двух этажах расположена коммерческая зона, включающая бассейн, фитнес-центр, хаммам и детскую игровую комнату. Предусмотрен двухъярусный подземный паркинг и охраняемая территория.</p>
  <p>Есть возможность приобретения жилья в рассрочку с первоначальным взносом от 30% до 50%.</p>
  <img src="https://sellox.ru/wp-content/uploads/2024/07/ЖК-Престиж-1-1170x785.webp" />
  <img src="https://sellox.ru/wp-content/uploads/2024/07/ЖК-Престиж-1.webp" />
  <img src="https://sellox.ru/wp-content/uploads/2024/07/ЖК-Престиж-2.webp" />
  <img src="https://sellox.ru/wp-content/uploads/2023/12/sellox-300x93.webp" />
  <img src="https://sellox.ru/wp-content/uploads/2024/07/favicon-57x57-2.png" />
  <img src="https://sellox.ru/wp-content/uploads/2016/02/agent-Sellox-150x150.webp" />
</main>
<aside class="related">
  <h3>Похожие объекты</h3>
  <a href="https://sellox.ru/property/zhk-rivera/">ЖК Ривера</a>
  <div class="price">59,000₽/м²</div>
  <div class="area">от 36 м²</div>
  <img src="https://sellox.ru/wp-content/uploads/2024/07/Rivera-1.webp" />
</aside>
</body></html>`

// Dubai complex: actually foreign-priced, so it resolves to AE/DUBAI/USD.
export const DUBAI_HTML = `<!doctype html><html><head>
<title>Apartments in Dubai Marina | Sellox</title>
<meta property="og:title" content="Apartments in Dubai Marina | Sellox" />
<meta property="og:description" content="Квартиры в Дубае, район Dubai Marina." />
<meta property="og:image" content="https://sellox.ru/wp-content/uploads/2025/01/dubai-marina-1.webp" />
<script type="application/ld+json">{"@graph":[{"@type":"BreadcrumbList","itemListElement":[
{"@type":"ListItem","position":1,"name":"Главная страница","item":"https://sellox.ru/"},
{"@type":"ListItem","position":3,"name":"Dubai Marina Residences"}]}]}</script>
</head><body>
<main>
  <div class="price">от 350,000 $</div>
  <div class="area">от 55 м²</div>
  <p>Резиденция в районе Dubai Marina с панорамными видами на залив, развитой инфраструктурой и собственным бассейном для жителей комплекса.</p>
</main>
</body></html>`

// Dubai-themed but ruble-priced → must stay a Russian listing.
export const DUBAI_STYLE_RU_HTML = `<!doctype html><html><head>
<title>ЖК Дубайские дома | Sellox</title>
<meta property="og:title" content="ЖК Дубайские дома | Sellox" />
<meta property="og:description" content="ЖК Дубайские дома — дома в стиле Дубай." />
<meta property="og:image" content="https://sellox.ru/wp-content/uploads/2024/09/dom-1.webp" />
<script type="application/ld+json">{"@graph":[{"@type":"BreadcrumbList","itemListElement":[
{"@type":"ListItem","position":3,"name":"ЖК Дубайские дома"}]}]}</script>
</head><body>
<main>
  <div class="price">90,000₽/м²</div>
  <div class="area">от 23 м²</div>
  <p>ЖК Дубайские дома — современный жилой комплекс в стиле Дубай с качественной отделкой и удобными планировками для комфортной жизни всей семьи.</p>
</main>
</body></html>`
