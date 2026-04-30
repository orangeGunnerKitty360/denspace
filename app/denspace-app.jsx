"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  Home,
  Image,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  Map,
  MessageCircle,
  Palette,
  Scissors,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Upload,
  UsersRound,
  X
} from "lucide-react";
import { authClient } from "../lib/auth/client";

const circles = [];
const events = [];
const postKinds = ["art", "meetup", "making"];

function getDisplayUser(user) {
  return user ? {
    name: user.name || user.email,
    handle: user.email,
    avatar: (user.name || user.email || "You").slice(0, 3),
    avatarClass: "avatar-sun",
    picture: user.image || ""
  } : {
    name: "You",
    handle: "Email sign-in required",
    avatar: "You",
    avatarClass: "avatar-sun"
  };
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DenSpaceApp() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const user = session?.user || null;
  const displayUser = getDisplayUser(user);
  const [authMode, setAuthMode] = useState("sign-up");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", remember: true });
  const [authNote, setAuthNote] = useState("Your account and sessions are handled by Neon Auth.");
  const [posts, setPosts] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeKind, setActiveKind] = useState("art");
  const [search, setSearch] = useState("");
  const [postText, setPostText] = useState("");
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState("");
  const [feedNote, setFeedNote] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  const authVisible = !isPending && !user;

  const fetchPosts = async () => {
    const params = new URLSearchParams({ filter: activeFilter, q: search });
    const response = await fetch(`/api/posts?${params}`);
    if (!response.ok) {
      setFeedNote("Connect Neon Postgres to load the shared feed.");
      return;
    }

    const data = await response.json();
    setPosts(data.posts || []);
    setFeedNote("");
  };

  useEffect(() => {
    fetchPosts();
  }, [activeFilter, search]);

  useEffect(() => {
    if (!selectedUpload) {
      setUploadPreviewUrl("");
      return undefined;
    }

    const url = URL.createObjectURL(selectedUpload);
    setUploadPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedUpload]);

  const visiblePosts = useMemo(() => posts, [posts]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthNote("Checking your account...");

    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;
    const name = authForm.name.trim();

    if (authMode === "sign-up" && !name) {
      setAuthNote("Enter a display name to create your account.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthNote("Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setAuthNote("Use a password with at least 8 characters.");
      return;
    }

    let response;
    setIsAuthSubmitting(true);
    try {
      response = authMode === "sign-up"
        ? await authClient.signUp.email({
          email,
          password,
          name,
          rememberMe: authForm.remember
        })
        : await authClient.signIn.email({
          email,
          password,
          rememberMe: authForm.remember
        });
    } catch (error) {
      setAuthNote(error?.message || "Neon Auth could not be reached. Please try again.");
      setIsAuthSubmitting(false);
      return;
    }
    setIsAuthSubmitting(false);

    if (response?.error) {
      setAuthNote(response.error.message || "Neon Auth could not sign you in yet.");
      return;
    }

    setAuthNote(authForm.remember ? "Signed in and remembered on this device." : "Signed in for this browser session.");
    await refetch();
    await fetchPosts();
  }

  async function handleSignOut() {
    await authClient.signOut();
    await refetch();
  }

  async function createPost() {
    const text = postText.trim();
    if (!user) {
      setAuthNote("Sign in before posting.");
      return;
    }

    if (!text && !selectedUpload) {
      setFeedNote("Add text or an image before posting.");
      return;
    }

    setIsPosting(true);
    setFeedNote("");
    const formData = new FormData();
    formData.set("text", text);
    formData.set("kind", activeKind);
    if (selectedUpload) formData.set("image", selectedUpload);

    const response = await fetch("/api/posts", {
      method: "POST",
      body: formData
    });

    setIsPosting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setFeedNote(data.details || data.error || "The post could not be saved yet.");
      return;
    }

    const data = await response.json();
    setPosts((current) => [data.post, ...current]);
    setPostText("");
    setSelectedUpload(null);
  }

  async function toggleReaction(postId, reaction) {
    if (!user) {
      setAuthNote("Sign in before reacting.");
      return;
    }

    const response = await fetch(`/api/posts/${postId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reaction })
    });

    if (!response.ok) return;
    const data = await response.json();
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, reactions: data.reactions } : post));
  }

  return (
    <>
      <section id="authGate" className={`auth-gate ${authVisible ? "" : "hidden"}`} aria-label="Sign in">
        <div className="auth-card">
          <span className="brand-mark">D</span>
          <div>
            <p>Your Den</p>
            <h1>{authMode === "sign-up" ? "Create your DenSpace account" : "Sign in to DenSpace"}</h1>
          </div>
          <form className="email-auth-form" onSubmit={handleAuthSubmit} noValidate>
            {authMode === "sign-up" && (
              <label>
                <span>Display name</span>
                <input value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} name="displayName" type="text" autoComplete="name" maxLength="40" required placeholder="Your name" />
              </label>
            )}
            <label>
              <span>Email</span>
              <input value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
            </label>
            <label>
              <span>Password</span>
              <input value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} name="password" type="password" autoComplete={authMode === "sign-up" ? "new-password" : "current-password"} minLength="8" required placeholder="At least 8 characters" />
            </label>
            <label className="remember-option">
              <input checked={authForm.remember} onChange={(event) => setAuthForm({ ...authForm, remember: event.target.checked })} name="rememberMe" type="checkbox" />
              <span>Remember me</span>
            </label>
            <button className="email-signup-button" type="submit" disabled={isAuthSubmitting}>
              <Mail /> {isAuthSubmitting ? (authMode === "sign-up" ? "Creating account..." : "Signing in...") : (authMode === "sign-up" ? "Sign up with email" : "Sign in with email")}
            </button>
            <div className="auth-mode-row">
              <button className="secondary-auth-button" type="button" onClick={() => setAuthMode(authMode === "sign-up" ? "sign-in" : "sign-up")}>
                {authMode === "sign-up" ? "Already have an account?" : "Need an account?"}
              </button>
            </div>
          </form>
          <p className="auth-note">{authNote}</p>
        </div>
      </section>

      <div className="app-shell">
        <aside className="sidebar" aria-label="Primary">
          <a className="brand" href="#" aria-label="DenSpace home">
            <span className="brand-mark">D</span>
            <span>DenSpace</span>
          </a>
          <nav className="nav-list" aria-label="Sections">
            <button className="nav-item active" type="button"><Home /><span>Home</span></button>
            <button className="nav-item" type="button"><UsersRound /><span>Circles</span></button>
            <button className="nav-item" type="button"><CalendarDays /><span>Meetups</span></button>
            <button className="nav-item" type="button"><Palette /><span>Studio</span></button>
            <button className="nav-item" type="button"><ShieldCheck /><span>Safety</span></button>
          </nav>
          <div className="mini-profile">
            <div className={`avatar ${displayUser.avatarClass}`}>{displayUser.picture ? <img src={displayUser.picture} alt="" /> : displayUser.avatar}</div>
            <div>
              <strong>{displayUser.name}</strong>
              <span>{displayUser.handle}</span>
            </div>
            <button className="profile-signout" type="button" aria-label="Sign out" onClick={handleSignOut}><LogOut /></button>
          </div>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <label className="search" aria-label="Search DenSpace">
              <Search />
              <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search posts, tags, makers" />
            </label>
            <div className="top-actions">
              <button className="top-auth-button" type="button" onClick={user ? handleSignOut : () => setAuthNote("Sign in or create an account to continue.")}>{user ? <LogOut /> : <LogIn />} {user ? "Sign out" : "Sign in"}</button>
              <button className="icon-button" type="button" aria-label="Notifications"><Bell /></button>
              <button className="icon-button" type="button" aria-label="Messages"><MessageCircle /></button>
            </div>
          </header>

          <section className="hero" aria-label="Community spotlight">
            <img src="/assets/frutiger-aero-banner.png" alt="Glossy Frutiger Aero community lounge illustration" />
            <div className="hero-overlay">
              <p>Your Den</p>
              <h1>Start Your Feed</h1>
              <div className="hero-meta">
                <span><LockKeyhole /> Neon Auth</span>
                <span><Upload /> Vercel Blob uploads</span>
              </div>
            </div>
          </section>

          <section className="composer" aria-label="Create post">
            <div className="avatar avatar-mint">You</div>
            <div className="composer-panel">
              <label className="post-text-field" htmlFor="postText">
                <span>Post text</span>
                <textarea id="postText" value={postText} onChange={(event) => setPostText(event.target.value)} rows="4" maxLength="280" placeholder="Write a caption, update, or text-only post" />
              </label>
              <div className="text-meter"><span>{postText.length}</span>/280</div>
              {selectedUpload && (
                <div className="upload-preview">
                  <img src={uploadPreviewUrl} alt="Selected upload preview" />
                  <div>
                    <strong>{selectedUpload.name}</strong>
                    <span>{selectedUpload.type.replace("image/", "").toUpperCase()} · {formatBytes(selectedUpload.size)}</span>
                  </div>
                  <button className="remove-upload" type="button" aria-label="Remove selected upload" onClick={() => setSelectedUpload(null)}><X /></button>
                </div>
              )}
              <div className="composer-footer">
                <div className="composer-tools" aria-label="Post type">
                  <button type="button" className={`tool-chip ${activeKind === "art" ? "active" : ""}`} onClick={() => setActiveKind("art")}><Image /> Art</button>
                  <button type="button" className={`tool-chip ${activeKind === "meetup" ? "active" : ""}`} onClick={() => setActiveKind("meetup")}><Map /> Meetup</button>
                  <button type="button" className={`tool-chip ${activeKind === "making" ? "active" : ""}`} onClick={() => setActiveKind("making")}><Scissors /> Making</button>
                </div>
                <div className="composer-actions">
                  <label className="upload-button" htmlFor="postImage"><Upload /> Upload</label>
                  <input id="postImage" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => setSelectedUpload(event.target.files?.[0] || null)} />
                  <button className="primary-button" type="button" onClick={createPost} disabled={isPosting}><Send /> {isPosting ? "Posting" : "Post"}</button>
                </div>
              </div>
              {feedNote && <p className="composer-status">{feedNote}</p>}
            </div>
          </section>

          <div className="content-grid">
            <section className="feed-column" aria-label="Community feed">
              <div className="filter-row" aria-label="Feed filters">
                {["all", ...postKinds].map((filter) => (
                  <button key={filter} className={`filter-pill ${activeFilter === filter ? "active" : ""}`} type="button" onClick={() => setActiveFilter(filter)}>{filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1)}</button>
                ))}
              </div>
              <div className="feed">
                {visiblePosts.length ? visiblePosts.map((post) => (
                  <article className="post-card" key={post.id}>
                    <header className="post-head">
                      <div className={`avatar ${post.avatarClass}`}>{post.avatar}</div>
                      <div className="post-author">
                        <strong>{post.author}</strong>
                        <span>{post.handle} · <span className="post-time">{post.time}</span></span>
                      </div>
                      <span className="post-tag">{post.kind}</span>
                    </header>
                    {post.text && <p className={`post-body ${post.upload ? "" : "text-only-post"}`}>{post.text}</p>}
                    {post.upload && (
                      <figure className="post-upload">
                        <img src={post.upload.src} alt={post.upload.name} />
                      </figure>
                    )}
                    <footer className="post-actions">
                      <div className="reaction-group">
                        {Object.entries(post.reactions).map(([label, count]) => (
                          <button className="reaction" type="button" key={label} onClick={() => toggleReaction(post.id, label)}>
                            {label} <span>{count}</span>
                          </button>
                        ))}
                      </div>
                      <button className="share-button" type="button" aria-label="Share post"><Share2 /></button>
                    </footer>
                  </article>
                )) : (
                  <article className="post-card empty-state">
                    <div className="avatar avatar-mint">You</div>
                    <div>
                      <strong>{feedNote || "No posts yet."}</strong>
                      <p className="post-body">{feedNote ? "Once Neon and Blob environment variables are connected, the shared feed will appear here." : "Upload an image or write a post to start your feed."}</p>
                    </div>
                  </article>
                )}
              </div>
            </section>

            <aside className="right-rail">
              <section className="panel">
                <div className="panel-header">
                  <h2>Your Circles</h2>
                  <button className="ghost-button" type="button">New</button>
                </div>
                <div className="circle-list">
                  {circles.length ? null : <div className="circle"><div><strong>No circles yet</strong><span className="circle-meta">Create one when you are ready.</span></div></div>}
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <h2>Your Meetups</h2>
                  <button className="ghost-button" type="button">Add</button>
                </div>
                <div className="event-list">
                  {events.length ? null : <div className="event"><div><strong>No meetups yet</strong><span className="event-meta">Add your own plans here.</span></div></div>}
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <h2>Studio Queue</h2>
                  <button className="ghost-button" type="button">Board</button>
                </div>
                <div className="queue-list">
                  <div><span>No studio items yet</span><strong>Empty</strong></div>
                </div>
              </section>

              <section className="panel safety-panel">
                <div className="panel-header">
                  <h2>Safety Tools</h2>
                  <button className="ghost-button" type="button">Settings</button>
                </div>
                <label><input type="checkbox" defaultChecked /> Hide untagged mature posts</label>
                <label><input type="checkbox" defaultChecked /> Mutuals-only DMs</label>
                <label><input type="checkbox" /> Quiet con-mode</label>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </>
  );
}
