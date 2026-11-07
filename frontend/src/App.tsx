import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ComingSoon from "./pages/ComingSoon";
import { NAV } from "./nav";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        {NAV.filter(n => n.path !== "/").map(n => <Route key={n.path} path={n.path} element={<ComingSoon />} />)}
        <Route path="*" element={<ComingSoon />} />
      </Route>
    </Routes>
  );
}
