import { prisma } from "../src/index";

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No admin user");

  const categories = await prisma.category.findMany();
  const catMap: Record<string, string> = {};
  categories.forEach((c) => (catMap[c.slug] = c.id));

  const districts = await prisma.district.findMany({ include: { constituencies: { take: 1 } } });
  const distMap: Record<string, { id: string; constId?: string }> = {};
  districts.forEach((d) => (distMap[d.slug] = { id: d.id, constId: d.constituencies[0]?.id }));

  // ========== 1. MISSING DISTRICT ARTICLES ==========
  console.log("=== Adding missing district articles ===");

  const districtArticles = [
    // Nandyal
    { district: "nandyal", title: "నంద్యాల జిల్లాలో వరద బాధితులకు ప్రత్యేక సహాయ కేంద్రాలు", summary: "నంద్యాల జిల్లాలో ఇటీవల కురిసిన భారీ వర్షాల కారణంగా వరద బాధితులకు ప్రత్యేక సహాయ కేంద్రాలు ఏర్పాటు చేశారు.", slug: "nandyal-flood-relief-centers-2026", image: "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800" },
    { district: "nandyal", title: "బనగానపల్లె మామిడి ఎగుమతులు రికార్డు స్థాయిలో పెరుగుదల", summary: "నంద్యాల జిల్లా బనగానపల్లె మామిడి ఈ సీజన్‌లో అంతర్జాతీయ మార్కెట్లకు ఎగుమతులు గణనీయంగా పెరిగాయి.", slug: "banaganapalli-mango-exports-record-2026", image: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=800" },
    { district: "nandyal", title: "నంద్యాల-కర్నూలు ఎక్స్‌ప్రెస్‌వే నిర్మాణం వేగవంతం", summary: "నంద్యాల-కర్నూలు మధ్య ఎక్స్‌ప్రెస్‌వే నిర్మాణం వేగవంతంగా జరుగుతోంది. 2027 నాటికి పూర్తి చేయాలని లక్ష్యం.", slug: "nandyal-kurnool-expressway-progress-2026", image: "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=800" },
    // YSR Kadapa - more articles
    { district: "ysr-kadapa", title: "కడప జిల్లాలో కొత్త ఐటీ హబ్ ఏర్పాటుకు ప్రభుత్వ ఆమోదం", summary: "వై.యస్.ఆర్ కడప జిల్లాలో కొత్త ఐటీ హబ్ ఏర్పాటు చేయనున్నారు. దీని ద్వారా 2,000 ఉద్యోగాలు సృష్టించబడతాయి.", slug: "kadapa-it-hub-approval-2026", image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800" },
    { district: "ysr-kadapa", title: "కడప స్టీల్ ప్లాంట్ నిర్మాణం తుది దశలో - వేలాది ఉద్యోగాల అవకాశం", summary: "కడప స్టీల్ ప్లాంట్ నిర్మాణం తుది దశకు చేరుకుంది. త్వరలో ఉత్పత్తి ప్రారంభం కానుంది.", slug: "kadapa-steel-plant-final-phase-2026", image: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=800" },
    // Ananthapuramu
    { district: "ananthapuramu", title: "అనంతపురం జిల్లాలో సోలార్ ఎనర్జీ పార్క్ విస్తరణ - 10,000 MW లక్ష్యం", summary: "అనంతపురం జిల్లాలో సోలార్ ఎనర్జీ పార్క్ విస్తరణ ప్రణాళిక ప్రకటించారు. 10,000 MW సామర్థ్యం లక్ష్యం.", slug: "anantapur-solar-park-expansion-2026", image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800" },
    { district: "ananthapuramu", title: "అనంతపురం కియా ఫ్యాక్టరీ నుండి కొత్త EV మోడల్ ఆవిష్కరణ", summary: "కియా ఇండియా అనంతపురం ప్లాంట్ నుండి కొత్త ఎలక్ట్రిక్ వాహన మోడల్‌ను ఆవిష్కరించింది.", slug: "anantapur-kia-new-ev-model-2026", image: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800" },
    { district: "ananthapuramu", title: "లేపాక్షి ఆలయ పునర్నిర్మాణ పనులు ప్రారంభం", summary: "అనంతపురం జిల్లా లేపాక్షి ఆలయ పునర్నిర్మాణ పనులు ఆర్కియాలజికల్ సర్వే ఆఫ్ ఇండియా ఆధ్వర్యంలో ప్రారంభమయ్యాయి.", slug: "lepakshi-temple-restoration-begins-2026", image: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800" },
  ];

  for (const a of districtArticles) {
    const d = distMap[a.district];
    if (!d) continue;
    const existing = await prisma.article.findUnique({ where: { slug: a.slug } });
    if (existing) continue;
    await prisma.article.create({
      data: {
        title: a.title, slug: a.slug, summary: a.summary,
        body: `<p>${a.summary}</p><p>మరిన్ని వివరాలు త్వరలో...</p>`,
        categoryId: catMap["district-news"], authorId: admin.id,
        featuredImage: a.image, status: "PUBLISHED", language: "TELUGU",
        publishedAt: new Date(), constituencyId: d.constId || null,
      },
    });
    console.log(`  District: ${a.district} - ${a.title.substring(0, 40)}`);
  }

  // ========== 2. AGRICULTURE ARTICLES ==========
  console.log("\n=== Adding agriculture articles ===");
  const agriArticles = [
    { title: "రాయలసీమలో ఖరీఫ్ సీజన్ సిద్ధం - రైతులకు సబ్సిడీ విత్తనాలు పంపిణీ", slug: "rayalaseema-kharif-season-seeds-2026", image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800" },
    { title: "కర్నూలు మండి: మిర్చి ధరలు క్వింటాల్‌కు రూ.15,000 దాటాయి", slug: "kurnool-mandi-chilli-prices-rise-2026", image: "https://images.unsplash.com/photo-1588252303782-cb27a08f131d?w=800" },
    { title: "డ్రిప్ ఇరిగేషన్ సబ్సిడీ - రాయలసీమ రైతులకు 90% రాయితీ", slug: "drip-irrigation-subsidy-rayalaseema-2026", image: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800" },
    { title: "వేరుశనగ సాగులో కొత్త టెక్నాలజీ - అనంతపురం రైతుల విజయగాథ", slug: "groundnut-farming-tech-anantapur-2026", image: "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=800" },
    { title: "తుంగభద్ర ప్రాజెక్ట్ నుండి నీటి విడుదల - కర్నూలు, నంద్యాల జిల్లాలకు సాగునీరు", slug: "tungabhadra-water-release-kurnool-nandyal-2026", image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800" },
  ];
  for (const a of agriArticles) {
    const existing = await prisma.article.findUnique({ where: { slug: a.slug } });
    if (existing) continue;
    await prisma.article.create({
      data: {
        title: a.title, slug: a.slug, summary: a.title,
        body: `<p>${a.title}. మరిన్ని వివరాలు త్వరలో అందుబాటులోకి వస్తాయి.</p>`,
        categoryId: catMap["agriculture"], authorId: admin.id,
        featuredImage: a.image, status: "PUBLISHED", language: "TELUGU", publishedAt: new Date(),
      },
    });
    console.log(`  Agriculture: ${a.title.substring(0, 40)}`);
  }

  // ========== 3. BREAKING NEWS ==========
  console.log("\n=== Adding breaking news ===");
  const breakingItems = [
    "ఏపీ కేబినెట్ కీలక నిర్ణయాలు - రాయలసీమ ప్రాజెక్టులకు రూ.5,000 కోట్ల కేటాయింపు",
    "తిరుపతి: శ్రీవారి దర్శనానికి ఆన్‌లైన్ బుకింగ్ కొత్త విధానం ప్రారంభం",
    "IPL 2026: సన్‌రైజర్స్ హైదరాబాద్ ప్లేఆఫ్‌లోకి ప్రవేశం",
    "కర్నూలు: తుంగభద్ర డ్యామ్ గేట్లు ఎత్తివేత - జిల్లాలో అప్రమత్తం",
    "ఏపీ ఇంటర్ ఫలితాలు 2026 విడుదల - రాయలసీమ జిల్లాల్లో మెరుగైన ఫలితాలు",
  ];
  await prisma.breakingNews.deleteMany();
  for (let i = 0; i < breakingItems.length; i++) {
    await prisma.breakingNews.create({
      data: { headline: breakingItems[i], priority: i + 1, active: true },
    });
  }
  console.log(`  ${breakingItems.length} breaking news items`);

  // ========== 4. FEATURED ARTICLES FOR SLIDER ==========
  console.log("\n=== Setting featured articles ===");
  const topArticles = await prisma.article.findMany({
    where: { status: "PUBLISHED", featuredImage: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: 6,
  });
  for (const a of topArticles) {
    await prisma.article.update({ where: { id: a.id }, data: { featured: true } });
  }
  console.log(`  ${topArticles.length} articles marked as featured`);

  // ========== 5. WEB STORIES ==========
  console.log("\n=== Creating web stories ===");
  const webStories = [
    { title: "తిరుపతి బ్రహ్మోత్సవాలు - అద్భుత దృశ్యాలు", category: "devotional", image: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800" },
    { title: "రాయలసీమ వంటకాలు - రుచికి మారుపేరు", category: "food", image: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800" },
    { title: "గండికోట - భారతదేశపు గ్రాండ్ కాన్యన్", category: "travel", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800" },
    { title: "బేలం గుహలు - భారతదేశంలో రెండవ పెద్ద గుహలు", category: "travel", image: "https://images.unsplash.com/photo-1500534623283-312aade485b7?w=800" },
    { title: "లేపాక్షి నంది - చారిత్రక అద్భుతం", category: "heritage", image: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800" },
    { title: "కర్నూలు - రాయలసీమ న్యాయ రాజధాని", category: "city", image: "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800" },
    { title: "అనంతపురం కియా ఫ్యాక్టరీ - అంతర్జాతీయ తయారీ కేంద్రం", category: "business", image: "https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=800" },
    { title: "పుట్టపర్తి - శ్రీ సత్యసాయి బాబా ఆశ్రమం", category: "devotional", image: "https://images.unsplash.com/photo-1545468800-85cc9bc6ecf7?w=800" },
    { title: "బనగానపల్లె మామిడి - ప్రపంచ ప్రసిద్ధ రుచి", category: "food", image: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=800" },
    { title: "హార్సిలీ హిల్స్ - ఆంధ్రప్రదేశ్ ఊటీ", category: "travel", image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800" },
    { title: "శ్రీ కృష్ణదేవరాయలు - విజయనగర వైభవం", category: "history", image: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800" },
    { title: "తిరుమల 7 కొండల రహస్యాలు", category: "devotional", image: "https://images.unsplash.com/photo-1590577976322-3d2d6e2130d5?w=800" },
  ];
  await prisma.webStory.deleteMany();
  for (const s of webStories) {
    await prisma.webStory.create({
      data: { title: s.title, slug: `ws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, imageUrl: s.image, category: s.category, active: true },
    });
  }
  console.log(`  ${webStories.length} web stories`);

  // ========== 6. VIDEOS ==========
  console.log("\n=== Creating videos ===");
  await prisma.video.deleteMany();
  const videos = [
    { title: "రాయలసీమ అభివృద్ధి - ముఖ్యమంత్రి ప్రత్యేక ఇంటర్వ్యూ", url: "https://youtube.com/watch?v=example1", thumb: "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800", duration: "12:45" },
    { title: "తిరుపతి బ్రహ్మోత్సవాలు 2026 - ప్రత్యేక కథనం", url: "https://youtube.com/watch?v=example2", thumb: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800", duration: "8:30" },
    { title: "కర్నూలు సోలార్ పార్క్ - భారతదేశంలోనే అతిపెద్దది", url: "https://youtube.com/watch?v=example3", thumb: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800", duration: "10:15" },
  ];
  for (const v of videos) {
    await prisma.video.create({
      data: { title: v.title, slug: `vid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, videoUrl: v.url, thumbnailUrl: v.thumb, duration: v.duration, featured: true, active: true },
    });
  }
  console.log(`  ${videos.length} videos`);

  // ========== 7. REELS ==========
  console.log("\n=== Creating reels ===");
  await prisma.reel.deleteMany();
  const reels = [
    { title: "లేపాక్షి నంది విగ్రహం అద్భుతాలు", thumb: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=400", views: 220000 },
    { title: "రాయలసీమ సంప్రదాయ వివాహం", thumb: "https://images.unsplash.com/photo-1519741497674-611481863552?w=400", views: 310000 },
    { title: "అనంతపురం కియా ఫ్యాక్టరీ లోపల", thumb: "https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=400", views: 120000 },
    { title: "బనగానపల్లె మామిడి తోటల్లో పర్యటన", thumb: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=400", views: 95000 },
    { title: "కర్నూలు బేలం గుహల లైట్ షో", thumb: "https://images.unsplash.com/photo-1500534623283-312aade485b7?w=400", views: 180000 },
    { title: "తిరుమల వాహన సేవ అద్భుత దృశ్యాలు", thumb: "https://images.unsplash.com/photo-1590577976322-3d2d6e2130d5?w=400", views: 250000 },
  ];
  for (const r of reels) {
    await prisma.reel.create({
      data: { title: r.title, slug: `reel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, videoUrl: "https://youtube.com/shorts/example", thumbnailUrl: r.thumb, views: String(r.views), active: true },
    });
  }
  console.log(`  ${reels.length} reels`);

  // ========== 8. PHOTO GALLERIES ==========
  console.log("\n=== Creating photo galleries ===");
  await prisma.photoGallery.deleteMany();
  const galleries = [
    { title: "తిరుమల బ్రహ్మోత్సవాల దృశ్యాలు", cover: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800" },
    { title: "రాయలసీమ వ్యవసాయ దృశ్యాలు", cover: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800" },
    { title: "అనంతపురం లేపాక్షి ఆలయం", cover: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800" },
    { title: "కర్నూలు బేలం గుహల అందాలు", cover: "https://images.unsplash.com/photo-1500534623283-312aade485b7?w=800" },
  ];
  for (const g of galleries) {
    await prisma.photoGallery.create({
      data: { title: g.title, slug: `pg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, coverImage: g.cover, active: true },
    });
  }
  console.log(`  ${galleries.length} galleries`);

  // ========== 9. CARTOONS ==========
  console.log("\n=== Creating cartoons ===");
  await prisma.cartoon.deleteMany();
  const cartoons = [
    { title: "నేటి ఎట్టెట", caption: "రాజకీయ వ్యంగ్యం", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400", date: new Date() },
    { title: "నిన్నటి ఎట్టెట", caption: "సామాజిక వ్యంగ్యం", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400", date: new Date(Date.now() - 86400000) },
  ];
  for (const c of cartoons) {
    await prisma.cartoon.create({
      data: { title: c.title, caption: c.caption, imageUrl: c.image, date: c.date, active: true },
    });
  }
  console.log(`  ${cartoons.length} cartoons`);

  const totalArticles = await prisma.article.count({ where: { status: "PUBLISHED" } });
  console.log(`\n=== DONE! Total published articles: ${totalArticles} ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
