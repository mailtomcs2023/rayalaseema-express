// Full-scale mock data with real Telugu news content and images
// For localhost development only

export const sliderItems = [
  {
    id: "sl1",
    title: "తుంగభద్ర డ్యామ్ నుండి 1 లక్ష క్యూసెక్కుల నీటి విడుదల - కర్నూలు, నంద్యాల జిల్లాలకు సాగునీరు",
    summary: "తుంగభద్ర డ్యామ్ గేట్లు ఎత్తివేశారు. కుడి కాలువ, ఎడమ కాలువల ద్వారా రాయలసీమ ప్రాంతంలోని లక్షల ఎకరాల సాగు భూములకు నీటి విడుదల ప్రారంభమైంది.",
    slug: "tungabhadra-dam-water-release-kurnool-nandyal",
    category: { name: "కర్నూలు", color: "#FF2C2C", slug: "kurnool" },
    featuredImage: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1400&h=700&fit=crop",
    publishedAt: new Date(Date.now() - 1800000).toISOString(),
    author: { name: "రాజేష్ కుమార్" },
  },
  {
    id: "sl2",
    title: "తిరుపతి: శ్రీవారి బ్రహ్మోత్సవాలు ఘనంగా ప్రారంభం - 10 లక్షల భక్తుల తాకిడి అంచనా",
    summary: "తిరుమల శ్రీవేంకటేశ్వర స్వామి ఆలయంలో వార్షిక బ్రహ్మోత్సవాలు ఘనంగా ప్రారంభమయ్యాయి. భారీ భద్రతా ఏర్పాట్లు.",
    slug: "tirupati-brahmotsavam-10-lakh-devotees",
    category: { name: "తిరుపతి", color: "#B45309", slug: "tirupati" },
    featuredImage: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=1400&h=700&fit=crop",
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    author: { name: "వెంకట్ నాయుడు" },
  },
  {
    id: "sl3",
    title: "అనంతపురం: కియా EV ప్లాంట్ శంకుస్థాపన - 5,000 ఉద్యోగాలు, రూ.4,000 కోట్ల పెట్టుబడి",
    summary: "అనంతపురం జిల్లా పెనుకొండలో కియా ఎలక్ట్రిక్ వాహనాల తయారీ ప్లాంట్ శంకుస్థాపన. రాయలసీమ పారిశ్రామిక రంగంలో మైలురాయి.",
    slug: "anantapur-kia-ev-plant-foundation-5000-jobs",
    category: { name: "అనంతపురం", color: "#2563EB", slug: "anantapur" },
    featuredImage: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=1400&h=700&fit=crop",
    publishedAt: new Date(Date.now() - 5400000).toISOString(),
    author: { name: "సురేష్ రెడ్డి" },
  },
  {
    id: "sl4",
    title: "వై.యస్.ఆర్ జిల్లా: కడప స్టీల్ ప్లాంట్ ఏర్పాటుకు కేంద్ర ఆమోదం - దశాబ్దాల కల నెరవేరింది",
    summary: "కడప ఉక్కు కర్మాగారం ఏర్పాటుకు చివరకు కేంద్ర ప్రభుత్వం ఆమోదం తెలిపింది. రూ.12,000 కోట్ల అంచనా వ్యయంతో నిర్మాణం ప్రారంభం.",
    slug: "ysr-kadapa-steel-plant-central-approval",
    category: { name: "వై.యస్.ఆర్", color: "#7C3AED", slug: "ysr" },
    featuredImage: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&h=700&fit=crop",
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    author: { name: "లక్ష్మి దేవి" },
  },
  {
    id: "sl5",
    title: "కర్నూలు అల్ట్రా మెగా సోలార్ పార్క్ 5,000 MW కు విస్తరణ - దేశంలోనే అతిపెద్దది",
    summary: "కర్నూలు జిల్లాలోని సోలార్ పార్క్ విస్తరణకు కేంద్ర ఆమోదం. రాయలసీమ గ్రీన్ ఎనర్జీ హబ్‌గా ఎదుగుతోంది.",
    slug: "kurnool-solar-park-expansion-5000mw",
    category: { name: "కర్నూలు", color: "#FF2C2C", slug: "kurnool" },
    featuredImage: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1400&h=700&fit=crop",
    publishedAt: new Date(Date.now() - 10800000).toISOString(),
    author: { name: "రాజేష్ కుమార్" },
  },
  {
    id: "sl6",
    title: "నంద్యాల: బనగానపల్లె మామిడికి GI ట్యాగ్ - అంతర్జాతీయ మార్కెట్లో డిమాండ్ పెరుగుదల",
    summary: "ప్రపంచ ప్రసిద్ధ బనగానపల్లె మామిడికి GI (జియోగ్రాఫికల్ ఇండికేషన్) గుర్తింపు. ఎగుమతులు రెట్టింపు అవుతాయని అంచనా.",
    slug: "nandyal-banganapalle-mango-gi-tag",
    category: { name: "నంద్యాల", color: "#65A30D", slug: "nandyal" },
    featuredImage: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=1400&h=700&fit=crop",
    publishedAt: new Date(Date.now() - 14400000).toISOString(),
    author: { name: "సురేష్ రెడ్డి" },
  },
];

