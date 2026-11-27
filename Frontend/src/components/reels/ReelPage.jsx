import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft, Heart, Sparkles, CheckCircle2, MessageCircle,
  Volume2, VolumeX, Play,
} from 'lucide-react';
import { authService } from '../../services/authService.js';
import { homePostService, postSkillCache } from '../../services/homePostService.js';
import CommentPanel from '../shared/CommentPanel.jsx';
import { useInView, useLearningTracker } from '../hooks/useLearningTracker.js';
import { navigate } from '../../utils/navigate.js';
import { takeListPosts, clearListPosts } from '../../utils/listPosts.js';
import { enrichCreators } from '../../services/discoverService.js';
import { attachReactionData, getPostLearned } from '../../services/reactionTotals.js';
import "../reels/ReelPage.css";

// ── Type helpers ────────────────────────────────────────────────────────────
const isVideo = (p) => (p.media?.type === 'video' || p.type === 'reel') && p.media?.src;
const isImage = (p) => p.media?.type === 'image' && p.media?.src;
const isMedia = (p) => isVideo(p) || isImage(p);

const fmt = (n = 0) =>
  n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'K' : String(n);
let lastGivenList = null; // survives StrictMode double-run

// Cursor saved by Home so we can continue the same feed
function readCursorInfo() {
  try {
    const info = JSON.parse(sessionStorage.getItem('evolv-reel-cursor') || 'null');
    const start =
      sessionStorage.getItem('evolv-reel-start') ||
      sessionStorage.getItem('evolv-image-start');
    // only trust it if it belongs to this open (avoids stale cursor)
    if (info?.cursor && String(info.startId) === String(start)) return info;
  } catch { /* ignore */ }
  return null;
}

function goBack() {
  const back =
    sessionStorage.getItem('evolv-reel-back') ||
    sessionStorage.getItem('evolv-image-back') ||
    '/home';
  sessionStorage.removeItem('evolv-reel-back');
  sessionStorage.removeItem('evolv-image-back');
  sessionStorage.removeItem('evolv-reel-start');
  sessionStorage.removeItem('evolv-image-start');
  sessionStorage.removeItem('evolv-reel-cursor');
  lastGivenList = null;
  clearListPosts();
  navigate(back);
}


