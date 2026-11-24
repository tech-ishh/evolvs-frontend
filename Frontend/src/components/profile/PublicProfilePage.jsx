import React, { useEffect, useState } from 'react';
import { navigate } from '../../utils/navigate.js';
import './PublicProfilePage.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// "IN" -> { name: "India", flag: "🇮🇳" }
function getCountry(code) {
  if (!code || String(code).length !== 2) return null;
  const cc = String(code).toUpperCase();
  let name = cc;
  try {
    name = new Intl.DisplayNames(['en'], { type: 'region' }).of(cc) || cc;
  } catch { /* keep code */ }
  const flag = String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
  return { name, flag };
}

// Primary identity first, else the first one
function getRole(identities) {
  if (!Array.isArray(identities) || identities.length === 0) return '';
  const primary = identities.find((i) => i?.isPrimary) ?? identities[0];
  return primary?.name ?? '';
}

// Skill can be a string or an object like { name: "Python" }
const skillName = (s) => (typeof s === 'string' ? s : s?.name ?? s?.skillName ?? '');

function formatCount(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(v);
}

function SkillChips({ title, items }) {
  const names = (items || []).map(skillName).filter(Boolean);
  if (names.length === 0) return null;
  return (
    <section className="sp-section">
      <h2 className="sp-section-title">{title}</h2>
      <div className="sp-chips">
        {names.map((n) => (
          <span key={n} className="sp-chip">{n}</span>
        ))}
      </div>
    </section>
  );
}

export default function PublicProfilePage({ username }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [identities, setIdentities] = useState([]);
  const [learning, setLearning] = useState([]);
  const [curious, setCurious] = useState([]);
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('posts'); // 'posts' | 'reels'

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setProfile(null);
    setStats(null);
    setIdentities([]);
    setLearning([]);
    setCurious([]);
    setPosts([]);

    fetch(`${API_BASE_URL}/api/profile/public/${encodeURIComponent(username)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.message || 'Profile not found');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setProfile(data?.profile ?? null);
        setStats(data?.statistics ?? null);
        setIdentities(data?.identities ?? []);

        // ⚠️ Adjust these keys to match what your backend returns
        setLearning(data?.skills?.learning ?? data?.learning ?? data?.currentlyLearning ?? []);
        setCurious(data?.skills?.curious ?? data?.curious ?? data?.curiousAbout ?? []);
        setPosts(data?.posts ?? []);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [username]);

  useEffect(() => {
    if (profile) document.title = `${profile.fullName} (@${profile.username}) | EVOLV`;
  }, [profile]);

  if (loading) {
    return (
      <div className="sp-page">
        <div className="sp-state">Loading profile…</div>
      </div>
    );
  }
  if (error || !profile) {
    return (
      <div className="sp-page">
        <div className="sp-state">
          <p>{error || 'Profile not found'}</p>
          <button className="sp-btn sp-btn-primary" onClick={() => navigate('/')}>Go to EVOLV</button>
        </div>
      </div>
    );
  }

  const initials = (profile.fullName || 'U')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const country = getCountry(profile.countryCode);
  const role = getRole(identities);

  const isReel = (p) => p?.type === 'reel' || p?.type === 'video' || p?.mediaType === 'video';
  const visiblePosts = tab === 'reels' ? posts.filter(isReel) : posts;

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else navigate('/');
  };

  return (
    <div className="sp-page">
      <div className="sp-container">
        {/* Top bar */}
        <header className="sp-topbar">
          <button className="sp-back" onClick={goBack} aria-label="Go back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="sp-topbar-title">@{profile.username}</h1>
        </header>

        {/* Avatar + stats */}
        <div className="sp-head">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.fullName} className="sp-avatar" />
          ) : (
            <div className="sp-avatar sp-avatar-fallback">{initials}</div>
          )}

          <div className="sp-stats">
            {[
              ['Posts', stats?.totalPosts],
              ['Connections', stats?.totalConnections],
              ['Skills', stats?.totalSkills],
            ].map(([label, value]) => (
              <div key={label} className="sp-stat">
                <strong>{formatCount(value)}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Identity */}
        <div className="sp-info">
          <h2 className="sp-name">{profile.fullName}</h2>
          {(role || country) && (
            <p className="sp-meta">
              {role && <span>🎓 {role}</span>}
              {country && <span>{country.flag} {country.name}</span>}
            </p>
          )}
          {profile.bio && <p className="sp-bio">{profile.bio}</p>}
        </div>

        {/* Actions */}
        <div className="sp-actions">
          <button className="sp-btn sp-btn-primary" onClick={() => navigate('/signup')}>
            Join EVOLV to connect
          </button>
          <button className="sp-btn" onClick={() => navigate('/login')}>
            Log in to message
          </button>
        </div>

        <SkillChips title="Currently learning" items={learning} />
        <SkillChips title="Curious about" items={curious} />

        {/* Tabs */}
        <div className="sp-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'posts'}
            className={`sp-tab ${tab === 'posts' ? 'is-active' : ''}`}
            onClick={() => setTab('posts')}
            aria-label="Posts"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
            </svg>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'reels'}
            className={`sp-tab ${tab === 'reels' ? 'is-active' : ''}`}
            onClick={() => setTab('reels')}
            aria-label="Reels"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 8h18M3 16h18M8 3v18M16 3v18" />
            </svg>
          </button>
        </div>

        {/* Posts grid */}
        {visiblePosts.length > 0 ? (
          <div className="sp-grid">
            {visiblePosts.map((p, i) => {
              const thumb = p?.thumbnailUrl || p?.mediaUrl || p?.imageUrl || p?.url;
              return (
                <button
                  key={p?.id ?? i}
                  className="sp-tile"
                  onClick={() => navigate('/signup')}
                  aria-label="View post"
                >
                  {thumb ? (
                    isReel(p) && !p?.thumbnailUrl ? (
                      <video src={thumb} muted preload="metadata" />
                    ) : (
                      <img src={thumb} alt="" loading="lazy" />
                    )
                  ) : (
                    <div className="sp-tile-empty" />
                  )}
                  {isReel(p) && (
                    <svg className="sp-play" width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="sp-empty">
            {tab === 'reels' ? 'No reels yet.' : 'No posts yet.'}
          </p>
        )}
      </div>
    </div>
  );
}
