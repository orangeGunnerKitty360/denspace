"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  Crown,
  Download,
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

const events = [];
const postKinds = ["art", "meetup", "making"];
const ownerNames = new Set(["frutigerfloppa"]);
const denSpaceIcon = "/assets/denspace-icon.png";
const banSound = "/assets/Microsoft%20Windows%2095%20Error%20-%20Sound%20Effect%20%28HD%29.mp3";
const liveAppUrl = "https://denspace.vercel.app/";
const iphoneProfileUrl = "https://denspace.vercel.app/iphone-profile.mobileconfig";

function isAppleMobileBrowser(navigatorObject) {
  const userAgent = navigatorObject.userAgent || "";
  return /iphone|ipad|ipod/i.test(userAgent) || (navigatorObject.platform === "MacIntel" && navigatorObject.maxTouchPoints > 1);
}

function isOwnerName(name) {
  return ownerNames.has(String(name || "").trim().toLowerCase());
}

function OwnerBadge() {
  return (
    <span className="owner-badge" title="Owner">
      <Crown /> Owner
    </span>
  );
}

function UserBadge() {
  return (
    <span className="user-badge" title="User">
      <UsersRound /> User
    </span>
  );
}

function ProfileBadge({ name }) {
  return isOwnerName(name) ? <OwnerBadge /> : <UserBadge />;
}

function InstallGuide({ device }) {
  const isIphone = device === "iphone";

  return (
    <div className="install-guide" role="status">
      <div className="install-guide-head">
        <span className="install-guide-icon"><img src={denSpaceIcon} alt="" /></span>
        <div>
          <strong>{isIphone ? "Install DenSpace on iPhone" : "Install DenSpace on mobile"}</strong>
          <span>{isIphone ? "Use Safari so iOS can add the app icon." : "Use your phone browser to add the app icon."}</span>
        </div>
      </div>
      <ol>
        <li>{isIphone ? "Tap Download iPhone Profile." : "Open DenSpace on your phone."}</li>
        <li>{isIphone ? "Open Settings and tap Profile Downloaded." : "Open the browser menu."}</li>
        <li>{isIphone ? "Tap Install to add DenSpace." : "Tap Install app or Add to Home screen."}</li>
      </ol>
      {isIphone ? (
        <a className="install-open-link" href={iphoneProfileUrl}>Download iPhone Profile</a>
      ) : (
        <a className="install-open-link" href={liveAppUrl} target="_blank" rel="noreferrer">Open DenSpace</a>
      )}
    </div>
  );
}

function UserAvatar({ avatar, picture, className = "", label = "" }) {
  return (
    <div className={`avatar ${className}`}>
      {picture ? <img src={picture} alt={label} /> : avatar}
    </div>
  );
}

