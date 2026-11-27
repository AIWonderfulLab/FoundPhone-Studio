import { Heart, Lock } from "lucide-react";
import { safeMedia, type Item } from "./schema";
import "./wechat-moments.css";

type Comment = {
  author: string;
  replyTo?: string;
  text?: string;
  sticker?: string;
};

function readComments(value = ""): Comment[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is Comment => item && typeof item.author === "string") : [];
  } catch {
    return [];
  }
}

export function visibleMoments(posts: Item[], owner?: string) {
  return posts
    .filter(
      (post) =>
        !post.meta.visibleTo ||
        (!!owner && (post.meta.visibleTo === owner || post.meta.profile === owner)),
    )
    .sort((first, second) => second.time.localeCompare(first.time));
}

export function MomentDetails({ post, items }: { post: Item; items: Item[] }) {
  const comments = readComments(post.meta.comments);
  return (
    <>
      {post.meta.audience && (
        <span className="wx-moment-audience"><Lock size={11} />{post.meta.audience}</span>
      )}
      {(post.meta.likes || comments.length > 0) && (
        <div className="wx-moment-reactions">
          {post.meta.likes && (
            <div className="wx-moment-likes"><Heart size={12} />{post.meta.likes}</div>
          )}
          {comments.map(({ author, replyTo, text, sticker }, index) => {
            const media = sticker && safeMedia(items.find((item) => item.id === sticker)?.media ?? "");
            return (
              <div key={index}>
                <strong>{author}</strong>{replyTo && <> 回复 <strong>{replyTo}</strong></>}：{text}
                {media && <img className="wx-comment-sticker" src={media} alt="调皮的小狗表情包" />}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
