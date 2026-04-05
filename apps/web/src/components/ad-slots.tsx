"use client";

// Dummy ads for development - will be replaced with real AdSense/ad network

export function AdBannerTop() {
  return (
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-[10px] text-gray-400 mb-1">ADVERTISEMENT</p>
          <p className="text-lg font-bold text-amber-800">🏠 MY HOME GROUP</p>
          <p className="text-sm text-amber-700">2, 2.5, 3 & 4 BHK Premium Homes</p>
          <p className="text-xs text-gray-500 mt-1">at TELLPUR | Starting ₹45 Lakhs*</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-amber-600">UDYAN</p>
          <p className="text-[10px] text-gray-500">WELCOME TO THE PARK LIFE</p>
        </div>
      </div>
    </div>
  );
}

export function AdSidebarSquare() {
  return (
    <div className="bg-gradient-to-b from-blue-900 to-blue-800 text-white rounded overflow-hidden p-4 text-center">
      <p className="text-[9px] text-blue-300 mb-2">ADVERTISEMENT</p>
      <p className="text-xs text-blue-200">Planning to prepare for</p>
      <p className="text-3xl font-black text-yellow-400 my-2">IAS/IPS?</p>
      <p className="text-sm">Choose the best institute</p>
      <p className="text-lg font-bold text-yellow-300 mt-1">La Excellence</p>
      <div className="mt-3 space-y-1 text-[11px] text-left text-blue-200">
        <p>✓ Inter with civils</p>
        <p>✓ Degree with civils</p>
        <p>✓ Inter with CLAT</p>
      </div>
      <div className="mt-3 bg-yellow-400 text-blue-900 rounded px-3 py-1.5 text-sm font-bold inline-block">
        86 Ranks in 2025
      </div>
      <p className="text-xs text-blue-300 mt-2">📞 9052 29 29 29</p>
    </div>
  );
}

export function AdSidebarTall() {
  return (
    <div className="bg-gradient-to-b from-indigo-50 to-purple-50 border border-indigo-200 rounded overflow-hidden p-4 text-center">
      <p className="text-[9px] text-gray-400 mb-2">ADVERTISEMENT</p>
      <p className="text-2xl font-black text-indigo-700 font-telugu">జాతక ఫలం</p>
      <p className="text-sm text-indigo-600 font-telugu mt-1">అడగండి ప్రశ్నే</p>
      <div className="my-4 text-5xl">🔮</div>
      <p className="text-xs text-gray-600 font-telugu">మీ జాతకం గురించి తెలుసుకోండి</p>
      <button className="mt-3 bg-indigo-600 text-white rounded px-4 py-1.5 text-sm font-medium">
        Click here
      </button>
    </div>
  );
}

export function AdBannerMid() {
  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded py-2.5 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <p className="text-[9px] text-gray-400">AD</p>
        <p className="text-sm font-bold text-red-700 font-telugu">
          రాయలసీమ ఎక్స్‌ప్రెస్ — మీ జిల్లా వార్తలు, మీ భాషలో, మీ ఫోన్‌లో
        </p>
      </div>
      <button className="bg-[#FF2C2C] text-white text-xs px-3 py-1 rounded font-bold shrink-0">
        APP Download
      </button>
    </div>
  );
}

export function AdVerticalStrip() {
  return (
    <div className="bg-gradient-to-b from-blue-900 to-blue-800 text-white rounded overflow-hidden p-3 text-center sticky top-[120px]">
      <p className="text-[8px] text-blue-300 mb-2">AD</p>
      <p className="text-[10px] text-blue-200">Planning to prepare for</p>
      <p className="text-xl font-black text-yellow-400 my-1">IAS<br/>IPS?</p>
      <p className="text-[10px] text-blue-200 mt-1">Choose</p>
      <p className="text-sm font-bold text-yellow-300">La Excellence</p>
      <div className="mt-2 text-[9px] text-left text-blue-200 space-y-0.5">
        <p>✓ Inter with civils</p>
        <p>✓ Degree with civils</p>
        <p>✓ Inter with CLAT</p>
      </div>
      <div className="mt-2 bg-yellow-400 text-blue-900 rounded px-2 py-1 text-[10px] font-bold">
        86 Ranks
      </div>
      <p className="text-[9px] text-blue-300 mt-2">📞 9052 29 29 29</p>
    </div>
  );
}

export function AdInFeedBanner() {
  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="text-4xl">🏗️</div>
        <div>
          <p className="text-[9px] text-gray-400">ADVERTISEMENT</p>
          <p className="text-sm font-bold text-green-800">లగ్జరీ ఫ్లాట్.. బడ్జెట్ ధర</p>
          <p className="text-xs text-green-700">ప్రతి అడుగులో సౌకర్యం.. సౌగతే</p>
          <p className="text-[10px] text-gray-500 mt-0.5">ధర.. ప్రతి అడుగులో సౌకర్యం | 2 & 3 BHK</p>
        </div>
        <div className="ml-auto">
          <button className="bg-green-600 text-white text-xs px-3 py-1.5 rounded font-medium">
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdLeaderboard() {
  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="flex items-center justify-center gap-6 px-4 py-4">
        <img src="/logo.svg" alt="Rayalaseema Express" className="h-10 w-auto" />
        <div className="border-l border-gray-200 pl-6">
          <p className="text-[9px] text-gray-400 mb-0.5">ADVERTISE WITH US</p>
          <p className="text-sm text-gray-600 font-telugu">మీ వ్యాపార ప్రకటన ఇక్కడ</p>
          <p className="text-sm font-bold text-gray-800">ads@rayalaseemaexpress.com</p>
          <p className="text-xs text-gray-500">📞 98765 43210</p>
        </div>
      </div>
    </div>
  );
}
