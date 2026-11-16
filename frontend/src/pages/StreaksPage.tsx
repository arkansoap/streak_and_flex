/**
 * Page d'accueil : toutes les cartes actives (ou archivées sur /archives).
 */

import { Link } from "react-router-dom";

import { useStreaks } from "../hooks/useStreaks";
import { errorMessage } from "../lib/status";
import { StreakCard } from "../components/StreakCard";

interface Props {
  archived?: boolean;
}

export function StreaksPage({ archived = false }: Props) {
  const { data, isPending, isError, error } = useStreaks(archived);

  if (isPending) return <p className="muted">Chargement…</p>;
  if (isError) return <p className="error">{errorMessage(error)}</p>;

  if (data.length === 0) {
    return (
      <div className="empty">
        {archived ? (
          <p>Aucun streak archivé.</p>
        ) : (
          <>
            <h2>Pas encore de streak</h2>
            <p>Crée ton premier suivi : une habitude, un projet, avec trois niveaux pour tenir même les jours difficiles.</p>
            <Link to="/streaks/new" className="btn btn-primary">
              Créer un streak
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <h1>{archived ? "Streaks archivés" : "Mes streaks"}</h1>
      <div className="cards">
        {data.map((streak) => (
          <StreakCard key={streak.id} streak={streak} />
        ))}
      </div>
    </>
  );
}
