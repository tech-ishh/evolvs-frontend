import React, { useEffect, useState } from 'react';
import { navigate } from '../../utils/navigate.js';
import './ProfilePage.css';

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

export default function PublicProfilePage({ username }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [identities, setIdentities] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setProfile(null);
    setStats(null);
    setIdentities([]);

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
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [username]);

  useEffect(() => {
    if (profile) document.title = `${profile.fullName} (@${profile.username}) | EVOLV`;
  }, [profile]);

  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;
  if (error || !profile) return <p style={{ padding: 24 }}>{error || 'Profile not found'}</p>;

  const initials = (profile.fullName || 'U')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const country = getCountry(profile.countryCode);
  const role = getRole(identities);

  return (
    <div className="pp-content" style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <div className="pp-hero-card">
        <div className="pp-hero-body">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.fullName} className="pp-hero-avatar" />
          ) : (
            <div className="pp-hero-avatar-fallback">{initials}</div>
          )}

          <h1 className="pp-hero-name">{profile.fullName}</h1>
          <p className="pp-hero-username">@{profile.username}</p>

          {/* Role + Country */}
          {(role || country) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8, color: '#5b4b73', fontSize: 14 }}>
              {role && <span>🎓 {role}</span>}
              {country && <span>{country.flag} {country.name}</span>}
            </div>
          )}

          {profile.bio && <p className="pp-hero-bio">{profile.bio}</p>}

          {/* Stats */}
          {stats && (
            <div style={{ display: 'flex', gap: 28, marginTop: 16 }}>
              {[
                ['Skills', stats.totalSkills],
                ['Posts', stats.totalPosts],
                ['Connections', stats.totalConnections],
              ].map(([label, value]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <strong style={{ display: 'block', fontSize: 18, color: '#2d1b4e' }}>{value ?? 0}</strong>
                  <span style={{ fontSize: 12, color: '#8b7aa3' }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button className="pp-edit-btn" onClick={() => navigate('/signup')}>
              Join EVOLV to connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}