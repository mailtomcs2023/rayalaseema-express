"use client";

const entertainmentItems = [
  {
    id: "es1",
    title: "పుష్ప 3 షూటింగ్ రాయలసీమ అడవుల్లో",
    image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=300&h=400&fit=crop",
    tag: "సినిమా",
  },
  {
    id: "es2",
    title: "తిరుమల బ్రహ్మోత్సవాల దృశ్యాలు",
    image: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=300&h=400&fit=crop",
    tag: "గ్యాలరీ",
  },
  {
    id: "es3",
    title: "కర్నూలు బేలం గుహల సందర్శన",
    image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=300&h=400&fit=crop",
    tag: "ట్రావెల్",
  },
  {
    id: "es4",
    title: "లేపాక్షి వీరభద్ర ఆలయ అందాలు",
    image: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=300&h=400&fit=crop",
    tag: "హెరిటేజ్",
  },
  {
    id: "es5",
    title: "రాయలసీమ వంటకాలు - గోంగూర స్పెషల్",
    image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=300&h=400&fit=crop",
    tag: "ఫుడ్",
  },
  {
    id: "es6",
    title: "అనంతపురం కియా ఫ్యాక్టరీ - ఫోటో ఫీచర్",
    image: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=300&h=400&fit=crop",
    tag: "బిజినెస్",
  },
];

export function EntertainmentStrip() {
  return (
    <section className="mt-1">
      {/* Header - solid red like Eenadu's blue */}
      <div className="bg-[#E01B1B] px-4 py-1.5 flex items-center justify-between">
        <h3 className="text-[14px] text-white fw-extrabold">
          ఫోటో & వీడియో గ్యాలరీ
        </h3>
        <a href="/gallery" className="text-white/70 hover:text-white transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Scrollable horizontal cards */}
      <div className="bg-white border border-gray-200 border-t-0 p-2">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {entertainmentItems.map((item) => (
            <a
              key={item.id}
              href="#"
              className="group relative block overflow-hidden rounded"
            >
              <div className="aspect-[3/4] overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              {/* Play icon overlay for video feel */}
              <div className="absolute top-2 left-2">
                <span
                  className="bg-[#FF2C2C] text-white text-[9px] px-1.5 py-0.5 rounded"
                  className="fw-extrabold"
                >
                  {item.tag}
                </span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p
                  className="text-white text-[12px] leading-[1.5] line-clamp-2"
                  className="fw-bold"
                >
                  {item.title}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
