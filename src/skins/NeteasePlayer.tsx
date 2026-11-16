import {
  ChevronDown,
  ChevronLeft,
  Heart,
  ListMusic,
  MessageCircle,
  Music,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  ThumbsUp,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { safeMedia, type Item } from "../schema";
import { useSkinState } from "../skinState";
import { Avatar, meta, type Props } from "./shared";
import "./netease-player.css";

function trackSeed(id: string) {
  return Array.from(id).reduce(
    (seed, char) => (seed * 31 + char.charCodeAt(0)) >>> 0,
    0,
  );
}

function commentCount(item: Item) {
  return 280 + ((Math.imul(trackSeed(item.id), 2654435761) >>> 0) % 11900);
}

function clock(seconds: number) {
  return [Math.floor(seconds / 60), seconds % 60]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function officialMusicSource(item: Item) {
  const apple = /^(cn|tw):(\d{1,16}):(\d{1,16})$/.exec(
    meta(item, "appleMusic"),
  );
  if (apple) {
    const [, region, album, track] = apple;
    const path = `/${region}/album/${album}?i=${track}`;
    return {
      name: "Apple Music",
      link: "https://music.apple.com" + path,
      embed:
        region === "cn" ? "https://embed.music.apple.com" + path : undefined,
    };
  }
  const netease = meta(item, "neteaseSongId");
  if (/^\d{1,16}$/.test(netease)) {
    return {
      name: "网易云音乐",
      link: `https://music.163.com/song?id=${netease}`,
    };
  }
}

function RecordCover({ item }: { item: Item }) {
  const artwork = item.kind === "image" ? safeMedia(item.media) : undefined;
  return (
    <div className="netease-record" aria-hidden="true">
      <div className="netease-record-art" data-color={trackSeed(item.id) % 4}>
        {artwork ? (
          <img src={artwork} alt="" />
        ) : (
          <>
            <Music />
            <b>{item.title}</b>
            <small>{item.sender}</small>
          </>
        )}
      </div>
    </div>
  );
}

export function NeteasePlayer({
  p,
  item,
  opened,
  playing,
  setPlaying,
  step,
  chooseTrack,
  close,
  openComments,
}: {
  p: Props;
  item: Item;
  opened: boolean;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  step: (direction: number) => void;
  chooseTrack: (item: Item) => void;
  close: () => void;
  openComments: () => void;
}) {
  const [liked, setLiked] = useSkinState(p, `liked-${item.id}`, item.favorite);
  const [repeat, setRepeat] = useSkinState<boolean>(p, "repeat", false);
  const [seconds, setSeconds] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [playError, setPlayError] = useState("");
  const audioElement = useRef<HTMLAudioElement>(null);
  const audio = item.kind === "audio" ? safeMedia(item.media) : undefined;
  const official = audio ? undefined : officialMusicSource(item);
  const simulatePlayback = !audio && !official;
  const progressKey = `audio-${item.id}`;
  const parts = meta(item, "duration").match(/^(\d+):([0-5]\d)$/);
  const duration = audio
    ? audioDuration
    : (parts && Number(parts[1]) * 60 + Number(parts[2])) || 203;

  useEffect(() => {
    const element = audioElement.current;
    if (!element) return;
    if (!playing) {
      element.pause();
      return;
    }
    let cancelled = false;
    void element.play().catch(() => {
      if (cancelled) return;
      setPlaying(false);
      setPlayError("暂时无法播放，请点播放重试");
    });
    return () => {
      cancelled = true;
    };
  }, [audio, playing, setPlaying]);

  useEffect(() => {
    if (!simulatePlayback || !playing) return;
    const timer = window.setInterval(
      () =>
        setSeconds((time) =>
          time >= duration ? (repeat ? 0 : duration) : time + 1,
        ),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [simulatePlayback, duration, playing, repeat]);

  const active = audio
    ? audioPlaying
    : simulatePlayback && playing && (repeat || seconds < duration);
  const seek = (time: number) => {
    if (audioElement.current && audioDuration) {
      audioElement.current.currentTime = time;
      p.onUi?.(progressKey, time);
    }
    setSeconds(time);
  };
  return (
    <section className="netease-playing" aria-label="正在播放">
      <header className="netease-overlay-header">
        <button aria-label="收起播放页" onClick={close}>
          <ChevronDown />
        </button>
        <span>心动</span>
      </header>
      <div className="netease-turntable">
        <div className="netease-turntable-disc" data-playing={active}>
          <RecordCover item={item} />
        </div>
        <span className="netease-tonearm" aria-hidden="true">
          <i />
        </span>
      </div>
      <div className="netease-playing-info">
        <div>
          <h2>{item.title}</h2>
          <p>{item.sender || meta(item, "artist", "未知歌手")}</p>
        </div>
        <button
          aria-label={liked ? "取消喜欢" : "喜欢"}
          aria-pressed={liked}
          onClick={() => setLiked(!liked)}
        >
          <Heart size={25} fill={liked ? "currentColor" : "none"} />
        </button>
        <button
          className="netease-comment-link"
          aria-label={`打开评论（${commentCount(item)}）`}
          onClick={openComments}
        >
          <MessageCircle size={25} />
          <sup>{commentCount(item)}</sup>
        </button>
      </div>
      {audio && (
        <audio
          ref={audioElement}
          src={audio}
          preload="metadata"
          loop={repeat}
          onLoadedMetadata={(event) => {
            const element = event.currentTarget;
            if (!Number.isFinite(element.duration)) return;
            setAudioDuration(Math.floor(element.duration));
            const saved = p.ui?.[progressKey];
            if (
              typeof saved === "number" &&
              saved > 0 &&
              saved < element.duration
            ) {
              element.currentTime = saved;
              setSeconds(Math.floor(saved));
            }
          }}
          onPlaying={() => {
            setAudioPlaying(true);
            setPlayError("");
          }}
          onPause={(event) => {
            setAudioPlaying(false);
            p.onUi?.(progressKey, event.currentTarget.currentTime);
          }}
          onEnded={() => {
            setAudioPlaying(false);
            setPlaying(false);
            p.onUi?.(progressKey, 0);
          }}
          onTimeUpdate={(event) =>
            setSeconds(Math.floor(event.currentTarget.currentTime))
          }
          onError={() => {
            setPlaying(false);
            setPlayError("音频加载失败");
          }}
        />
      )}
      {official ? (
        <div className="netease-official-source">
          {official.embed && opened && (
            <iframe
              title={`Apple Music 官方试听：${item.title}`}
              src={official.embed}
              allow="autoplay *; encrypted-media *"
              sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
            />
          )}
          <a href={official.link} target="_blank" rel="noreferrer">
            {official.embed
              ? `在 ${official.name} 打开`
              : `前往 ${official.name} 播放`}
          </a>
        </div>
      ) : (
        <div className="netease-progress">
          <input
            aria-label="播放进度"
            type="range"
            min={0}
            max={duration}
            value={seconds}
            disabled={Boolean(audio && !duration)}
            onChange={(event) => seek(Number(event.target.value))}
          />
          <div>
            <time>{clock(seconds)}</time>
            <span>{audio ? "完整录音" : "演示 · 暂无音源"}</span>
            <time>{clock(duration)}</time>
          </div>
        </div>
      )}
      {playError && (
        <small className="netease-recording-credit" role="status">
          {playError}
        </small>
      )}
      <div className="netease-transport">
        {!official && (
          <button
            aria-label="单曲循环"
            aria-pressed={repeat}
            onClick={() => setRepeat(!repeat)}
          >
            <Repeat />
          </button>
        )}
        <button aria-label="上一首" onClick={() => step(-1)}>
          <SkipBack fill="currentColor" />
        </button>
        {!official && (
          <button
            aria-label={active ? "暂停" : "播放"}
            onClick={() => {
              if (duration && seconds >= duration) seek(0);
              setPlayError("");
              setPlaying(!active);
            }}
          >
            {active ? (
              <Pause size={38} fill="currentColor" />
            ) : (
              <Play size={38} fill="currentColor" />
            )}
          </button>
        )}
        <button aria-label="下一首" onClick={() => step(1)}>
          <SkipForward fill="currentColor" />
        </button>
        <button
          aria-label="播放列表"
          aria-expanded={showQueue}
          onClick={() => setShowQueue(!showQueue)}
        >
          <ListMusic />
        </button>
      </div>
      {showQueue && (
        <section className="netease-queue" aria-label="播放列表">
          <header>
            <strong>播放列表</strong>
            <button
              aria-label="关闭播放列表"
              onClick={() => setShowQueue(false)}
            >
              <X />
            </button>
          </header>
          {p.items.map((song) => (
            <button
              key={song.id}
              aria-current={song.id === item.id}
              onClick={() => {
                chooseTrack(song);
                setShowQueue(false);
              }}
            >
              {song.title}
              <small>{song.sender}</small>
            </button>
          ))}
        </section>
      )}
    </section>
  );
}

const demoComments = [
  {
    name: "耳机里的小岛",
    region: "浙江",
    body: "前奏一响，今天就可以慢下来一点了。",
    reply: "刚好适合晚上回家的路。",
  },
  {
    name: "今天也听一遍",
    region: "广东",
    body: "隔了这么久再听，还是会在同一个地方心动。",
    reply: "我也是，前几秒就认出来了。",
  },
  {
    name: "月光收件箱",
    region: "重庆",
    body: "下班路上单曲循环，窗外的灯一盏一盏亮起来。",
    reply: "这首歌和夜景好搭。",
  },
  {
    name: "汽水与晚风",
    region: "福建",
    body: "收藏夹翻到这首，才发现以前的自己也很会挑歌。",
    reply: "老歌总会在意想不到的时候回来。",
  },
  {
    name: "窗边听雨",
    region: "江苏",
    body: "本来只想听一遍，结果又把进度条拉回了开头。",
    reply: "副歌值得多听一次。",
  },
];

const orders = ["推荐", "最热", "最新"] as const;

export function NeteaseComments({
  p,
  item,
  close,
}: {
  p: Props;
  item: Item;
  close: () => void;
}) {
  const [order, setOrder] = useState<(typeof orders)[number]>("推荐");
  const [reply, setReply] = useState("");
  const [draft, setDraft] = useState("");
  const [own, setOwn] = useSkinState<string[]>(p, `comments-${item.id}`, []);
  const [likes, setLikes] = useSkinState<string[]>(
    p,
    `comment-likes-${item.id}`,
    [],
  );
  const seed = trackSeed(item.id);
  const demo = Array.from({ length: 4 }, (_, index) => {
    const comment = demoComments[(index + seed) % demoComments.length];
    return {
      ...comment,
      id: comment.name,
      date: `${index + 1} 天前 · ${comment.region}`,
      votes: 45 + ((seed >>> index) % 2300),
    };
  });
  const ordered =
    order === "最热"
      ? demo.sort((a, b) => b.votes - a.votes)
      : order === "推荐"
        ? [demo[1], demo[0], ...demo.slice(2)]
        : demo;
  const entries = [
    ...own.map((body, index) => ({
      id: `own-${own.length - index}`,
      name: p.owner ?? "我",
      date: "刚刚",
      body,
      votes: 0,
      reply: "",
    })),
    ...ordered,
  ];
  return (
    <section className="netease-comments" aria-label="歌曲评论">
      <header className="netease-overlay-header">
        <button aria-label="返回" onClick={close}>
          <ChevronLeft />
        </button>
        <strong>评论</strong>
      </header>
      <div className="netease-comment-song">
        <RecordCover item={item} />
        <div>
          {item.title}{" "}
          <small>– {item.sender || meta(item, "artist", "未知歌手")}</small>
        </div>
      </div>
      <div className="netease-comment-filters">
        <strong>评论 ({commentCount(item) + own.length})</strong>
        <div>
          {orders.map((name) => (
            <button
              key={name}
              aria-pressed={name === order}
              onClick={() => setOrder(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="netease-comment-scroll">
        {entries.map((entry) => {
          const liked = likes.includes(entry.id);
          return (
            <article key={entry.id} className="netease-comment">
              <Avatar name={entry.name} />
              <div>
                <header>
                  <div>
                    <strong>{entry.name}</strong>
                    <small>{entry.date}</small>
                  </div>
                  <button
                    aria-label={`点赞 ${entry.name}的评论`}
                    aria-pressed={liked}
                    onClick={() =>
                      setLikes(
                        liked
                          ? likes.filter((id) => id !== entry.id)
                          : [...likes, entry.id],
                      )
                    }
                  >
                    {entry.votes + Number(liked)}{" "}
                    <ThumbsUp
                      size={16}
                      fill={liked ? "currentColor" : "none"}
                    />
                  </button>
                </header>
                <p>{entry.body}</p>
                {entry.reply && (
                  <>
                    <button
                      className="netease-replies"
                      aria-expanded={reply === entry.id}
                      onClick={() =>
                        setReply(reply === entry.id ? "" : entry.id)
                      }
                    >
                      {reply === entry.id ? "收起回复" : "展开回复"}{" "}
                      <ChevronDown size={13} />
                    </button>
                    {reply === entry.id && (
                      <p className="netease-reply">{entry.reply}</p>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <form
        className="netease-comment-form"
        onSubmit={(event) => {
          event.preventDefault();
          const body = draft.trim();
          if (!body || own.length >= 50) return;
          setOwn([body, ...own]);
          setDraft("");
        }}
      >
        <input
          aria-label="写评论"
          placeholder="这一次也许就是你上热评了"
          maxLength={200}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        {draft.trim() && (
          <button type="submit" disabled={own.length >= 50}>
            发送
          </button>
        )}
      </form>
    </section>
  );
}
