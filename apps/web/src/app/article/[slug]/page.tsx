import Link from "next/link";
import { Badge } from "@rayalaseema/ui";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { DateBar } from "@/components/date-bar";
import { TrendingSidebar } from "@/components/trending-sidebar";
import { trendingArticles, politicsArticles } from "@/lib/mock-data";

// Full article content for detail page
const fullArticle = {
  id: "fa1",
  title: "రాయలసీమ అభివృద్ధి మండలి ఏర్పాటు - రూ.50,000 కోట్ల ప్రత్యేక నిధులు ప్రకటించిన ముఖ్యమంత్రి",
  slug: "rayalaseema-development-board-50000-crores",
  category: { name: "రాజకీయాలు", nameEn: "Politics", color: "#FF2C2C", slug: "politics" },
  author: {
    name: "రాజేష్ కుమార్",
    bio: "సీనియర్ పొలిటికల్ ఎడిటర్, రాయలసీమ ఎక్స్‌ప్రెస్. 15 సంవత్సరాల జర్నలిజం అనుభవం.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
  },
  featuredImage: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&h=630&fit=crop",
  imageCaption: "రాయలసీమ అభివృద్ధి మండలి ప్రకటన సందర్భంగా ముఖ్యమంత్రి (ఫైల్ ఫోటో)",
  publishedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  viewCount: 15420,
  readTime: 6,
  tags: [
    { name: "రాయలసీమ", slug: "rayalaseema" },
    { name: "అభివృద్ధి", slug: "development" },
    { name: "ఏపీ", slug: "ap" },
    { name: "కర్నూలు", slug: "kurnool" },
  ],
  body: `
    <p>రాయలసీమ ప్రాంతం సమగ్ర అభివృద్ధి కోసం ప్రత్యేక అభివృద్ధి మండలిని ఏర్పాటు చేస్తున్నట్లు ముఖ్యమంత్రి శుక్రవారం అధికారికంగా ప్రకటించారు. ఈ మండలికి రూ.50,000 కోట్ల ప్రత్యేక నిధులు కేటాయించనున్నట్లు తెలిపారు.</p>

    <h2>ప్రాజెక్ట్ వివరాలు</h2>

    <p>ఈ ప్రణాళిక కింద కర్నూలు, అనంతపురం, కడప, చిత్తూరు జిల్లాల్లో కొత్త పరిశ్రమలు, ఐటీ పార్కులు, మెడికల్ కాలేజీలు నెలకొల్పనున్నారు. ప్రాంత అభివృద్ధి కోసం ఐదేళ్ల ప్రణాళిక రూపొందించారు.</p>

    <p>రాయలసీమ అభివృద్ధి మండలి అధ్యక్షుడిగా ఒక సీనియర్ IAS అధికారిని నియమించనున్నారు. ప్రతి జిల్లాకు ప్రత్యేక ప్రణాళికలు రూపొందించి, స్థానిక అవసరాలకు అనుగుణంగా నిధులు కేటాయించనున్నారు.</p>

    <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&h=500&fit=crop" alt="ఐటీ పార్క్ అభివృద్ధి ప్రణాళిక" />
    <p class="text-sm text-gray-500 italic mt-1">అనంతపురం ఐటీ పార్క్ ప్రణాళిక (ప్రతీకాత్మక చిత్రం)</p>

    <h2>నీటి పారుదల ప్రాజెక్టులు</h2>

    <p>రాయలసీమ కరువు నివారణకు నీటి పారుదల ప్రాజెక్టులకు రూ.15,000 కోట్లు కేటాయించారు. హంద్రీ-నీవా సుజల స్రవంతి ప్రాజెక్ట్ పూర్తి, గాలేరు-నగరి ప్రాజెక్ట్ వేగవంతం, వెలిగొండ ప్రాజెక్ట్ రెండవ దశ ప్రారంభం వంటి కీలక నిర్ణయాలు తీసుకున్నారు.</p>

    <blockquote>"రాయలసీమ అభివృద్ధి నా ప్రభుత్వ ప్రాధాన్యత. ఈ ప్రాంతంలో ప్రతి గ్రామానికి మంచినీరు, ప్రతి యువకుడికి ఉద్యోగం, ప్రతి రైతుకు సాగునీరు అందించడం మా లక్ష్యం." - ముఖ్యమంత్రి</blockquote>

    <h2>పారిశ్రామిక అభివృద్ధి</h2>

    <p>కర్నూలు, అనంతపురం, కడప జిల్లాల్లో కొత్త ఇండస్ట్రియల్ పార్కులు ఏర్పాటు చేయనున్నారు. అనంతపురంలో ఇప్పటికే కియా మోటార్స్ ప్లాంట్ విజయవంతంగా నడుస్తుండగా, మరిన్ని ఆటోమొబైల్ కంపెనీలను ఆకర్షించే ప్రయత్నాలు జరుగుతున్నాయి.</p>

    <p>కర్నూలు జిల్లాలో ఫుడ్ ప్రాసెసింగ్ పార్క్, కడప జిల్లాలో మైనింగ్ & మినరల్స్ ప్రాసెసింగ్ హబ్, చిత్తూరు జిల్లాలో ఎలక్ట్రానిక్స్ మానుఫ్యాక్చరింగ్ క్లస్టర్ ఏర్పాటు చేయనున్నారు.</p>

    <img src="https://images.unsplash.com/photo-1509391366360-2e959784a276?w=900&h=500&fit=crop" alt="కర్నూలు సోలార్ పార్క్" />
    <p class="text-sm text-gray-500 italic mt-1">కర్నూలు అల్ట్రా మెగా సోలార్ పార్క్ (ప్రతీకాత్మక చిత్రం)</p>

    <h2>విద్యా రంగం</h2>

    <p>రాయలసీమలో కొత్త ఇంజనీరింగ్ కాలేజీలు, మెడికల్ కాలేజీలు, IIT/NIT క్యాంపస్‌లు ఏర్పాటు చేయనున్నారు. కర్నూలు మెడికల్ కాలేజీని అప్‌గ్రేడ్ చేసి AIIMS స్థాయి సంస్థగా మార్చే ప్రతిపాదన ఉంది.</p>

    <h2>ప్రతిపక్షాల స్పందన</h2>

    <p>ప్రతిపక్ష నాయకులు ఈ ప్రకటనను స్వాగతిస్తూనే, అమలు తీరు చూడాలని పేర్కొన్నారు. గతంలో కూడా ఇలాంటి ప్రకటనలు చేసి, అమలు చేయలేదని ఆరోపించారు. అయితే ప్రభుత్వ వర్గాలు ఈసారి నిధుల కేటాయింపు బడ్జెట్‌లో చేర్చడం జరుగుతుందని స్పష్టం చేశాయి.</p>

    <p>రాయలసీమ ప్రాంత ఎంపీలు, ఎమ్మెల్యేలు ఈ నిర్ణయాన్ని హర్షించారు. "చాలా కాలంగా ఎదురు చూస్తున్న ప్రకటన ఇది. ఈసారి అమలు జరుగుతుందని ఆశిస్తున్నాం" అని కర్నూలు ఎంపీ వ్యాఖ్యానించారు.</p>
  `,
};

