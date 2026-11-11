import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import AuthGate from "./components/AuthGate";
import Account from "./pages/Account";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import CreateCourse from "./pages/CreateCourse";
import CourseDetail from "./pages/CourseDetail";
import LessonPage from "./pages/LessonPage";
import EditCourse from "./pages/EditCourse";
import Teacher from "./pages/Teacher";
import Settings from "./pages/Settings";
import Progress from "./pages/Progress";
import Exams from "./pages/Exams";
import Games from "./pages/Games";
import ComingSoon from "./pages/ComingSoon";
import { NAV } from "./nav";

const BUILT = new Set(["/", "/courses", "/create", "/teacher", "/settings", "/progress", "/exams", "/games"]);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Account />} />
      <Route element={<AuthGate />}>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:courseId" element={<CourseDetail />} />
        <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonPage />} />
        <Route path="/courses/:courseId/edit" element={<EditCourse />} />
        <Route path="/create" element={<CreateCourse />} />
        <Route path="/teacher" element={<Teacher />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/exams" element={<Exams />} />
        <Route path="/games" element={<Games />} />
        {NAV.filter(n => !BUILT.has(n.path)).map(n => <Route key={n.path} path={n.path} element={<ComingSoon />} />)}
        <Route path="*" element={<ComingSoon />} />
      </Route>
      </Route>
    </Routes>
  );
}