// ─── One feed item (video OR image) ─────────────────────────────────────────
function FeedItem({ post, muted, setMuted, onAppreciate, onHelpful, onLearned, onDiscuss, onOpenProfile }) {
  const video = isVideo(post);

  const itemRef = useRef(null);
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLandscape, setIsLandscape] = useState(false);
  const [tip, setTip] = useState('');
  const pressTimer = useRef(null);
  // ── Learning tracking ──
  const [trackRef, inView] = useInView(0.6);
  useLearningTracker({
    postId: /^\d+$/.test(String(post.id)) ? post.id : null,
    contentType: video ? 'video' : 'image',
    isVisible: inView,
    isPlaying: video ? playing : true, // video counts only while playing
    getCompletion: () => {
      if (!video) return 100;
      const v = videoRef.current;
      return v?.duration ? (v.currentTime / v.duration) * 100 : 0;
    },
  });

  const startPress = (label) => {
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setTip(label), 400);
  };
  const endPress = () => {
    clearTimeout(pressTimer.current);
    setTip('');
  };
  const tipProps = (label) => ({
    onMouseEnter: () => setTip(label),
    onMouseLeave: endPress,
    onTouchStart: () => startPress(label),
    onTouchEnd: endPress,
    onTouchMove: endPress,
    onTouchCancel: endPress,
    onContextMenu: (e) => e.preventDefault(),
  });

  // Auto-play only when this item is mostly visible (videos only)
  useEffect(() => {
    if (!video) return undefined;
    const el = itemRef.current;
    const v = videoRef.current;
    if (!el || !v) return undefined;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.6) {
          v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        } else {
          v.pause();
          v.currentTime = 0;
          setPlaying(false);
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [video]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };

  const creator = post.creator || {};
  const displayName =
    creator.name || creator.username || (creator.id ? `User ${creator.id}` : 'EVOLV member');
  const initial = displayName[0].toUpperCase();
  const backdropSrc = video ? post.media.poster : post.media.src;



  return (
    <section className="rl-item" ref={itemRef} data-post-id={post.id}>
      <div className="rl-card" ref={trackRef}>
        <div className="rl-media">
          {(!video || isLandscape) && backdropSrc && (
            <div
              className="rl-backdrop"
              style={{ backgroundImage: `url(${backdropSrc})` }}
              aria-hidden="true"
            />
          )}

          {video ? (
            <video
              ref={videoRef}
              src={post.media.src}
              poster={post.media.poster}
              className={`rl-video ${isLandscape ? 'rl-video--landscape' : ''}`}
              loop
              playsInline
              muted={muted}
              preload="metadata"
              onClick={togglePlay}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                setIsLandscape(v.videoWidth > v.videoHeight);
              }}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
              }}
            />
          ) : (
            <img
              src={post.media.src}
              alt={post.caption || 'Post image'}
              className="rl-image"
              draggable={false}
            />
          )}
        </div>

        {/* Video-only controls */}
        {video && !playing && (
          <button type="button" className="rl-play" onClick={togglePlay} aria-label="Play">
            <Play size={28} fill="currentColor" />
          </button>
        )}

        {video && (
          <button
            type="button"
            className="rl-mute"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}

        {/* Bottom overlay */}
        <div className="rl-overlay">
          {post.tags?.length > 0 && (
            <div className="rl-tags">
              {post.tags.slice(0, 3).map((t) => <span key={t}>{t}</span>)}
            </div>
          )}
          <div
            className="rl-creator"
            role={creator.id != null ? 'button' : undefined}
            tabIndex={creator.id != null ? 0 : undefined}
            style={creator.id != null ? { cursor: 'pointer' } : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (creator.id != null) onOpenProfile(creator.id);
            }} onKeyDown={(e) => {
              if (e.key === 'Enter' && creator.id != null) onOpenProfile(creator.id);
            }}
            aria-label={`Open ${displayName}'s profile`}
          >
            {creator.avatar ? (
              <img src={creator.avatar} alt={displayName} className="rl-avatar" />
            ) : (
              <span className="rl-avatar rl-avatar-fallback">{initial}</span>
            )}
            <div className="rl-creator-info">
              <strong>{displayName}</strong>
              <span>{post.timestamp}</span>
            </div>
          </div>
          {post.caption && <p className="rl-caption">{post.caption}</p>}
        </div>

        {video && <div className="rl-progress"><span style={{ width: `${progress}%` }} /></div>}

        {/* Actions */}
        <div className="rl-actions">
          <button
            className={`rl-act ${post.appreciated ? 'on pink' : ''}`}
            onClick={() => onAppreciate(post.id)}
            aria-label="Appreciate"
            {...tipProps('Appreciate')}
          >
            {tip === 'Appreciate' && <span className="rl-tooltip" role="tooltip">Appreciate</span>}
            <Heart size={22} fill={post.appreciated ? 'currentColor' : 'none'} />
            <span>{fmt(post.appreciations)}</span>
          </button>

          <button
            className={`rl-act ${post.helpful ? 'on blue' : ''}`}
            onClick={() => onHelpful(post.id)}
            aria-label="Helpful"
            {...tipProps('Helpful')}
          >
            {tip === 'Helpful' && <span className="rl-tooltip" role="tooltip">Helpful</span>}
            <Sparkles size={22} />
            <span>{fmt(post.helpfulCount)}</span>
          </button>

          <button
            className={`rl-act ${post.learned ? 'on green' : ''}`}
            onClick={() => onLearned(post.id)}
            aria-label="Learned"
            {...tipProps('Learned')}
          >
            {tip === 'Learned' && <span className="rl-tooltip" role="tooltip">Learned</span>}
            <CheckCircle2 size={22} />
            <span>{fmt(post.learnedCount)}</span>
          </button>

          <button
            className="rl-act"
            onClick={() => onDiscuss(post.id)}
            aria-label="Discuss"
            {...tipProps('Discuss')}
          >
            {tip === 'Discuss' && <span className="rl-tooltip" role="tooltip">Discuss</span>}
            <MessageCircle size={22} />
            <span>{fmt(post.comments)}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ReelsPage() {
  const user = authService.getCurrentUser();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [commentPostId, setCommentPostId] = useState(null);
  const feedRef = useRef(null);
  const pending = useRef(new Set());
  const postsRef = useRef([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef(null);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const loadErrorRef = useRef(false);

  useEffect(() => { postsRef.current = posts; }, [posts]);

  // Load feed + my posts → keep images AND videos
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let list;
        let pg = { hasMore: false, nextCursor: null };

        const given = takeListPosts() || lastGivenList;
        if (given) lastGivenList = given;
        if (given) {
          // opened from Home / Discover / Profile
          list = given.filter(isMedia);
          const info = readCursorInfo();
          if (info) pg = { hasMore: true, nextCursor: info.cursor };
        } else {
          // opened from Home
          const userId = user?.id ?? user?.userId ?? user?._id ?? null;

          const [feedRes, mine] = await Promise.all([
            homePostService.getFeedPosts().catch(() => ({ posts: [] })),
            homePostService.getMyPosts(userId).catch(() => []),
          ]);

          const feed = (feedRes?.posts ?? []).map((p) => homePostService._normalisePost(p));

          const map = new Map();
          [...(mine || []), ...feed].forEach((p) => {
            if (p?.id && isMedia(p)) map.set(String(p.id), p);
          });
          list = [...map.values()];
          const p = feedRes?.pagination;
          pg = {
            hasMore: Boolean(p?.hasMore && p?.nextCursor),
            nextCursor: p?.nextCursor ?? null,
          };
        }

        const withCreators = await enrichCreators(list);
        const withReactions = await attachReactionData(withCreators);
        const withCounts = await homePostService.attachCommentCounts(withReactions);

        if (!cancelled) {
          cursorRef.current = pg.nextCursor;
          hasMoreRef.current = pg.hasMore;
          setHasMore(pg.hasMore);
          setPosts(withCounts);
        }
      } catch (err) {
        console.error('[Reels] load more failed:', err);
        loadErrorRef.current = true; // stop endless retry on repeated failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jump to the item that was clicked (works for both old keys)
  useEffect(() => {
    if (loading || posts.length === 0) return;

    const startId =
      sessionStorage.getItem('evolv-reel-start') ||
      sessionStorage.getItem('evolv-image-start');
    if (!startId) return;

    const el = feedRef.current?.querySelector(
      `[data-post-id="${CSS.escape(String(startId))}"]`
    );
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });

    // always clear, so a stale id can never win next time
    sessionStorage.removeItem('evolv-reel-start');
    sessionStorage.removeItem('evolv-image-start');
  }, [loading, posts.length]);

  // ── Infinite scroll: load next page of the same feed ──
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || !cursorRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      let cursor = cursorRef.current;
      let more = true;
      let fresh = [];

      // a page may contain only text/doc posts, so try a few pages
      for (let i = 0; i < 5 && more && fresh.length === 0; i++) {
        const res = await homePostService.getPersonalizedFeed(cursor);
        cursor = res.pagination.nextCursor;
        more = res.pagination.hasMore;

        const known = new Set(postsRef.current.map((p) => String(p.id)));
        fresh = res.posts
          .map((raw) => {
            const base = homePostService._normalisePost(raw);
            return {
              ...base,
              tags: base.tags.length ? base.tags : postSkillCache.get(base.id),
            };
          })
          .filter((p) => p?.id && isMedia(p) && !known.has(String(p.id)));
      }

      cursorRef.current = cursor;
      hasMoreRef.current = more;
      setHasMore(more);

      if (fresh.length) {
        const a = await enrichCreators(fresh);
        const b = await attachReactionData(a);
        const c = await homePostService.attachCommentCounts(b);
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => String(p.id)));
          return [...prev, ...c.filter((p) => !seen.has(String(p.id)))];
        });
      }
    } catch (err) {
      console.error('[Reels] load more failed:', err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  // When the 3rd-last item becomes visible, fetch the next page
  useEffect(() => {
    if (loading || loadingMore || !hasMore || posts.length === 0) return undefined;
    if (loadErrorRef.current) return undefined;

    const root = feedRef.current;
    if (!root) return undefined;

    const items = root.querySelectorAll('.rl-item');
    const target = items[Math.max(0, items.length - 3)];
    if (!target) return undefined;

    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, [loading, loadingMore, hasMore, posts.length, loadMore]);

  // Esc = back
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !commentPostId) goBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commentPostId]);

  // Optimistic toggle with rollback (fixed: snapshot taken from ref, not inside setState)
  const toggle = useCallback(async (postId, flag, countKey, onApi, offApi) => {
    const key = `${flag}:${postId}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);

    const snapshot = postsRef.current;
    const current = snapshot.find((p) => String(p.id) === String(postId));
    if (!current) { pending.current.delete(key); return; }

    const was = Boolean(current[flag]);
    const next = !was;

    setPosts((ps) => ps.map((p) =>
      String(p.id) !== String(postId) ? p : {
        ...p,
        [flag]: next,
        [countKey]: Math.max(0, (p[countKey] ?? 0) + (next ? 1 : -1)),
      }));

    try {
      await (was ? offApi() : onApi());
    } catch (err) {
      console.warn('[Feed] reaction failed, rolling back:', err.message);
      setPosts(snapshot);
    } finally {
      pending.current.delete(key);
    }
  }, []);

  const onAppreciate = (id) => toggle(id, 'appreciated', 'appreciations',
    () => homePostService.addReaction(id, 'APPRECIATE'),
    () => homePostService.removeReaction(id, 'APPRECIATE'));
  const onHelpful = (id) => toggle(id, 'helpful', 'helpfulCount',
    () => homePostService.addReaction(id, 'HELPFUL'),
    () => homePostService.removeReaction(id, 'HELPFUL'));
  const syncLearned = useCallback(async (id) => {
    try {
      const l = await getPostLearned(id);
      setPosts((ps) => ps.map((p) => (String(p.id) !== String(id) ? p : { ...p, ...l })));
    } catch (e) {
      console.warn('[syncLearned] failed:', e.message);
    }
  }, []);

  const onLearned = (id) => toggle(id, 'learned', 'learnedCount',
    async () => { await homePostService.markLearned(id); await syncLearned(id); },
    async () => { await homePostService.unmarkLearned(id); await syncLearned(id); });

  const onCommentSync = useCallback((postId, total) => {
    setPosts((ps) => ps.map((p) =>
      String(p.id) !== String(postId) ? p : { ...p, comments: total }));
  }, []);

  const onCommentCount = useCallback((postId, delta) => {
    setPosts((ps) => ps.map((p) =>
      String(p.id) !== String(postId)
        ? p
        : { ...p, comments: Math.max(0, (Number(p.comments) || 0) + delta) }));
  }, []);

  const openProfile = (userId, currentPostId) => {
    sessionStorage.setItem('evolv-list-posts', JSON.stringify(postsRef.current));
    sessionStorage.setItem('evolv-reel-start', String(currentPostId));
    if (cursorRef.current) {
      sessionStorage.setItem(
        'evolv-reel-cursor',
        JSON.stringify({ startId: String(currentPostId), cursor: cursorRef.current })
      );
    }
    navigate(`/profile/${userId}`);
  };

  if (!user) return null;


  return (
    <div className="rl-page">
      <button type="button" className="rl-back" onClick={goBack} aria-label="Back">
        <ArrowLeft size={20} /> <span>Back</span>
      </button>

      {loading ? (
        <div className="rl-empty">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="rl-empty">No posts yet.</div>
      ) : (
        <div className="rl-feed" ref={feedRef}>
          {posts.map((post) => (
            <FeedItem
              key={post.id}
              post={post}
              muted={muted}
              setMuted={setMuted}
              onAppreciate={onAppreciate}
              onHelpful={onHelpful}
              onLearned={onLearned}
              onDiscuss={(id) => setCommentPostId(String(id))}
              onOpenProfile={(userId) => openProfile(userId, post.id)}

            />
          ))}
        </div>
      )}
      {loadingMore && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          padding: '6px 14px', borderRadius: 20, background: 'rgba(0,0,0,.6)',
          color: '#fff', fontSize: 12, zIndex: 20,
        }}>
          Loading more…
        </div>
      )}

      {commentPostId && (
        <CommentPanel
          postId={commentPostId}
          currentUser={user}
          onClose={() => setCommentPostId(null)}
          onCountChange={onCommentCount}
          onCountSync={onCommentSync}
        />
      )}
    </div>
  );
}