export default function ArticlePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <DateBar />

      <main>
        {/* Breadcrumb */}
        <div className="container-news py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-400">
            <Link href="/" className="hover:text-primary-500">హోమ్</Link>
            <span>/</span>
            <Link
              href={`/category/${fullArticle.category.slug}`}
              className="hover:text-primary-500"
            >
              {fullArticle.category.name}
            </Link>
            <span>/</span>
            <span className="text-gray-600 font-telugu line-clamp-1">{fullArticle.title.substring(0, 40)}...</span>
          </nav>
        </div>

        <div className="container-news pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Article Content */}
            <article className="lg:col-span-8">
              {/* Category Badge */}
              <Badge color={fullArticle.category.color}>
                {fullArticle.category.name}
              </Badge>

              {/* Title */}
              <h1 className="text-telugu-3xl font-bold text-gray-900 font-telugu mt-3 leading-snug">
                {fullArticle.title}
              </h1>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-4 mt-4 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <img
                    src={fullArticle.author.avatar}
                    alt={fullArticle.author.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800 font-telugu">
                      {fullArticle.author.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(fullArticle.publishedAt).toLocaleDateString("te-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 ml-auto">
                  <span>{fullArticle.readTime} ని. చదివే సమయం</span>
                  <span>•</span>
                  <span>{fullArticle.viewCount.toLocaleString()} views</span>
                </div>
              </div>

              {/* Social Share Bar */}
              <div className="flex items-center gap-2 py-3 border-b border-gray-200">
                <span className="text-xs text-gray-400 mr-2">Share:</span>
                {[
                  { name: "WhatsApp", color: "bg-green-500", icon: "W" },
                  { name: "Facebook", color: "bg-blue-600", icon: "f" },
                  { name: "Twitter", color: "bg-black", icon: "X" },
                  { name: "Telegram", color: "bg-sky-500", icon: "T" },
                  { name: "Copy Link", color: "bg-gray-500", icon: "🔗" },
                ].map((s) => (
                  <button
                    key={s.name}
                    className={`${s.color} text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold hover:opacity-80 transition-opacity`}
                    title={s.name}
                  >
                    {s.icon}
                  </button>
                ))}
              </div>

              {/* Featured Image */}
              <div className="mt-6">
                <img
                  src={fullArticle.featuredImage}
                  alt={fullArticle.title}
                  className="w-full rounded-xl"
                />
                {fullArticle.imageCaption && (
                  <p className="text-sm text-gray-500 mt-2 italic font-telugu">
                    {fullArticle.imageCaption}
                  </p>
                )}
              </div>

              {/* Article Body */}
              <div
                className="article-body mt-6"
                dangerouslySetInnerHTML={{ __html: fullArticle.body }}
              />

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-gray-200">
                <span className="text-sm text-gray-500">Tags:</span>
                {fullArticle.tags.map((tag) => (
                  <Link
                    key={tag.slug}
                    href={`/tag/${tag.slug}`}
                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm hover:bg-primary-50 hover:text-primary-500 transition-colors font-telugu"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>

              {/* Author Card */}
              <div className="bg-gray-50 rounded-xl p-6 mt-8 flex gap-4">
                <img
                  src={fullArticle.author.avatar}
                  alt={fullArticle.author.name}
                  className="w-16 h-16 rounded-full object-cover shrink-0"
                />
                <div>
                  <p className="font-bold text-gray-900 font-telugu">
                    {fullArticle.author.name}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 font-telugu">
                    {fullArticle.author.bio}
                  </p>
                </div>
              </div>

              {/* Related Articles */}
              <div className="mt-10">
                <h3 className="text-telugu-xl font-bold text-gray-900 font-telugu mb-5 border-b-2 border-primary-500 pb-2">
                  సంబంధిత వార్తలు
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {politicsArticles.slice(0, 4).map((article) => (
                    <Link
                      key={article.id}
                      href={`/article/${article.slug}`}
                      className="group flex gap-3"
                    >
                      <div className="w-28 h-20 shrink-0 rounded-lg overflow-hidden">
                        <img
                          src={article.featuredImage || ""}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800 font-telugu line-clamp-2 group-hover:text-primary-500 transition-colors">
                          {article.title}
                        </h4>
                        <span className="text-xs text-gray-400 mt-1 block">
                          {new Date(article.publishedAt).toLocaleDateString("te-IN")}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </article>

            {/* Sidebar */}
            <aside className="lg:col-span-4 space-y-8">
              <TrendingSidebar articles={trendingArticles} />

              {/* Ad */}
              <div className="bg-gradient-to-b from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-2">ప్రకటన</p>
                <div className="bg-white rounded-lg p-8 shadow-inner">
                  <p className="text-lg font-bold text-blue-600 font-telugu">మీ వ్యాపార ప్రకటన</p>
                  <p className="text-xs text-gray-400 mt-1">300x250 Ad Space</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