export const breakingNewsItems = [
  {
    id: "bn1",
    headline: "తుంగభద్ర డ్యామ్ గేట్లు ఎత్తివేత - కర్నూలు, నంద్యాల జిల్లాల్లో అప్రమత్తం",
    url: "/article/tungabhadra-dam-gates-open",
  },
  {
    id: "bn2",
    headline: "కడప స్టీల్ ప్లాంట్ ఏర్పాటుకు కేంద్ర ఆమోదం - రూ.12,000 కోట్ల పెట్టుబడి",
    url: "/article/kadapa-steel-plant-approval",
  },
  {
    id: "bn3",
    headline: "తిరుపతి బ్రహ్మోత్సవాలు ప్రారంభం - 10 లక్షల భక్తులు అంచనా",
    url: "/article/tirupati-brahmotsavam-start",
  },
  {
    id: "bn4",
    headline: "అనంతపురం కియా ప్లాంట్‌లో EV తయారీ యూనిట్ శంకుస్థాపన - 5,000 ఉద్యోగాలు",
    url: "/article/anantapur-kia-ev-plant",
  },
  {
    id: "bn5",
    headline: "నంద్యాల బనగానపల్లె మామిడికి GI ట్యాగ్ - అంతర్జాతీయ గుర్తింపు",
    url: "/article/banganapalle-mango-gi-tag",
  },
];

export const featuredArticle = {
  id: "fa1",
  title: "రాయలసీమ అభివృద్ధి మండలి ఏర్పాటు - రూ.50,000 కోట్ల ప్రత్యేక నిధులు ప్రకటించిన ముఖ్యమంత్రి",
  summary: "రాయలసీమ ప్రాంతం సమగ్ర అభివృద్ధి కోసం ప్రత్యేక అభివృద్ధి మండలిని ఏర్పాటు చేస్తున్నట్లు ముఖ్యమంత్రి ప్రకటించారు. నీటి పారుదల, పారిశ్రామిక అభివృద్ధి, విద్య, వైద్యం, రోడ్లు తదితర రంగాల్లో భారీ పెట్టుబడులు పెట్టనున్నట్లు తెలిపారు. ఈ ప్రణాళిక కింద కర్నూలు, అనంతపురం, కడప, చిత్తూరు జిల్లాల్లో కొత్త పరిశ్రమలు, ఐటీ పార్కులు, మెడికల్ కాలేజీలు నెలకొల్పనున్నారు.",
  slug: "rayalaseema-development-board-50000-crores",
  category: { name: "రాజకీయాలు", nameEn: "Politics", color: "#FF2C2C", slug: "politics" },
  featuredImage: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&h=630&fit=crop",
  publishedAt: new Date().toISOString(),
  author: { name: "రాజేష్ కుమార్", avatar: null },
  viewCount: 15420,
};

