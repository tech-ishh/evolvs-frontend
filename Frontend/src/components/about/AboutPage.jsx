import React, { useRef, useState } from 'react';
import {
  ArrowLeft, LogIn, UserPlus, Play, Sparkles, Users, Target,
  BookOpen, Share2, Compass, ArrowUpRight,
} from 'lucide-react';
import { navigate } from '../../utils/navigate.js';
import './AboutPage.css';

/* ───────── VIDEO SETTINGS: change only this block ───────── */
const VIDEO = {
  type: 'file',                         // 'file' or 'youtube'
  src: '/about-video.mp4',              // for 'file': path in /public
  poster: '/about-poster.jpg',          // thumbnail (optional)
  youtubeId: 'YOUR_YOUTUBE_VIDEO_ID',   // for 'youtube': e.g. 'dQw4w9WgXcQ'
};

const STATS = [
  { value: '10K+', label: 'Learners' },
  { value: '50+', label: 'Skill areas' },
  { value: '1M+', label: 'Reactions shared' },
  { value: '100%', label: 'Made in India' },
];

const STEPS = [
  { Icon: Compass, title: 'Discover', text: 'Pick the skills you can do, are learning, or are curious about.' },
  { Icon: Share2, title: 'Share', text: 'Post images, short videos and documents about what you learn.' },
  { Icon: Users, title: 'Connect', text: 'Find people who help you grow and learn together.' },
  { Icon: Target, title: 'Evolve', text: 'Track appreciation, helpful and learned counts as you grow.' },
];

const VALUES = [
  { Icon: BookOpen, title: 'Learning first', text: 'Every feature is built to help you learn something, not just scroll.' },
  { Icon: Users, title: 'Community', text: 'Growth is faster with people. We build real connections, not follower counts.' },
  { Icon: Sparkles, title: 'Positive space', text: 'Appreciation, helpful and learned reactions keep the feed kind and useful.' },
];

function AboutVideo() {
  const videoRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  if (VIDEO.type === 'youtube') {
    return (
      <div className="ab-video-box">
        <iframe
          className="ab-video-frame"
          src={`https://www.youtube.com/embed/${VIDEO.youtubeId}?rel=0`}
          title="About Evolvs"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  const handlePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  };

  return (
    <div className="ab-video-box">
      {failed ? (
        <div className="ab-video-fallback">
          Video could not be loaded. Please try again later.
        </div>
      ) : (
        <video
          ref={videoRef}
          className="ab-video"
          src={VIDEO.src}
          poster={VIDEO.poster}
          controls={started}
          playsInline
          preload="metadata"
          onPlay={() => setStarted(true)}
          onEnded={() => setStarted(false)}
          onError={() => setFailed(true)}
        />
      )}

      {!started && !failed && (
        <button
          type="button"
          className="ab-play-btn"
          onClick={handlePlay}
          aria-label="Play video"
        >
          <Play size={30} fill="currentColor" />
        </button>
      )}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="ab-page">
      <div className="ab-frame">

        {/* Navbar */}
        <header className="ab-nav">
          <button type="button" className="ab-nav-back" onClick={() => navigate('/')}>
            <ArrowLeft size={18} /> Home
          </button>

          <img src="/logo-remove.png" alt="Evolvs" className="ab-nav-logo" />

          <div className="ab-nav-actions">
            <button type="button" className="ab-nav-login" onClick={() => navigate('/login')}>
              <LogIn size={16} /> <span>Login</span>
            </button>
            <button type="button" className="ab-btn ab-btn--primary" onClick={() => navigate('/signup')}>
              <UserPlus size={16} /> <span>Sign Up</span>
            </button>
          </div>
        </header>

        {/* Hero */}
        <section className="ab-hero">
          <p className="ab-kicker">About Us</p>
          <h1 className="ab-title">Built for people who want to evolve.</h1>
          <p className="ab-sub">
            Evolvs is a human growth network. Discover skills, share what you know,
            and connect with people who help you grow.
          </p>
        </section>

        {/* Video */}
        <section className="ab-video-section" aria-label="About Evolvs video">
          <AboutVideo />
          <p className="ab-video-caption">Watch our story in under two minutes.</p>
        </section>

        {/* Stats */}
        <section className="ab-stats">
          {STATS.map((s) => (
            <div className="ab-stat" key={s.label}>
              <span className="ab-stat-value">{s.value}</span>
              <span className="ab-stat-label">{s.label}</span>
            </div>
          ))}
        </section>

        {/* Mission + Vision */}
        <section className="ab-split">
          <article className="ab-card ab-card--purple">
            <h2>Our mission</h2>
            <p>
              To turn screen time into growth time. We want every hour spent on Evolvs to
              teach you something, connect you with someone, or move you closer to a goal.
            </p>
          </article>
          <article className="ab-card">
            <h2>Our vision</h2>
            <p>
              A world where learning is social, kind and rewarding, and where anyone,
              anywhere in India, can find their people and grow with them.
            </p>
          </article>
        </section>

        {/* How it works */}
        <section className="ab-section">
          <h2 className="ab-h2">How Evolvs works</h2>
          <div className="ab-steps">
            {STEPS.map(({ Icon, title, text }, i) => (
              <article className="ab-step" key={title}>
                <span className="ab-step-num">{i + 1}</span>
                <span className="ab-icon"><Icon size={22} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Values */}
        <section className="ab-section">
          <h2 className="ab-h2">What we believe in</h2>
          <div className="ab-values">
            {VALUES.map(({ Icon, title, text }) => (
              <article className="ab-card" key={title}>
                <span className="ab-icon ab-icon--purple"><Icon size={22} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="ab-cta">
          <h2>Ready to start evolving?</h2>
          <p>Join Evolvs today and make your time online count.</p>
          <div className="ab-cta-actions">
            <button type="button" className="ab-btn ab-btn--dark" onClick={() => navigate('/signup')}>
              Join Evolvs <ArrowUpRight size={16} />
            </button>
            <button type="button" className="ab-btn ab-btn--ghost" onClick={() => navigate('/login')}>
              I already have an account
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="ab-footer">
          <span>© {new Date().getFullYear()} Evolvs. All rights reserved.</span>
          <nav>
            <button type="button" onClick={() => navigate('/terms')}>Terms</button>
            <button type="button" onClick={() => navigate('/privacy')}>Privacy</button>
          </nav>
        </footer>
      </div>
    </div>
  );
}