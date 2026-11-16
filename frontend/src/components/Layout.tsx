/**
 * Gabarit commun : barre de navigation + `<Outlet />` (l'équivalent de `<router-view>`).
 */

import { NavLink, Outlet } from "react-router-dom";

export function Layout() {
  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">
          Streak <span>&amp;</span> Flex
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Streaks
          </NavLink>
          <NavLink to="/archives">Archivés</NavLink>
          <NavLink to="/streaks/new" className="btn btn-primary">
            + Nouveau
          </NavLink>
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