export const secondaryFeatured = [
  {
    id: "sf1",
    title: "హంద్రీ-నీవా సుజల స్రవంతి ప్రాజెక్ట్ పూర్తి - లక్షల ఎకరాలకు సాగునీరు",
    summary: "రాయలసీమ జీవనాడిగా పేరొందిన హంద్రీ-నీవా ప్రాజెక్ట్ చివరి దశ పనులు పూర్తయ్యాయి.",
    slug: "handri-neeva-project-complete",
    category: { name: "జిల్లా వార్తలు", color: "#EA580C", slug: "district-news" },
    featuredImage: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    author: { name: "సురేష్ రెడ్డి" },
  },
  {
    id: "sf2",
    title: "కర్నూలు మెడికల్ కాలేజీలో రోబోటిక్ సర్జరీ సెంటర్ ప్రారంభం",
    summary: "అత్యాధునిక రోబోటిక్ సర్జరీ సదుపాయాలతో కర్నూలు మెడికల్ కాలేజీ దేశంలోనే అగ్రగామిగా.",
    slug: "kurnool-medical-college-robotic-surgery",
    category: { name: "విద్య", color: "#0891B2", slug: "education" },
    featuredImage: "https://images.unsplash.com/photo-1551190822-a9ce113ac100?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    author: { name: "లక్ష్మి దేవి" },
  },
  {
    id: "sf3",
    title: "అనంతపురం IT పార్క్‌లో 5,000 ఉద్యోగాలు - ఇన్ఫోసిస్, TCS కంపెనీలు",
    summary: "అనంతపురం ఐటీ పార్క్‌లో ప్రముఖ సాఫ్ట్‌వేర్ కంపెనీలు కార్యకలాపాలు ప్రారంభించనున్నాయి.",
    slug: "anantapur-it-park-5000-jobs",
    category: { name: "వ్యాపారం", color: "#2563EB", slug: "business" },
    featuredImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 10800000).toISOString(),
    author: { name: "వెంకట్ నాయుడు" },
  },
];

export const politicsArticles = [
  {
    id: "pol1",
    title: "రాయలసీమ అభివృద్ధి మండలి ఏర్పాటుపై అన్ని పార్టీల సమావేశం",
    summary: "రాయలసీమ ప్రాంత అభివృద్ధికి అన్ని రాజకీయ పార్టీలు ఏకతాటిపై నడవాలని నిర్ణయించాయి. అసెంబ్లీలో జరిగిన ప్రత్యేక సమావేశంలో అన్ని పార్టీల నాయకులు పాల్గొన్నారు.",
    slug: "all-party-meet-rayalaseema-development",
    featuredImage: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 1800000).toISOString(),
    viewCount: 8920,
  },
  {
    id: "pol2",
    title: "ఏపీ కేబినెట్ కీలక నిర్ణయాలు - కొత్త జిల్లాల ఏర్పాటుపై చర్చ",
    summary: "రాష్ట్ర మంత్రివర్గ సమావేశంలో పలు కీలక నిర్ణయాలు తీసుకున్నారు. కొత్త జిల్లాల ఏర్పాటు, పునర్వ్యవస్థీకరణపై ముఖ్యమంత్రి సమీక్ష నిర్వహించారు.",
    slug: "ap-cabinet-key-decisions-new-districts",
    featuredImage: "https://images.unsplash.com/photo-1575540325276-8ab0f9b2a4d3?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 5400000).toISOString(),
    viewCount: 6540,
  },
  {
    id: "pol3",
    title: "కేంద్ర హోం మంత్రి రాయలసీమ పర్యటన - భద్రతా సమీక్ష",
    summary: "కేంద్ర హోం మంత్రి రేపు రాయలసీమ పర్యటనకు రానున్నారు. శ్రీశైలం, అహోబిలం ఆలయాల సందర్శనతో పాటు భద్రతా సమీక్ష నిర్వహించనున్నారు.",
    slug: "union-home-minister-rayalaseema-tour",
    featuredImage: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 9000000).toISOString(),
    viewCount: 4320,
  },
  {
    id: "pol4",
    title: "నంద్యాల ఉప ఎన్నిక - అభ్యర్థుల మధ్య హోరాహోరీ పోటీ",
    summary: "నంద్యాల నియోజకవర్గ ఉప ఎన్నికలో అన్ని పార్టీల అభ్యర్థులు తీవ్రంగా ప్రచారం చేస్తున్నారు. ఓటర్లను ఆకట్టుకునేందుకు వివిధ హామీలు ప్రకటిస్తున్నారు.",
    slug: "nandyal-by-election-tough-fight",
    featuredImage: "https://images.unsplash.com/photo-1494172961521-33799ddd43a5?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 14400000).toISOString(),
    viewCount: 3890,
  },
];

