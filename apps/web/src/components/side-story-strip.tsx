"use client";

const stories = [
  {
    id: "ss1",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&h=200&fit=crop",
    title: "సమంత న్యూ లుక్",
  },
  {
    id: "ss2",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=200&fit=crop",
    title: "రష్మిక ఫోటోషూట్",
  },
  {
    id: "ss3",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=160&h=200&fit=crop",
    title: "పూజా హెగ్డే స్టైల్",
  },
  {
    id: "ss4",
    image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=160&h=200&fit=crop",
    title: "సోలార్ పార్క్ అందాలు",
  },
  {
    id: "ss5",
    image: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=160&h=200&fit=crop",
    title: "తిరుమల దర్శనం",
  },
  {
    id: "ss6",
    image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=160&h=200&fit=crop",
    title: "బేలం గుహలు",
  },
  {
    id: "ss7",
    image: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=160&h=200&fit=crop",
    title: "లేపాక్షి అందాలు",
  },
  {
    id: "ss8",
    image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=160&h=200&fit=crop",
    title: "మామిడి సీజన్",
  },
];

export function SideStoryStrip() {
  return (
    <div className="sticky top-[100px]">
      {/* Header */}
      <div className="bg-[#E01B1B] px-2 py-1 text-center">
        <span className="text-[11px] text-white fw-extrabold">ఇవి చూశారా?</span>
      </div>

      {/* Vertical story cards */}
      <div className="space-y-1 bg-white border border-gray-200 border-t-0 p-1">
        {stories.map((story) => (
          <a key={story.id} href="#" className="block relative rounded overflow-hidden group">
            <img
              src={story.image}
              alt={story.title}
              className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <p
              className="absolute bottom-0 left-0 right-0 p-1.5 text-white text-[10px] leading-[1.3] line-clamp-2"
              className="fw-bold"
            >
              {story.title}
            </p>
          </a>
        ))}
      </div>

      {/* Ad below */}
      <div className="mt-1 bg-gradient-to-b from-blue-900 to-blue-800 text-white rounded p-2 text-center">
        <p className="text-[8px] text-blue-300">AD</p>
        <p className="text-[10px] text-blue-200">Toll-Free</p>
        <p className="text-[11px] text-yellow-400 fw-extrabold">1800-XXX-XXXX</p>
      </div>
    </div>
  );
}
