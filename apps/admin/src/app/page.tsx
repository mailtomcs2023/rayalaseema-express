import Link from "next/link";

const stats = [
  { label: "Published Articles", value: "0", color: "bg-green-500" },
  { label: "Drafts", value: "0", color: "bg-yellow-500" },
  { label: "In Review", value: "0", color: "bg-blue-500" },
  { label: "Social Posts Queued", value: "0", color: "bg-purple-500" },
];

const quickActions = [
  { label: "New Article", href: "/articles/new", icon: "+" },
  { label: "Breaking News", href: "/breaking-news", icon: "!" },
  { label: "Upload ePaper", href: "/epaper/upload", icon: "↑" },
  { label: "Media Library", href: "/media", icon: "□" },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 text-white p-6">
        <div className="mb-8">
          <h1 className="text-xl font-bold">RE Admin</h1>
          <p className="text-xs text-gray-400 mt-1">Rayalaseema Express CMS</p>
        </div>

        <nav className="space-y-1">
          {[
            { name: "Dashboard", href: "/", active: true },
            { name: "Articles", href: "/articles" },
            { name: "Categories", href: "/categories" },
            { name: "Media Library", href: "/media" },
            { name: "Breaking News", href: "/breaking-news" },
            { name: "ePaper", href: "/epaper" },
            { name: "Social Media", href: "/social" },
            { name: "Users", href: "/users" },
            { name: "Settings", href: "/settings" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-2.5 rounded-lg text-sm transition-colors ${
                item.active
                  ? "bg-primary-500 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
            <p className="text-sm text-gray-500 mt-1">
              Welcome to Rayalaseema Express CMS
            </p>
          </div>
          <Link
            href="/articles/new"
            className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors font-medium text-sm"
          >
            + New Article
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`w-3 h-3 rounded-full ${stat.color}`} />
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-200 transition-all text-center group"
              >
                <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">
                  {action.icon}
                </span>
                <span className="text-sm font-medium text-gray-700">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Articles */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Articles</h3>
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">No articles yet</p>
            <p className="text-sm mt-2">
              Create your first article to get started
            </p>
            <Link
              href="/articles/new"
              className="inline-block mt-4 bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
            >
              Create Article
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