export const crimeArticles = [
  {
    id: "cr1",
    title: "కడప జిల్లాలో రెడ్ శాండల్ స్మగ్లింగ్ ముఠా అరెస్ట్ - 5 టన్నుల రక్తచందనం స్వాధీనం",
    summary: "శేషాచలం అడవుల్లో అక్రమంగా రక్తచందనం తరలిస్తున్న ముఠాను పోలీసులు పట్టుకున్నారు. ఐదుగురు నిందితులను అదుపులోకి తీసుకుని, రూ.2 కోట్ల విలువైన రక్తచందనం స్వాధీనం చేసుకున్నారు.",
    slug: "kadapa-red-sandal-smuggling-gang-arrest",
    featuredImage: "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    viewCount: 12340,
  },
  {
    id: "cr2",
    title: "కర్నూలులో సైబర్ మోసగాళ్ల అరెస్ట్ - రూ.3 కోట్లు రికవరీ",
    summary: "ఆన్‌లైన్ లోన్ యాప్‌ల ద్వారా మోసం చేస్తున్న ముఠాను కర్నూలు సైబర్ క్రైం పోలీసులు పట్టుకున్నారు.",
    slug: "kurnool-cyber-fraud-arrest-3-crores",
    featuredImage: "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    viewCount: 8760,
  },
  {
    id: "cr3",
    title: "చిత్తూరులో కల్తీ పాలు తయారీ కేంద్రం కనుగొన్న పోలీసులు",
    summary: "చిత్తూరు జిల్లాలో కల్తీ పాలు తయారు చేస్తున్న కేంద్రాన్ని పోలీసులు రైడ్ చేసి ముగ్గురిని అరెస్ట్ చేశారు.",
    slug: "chittoor-adulterated-milk-factory-busted",
    featuredImage: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 14400000).toISOString(),
    viewCount: 5430,
  },
];

export const sportsArticles = [
  {
    id: "sp1",
    title: "IPL 2026: సన్‌రైజర్స్ హైదరాబాద్ సంచలన విజయం - ముంబై ఇండియన్స్‌పై 45 పరుగుల తేడాతో గెలుపు",
    summary: "IPL 2026 లీగ్ దశలో సన్‌రైజర్స్ హైదరాబాద్ అద్భుతమైన ప్రదర్శన కనబరచింది. కెప్టెన్ ధనుష్ 95 పరుగులతో రాణించగా, బౌలర్లు ముంబై బ్యాటర్లను కట్టడి చేశారు.",
    slug: "ipl-2026-srh-sensational-win-mi",
    featuredImage: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 1800000).toISOString(),
    viewCount: 25680,
  },
  {
    id: "sp2",
    title: "కర్నూలు జిల్లా క్రికెట్ టోర్నమెంట్ - ఫైనల్స్‌కు చేరిన నంద్యాల జట్టు",
    summary: "జిల్లా స్థాయి క్రికెట్ పోటీల్లో నంద్యాల జట్టు సెమీఫైనల్స్‌లో ఆదోని జట్టును ఓడించి ఫైనల్స్‌కు అర్హత సాధించింది.",
    slug: "kurnool-district-cricket-nandyal-finals",
    featuredImage: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 5400000).toISOString(),
    viewCount: 3450,
  },
  {
    id: "sp3",
    title: "ఒలింపిక్స్ 2028 కోసం రాయలసీమ అథ్లెట్ ఎంపిక - కడప జిల్లా వెయిట్‌లిఫ్టర్",
    summary: "కడప జిల్లాకు చెందిన యువ వెయిట్‌లిఫ్టర్ రమేష్ కుమార్ 2028 లాస్ ఏంజెలిస్ ఒలింపిక్స్ కోసం భారత జట్టులో ఎంపికయ్యాడు.",
    slug: "rayalaseema-athlete-olympics-2028-weightlifter",
    featuredImage: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 10800000).toISOString(),
    viewCount: 7890,
  },
  {
    id: "sp4",
    title: "ప్రో కబడ్డీ లీగ్‌లో ఏపీ జట్టు హ్యాట్రిక్ విజయం",
    summary: "ప్రో కబడ్డీ లీగ్ 2026 సీజన్‌లో ఆంధ్రప్రదేశ్ యోధులు వరుసగా మూడో విజయాన్ని నమోదు చేశారు.",
    slug: "pro-kabaddi-ap-team-hat-trick-win",
    featuredImage: "https://images.unsplash.com/photo-1461896836934-bd45ba8b72f9?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 18000000).toISOString(),
    viewCount: 4560,
  },
];

