import { useCallback, useEffect, useRef, useState } from "react";
import { safeMedia, type Item } from "../schema";
import type { Props } from "./shared";

export function neteaseAudio(item: Item | null) {
  if (!item) return;
  const local = item.meta.localAudio;
  if (/^[a-zA-Z0-9_-]+\.(mp3|m4a|ogg|wav)$/.test(local ?? ""))
    return import.meta.env.BASE_URL + "music/" + local;
  return item.kind === "audio" ? safeMedia(item.media) : undefined;
}

export function useNeteaseAudio(p: Props, track: Item | null, repeat: boolean) {
  const element = useRef<HTMLAudioElement>(null);
  const loaded = useRef<{ id: string; src: string } | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const play = useCallback((audio: HTMLAudioElement) => {
    const current = loaded.current;
    setError("");
    void audio.play().catch((reason: unknown) => {
      if (
        loaded.current === current &&
        (reason as { name?: string })?.name !== "AbortError"
      ) {
        setError("暂时无法播放，请重试");
      }
    });
  }, []);
  const load = useCallback(
    (item: Item | null, start = false) => {
      const audio = element.current;
      if (!audio) return;
      const src = neteaseAudio(item);
      if (
        src &&
        item &&
        loaded.current?.id === item.id &&
        loaded.current.src === src
      ) {
        if (start) play(audio);
        return;
      }
      audio.pause();
      loaded.current = src && item ? { id: item.id, src } : null;
      setPosition(0);
      setDuration(0);
      setPlaying(false);
      setError("");
      if (src) {
        audio.src = src;
        if (start) play(audio);
      } else if (audio.hasAttribute("src")) {
        audio.removeAttribute("src");
        audio.load();
      }
    },
    [play],
  );

  useEffect(() => load(track), [load, track]);

  const commit = (time: number) => {
    if (loaded.current && Number.isFinite(time))
      p.onUi?.(`audio-${loaded.current.id}`, time);
  };
  const select = (item: Item) => {
    if (
      element.current &&
      loaded.current?.id !== item.id &&
      !element.current.ended
    )
      commit(element.current.currentTime);
    load(item, true);
  };
  const toggle = () => {
    const audio = element.current;
    if (!audio || !loaded.current) return;
    if (audio.paused) play(audio);
    else audio.pause();
  };
  const seek = (time: number) => {
    const audio = element.current;
    if (!audio || !duration) return;
    audio.currentTime = time;
    setPosition(time);
    commit(time);
  };
  return {
    select,
    toggle,
    seek,
    position,
    duration,
    playing,
    error,
    media: (
      <audio
        ref={element}
        preload="metadata"
        loop={repeat}
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          if (!Number.isFinite(audio.duration)) return;
          setDuration(audio.duration);
          const saved = loaded.current && p.ui?.[`audio-${loaded.current.id}`];
          if (
            typeof saved === "number" &&
            saved > 0 &&
            saved < audio.duration
          ) {
            audio.currentTime = saved;
            setPosition(saved);
          }
        }}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onPlaying={() => setPlaying(true)}
        onPause={(event) => {
          if (!event.currentTarget.paused) return;
          setPlaying(false);
          if (event.currentTarget.readyState > 0 && !event.currentTarget.ended)
            commit(event.currentTarget.currentTime);
        }}
        onEnded={() => {
          setPlaying(false);
          commit(0);
        }}
        onError={() => {
          if (!loaded.current) return;
          setPlaying(false);
          setError("音频加载失败");
        }}
      />
    ),
  };
}
