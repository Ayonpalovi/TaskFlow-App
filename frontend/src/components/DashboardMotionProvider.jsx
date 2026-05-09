import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const PUBLIC_ROUTES = new Set(["/login", "/register", "/showcase"]);
const DASHBOARD_ROUTES = new Set(["/admin", "/client", "/editor"]);

export default function DashboardMotionProvider() {
  const location = useLocation();

  useEffect(() => {
    const isPublicRoute = PUBLIC_ROUTES.has(location.pathname);
    const isDashboardRoute = DASHBOARD_ROUTES.has(location.pathname);

    document.body.classList.toggle("mh-saas-motion", !isPublicRoute);
    document.body.classList.toggle("mh-dashboard-motion", isDashboardRoute);

    return () => {
      document.body.classList.remove("mh-saas-motion");
      document.body.classList.remove("mh-dashboard-motion");
    };
  }, [location.pathname]);

  return null;
}