export const businessArticles = [
  {
    id: "biz1",
    title: "కర్నూలు సోలార్ పార్క్ విస్తరణ - 5,000 MW సామర్థ్యం లక్ష్యం",
    summary: "కర్నూలు అల్ట్రా మెగా సోలార్ పార్క్ దేశంలోనే అతిపెద్ద సోలార్ పార్క్‌గా మారనుంది. ప్రస్తుతం 1,000 MW నుండి 5,000 MW కు విస్తరించే ప్రణాళికలను ప్రభుత్వం ఆమోదించింది.",
    slug: "kurnool-solar-park-expansion-5000mw",
    featuredImage: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    viewCount: 6780,
  },
  {
    id: "biz2",
    title: "అనంతపురం జిల్లాలో కొత్త ఆటోమొబైల్ హబ్ - కియా మోటార్స్ విస్తరణ",
    summary: "అనంతపురం జిల్లాలోని కియా మోటార్స్ ప్లాంట్ విస్తరణ ప్రణాళికలు ప్రకటించింది. మరో 3,000 మందికి ఉపాధి లభించనుంది.",
    slug: "anantapur-automobile-hub-kia-expansion",
    featuredImage: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    viewCount: 5430,
  },
  {
    id: "biz3",
    title: "బంగారం ధరలు సరికొత్త గరిష్ఠానికి - తులం రూ.82,000 దాటింది",
    summary: "అంతర్జాతీయ మార్కెట్లో బంగారం ధర పెరుగుదల కారణంగా దేశీయంగా బంగారం తులం ధర రూ.82,000 దాటింది.",
    slug: "gold-prices-new-record-high-82000",
    featuredImage: "https://images.unsplash.com/photo-1610375461246-83df859d849d?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 10800000).toISOString(),
    viewCount: 9870,
  },
];

export const educationArticles = [
  {
    id: "edu1",
    title: "ఏపీ ఇంటర్ ఫలితాలు 2026 విడుదల - రాయలసీమ జిల్లాల్లో 89% ఉత్తీర్ణత",
    summary: "ఆంధ్రప్రదేశ్ ఇంటర్మీడియేట్ పరీక్షల ఫలితాలు విడుదలయ్యాయి. రాయలసీమ జిల్లాల నుండి అద్భుతమైన ఫలితాలు వచ్చాయి. కర్నూలు జిల్లా టాపర్ రేష్మ 990/1000 మార్కులు సాధించింది.",
    slug: "ap-inter-results-2026-rayalaseema-89-percent",
    featuredImage: "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 1800000).toISOString(),
    viewCount: 34560,
  },
  {
    id: "edu2",
    title: "కడప IIT స్టడీ సెంటర్ ఏర్పాటు - గ్రామీణ విద్యార్థులకు ఉచిత శిక్షణ",
    summary: "కడప జిల్లాలో IIT, NEET పరీక్షలకు ఉచిత శిక్షణ ఇచ్చే స్టడీ సెంటర్ ఏర్పాటు చేయనున్నారు.",
    slug: "kadapa-iit-study-center-free-coaching",
    featuredImage: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    viewCount: 8920,
  },
  {
    id: "edu3",
    title: "JNTU అనంతపురం - AI & రోబోటిక్స్ కొత్త కోర్సులు ప్రారంభం",
    summary: "జవహర్‌లాల్ నెహ్రూ సాంకేతిక విశ్వవిద్యాలయం, అనంతపురంలో ఆర్టిఫిషియల్ ఇంటెలిజెన్స్ మరియు రోబోటిక్స్ కోర్సులు ప్రారంభమవుతున్నాయి.",
    slug: "jntu-anantapur-ai-robotics-courses",
    featuredImage: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 14400000).toISOString(),
    viewCount: 5670,
  },
];

