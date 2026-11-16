/**
 * Gabarit commun : barre de navigation + `<Outlet />` (l'équivalent de `<router-view>`).
 *
 * Responsive : au-dessus de 640 px, une barre en haut (texte seul). En dessous, les
 * mêmes liens deviennent une barre d'onglets fixée en bas de l'écran, icône + libellé,
 * à portée de pouce. C'est le CSS qui bascule (`.topbar nav`), pas le composant.
 */

import { NavLink, Outlet } from "react-router-dom";

const LINKS = [
  { to: "/", label: "Streaks", end: true, icon: "M4 19h16M4 14l4-4 4 3 8-8" },
  { to: "/archives", label: "Archivés", end: false, icon: "M4 7h16v3H4zM5 10v9h14v-9M10 14h4" },
  { to: "/streaks/new", label: "Nouveau", end: false, icon: "M12 5v14M5 12h14", primary: true },
];

export function Layout() {
  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">
          Streak <span>&amp;</span> Flex
        </NavLink>
        <nav aria-label="Navigation principale">
          {LINKS.map(({ to, label, end, icon, primary }) => (
            <NavLink key={to} to={to} end={end} className={primary ? "nav-link nav-primary" : "nav-link"}>
              <svg className="nav-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d={icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{primary ? "+ Nouveau" : label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