function getDisplayUser(user, profile) {
  return user ? {
    name: user.name || user.email,
    handle: user.email,
    avatar: (user.name || user.email || "You").slice(0, 3),
    avatarClass: "avatar-sun",
    picture: profile?.avatarUrl || user.image || ""
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
  const [activeScreen, setActiveScreen] = useState("home");
  const [authMode, setAuthMode] = useState("sign-up");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", remember: true });
  const [authNote, setAuthNote] = useState("Your account and sessions are handled by Neon Auth.");
  const [profile, setProfile] = useState(null);
  const [profileNote, setProfileNote] = useState("");
  const [isUploadingProfilePicture, setIsUploadingProfilePicture] = useState(false);
  const [posts, setPosts] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeKind, setActiveKind] = useState("art");
  const [search, setSearch] = useState("");
  const [postText, setPostText] = useState("");
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState("");
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentingPosts, setCommentingPosts] = useState({});
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatForm, setChatForm] = useState({ name: "Den Lounge", icon: "DL" });
  const [chatEditForm, setChatEditForm] = useState({ name: "", icon: "" });
  const [chatNote, setChatNote] = useState("");
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isSavingChat, setIsSavingChat] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [feedNote, setFeedNote] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [banNotice, setBanNotice] = useState(null);
  const [banAudioKey, setBanAudioKey] = useState(0);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installNote, setInstallNote] = useState("");
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [installDevice, setInstallDevice] = useState("phone");
  const [isStandalone, setIsStandalone] = useState(false);
  const banAudioBufferRef = useRef(null);
  const banAudioContextRef = useRef(null);
  const banAudioSourceRef = useRef(null);
  const banAudioElementRef = useRef(null);
  const banSoundRetryRef = useRef(null);
  const banSoundUnmuteTimerRef = useRef(null);
  const banSoundUnlockedRef = useRef(false);
  const banSoundUnlockingRef = useRef(null);
  const profileImageInputRef = useRef(null);

  const displayUser = getDisplayUser(user, profile);
  const authVisible = !isPending && !user;
  const isBanned = Boolean(user && banNotice);
  const installButtonText = isStandalone ? "Installed" : (installDevice === "iphone" ? "Download iPhone Profile" : "Get mobile app");

  function showBanFromResponse(status, data) {
    const banText = `${data?.error || ""} ${data?.details || ""}`;
    if (status !== 403 || !/ban/i.test(banText)) {
      return false;
    }

    playBanSound();
    setBanNotice({
      error: data?.error || "This account has been permanently banned.",
      details: data?.details || "This account cannot use DenSpace.",
      permanent: data?.permanent !== false
    });
    return true;
  }

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

  const fetchChats = async () => {
    const response = await fetch("/api/chats");
    if (!response.ok) {
      setChatNote("Connect Neon Postgres to load group chats.");
      return;
    }

    const data = await response.json();
    const nextChats = data.chats || [];
    setChats(nextChats);
    setSelectedChatId((current) => current || nextChats[0]?.id || "");
    setChatNote("");
  };

  const fetchChatMessages = async (chatId) => {
    if (!chatId) {
      setChatMessages([]);
      return;
    }

    const response = await fetch(`/api/chats/${chatId}/messages`);
    if (!response.ok) {
      setChatNote("Messages could not be loaded yet.");
      return;
    }

    const data = await response.json();
    setChatMessages(data.messages || []);
  };

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setProfileNote("");
      return;
    }

    const response = await fetch("/api/account/profile");
    if (!response.ok) {
      setProfileNote("Profile picture could not be loaded yet.");
      return;
    }

    const data = await response.json();
    setProfile(data.profile || null);
    setProfileNote("");
  };

  useEffect(() => {
    fetchPosts();
  }, [activeFilter, search]);

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    fetchChatMessages(selectedChatId);
  }, [selectedChatId]);

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setBanNotice(null);
      return undefined;
    }

    let cancelled = false;
    const checkBanStatus = async () => {
      const response = await fetch("/api/account/status");
      const data = await response.json().catch(() => ({}));

      if (cancelled || !response.ok) return;

      setBanNotice(data.banned ? {
        error: data.error || "This account has been permanently banned.",
        details: data.details || data.reason || "This account cannot use DenSpace.",
        permanent: data.permanent !== false
      } : null);
    };

    checkBanStatus();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!isBanned || typeof window === "undefined") {
      clearBanSoundRetry();
      stopBanSound();
      return;
    }

    const playWhenVisible = () => {
      if (document.visibilityState === "visible") {
        playBanScreenSound();
      }
    };

    playBanScreenSound();
    window.addEventListener("focus", playBanScreenSound);
    window.addEventListener("pageshow", playBanScreenSound);
    document.addEventListener("visibilitychange", playWhenVisible);

    return () => {
      clearBanSoundRetry();
      window.removeEventListener("focus", playBanScreenSound);
      window.removeEventListener("pageshow", playBanScreenSound);
      document.removeEventListener("visibilitychange", playWhenVisible);
    };
  }, [isBanned, user?.id, banNotice?.error, banNotice?.details]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    loadBanSoundBuffer().catch(() => {});
    const unlockFromInteraction = () => {
      unlockBanSound().catch(() => {});
    };
    window.addEventListener("pointerdown", unlockFromInteraction, { passive: true, capture: true });
    window.addEventListener("touchstart", unlockFromInteraction, { passive: true, capture: true });
    window.addEventListener("keydown", unlockFromInteraction, { capture: true });

    return () => {
      window.removeEventListener("pointerdown", unlockFromInteraction, { capture: true });
      window.removeEventListener("touchstart", unlockFromInteraction, { capture: true });
      window.removeEventListener("keydown", unlockFromInteraction, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (!selectedUpload) {
      setUploadPreviewUrl("");
      return undefined;
    }

    const url = URL.createObjectURL(selectedUpload);
    setUploadPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedUpload]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const updateStandalone = () => {
      setIsStandalone(Boolean(standaloneQuery.matches || window.navigator.standalone));
    };
    const captureInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      setInstallNote("");
    };
    const handleInstalled = () => {
      setIsStandalone(true);
      setInstallPrompt(null);
      setInstallGuideOpen(false);
      setInstallNote("DenSpace is ready on your home screen.");
    };

    updateStandalone();
    setInstallDevice(isAppleMobileBrowser(window.navigator) ? "iphone" : (/android/i.test(window.navigator.userAgent) ? "android" : "phone"));
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    standaloneQuery.addEventListener?.("change", updateStandalone);

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      standaloneQuery.removeEventListener?.("change", updateStandalone);
    };
  }, []);

  const visiblePosts = useMemo(() => posts, [posts]);
  const activeChat = useMemo(() => chats.find((chat) => chat.id === selectedChatId) || null, [chats, selectedChatId]);

  useEffect(() => {
    if (!activeChat) {
      setChatEditForm({ name: "", icon: "" });
      return;
    }

    setChatEditForm({ name: activeChat.name, icon: activeChat.icon });
  }, [activeChat]);

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
    await fetchProfile();
    await fetchPosts();
    await fetchChats();
  }

  async function handleProfilePictureChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileNote("Choose an image file for your profile picture.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileNote("Profile pictures must be 5 MB or smaller.");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);
    setIsUploadingProfilePicture(true);
    setProfileNote("Uploading profile picture...");

    try {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        body: formData
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (!showBanFromResponse(response.status, data)) {
          setProfileNote(data.error || "Profile picture could not be uploaded.");
        }
        return;
      }

      setProfile(data.profile || null);
      setProfileNote("Profile picture updated.");
      await fetchPosts();
      await fetchChatMessages(selectedChatId);
    } catch {
      setProfileNote("Profile picture could not be uploaded.");
    } finally {
      setIsUploadingProfilePicture(false);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    setBanNotice(null);
    setProfile(null);
    setProfileNote("");
    await refetch();
  }

  function getBanAudioContext() {
    if (typeof window === "undefined") return null;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!banAudioContextRef.current) {
      banAudioContextRef.current = new AudioContextClass();
    }

    return banAudioContextRef.current;
  }

  async function loadBanSoundBuffer() {
    if (banAudioBufferRef.current) return banAudioBufferRef.current;

    const context = getBanAudioContext();
    if (!context) return null;

    const response = await fetch(banSound);
    const data = await response.arrayBuffer();
    banAudioBufferRef.current = await context.decodeAudioData(data);
    return banAudioBufferRef.current;
  }

  async function unlockBanSound() {
    if (banSoundUnlockedRef.current) return true;
    if (banSoundUnlockingRef.current) return banSoundUnlockingRef.current;

    banSoundUnlockingRef.current = (async () => {
      const context = getBanAudioContext();
      if (!context) return false;

      await context.resume();
      const silentBuffer = context.createBuffer(1, 1, 22050);
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = 0;
      source.buffer = silentBuffer;
      source.connect(gain);
      gain.connect(context.destination);
      source.start(0);

      const unlocked = context.state === "running";
      banSoundUnlockedRef.current = unlocked;
      loadBanSoundBuffer().catch(() => {});
      return unlocked;
    })().finally(() => {
      banSoundUnlockingRef.current = null;
    });

    return banSoundUnlockingRef.current;
  }

  async function playBanSoundWithElement() {
    try {
      const audio = banAudioElementRef.current || new Audio(banSound);
      banAudioElementRef.current = audio;
      audio.autoplay = true;
      audio.loop = false;
      audio.playsInline = true;
      audio.preload = "auto";
      audio.volume = 1;
      audio.currentTime = 0;
      if (audio.readyState === 0) {
        audio.load();
      }
      audio.muted = false;
      try {
        await audio.play();
        return !audio.muted;
      } catch {
        audio.muted = true;
        await audio.play();
        unmuteBanSound();
        return false;
      }
    } catch {
      return false;
    }
  }

  async function playBanSound() {
    const elementPlayed = await playBanSoundWithElement();
    if (elementPlayed) return true;

    try {
      const context = getBanAudioContext();
      if (!context) return false;

      await context.resume();
      if (context.state !== "running") return false;

      const buffer = await loadBanSoundBuffer();
      if (!buffer) return false;

      stopBanSound();

      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = 0.9;
      source.buffer = buffer;
      source.loop = false;
      source.connect(gain);
      gain.connect(context.destination);
      source.start(0);
      banAudioSourceRef.current = source;
      return true;
    } catch {
      // Some browsers block autoplay until the user has interacted with the page.
      return false;
    }
  }

  function clearBanSoundRetry() {
    if (typeof window === "undefined" || !banSoundRetryRef.current) return;

    window.clearInterval(banSoundRetryRef.current);
    banSoundRetryRef.current = null;
  }

  function clearBanSoundUnmuteTimer() {
    if (typeof window === "undefined" || !banSoundUnmuteTimerRef.current) return;

    window.clearTimeout(banSoundUnmuteTimerRef.current);
    banSoundUnmuteTimerRef.current = null;
  }

  function unmuteBanSound() {
    if (typeof window === "undefined") return;

    clearBanSoundUnmuteTimer();
    const tryUnmute = () => {
      if (!banAudioElementRef.current) return;

      banAudioElementRef.current.muted = false;
      banAudioElementRef.current.volume = 1;
      banAudioElementRef.current.play().catch(() => {});
    };

    tryUnmute();
    banSoundUnmuteTimerRef.current = window.setTimeout(tryUnmute, 180);
  }

  function playBanScreenSound() {
    if (typeof window === "undefined") return;

    clearBanSoundRetry();
    stopBanSound();
    setBanAudioKey((key) => key + 1);

    let attempts = 0;
    const retryBanSound = async () => {
      attempts += 1;
      const played = await playBanSound();
      if (played || attempts >= 60) {
        clearBanSoundRetry();
      }
    };

    retryBanSound();
    banSoundRetryRef.current = window.setInterval(retryBanSound, 500);
  }

  function stopBanSound() {
    clearBanSoundUnmuteTimer();

    if (banAudioElementRef.current) {
      banAudioElementRef.current.pause();
      banAudioElementRef.current.currentTime = 0;
      banAudioElementRef.current.loop = false;
    }

    if (!banAudioSourceRef.current) return;

    try {
      banAudioSourceRef.current.stop();
    } catch {
      // The sound may have already ended.
    }
    banAudioSourceRef.current = null;
  }

  async function handleMobileDownload() {
    if (isStandalone) {
      setInstallNote("DenSpace is already running like a mobile app.");
      return;
    }

    const isAppleMobile = isAppleMobileBrowser(window.navigator);
    if (isAppleMobile) {
      setInstallDevice("iphone");
      setInstallGuideOpen(true);
      setInstallNote("Download the iPhone profile, then open Settings and tap Profile Downloaded.");
      window.location.href = iphoneProfileUrl;
      return;
    }

    const userAgent = window.navigator.userAgent;
    const isAndroid = /android/i.test(userAgent);
    const fallbackNote = isAndroid
      ? "On Android: open the browser menu, then tap Install app or Add to Home screen."
      : "On your phone: open denspace.vercel.app, then use your browser menu to add DenSpace to the home screen.";

    if (installPrompt && isAndroid) {
      const promptEvent = installPrompt;
      setInstallPrompt(null);
      setInstallGuideOpen(true);
      setInstallNote(`Opening the install prompt. If nothing pops up, ${fallbackNote}`);

      try {
        await promptEvent.prompt();
        promptEvent.userChoice.then((choice) => {
          if (choice.outcome === "accepted") {
            setInstallGuideOpen(false);
            setInstallNote("DenSpace is downloading to your device.");
          } else {
            setInstallNote(fallbackNote);
          }
        }).catch(() => setInstallNote(fallbackNote));
      } catch {
        setInstallNote(fallbackNote);
      }
      return;
    }

    setInstallGuideOpen(true);
    setInstallNote(fallbackNote);
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
      if (showBanFromResponse(response.status, data)) return;
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

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (showBanFromResponse(response.status, data)) return;
      setFeedNote(data.details || data.error || "The reaction could not be saved yet.");
      return;
    }

    const data = await response.json();
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, reactions: data.reactions } : post));
  }

  async function createComment(postId) {
    const text = (commentDrafts[postId] || "").trim();
    if (!user) {
      setAuthNote("Sign in before commenting.");
      return;
    }

    if (!text) {
      setFeedNote("Write a comment before sending.");
      return;
    }
    setCommentingPosts((current) => ({ ...current, [postId]: true }));
    setFeedNote("");

    const response = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    setCommentingPosts((current) => ({ ...current, [postId]: false }));

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (showBanFromResponse(response.status, data)) return;
      setFeedNote(data.details || data.error || "The comment could not be saved yet.");
      return;
    }

    const data = await response.json();
    setPosts((current) => current.map((post) => (
      post.id === postId
        ? { ...post, comments: [...(post.comments || []), data.comment] }
        : post
    )));
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
  }

  async function createChat() {
    if (!user) {
      setAuthNote("Sign in before creating a group chat.");
      return;
    }

    const name = chatForm.name.trim();
    if (!name) {
      setChatNote("Name the group chat first.");
      return;
    }
    setIsCreatingChat(true);
    setChatNote("");

    const response = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icon: chatForm.icon })
    });

    setIsCreatingChat(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (showBanFromResponse(response.status, data)) return;
      setChatNote(data.details || data.error || "The group chat could not be created yet.");
      return;
    }

    const data = await response.json();
    setChats((current) => [data.chat, ...current.filter((chat) => chat.id !== data.chat.id)]);
    setSelectedChatId(data.chat.id);
    setChatForm({ name: "", icon: "GC" });
  }

  async function saveChatDetails() {
    if (!activeChat) return;
    if (!user) {
      setAuthNote("Sign in before editing a group chat.");
      return;
    }

    const name = chatEditForm.name.trim();
    if (!name) {
      setChatNote("Name the group chat first.");
      return;
    }
    setIsSavingChat(true);
    setChatNote("");

    const response = await fetch(`/api/chats/${activeChat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icon: chatEditForm.icon })
    });

    setIsSavingChat(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (showBanFromResponse(response.status, data)) return;
      setChatNote(data.details || data.error || "The group chat could not be updated yet.");
      return;
    }

    const data = await response.json();
    setChats((current) => current.map((chat) => chat.id === data.chat.id ? data.chat : chat));
    setChatNote("Chat details saved.");
  }

  async function sendChatMessage() {
    const text = chatDraft.trim();
    if (!user) {
      setAuthNote("Sign in before chatting.");
      return;
    }

    if (!activeChat) {
      setChatNote("Create or select a group chat first.");
      return;
    }

    if (!text) {
      setChatNote("Write a message before sending.");
      return;
    }
    setIsSendingChat(true);
    setChatNote("");

    const response = await fetch(`/api/chats/${activeChat.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    setIsSendingChat(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (showBanFromResponse(response.status, data)) return;
      setChatNote(data.details || data.error || "The message could not be sent yet.");
      return;
    }

    const data = await response.json();
    setChatMessages((current) => [...current, data.message]);
    setChatDraft("");
    setChats((current) => current.map((chat) => (
      chat.id === activeChat.id
        ? { ...chat, latestMessage: data.message.text, messageCount: chat.messageCount + 1, time: "now" }
        : chat
    )));
  }

  return (
    <>
      <section id="authGate" className={`auth-gate ${authVisible ? "" : "hidden"}`} aria-label="Sign in">
        <div className="auth-card">
          <span className="brand-mark"><img src={denSpaceIcon} alt="" /></span>
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
          <button className="mobile-install-button auth-install-button" type="button" onClick={handleMobileDownload}>
            <Download /> {installButtonText}
          </button>
          {installNote && <p className="install-note">{installNote}</p>}
          {installGuideOpen && <InstallGuide device={installDevice} />}
          <p className="auth-note">{authNote}</p>
        </div>
      </section>

      {isBanned ? (
        <section className="ban-screen" aria-label="Account banned">
          <audio
            key={banAudioKey}
            ref={banAudioElementRef}
            src={banSound}
            autoPlay
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            onLoadedData={playBanSoundWithElement}
            onCanPlayThrough={playBanSoundWithElement}
            onPlaying={unmuteBanSound}
          />
          <div className="ban-card">
            <span className="brand-mark"><img src={denSpaceIcon} alt="" /></span>
            <div>
              <p>Account status</p>
              <h1>Account banned</h1>
            </div>
            <div className="ban-status">
              <ShieldCheck />
              <span>{banNotice.permanent ? "Permanent ban" : "Account restricted"}</span>
            </div>
            <p className="ban-message">{banNotice.error}</p>
            <p className="auth-note">{banNotice.details}</p>
            <button className="email-signup-button" type="button" onClick={handleSignOut}>
              <LogOut /> Sign out
            </button>
          </div>
        </section>
      ) : (
      <div className="app-shell">
        <aside className="sidebar" aria-label="Primary">
          <a className="brand" href="#" aria-label="DenSpace home" onClick={(event) => { event.preventDefault(); setActiveScreen("home"); }}>
            <span className="brand-mark"><img src={denSpaceIcon} alt="" /></span>
            <span>DenSpace</span>
          </a>
          <nav className="nav-list" aria-label="Sections">
            <button className={`nav-item ${activeScreen === "home" ? "active" : ""}`} type="button" onClick={() => setActiveScreen("home")}><Home /><span>Home</span></button>
            <button className={`nav-item ${activeScreen === "chats" ? "active" : ""}`} type="button" onClick={() => setActiveScreen("chats")}><MessageCircle /><span>Chats</span></button>
            <button className="nav-item" type="button"><CalendarDays /><span>Meetups</span></button>
            <button className="nav-item" type="button"><Palette /><span>Studio</span></button>
            <button className="nav-item" type="button"><ShieldCheck /><span>Safety</span></button>
          </nav>
          <div className="mini-profile">
            <button
              className="profile-picture-button"
              type="button"
              aria-label="Change profile picture"
              onClick={() => profileImageInputRef.current?.click()}
              disabled={!user || isUploadingProfilePicture}
            >
              <UserAvatar avatar={displayUser.avatar} picture={displayUser.picture} className={displayUser.avatarClass} />
              <span><Upload /></span>
            </button>
            <div>
              <div className="profile-name-line">
                <strong>{displayUser.name}</strong>
                <ProfileBadge name={displayUser.name} />
              </div>
              <span>{displayUser.handle}</span>
              {user && <small>{isUploadingProfilePicture ? "Uploading..." : "Tap photo to change"}</small>}
              {profileNote && <small className="profile-note">{profileNote}</small>}
            </div>
            <input
              ref={profileImageInputRef}
              className="profile-picture-input"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleProfilePictureChange}
              disabled={!user || isUploadingProfilePicture}
            />
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
              <button className="mobile-install-button" type="button" onClick={handleMobileDownload}><Download /> {installButtonText}</button>
              <button className="top-auth-button" type="button" onClick={user ? handleSignOut : () => setAuthNote("Sign in or create an account to continue.")}>{user ? <LogOut /> : <LogIn />} {user ? "Sign out" : "Sign in"}</button>
              <button className="icon-button" type="button" aria-label="Notifications"><Bell /></button>
              <button className="icon-button" type="button" aria-label="Group chats" onClick={() => setActiveScreen("chats")}><MessageCircle /></button>
            </div>
          </header>
          {installNote && <p className="install-note main-install-note">{installNote}</p>}
          {installGuideOpen && <InstallGuide device={installDevice} />}

          {activeScreen === "chats" ? (
            <section className="chat-screen" aria-label="Group chats screen">
              <div className="screen-heading">
                <div>
                  <p>Messages</p>
                  <h1>Group Chats</h1>
                </div>
                <button className="ghost-button" type="button" onClick={() => setActiveScreen("home")}><Home /> Feed</button>
              </div>

              <div className="chat-screen-grid">
                <section className="panel chat-directory" aria-label="Group chat list">
                  <div className="panel-header">
                    <h2>Chats</h2>
                    <span className="chat-count">{chats.length}</span>
                  </div>
                  <div className="chat-create">
                    <input
                      className="chat-icon-input"
                      value={chatForm.icon}
                      onChange={(event) => setChatForm({ ...chatForm, icon: event.target.value })}
                      maxLength="6"
                      aria-label="New group chat icon"
                      placeholder="GC"
                      disabled={!user || isCreatingChat}
                    />
                    <input
                      value={chatForm.name}
                      onChange={(event) => setChatForm({ ...chatForm, name: event.target.value })}
                      maxLength="42"
                      aria-label="New group chat name"
                      placeholder="Group chat name"
                      disabled={!user || isCreatingChat}
                    />
                    <button className="ghost-button" type="button" onClick={createChat} disabled={!user || isCreatingChat}>{isCreatingChat ? "Making" : "New"}</button>
                  </div>
                  <div className="chat-list screen-list">
                    {chats.length ? chats.map((chat) => (
                      <button className={`chat-list-item ${chat.id === selectedChatId ? "active" : ""}`} type="button" key={chat.id} onClick={() => setSelectedChatId(chat.id)}>
                        <span className="chat-icon">{chat.icon}</span>
                        <span>
                          <strong>{chat.name}</strong>
                          <small>{chat.latestMessage || "No messages yet"}</small>
                        </span>
                        <em>{chat.messageCount}</em>
                      </button>
                    )) : (
                      <div className="chat-empty"><strong>No group chats yet</strong><span>Create one when you are ready.</span></div>
                    )}
                  </div>
                </section>

                <section className="panel chat-room-screen" aria-label={activeChat ? `${activeChat.name} group chat` : "Selected group chat"}>
                  {activeChat ? (
                    <>
                      <div className="chat-room-head screen-room-head">
                        <span className="chat-icon large">{activeChat.icon}</span>
                        <div>
                          <strong>{activeChat.name}</strong>
                          <span>{activeChat.messageCount} {activeChat.messageCount === 1 ? "message" : "messages"}</span>
                        </div>
                      </div>
                      <div className="chat-edit">
                        <input
                          className="chat-icon-input"
                          value={chatEditForm.icon}
                          onChange={(event) => setChatEditForm({ ...chatEditForm, icon: event.target.value })}
                          maxLength="6"
                          aria-label="Edit group chat icon"
                          disabled={!user || isSavingChat}
                        />
                        <input
                          value={chatEditForm.name}
                          onChange={(event) => setChatEditForm({ ...chatEditForm, name: event.target.value })}
                          maxLength="42"
                          aria-label="Edit group chat name"
                          disabled={!user || isSavingChat}
                        />
                        <button className="ghost-button" type="button" onClick={saveChatDetails} disabled={!user || isSavingChat}>{isSavingChat ? "Saving" : "Save"}</button>
                      </div>
                      <div className="chat-messages screen-messages" aria-label={`${activeChat.name} messages`}>
                        {chatMessages.length ? chatMessages.map((message) => (
                          <article className="chat-message" key={message.id}>
                            <UserAvatar avatar={message.avatar} picture={message.picture} className="comment-avatar" />
                            <div>
                              <div className="comment-author-line">
                                <strong>{message.author}</strong>
                                <span>{message.time}</span>
                              </div>
                              <p>{message.text}</p>
                            </div>
                          </article>
                        )) : (
                          <p className="comment-empty">No messages yet.</p>
                        )}
                      </div>
                      <div className="chat-send">
                        <textarea
                          value={chatDraft}
                          onChange={(event) => setChatDraft(event.target.value)}
                          rows="2"
                          maxLength="420"
                          placeholder={user ? "Message the group" : "Sign in to chat"}
                          disabled={!user || isSendingChat}
                        />
                        <button className="comment-button" type="button" onClick={sendChatMessage} disabled={!user || isSendingChat}><Send /> {isSendingChat ? "Sending" : "Send"}</button>
                      </div>
                    </>
                  ) : (
                    <div className="chat-empty room-empty"><strong>No chat selected</strong><span>Create a group chat or pick one from the list.</span></div>
                  )}
                  {chatNote && <p className="composer-status">{chatNote}</p>}
                </section>
              </div>
            </section>
          ) : (
            <>
          <section className="hero" aria-label="Community spotlight">
            <img src="/assets/frutiger-aero-banner.png" alt="Glossy Frutiger Aero community lounge illustration" />
            <div className="hero-overlay">
              <p>Your Den</p>
              <h1>Welcome to DenSpace</h1>
              <div className="hero-meta">
                <span><LockKeyhole /> Neon Auth</span>
                <span><Upload /> Vercel Blob uploads</span>
              </div>
            </div>
          </section>

          <section className="composer" aria-label="Create post">
            <UserAvatar avatar={displayUser.avatar} picture={displayUser.picture} className="avatar-mint" />
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
                      <UserAvatar avatar={post.avatar} picture={post.picture} className={post.avatarClass} />
                      <div className="post-author">
                        <div className="post-author-line">
                          <strong>{post.author}</strong>
                          <ProfileBadge name={post.author} />
                        </div>
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
                    <section className="comments-panel" aria-label={`Comments on ${post.author}'s post`}>
                      <div className="comments-header">
                        <span><MessageCircle /> {(post.comments || []).length} {(post.comments || []).length === 1 ? "comment" : "comments"}</span>
                      </div>
                      <div className="comment-list">
                        {(post.comments || []).length ? (
                          (post.comments || []).map((comment) => (
                            <article className="comment" key={comment.id}>
                              <UserAvatar avatar={comment.avatar} picture={comment.picture} className="comment-avatar" />
                              <div>
                                <div className="comment-author-line">
                                  <strong>{comment.author}</strong>
                                  <ProfileBadge name={comment.author} />
                                  <span>{comment.time}</span>
                                </div>
                                <p>{comment.text}</p>
                              </div>
                            </article>
                          ))
                        ) : (
                          <p className="comment-empty">No comments yet.</p>
                        )}
                      </div>
                      <div className="comment-form">
                        <p className="comment-rule">AI checks comments immediately. Anti-furry comments trigger a permanent ban.</p>
                        <textarea
                          value={commentDrafts[post.id] || ""}
                          onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                          rows="2"
                          maxLength="220"
                          placeholder={user ? "Add a comment" : "Sign in to comment"}
                          disabled={!user || commentingPosts[post.id]}
                        />
                        <button className="comment-button" type="button" onClick={() => createComment(post.id)} disabled={!user || commentingPosts[post.id]}>
                          <Send /> {commentingPosts[post.id] ? "Sending" : "Comment"}
                        </button>
                      </div>
                    </section>
                  </article>
                )) : (
                  <article className="post-card empty-state">
                    <UserAvatar avatar={displayUser.avatar} picture={displayUser.picture} className="avatar-mint" />
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
            </>
          )}
        </main>
      </div>
      )}
    </>
  );
}