export const entertainmentArticles = [
  {
    id: "ent1",
    title: "పుష్ప 3 - అల్లు అర్జున్ కొత్త సినిమా షూటింగ్ రాయలసీమలో ప్రారంభం",
    summary: "ఐకాన్ స్టార్ అల్లు అర్జున్ నటిస్తున్న పుష్ప సిరీస్ మూడవ భాగం షూటింగ్ రాయలసీమ అడవుల్లో ప్రారంభమైంది. దర్శకుడు సుకుమార్ ఈ సినిమాకు మరింత గ్రాండ్ స్కేల్‌లో తెరకెక్కిస్తున్నారు.",
    slug: "pushpa-3-shooting-rayalaseema-allu-arjun",
    featuredImage: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    viewCount: 45230,
  },
  {
    id: "ent2",
    title: "తిరుపతి ఉత్సవాల్లో ఘనంగా బ్రహ్మోత్సవాలు - లక్షల భక్తుల తాకిడి",
    summary: "తిరుమల శ్రీవేంకటేశ్వర స్వామి ఆలయంలో బ్రహ్మోత్సవాలు ఘనంగా ప్రారంభమయ్యాయి.",
    slug: "tirupati-brahmotsavams-lakhs-devotees",
    featuredImage: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    viewCount: 23450,
  },
  {
    id: "ent3",
    title: "రాయలసీమ సంస్కృతిపై డాక్యుమెంటరీ - నెట్‌ఫ్లిక్స్‌లో విడుదల",
    summary: "రాయలసీమ ప్రాంత సంస్కృతి, సంప్రదాయాలు, ఆహారం, కళలపై తీసిన డాక్యుమెంటరీ నెట్‌ఫ్లిక్స్‌లో విడుదలైంది.",
    slug: "rayalaseema-culture-documentary-netflix",
    featuredImage: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 10800000).toISOString(),
    viewCount: 12890,
  },
];

export const agricultureArticles = [
  {
    id: "agr1",
    title: "రాయలసీమలో డ్రిప్ ఇరిగేషన్ విప్లవం - 2 లక్షల ఎకరాలకు సబ్సిడీ",
    summary: "కరువు ప్రాంతంగా పేరొందిన రాయలసీమలో డ్రిప్ ఇరిగేషన్ ద్వారా సాగుకు ప్రభుత్వం భారీ సబ్సిడీలు ప్రకటించింది. రైతులకు 90% సబ్సిడీపై డ్రిప్ పరికరాలు అందించనున్నారు.",
    slug: "rayalaseema-drip-irrigation-revolution-subsidy",
    featuredImage: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    viewCount: 7890,
  },
  {
    id: "agr2",
    title: "వేరుశెనగ ధరలు పెరుగుదల - అనంతపురం రైతులకు సంతోషం",
    summary: "వేరుశెనగ ధరలు క్వింటాల్‌కు రూ.8,000 పెరగడంతో అనంతపురం జిల్లా రైతులు సంతోషంలో ఉన్నారు.",
    slug: "groundnut-prices-increase-anantapur-farmers",
    featuredImage: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 10800000).toISOString(),
    viewCount: 4560,
  },
];

