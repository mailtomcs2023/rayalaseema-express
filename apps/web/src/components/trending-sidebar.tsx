interface TrendingArticle {
  id: string;
  title: string;
  viewCount: number;
  timeAgo: string;
}

export function TrendingSidebar({ articles }: { articles: TrendingArticle[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-telugu-lg font-bold text-gray-900 mb-4 font-telugu border-b-2 border-primary-500 pb-2 flex items-center gap-2">
        <svg className="w-5 h-5 text-primary-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M13 7.83l1.46-1.46 4.24 4.24-4.24 4.24L13 13.39l2.78-2.78H3v-2h12.78L13 7.83zM21 3v18H3v-6h2v4h14V5H5v4H3V3h18z" />
        </svg>
        ట్రెండింగ్ న్యూస్
      </h3>
      <div className="space-y-0">
        {articles.map((article, i) => (
          <a
            key={article.id}
            href="#"
            className="flex gap-3 group py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
          >
            <span
              className={`text-2xl font-black shrink-0 w-8 text-center ${
                i < 3 ? "text-primary-500" : "text-gray-200"
              }`}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 group-hover:text-primary-500 transition-colors font-telugu line-clamp-2 leading-relaxed">
                {article.title}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                <span>{article.timeAgo}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                  </svg>
                  {article.viewCount.toLocaleString()}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
