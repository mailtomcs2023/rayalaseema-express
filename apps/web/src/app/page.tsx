import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { NewsSlider } from "@/components/news-slider";
import { LatestNewsSidebar } from "@/components/latest-news-sidebar";
import { NewsGrid } from "@/components/news-grid";
import { VideoWidget } from "@/components/video-widget";
import { PhotoGallery } from "@/components/photo-gallery";
import {
  AdSidebarSquare,
  AdBannerMid,
  AdInFeedBanner,
  AdLeaderboard,
} from "@/components/ad-slots";
import { MovieGallery, TrendingReels } from "@/components/movie-gallery";
import { YettetaCartoon } from "@/components/yetteta-cartoon";
import { WebStories } from "@/components/web-stories";
import {
  sliderItems,
  breakingNewsItems,
  politicsArticles,
  crimeArticles,
  sportsArticles,
  businessArticles,
  educationArticles,
  entertainmentArticles,
  agricultureArticles,
  districtArticles,
  nationalArticles,
  photoGallery,
} from "@/lib/mock-data";

// Latest news for sidebar - Rayalaseema focused
const latestNewsItems = [
  { id: "ln1", title: "కర్నూలు జిల్లాలో భారీ వర్షాలు - పంటలు నీట మునిగాయి", slug: "kurnool-heavy-rains-crops" },
  { id: "ln2", title: "తిరుపతి రైల్వే స్టేషన్ ఆధునికీకరణ పనులు ప్రారంభం", slug: "tirupati-railway-modernization" },
  { id: "ln3", title: "అనంతపురం: రేయాన్ కర్మాగారంలో వేతన సమస్యపై కార్మికుల ఆందోళన", slug: "anantapur-rayon-factory-wages" },
  { id: "ln4", title: "వై.యస్.ఆర్ జిల్లా కలెక్టర్ ఆకస్మిక తనిఖీలు - అధికారులకు షాక్", slug: "ysr-collector-surprise-inspections" },
  { id: "ln5", title: "నంద్యాల-కర్నూలు హైవే విస్తరణ ప్రణాళికకు ఆమోదం", slug: "nandyal-kurnool-highway-expansion" },
  { id: "ln6", title: "చిత్తూరు: పుంగనూరు ఆవుల సంరక్షణకు కేంద్ర నిధులు", slug: "chittoor-punganur-cow-conservation" },
  { id: "ln7", title: "శ్రీ సత్యసాయి జిల్లాలో డ్రోన్ల ద్వారా పంటల సర్వే", slug: "sri-sathya-sai-drone-crop-survey" },
  { id: "ln8", title: "అన్నమయ్య: మదనపల్లెలో కొత్త ఐటీ ట్రైనింగ్ సెంటర్ ఏర్పాటు", slug: "annamayya-madanapalle-it-center" },
  { id: "ln9", title: "కర్నూలు ఎయిర్‌పోర్ట్ నుండి హైదరాబాద్ డైరెక్ట్ ఫ్లైట్ - త్వరలో", slug: "kurnool-airport-hyderabad-flight" },
  { id: "ln10", title: "తుంగభద్ర బోర్డు సమావేశం - నీటి పంపకం వివాదం కొనసాగింపు", slug: "tungabhadra-board-meeting-water" },
  { id: "ln11", title: "కడప స్టీల్ ప్లాంట్ ఏర్పాటుపై మరోసారి డిమాండ్ తీవ్రం", slug: "kadapa-steel-plant-demand" },
  { id: "ln12", title: "రాయలసీమ యూనివర్సిటీకి NAAC A++ గ్రేడ్ - అధికారిక ప్రకటన", slug: "rayalaseema-university-naac-grade" },
];

