import { useEffect, useState } from "react";

export default function Topbar({ onMenu, title }) {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    const hour = new Date().getHours();
    const isNight = hour >= 18 || hour < 6;
    setIsDark(isNight);
  }, []);

  // 2. apply theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  return (
    <header className="flex items-center h-16 px-4 bg-white border-b dark:bg-slate-900 border-slate-200 dark:border-slate-800 lg:px-6">
      <button
        onClick={onMenu}
        className="-ml-2 lg:hidden btn-ghost"
        aria-label="Menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
      <h1 className="ml-2 text-lg font-semibold lg:ml-0 text-slate-900 dark:text-white">
        {title}
      </h1>
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={() => setIsDark((v) => !v)}
          className="btn-ghost"
          title="Toggle dark mode"
          aria-label="Toggle dark mode"
        >
          {isDark ? (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M6.05 17.95l-1.414 1.414m0-13.728l1.414 1.414M17.95 17.95l1.414 1.414M12 7a5 5 0 100 10 5 5 0 000-10z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
              />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