export const districtArticles = [
  {
    id: "dist1",
    title: "కర్నూలు: బేలం గుహల్లో కొత్త టూరిజం సదుపాయాలు - లైట్ అండ్ సౌండ్ షో ప్రారంభం",
    summary: "కర్నూలు జిల్లాలోని ప్రసిద్ధ బేలం గుహల్లో కొత్త లైట్ అండ్ సౌండ్ షో, బోటింగ్ సదుపాయాలు ప్రారంభించారు. టూరిజం ఆదాయం మూడు రెట్లు పెరుగుతుందని అంచనా.",
    slug: "kurnool-belum-caves-new-tourism-facilities",
    featuredImage: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 1800000).toISOString(),
    viewCount: 6780,
  },
  {
    id: "dist2",
    title: "కడప: రైల్వే జోన్ ఏర్పాటు డిమాండ్ తీవ్రం - ధర్నాలు ప్రారంభం",
    summary: "కడప జిల్లాలో రైల్వే జోన్ ఏర్పాటు చేయాలని స్థానికులు తీవ్రంగా డిమాండ్ చేస్తున్నారు.",
    slug: "kadapa-railway-zone-demand-protests",
    featuredImage: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 5400000).toISOString(),
    viewCount: 5430,
  },
  {
    id: "dist3",
    title: "అనంతపురం: లేపాక్షి ఆలయ పునరుద్ధరణ పనులు వేగవంతం",
    summary: "చారిత్రాత్మక లేపాక్షి వీరభద్ర ఆలయ పునరుద్ధరణ పనులు వేగవంతంగా జరుగుతున్నాయి.",
    slug: "anantapur-lepakshi-temple-restoration",
    featuredImage: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 10800000).toISOString(),
    viewCount: 4320,
  },
  {
    id: "dist4",
    title: "చిత్తూరు: తిరుపతి ఎయిర్‌పోర్ట్ అంతర్జాతీయ విమానాల సేవలు ప్రారంభం",
    summary: "తిరుపతి అంతర్జాతీయ విమానాశ్రయం నుండి సింగపూర్, కౌలాలంపూర్, బ్యాంకాక్ నేరుగా విమానాల సేవలు ప్రారంభమయ్యాయి.",
    slug: "chittoor-tirupati-airport-international-flights",
    featuredImage: "https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 14400000).toISOString(),
    viewCount: 8920,
  },
];

export const nationalArticles = [
  {
    id: "nat1",
    title: "పార్లమెంట్ బడ్జెట్ సెషన్ - దక్షిణ భారతదేశానికి ప్రత్యేక కేటాయింపులు",
    summary: "కేంద్ర బడ్జెట్‌లో దక్షిణ భారతదేశ రాష్ట్రాలకు ప్రత్యేక నిధుల కేటాయింపు చేశారు. ఏపీకి రూ.25,000 కోట్లు, తెలంగాణకు రూ.20,000 కోట్లు ప్రకటించారు.",
    slug: "parliament-budget-south-india-special-allocation",
    featuredImage: "https://images.unsplash.com/photo-1565967511849-76a60a516170?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    viewCount: 15670,
  },
  {
    id: "nat2",
    title: "భారత ఆర్థిక వృద్ధి రేటు 8.2% - ప్రపంచంలోనే అత్యధికం",
    summary: "భారతదేశ GDP వృద్ధి రేటు 8.2% నమోదైందని RBI ప్రకటించింది. ప్రపంచంలోనే వేగంగా అభివృద్ధి చెందుతున్న ఆర్థిక వ్యవస్థగా భారత్ నిలిచింది.",
    slug: "india-economic-growth-8-2-percent",
    featuredImage: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    viewCount: 12340,
  },
];

export const internationalArticles = [
  {
    id: "int1",
    title: "భారత్-అమెరికా వ్యూహాత్మక ఒప్పందం - రక్షణ, టెక్నాలజీ రంగాల్లో సహకారం",
    summary: "భారత్-అమెరికా మధ్య కొత్త వ్యూహాత్మక ఒప్పందం కుదిరింది. రక్షణ, టెక్నాలజీ, అంతరిక్ష రంగాల్లో సహకారం పెరగనుంది.",
    slug: "india-us-strategic-agreement-defense-tech",
    featuredImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&h=400&fit=crop",
    publishedAt: new Date(Date.now() - 5400000).toISOString(),
    viewCount: 9870,
  },
];

