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
import { useState } from "react";
import { safeMedia, type Item } from "../schema";
import { useSkinState } from "../skinState";
import { Avatar, meta, type Props } from "./shared";
import { neteaseAudio, type useNeteaseAudio } from "./netease-audio";
import "./netease-player.css";

function trackSeed(id: string) {
  return Array.from(id).reduce(
    (seed, char) => (seed * 31 + char.charCodeAt(0)) >>> 0,
    0,
  );
}

function commentCount(item: Item) {
  return (
    200_000 + ((Math.imul(trackSeed(item.id), 2654435761) >>> 0) % 780_001)
  );
}

function clock(seconds: number) {
  return [Math.floor(seconds / 60), seconds % 60]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function neteaseTrackLink(item: Item) {
  const netease = meta(item, "neteaseSongId");
  if (/^\d{1,16}$/.test(netease))
    return `https://music.163.com/song?id=${netease}`;
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
  playback,
  repeat,
  toggleRepeat,
  step,
  chooseTrack,
  close,
  openComments,
}: {
  p: Props;
  item: Item;
  playback: ReturnType<typeof useNeteaseAudio>;
  repeat: boolean;
  toggleRepeat: () => void;
  step: (direction: number) => void;
  chooseTrack: (item: Item) => void;
  close: () => void;
  openComments: () => void;
}) {
  const [liked, setLiked] = useSkinState(p, `liked-${item.id}`, item.favorite);
  const [showQueue, setShowQueue] = useState(false);
  const { position, duration, playing, error, toggle, seek } = playback;
  const audio = neteaseAudio(item);
  const externalLink = audio ? undefined : neteaseTrackLink(item);
  const postedComments = p.ui?.[`comments-${item.id}`];
  const totalComments =
    commentCount(item) +
    (Array.isArray(postedComments) ? postedComments.length : 0);
  return (
    <section className="netease-playing" aria-label="正在播放">
      <header className="netease-overlay-header">
        <button aria-label="收起播放页" onClick={close}>
          <ChevronDown />
        </button>
        <span>心动</span>
      </header>
      <div className="netease-turntable">
        <div className="netease-turntable-disc" data-playing={playing}>
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
          aria-label={`打开评论（${totalComments}）`}
          onClick={openComments}
        >
          <MessageCircle size={25} />
          <sup>{Math.floor(totalComments / 1000) / 10}万</sup>
        </button>
      </div>
      <div className="netease-progress">
        <input
          aria-label="播放进度"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={position}
          disabled={!audio || !duration}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <div>
          <time>{clock(Math.floor(position))}</time>
          <span>
            {audio ? "本地音源" : externalLink ? "平台播放" : "暂无音源"}
          </span>
          <time>{duration ? clock(Math.floor(duration)) : "--:--"}</time>
        </div>
      </div>
      {error && (
        <small className="netease-recording-credit" role="status">
          {error}
        </small>
      )}
      <div className="netease-transport">
        <button
          aria-label="单曲循环"
          aria-pressed={repeat}
          disabled={!audio}
          onClick={toggleRepeat}
        >
          <Repeat />
        </button>
        <button aria-label="上一首" onClick={() => step(-1)}>
          <SkipBack fill="currentColor" />
        </button>
        {externalLink ? (
          <a
            aria-label="前往网易云音乐播放"
            href={externalLink}
            target="_blank"
            rel="noreferrer"
          >
            <Play size={38} fill="currentColor" />
          </a>
        ) : (
          <button
            aria-label={playing ? "暂停" : "播放"}
            disabled={!audio}
            onClick={toggle}
          >
            {playing ? (
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
const commentScenes = [
  { name: "末班车", text: "坐上末班车才有空翻歌单。", region: "湖南" },
  { name: "薄荷信封", text: "午休的时候刚好随机到了这首。", region: "四川" },
  {
    name: "半杯茉莉",
    text: "周末打扫房间的时候又把它放出来了。",
    region: "上海",
  },
  { name: "海盐月亮", text: "跟朋友散步时共享了半边耳机。", region: "山东" },
  { name: "橘色窗台", text: "窗外下雨，突然很想听它。", region: "湖北" },
  { name: "纸飞机", text: "以前写作业时常把这首放在第一首。", region: "北京" },
  {
    name: "迟到的云",
    text: "坐车经过熟悉的路口时想起这首歌。",
    region: "江西",
  },
  { name: "蓝色邮筒", text: "睡前把耳机的音量调低了一格。", region: "安徽" },
  {
    name: "周五的猫",
    text: "忙完手头的事，终于能完整听一遍。",
    region: "天津",
  },
];

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
  const demo = Array.from({ length: 50 }, (_, index) => {
    const comment = demoComments[(index + seed) % demoComments.length];
    const scene = commentScenes[Math.floor(index / demoComments.length) - 1];
    const name = scene ? `${scene.name}·${comment.name}` : comment.name;
    const votes = Math.imul(seed ^ (index + 1), 2654435761) >>> 0;
    return {
      ...comment,
      name,
      id: name,
      body: scene ? scene.text + comment.body : comment.body,
      date: `${index + 1} 天前 · ${scene?.region ?? comment.region}`,
      votes: 45 + (votes % 2300),
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
        <strong>评论 ({entries.length})</strong>
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
