import { useLocation } from "react-router-dom";
import { NAV } from "../nav";
import Icon from "../components/Icon";
import { fa } from "../lib/format";

// Honest status page for sections that are not built yet (no fake interactions).
export default function ComingSoon() {
  const { pathname } = useLocation();
  const item = NAV.find(n => n.path === pathname);
  return (
    <div className="card flex flex-col items-center py-10 text-center">
      <span className="text-indigo-600 dark:text-indigo-400"><Icon name={item?.icon ?? "more"} className="h-10 w-10" /></span>
      <h1 className="mt-3 text-xl font-bold">{item?.label ?? "صفحه پیدا نشد"}</h1>
      <p className="muted mt-2 text-sm">
        {item ? `این بخش هنوز ساخته نشده و در نقطه عطف ${fa(item.milestone)} پیاده‌سازی می‌شود.` : "آدرس واردشده وجود ندارد."}
      </p>
    </div>
  );
}
