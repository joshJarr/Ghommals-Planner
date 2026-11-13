import {useEffect} from 'react';
import {Link} from 'react-router-dom';
import './home.css';

export default function Home(){
  useEffect(()=>{document.title="OSRS Planners — Combat Achievements & Collection Log"},[]);
  return (
    <div className="home">
      <div className="home-glow" aria-hidden="true"/>
      <header className="home-brand">
        <div className="home-mark">⚔</div>
        <div>
          <p className="home-eyebrow">OLD SCHOOL RUNESCAPE</p>
          <h1>OSRS Planners</h1>
        </div>
      </header>
      <p className="home-lede">
        Track progress, shortlist goals, and project reward ranks — for Combat Achievements and the Collection Log.
      </p>
      <nav className="home-links" aria-label="Planners">
        <Link className="home-card" to="/ghommals">
          <span className="home-card-icon">⚔</span>
          <span className="home-card-body">
            <strong>Ghommal's Planner</strong>
            <small>Combat Achievements · tiers · aspirational points</small>
          </span>
          <span className="home-card-go" aria-hidden="true">→</span>
        </Link>
        <Link className="home-card" to="/collectors">
          <span className="home-card-icon">📜</span>
          <span className="home-card-body">
            <strong>Collector's Planner</strong>
            <small>Collection Log · staff ranks · sources</small>
          </span>
          <span className="home-card-go" aria-hidden="true">→</span>
        </Link>
      </nav>
      <footer className="home-foot">
        Unofficial fan tools · sync via{' '}
        <a href="https://www.runeprofile.com/" target="_blank" rel="noreferrer">RuneProfile</a>
        {' · '}
        <a href="https://github.com/joshJarr/Ghommals-Planner/issues" target="_blank" rel="noreferrer">Report an issue</a>
      </footer>
    </div>
  );
}