export const opinionArticles = [
  {
    id: "op1",
    title: "రాయలసీమ అభివృద్ధికి నీటి పారుదలే కీలకం - సంపాదకీయం",
    summary: "రాయలసీమ ప్రాంతం అభివృద్ధికి నీటి పారుదల ప్రాజెక్టుల పూర్తి అత్యంత అవసరం. హంద్రీ-నీవా, గాలేరు-నగరి, వెలిగొండ ప్రాజెక్టులు సకాలంలో పూర్తి చేయాలి.",
    slug: "editorial-rayalaseema-development-irrigation-key",
    featuredImage: null,
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    author: { name: "ప్రధాన సంపాదకులు" },
  },
  {
    id: "op2",
    title: "డిజిటల్ విద్య - గ్రామీణ విద్యార్థులకు సమాన అవకాశాలు కల్పించాలి",
    summary: "డిజిటల్ విద్య అందుబాటులోకి రావడంతో గ్రామీణ ప్రాంత విద్యార్థులకు కూడా నాణ్యమైన విద్య అందించే అవకాశం ఉంది.",
    slug: "opinion-digital-education-rural-students",
    featuredImage: null,
    publishedAt: new Date(Date.now() - 14400000).toISOString(),
    author: { name: "ప్రొ. రాజశేఖర్" },
  },
  {
    id: "op3",
    title: "వ్యవసాయ రంగంలో సాంకేతిక పరిజ్ఞానం - రైతుల ఆదాయం రెట్టింపు సాధ్యమా?",
    summary: "ఆధునిక సాంకేతిక పరిజ్ఞానం ఉపయోగించి రైతుల ఆదాయాన్ని రెట్టింపు చేయగలమా అనే అంశంపై విశ్లేషణ.",
    slug: "opinion-agriculture-technology-farmer-income",
    featuredImage: null,
    publishedAt: new Date(Date.now() - 21600000).toISOString(),
    author: { name: "డా. సీతారామయ్య" },
  },
];

export const trendingArticles = [
  { id: "t1", title: "పుష్ప 3 షూటింగ్ రాయలసీమలో ప్రారంభం", viewCount: 45230, timeAgo: "1 గంట క్రితం" },
  { id: "t2", title: "ఏపీ ఇంటర్ ఫలితాలు 2026 - 89% ఉత్తీర్ణత", viewCount: 34560, timeAgo: "2 గంటల క్రితం" },
  { id: "t3", title: "IPL: SRH సంచలన విజయం - MI పై 45 పరుగుల తేడా", viewCount: 25680, timeAgo: "30 ని. క్రితం" },
  { id: "t4", title: "తిరుపతి బ్రహ్మోత్సవాలు - లక్షల భక్తుల తాకిడి", viewCount: 23450, timeAgo: "3 గంటల క్రితం" },
  { id: "t5", title: "రాయలసీమ అభివృద్ధి మండలి - రూ.50,000 కోట్లు", viewCount: 15420, timeAgo: "4 గంటల క్రితం" },
  { id: "t6", title: "బంగారం ధరలు రూ.82,000 దాటాయి", viewCount: 9870, timeAgo: "5 గంటల క్రితం" },
  { id: "t7", title: "కడప రెడ్ శాండల్ ముఠా అరెస్ట్", viewCount: 12340, timeAgo: "2 గంటల క్రితం" },
  { id: "t8", title: "తిరుపతి నుండి అంతర్జాతీయ విమానాలు", viewCount: 8920, timeAgo: "6 గంటల క్రితం" },
  { id: "t9", title: "కియా మోటార్స్ విస్తరణ - 3,000 ఉద్యోగాలు", viewCount: 5430, timeAgo: "4 గంటల క్రితం" },
  { id: "t10", title: "ఒలింపిక్స్ 2028 కోసం కడప అథ్లెట్ ఎంపిక", viewCount: 7890, timeAgo: "5 గంటల క్రితం" },
];

export const photoGallery = [
  {
    id: "pg1",
    title: "తిరుమల బ్రహ్మోత్సవాల దృశ్యాలు",
    image: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&h=300&fit=crop",
    count: 24,
  },
  {
    id: "pg2",
    title: "కర్నూలు బేలం గుహల అందాలు",
    image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&h=300&fit=crop",
    count: 18,
  },
  {
    id: "pg3",
    title: "అనంతపురం లేపాక్షి ఆలయం",
    image: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=400&h=300&fit=crop",
    count: 12,
  },
  {
    id: "pg4",
    title: "రాయలసీమ వ్యవసాయ దృశ్యాలు",
    image: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=300&fit=crop",
    count: 15,
  },
];