// News grid items - Rayalaseema district focused
const newsGridItems = [
  {
    id: "ng1",
    title: "కర్నూలు: తుంగభద్ర డ్యామ్ నుండి నీటి విడుదల - కాలువలకు కొత్త నీరు",
    slug: "kurnool-tungabhadra-dam-water-release",
    summary: "తుంగభద్ర డ్యామ్ నుండి కుడి, ఎడమ కాలువలకు నీటి విడుదల ప్రారంభం",
    featuredImage: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=300&h=200&fit=crop",
    label: "కర్నూలు",
    isLive: true,
  },
  {
    id: "ng2",
    title: "తిరుపతి: శ్రీవారి దర్శనానికి 48 గంటల వేచి ఉండాలి - భక్తుల తీవ్ర ఇబ్బందులు",
    slug: "tirupati-48-hours-waiting-darshan",
    summary: "బ్రహ్మోత్సవాల సీజన్‌లో తిరుమలలో భక్తుల రద్దీ తీవ్రం",
    featuredImage: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=300&h=200&fit=crop",
    label: "తిరుపతి",
  },
  {
    id: "ng3",
    title: "అనంతపురం: కియా మోటార్స్ ప్లాంట్‌లో 2,000 కొత్త ఉద్యోగాలు - దరఖాస్తు ప్రారంభం",
    slug: "anantapur-kia-motors-2000-jobs",
    summary: "పెనుకొండ కియా ప్లాంట్ విస్తరణతో స్థానికులకు భారీ ఉపాధి",
    featuredImage: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=300&h=200&fit=crop",
    label: "అనంతపురం",
  },
  {
    id: "ng4",
    title: "వై.యస్.ఆర్: శేషాచలంలో రక్తచందనం స్మగ్లర్ల ఏరివేత - టాస్క్‌ఫోర్స్ ఆపరేషన్",
    slug: "ysr-seshachalam-red-sandal-operation",
    summary: "రెడ్ శాండల్ టాస్క్‌ఫోర్స్ ప్రత్యేక ఆపరేషన్‌లో పలువురి అరెస్ట్",
    featuredImage: "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=300&h=200&fit=crop",
    label: "వై.యస్.ఆర్",
  },
  {
    id: "ng5",
    title: "నంద్యాల: బనగానపల్లె మామిడి సీజన్ ప్రారంభం - ఈసారి భారీ దిగుబడి అంచనా",
    slug: "nandyal-banganapalle-mango-season-start",
    summary: "ప్రపంచ ప్రసిద్ధ బనగానపల్లె మామిడి ఎగుమతులు పెరగనున్నాయి",
    featuredImage: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=300&h=200&fit=crop",
    label: "నంద్యాల",
  },
  {
    id: "ng6",
    title: "చిత్తూరు: హార్సిలీ హిల్స్ టూరిజం అభివృద్ధికి రూ.50 కోట్లు - మంత్రి ప్రకటన",
    slug: "chittoor-horsley-hills-tourism-50-crores",
    summary: "హార్సిలీ హిల్స్‌ను జాతీయ స్థాయి టూరిస్ట్ డెస్టినేషన్‌గా తీర్చిదిద్దనున్నారు",
    featuredImage: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop",
    label: "చిత్తూరు",
  },
  {
    id: "ng7",
    title: "శ్రీ సత్యసాయి: పుట్టపర్తి ఆశ్రమంలో ఉచిత వైద్య శిబిరం - 5,000 మందికి సేవలు",
    slug: "sri-sathya-sai-puttaparthi-free-medical-camp",
    summary: "సూపర్ స్పెషాలిటీ హాస్పిటల్‌లో ప్రత్యేక వైద్య శిబిరం నిర్వహణ",
    featuredImage: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=300&h=200&fit=crop",
    label: "శ్రీ సత్యసాయి",
  },
  {
    id: "ng8",
    title: "అన్నమయ్య: రాజంపేట సమీపంలో గనుల తవ్వకం - స్థానికుల ఆందోళన",
    slug: "annamayya-rajampet-mining-protests",
    summary: "గనుల తవ్వకంతో పర్యావరణ హాని జరుగుతోందని స్థానికులు ఆందోళన",
    featuredImage: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=300&h=200&fit=crop",
    label: "అన్నమయ్య",
  },
];

