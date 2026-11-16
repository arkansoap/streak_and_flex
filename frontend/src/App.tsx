/** Table de routage. Chaque page est un composant ; `Layout` enveloppe tout. */

import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { StreakDetailPage } from "./pages/StreakDetailPage";
import { StreakFormPage } from "./pages/StreakFormPage";
import { StreaksPage } from "./pages/StreaksPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<StreaksPage />} />
        <Route path="archives" element={<StreaksPage archived />} />
        <Route path="streaks/new" element={<StreakFormPage />} />
        <Route path="streaks/:id" element={<StreakDetailPage />} />
        <Route path="streaks/:id/edit" element={<StreakFormPage />} />
      </Route>
    </Routes>
  );
}
