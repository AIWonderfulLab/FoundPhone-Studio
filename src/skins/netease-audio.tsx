import { useCallback, useEffect, useRef, useState } from "react";
import { localAudioUrl } from "../audio";
import { safeMedia, type Item } from "../schema";
import type { Props } from "./shared";

export function neteaseAudio(item: Item | null) {
  if (!item) return;
  return (
    localAudioUrl(item.meta.localAudio) ||
    (item.kind === "audio" ? safeMedia(item.media) : undefined)
  );
}

export function useNeteaseAudio(p: Props, track: Item | null, repeat: boolean) {
  const element = useRef<HTMLAudioElement>(null);
  const loaded = useRef<{ id: string; src: string } | null>(null);
  const seekRequest = useRef<{
    controller: AbortController;
    time: number;
  } | null>(null);
  const seekOnLoad = useRef<{ time: number; resume: boolean } | null>(null);
  const bufferedUrl = useRef("");
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const clearSeekBuffer = useCallback(() => {
    seekRequest.current?.controller.abort();
    seekRequest.current = null;
    seekOnLoad.current = null;
    if (bufferedUrl.current) URL.revokeObjectURL(bufferedUrl.current);
    bufferedUrl.current = "";
  }, []);
  useEffect(() => clearSeekBuffer, [clearSeekBuffer]);
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
      clearSeekBuffer();
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
    [clearSeekBuffer, play],
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
    const track = loaded.current;
    if (!audio || !track || !duration) return;
    setPosition(time);
    if (seekOnLoad.current) {
      seekOnLoad.current.time = time;
      return;
    }
    if (seekRequest.current) {
      seekRequest.current.time = time;
      return;
    }
    const canSeek = Array.from(
      { length: audio.seekable.length },
      (_, index) => index,
    ).some(
      (index) =>
        audio.seekable.start(index) <= time &&
        audio.seekable.end(index) >= time,
    );
    if (
      time === 0 ||
      canSeek ||
      bufferedUrl.current ||
      track.src.startsWith("data:")
    ) {
      audio.currentTime = time;
      commit(time);
      return;
    }
    // Some static hosts send the whole file even when the browser requests a byte range.
    const request = { controller: new AbortController(), time };
    seekRequest.current = request;
    void (async () => {
      try {
        const response = await fetch(track.src, {
          signal: request.controller.signal,
        });
        if (!response.ok) throw Error("Audio request failed");
        const blob = await response.blob();
        if (seekRequest.current !== request || loaded.current !== track) return;
        const resume = !audio.paused;
        bufferedUrl.current = URL.createObjectURL(blob);
        seekOnLoad.current = { time: request.time, resume };
        seekRequest.current = null;
        audio.src = bufferedUrl.current;
      } catch {
        if (seekRequest.current !== request) return;
        seekRequest.current = null;
        setPosition(audio.currentTime);
        setError("暂时无法跳转进度，请重试");
      }
    })();
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
          const pending = seekOnLoad.current;
          if (pending) {
            seekOnLoad.current = null;
            audio.currentTime = Math.min(pending.time, audio.duration);
            setPosition(audio.currentTime);
            commit(audio.currentTime);
            if (pending.resume) play(audio);
            return;
          }
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
        onTimeUpdate={(event) => {
          if (!seekRequest.current && !seekOnLoad.current)
            setPosition(event.currentTarget.currentTime);
        }}
        onPlaying={() => setPlaying(true)}
        onPause={(event) => {
          if (!event.currentTarget.paused) return;
          setPlaying(false);
          if (
            !seekOnLoad.current &&
            event.currentTarget.readyState > 0 &&
            !event.currentTarget.ended
          )
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