const videoItems = [
  {
    id: "v1",
    title: "రాయలసీమ అభివృద్ధి మండలి - ముఖ్యమంత్రి ప్రత్యేక ఇంటర్వ్యూ",
    thumbnail: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&h=300&fit=crop",
  },
  {
    id: "v2",
    title: "కర్నూలు సోలార్ పార్క్ - భారతదేశంలోనే అతిపెద్దది ఎలా?",
    thumbnail: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=500&h=300&fit=crop",
  },
  {
    id: "v3",
    title: "తిరుపతి బ్రహ్మోత్సవాలు - ప్రత్యేక కథనం",
    thumbnail: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=500&h=300&fit=crop",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "2px 8px 0" }}>
        {/* ===== SECTION 1: Slider + తాజా వార్తలు ===== */}
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          {/* Left: Slider + News Grid */}
          <div className="panel" style={{ flex: "0 0 63%", overflow: "hidden" }}>
            <NewsSlider items={sliderItems} />
            <AdBannerMid />
            <NewsGrid items={newsGridItems} />
          </div>
          {/* Right: Latest News sidebar */}
          <div className="panel" style={{ flex: "1 1 auto", overflow: "hidden" }}>
            <LatestNewsSidebar items={latestNewsItems} />
            <AdSidebarSquare />
          </div>
        </div>

        {/* ===== SECTION 2: Video + Movies + Reels ===== */}
        <div style={{ display: "flex", marginTop: 4, gap: 4, alignItems: "stretch" }}>
          <div className="category-card" style={{ flex: "1 1 33.33%", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <VideoWidget videos={videoItems} />
          </div>
          <div className="category-card" style={{ flex: "1 1 33.33%", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <MovieGallery />
          </div>
          <div className="category-card" style={{ flex: "1 1 33.33%", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <TrendingReels />
          </div>
        </div>

        {/* ===== BELOW FOLD: 3-col cards + right strip (like Eenadu) ===== */}
        <div style={{ display: "flex", marginTop: 4, gap: 4 }}>
          {/* LEFT: 3-column category grid */}
          <div style={{ flex: "1 1 auto" }} className="space-y-2">

            {/* Row 1: సినిమా | బిజినెస్ | క్రీడలు */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <CategoryCard title="సినిమా" slug="entertainment" articles={entertainmentArticles} />
              <CategoryCard title="బిజినెస్" slug="business" articles={businessArticles} />
              <CategoryCard title="క్రీడలు" slug="sports" articles={sportsArticles} />
            </div>

            {/* Row 2: జాతీయం | అంతర్జాతీయం | నవ్యసీమ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <CategoryCard title="జాతీయం" slug="national" articles={nationalArticles} />
            <CategoryCard
              title="అంతర్జాతీయం"
              slug="international"
              articles={[
                {
                  id: "int1",
                  title: "భారత్-అమెరికా వ్యూహాత్మక ఒప్పందం - రక్షణ, టెక్నాలజీ రంగాల్లో సహకారం",
                  slug: "india-us-agreement",
                  summary: "రక్షణ, టెక్నాలజీ, అంతరిక్ష రంగాల్లో సహకారం పెరగనుంది",
                  featuredImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&h=200&fit=crop",
                  publishedAt: new Date(Date.now() - 5400000).toISOString(),
                },
                {
                  id: "int2",
                  title: "చైనా-భారత్ సరిహద్దు చర్చలు - ఉద్రిక్తత తగ్గింపు దిశగా అడుగులు",
                  slug: "china-india-border-talks",
                  summary: "లడఖ్ సరిహద్దులో పరిస్థితి మెరుగుపడుతోందని రక్షణ మంత్రిత్వశాఖ",
                  featuredImage: "https://images.unsplash.com/photo-1565967511849-76a60a516170?w=300&h=200&fit=crop",
                  publishedAt: new Date(Date.now() - 10800000).toISOString(),
                },
              ]}
            />
            <CategoryCard
              title="నవ్యసీమ"
              slug="navyaseema"
              articles={[
                {
                  id: "nv1",
                  title: "రాయలసీమ మహిళా ఉద్యమకారులు - స్ఫూర్తిదాయక జీవిత గాథలు",
                  slug: "rayalaseema-women-leaders-stories",
                  summary: "రాయలసీమ ప్రాంతం నుండి వచ్చిన ధీర మహిళల ప్రేరణాత్మక కథలు",
                  featuredImage: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=200&fit=crop",
                  publishedAt: new Date(Date.now() - 3600000).toISOString(),
                },
                {
                  id: "nv2",
                  title: "రాయలసీమ వంటకాలు - గోంగూర పచ్చడి నుండి ఉగ్గాని వరకు",
                  slug: "rayalaseema-recipes-gongura-uggani",
                  summary: "మన ప్రాంత సంప్రదాయ వంటకాలు మరియు రెసిపీలు",
                  featuredImage: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=300&h=200&fit=crop",
                  publishedAt: new Date(Date.now() - 7200000).toISOString(),
                },
                {
                  id: "nv3",
                  title: "ఆరోగ్యం: వేసవిలో చర్మ సంరక్షణ - నిపుణుల సలహాలు",
                  slug: "summer-skin-care-expert-tips",
                  summary: "వేసవి కాలంలో చర్మాన్ని ఆరోగ్యంగా ఉంచుకునే చిట్కాలు",
                  featuredImage: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&h=200&fit=crop",
                  publishedAt: new Date(Date.now() - 14400000).toISOString(),
                },
                {
                  id: "nv4",
                  title: "మాతృత్వం కెరీర్‌కు ముగింపు కాదు! - సక్సెస్ స్టోరీస్",
                  slug: "motherhood-career-success-stories",
                  summary: "పిల్లల తర్వాత కూడా కెరీర్‌లో రాణిస్తున్న మహిళల కథలు",
                  featuredImage: "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=300&h=200&fit=crop",
                  publishedAt: new Date(Date.now() - 21600000).toISOString(),
                },
              ]}
            />
          </div>

            {/* Banner Ad */}
            <AdLeaderboard />

            {/* Row 3: వ్యవసాయం | విద్య | నేరాలు */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <CategoryCard title="వ్యవసాయం" slug="agriculture" articles={agricultureArticles} />
              <CategoryCard title="విద్య" slug="education" articles={educationArticles} />
              <CategoryCard title="నేరాలు" slug="crime" articles={crimeArticles} />
            </div>

            {/* Web Stories */}
            <WebStories />

            {/* Photo Gallery */}
            <PhotoGallery photos={photoGallery} />

            <AdInFeedBanner />

          </div>

          {/* RIGHT: ఎట్టెట Cartoon column */}
          <div style={{ flex: "0 0 180px" }} className="hidden lg:block">
            <YettetaCartoon />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/* ---- Category Card (uniform red header like Eenadu's blue) ---- */
function CategoryCard({
  title,
  slug,
  articles,
}: {
  title: string;
  slug: string;
  articles: any[];
}) {
  if (!articles || articles.length === 0) return null;

  return (
    <div className="category-card">
      {/* Header - inline tab (uses CSS var) */}
      <div style={{ padding: "8px 8px 0" }}>
        <a href={`/category/${slug}`} className="section-tab" style={{ textDecoration: "none" }}>
          <span className="section-tab-text">{title}</span>
          <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24" style={{ opacity: 0.8 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Image */}
      <div style={{ padding: "8px 8px 0" }}>
        <a href={`/article/${articles[0].slug}`} className="block group">
          <div style={{ overflow: "hidden", borderRadius: 2 }}>
            {articles[0].featuredImage ? (
              <img
                src={articles[0].featuredImage}
                alt={articles[0].title}
                className="group-hover:scale-105 transition-transform duration-300"
                style={{ display: "block", width: "100%", aspectRatio: "16/10", objectFit: "cover" }}
                loading="lazy"
              />
            ) : (
              <div style={{ aspectRatio: "16/10", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#9ca3af", fontSize: 24 }}>RE</span>
              </div>
            )}
          </div>
        </a>
      </div>

      {/* Featured title - uses CSS class */}
      <div style={{ padding: "6px 10px 4px" }}>
        <a href={`/article/${articles[0].slug}`} className="group">
          <h4 className="news-headline-featured line-clamp-2 hover-brand" style={{ margin: 0 }}>
            {articles[0].title}
          </h4>
        </a>
      </div>

      {/* Bullet Headlines - uses CSS classes */}
      <div style={{ padding: "4px 10px 14px" }}>
        {articles.slice(1, 4).map((article: any) => (
          <div key={article.id} style={{ marginBottom: 8 }}>
            <a
              href={`/article/${article.slug}`}
              className="group"
              style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
            >
              <span className="news-bullet-dot" style={{ marginTop: 8 }} />
              <span className="news-headline-bullet hover-brand line-clamp-2">
                {article.title}
              </span>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
