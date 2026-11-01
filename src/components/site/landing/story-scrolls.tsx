"use client";

import { PixelButton } from "@/components/site/landing/pixel";
import { cn } from "@/lib/utils";
import { useState } from "react";

/** One story per starter: the scroll in the middle is the one being read */
const stories = [
  {
    starter: { id: 258, name: "Mudkip", w: 43, h: 49, big: 2 },
    title: "The story",
    tagline: "The world opens up, step by step",
    kind: "Main story",
    steps: [
      { name: "Meet the Professor", detail: "Gives you 5 Poké Balls", done: true },
      { name: "Beat your rival", detail: "Wally steps out of the way", done: true },
      { name: "Win the Mist Badge", detail: "The boulder north disappears", done: false },
    ],
    text: "Block roads with trees, boulders or people, choose who opens them, and add side quests the player finds on the way. A Journal tells them what to do next.",
    link: "/docs/story",
    action: "Write your story",
  },
  {
    starter: { id: 252, name: "Treecko", w: 43, h: 63, big: 2 },
    title: "A side quest",
    tagline: "Help someone along the way",
    kind: "Side quest",
    steps: [
      { name: "Accept the quest", detail: "A girl lost her Skitty", done: true },
      { name: "Find Skitty", detail: "It hides in the tall grass", done: true },
      { name: "Bring it home", detail: "She gives you a Great Ball", done: false },
    ],
    text: "Side quests stay secret until the player starts them, then show up in the Journal next to the main story, with a banner when they're done.",
    link: "/docs/story#side-quests",
    action: "Add a side quest",
  },
  {
    starter: { id: 255, name: "Torchic", w: 33, h: 47, big: 3 },
    title: "Your rival",
    tagline: "Someone walks up to talk",
    kind: "Cutscene",
    steps: [
      { name: "Wally spots you", detail: "He walks over to say hi", done: true },
      { name: "Battle on Route 102", detail: "His Ralts is level 6", done: true },
      { name: "He steps aside", detail: "The road to Petalburg opens", done: false },
    ],
    text: "People can walk up to the player like a rival, trainers spot you from four tiles away, and beating them can move the story on.",
    link: "/docs/people#small-cutscenes",
    action: "Make a rival",
  },
];

type Story = (typeof stories)[number];

/** Animated Gen 5 sprite of a starter */
function Starter({ starter, scale, className }: { starter: Story["starter"]; scale?: number; className?: string }) {
  return <img src={`/site/sprites/anim-${starter.id}.gif`} alt="" width={starter.w * (scale ?? 1)} height={starter.h * (scale ?? 1)} className={cn("pixelated", className)} style={scale ? { width: starter.w * scale } : undefined} />;
}

/** Smaller scroll beside the story, rolled on its outer edge: click it to read its story */
function Side({ story, side, moved, onPick }: { story: Story; side: "left" | "right"; moved: boolean; onPick: () => void }) {
  const left = side === "left";
  return (
    <button onClick={onPick} aria-label={`Read ${story.starter.name}'s story: ${story.title}`} className="group relative hidden h-[270px] w-[200px] shrink-0 cursor-pointer transition-[translate] duration-150 ease-[steps(3)] hover:-translate-y-1.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-dashed focus-visible:outline-white xl:block 2xl:w-[270px]">
      <span className={cn("absolute -bottom-4 -top-4 w-10 stepped bg-[#c99a5b]", left ? "left-0 shadow-[inset_-6px_0_0_#9c6b33]" : "right-0 shadow-[inset_6px_0_0_#9c6b33]")} aria-hidden="true" />
      <span key={story.starter.id} className={cn(moved && "hop", "stepped absolute inset-y-0 flex flex-col items-center justify-center gap-3 bg-[#ecd3a3] shadow-[inset_0_0_0_4px_#d9b77d] transition-colors group-hover:bg-[#f3dfb6]", left ? "left-10 right-0" : "left-0 right-10")}>
        <Starter starter={story.starter} scale={story.starter.big} />
        <span className="font-game text-[13px] text-[#7a5430]">{story.kind}</span>
        <span className="blink font-pixel text-[10px] text-[#a0662e] opacity-0 group-hover:opacity-100">▶ Read</span>
      </span>
    </button>
  );
}

/** The story being read: unrolls from the middle with its rollers sliding out to the edges */
function Main({ story, moved }: { story: Story; moved: boolean }) {
  return (
    <div key={story.starter.id} className={cn("relative", moved && "unrolling")}>
      <div className="roller-left absolute -bottom-4 -top-4 w-8 stepped bg-[#c99a5b] shadow-[inset_-6px_0_0_#9c6b33] sm:w-10" aria-hidden="true" />
      <div className="roller-right absolute -bottom-4 -top-4 w-8 stepped bg-[#c99a5b] shadow-[inset_6px_0_0_#9c6b33] sm:w-10" aria-hidden="true" />
      <div className="unroll">
        <div className="stepped relative bg-[#ecd3a3] px-6 py-8 text-[#4a2e14] shadow-[inset_0_0_0_4px_#d9b77d] sm:px-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Starter starter={story.starter} scale={1} />
              <div>
                <h2 className="font-pixel text-[22px] leading-none sm:text-[28px]">{story.title}</h2>
                <p className="mt-1 font-game text-[14px] text-[#7a5430]">{story.tagline}</p>
              </div>
            </div>
            <span className="font-pixel text-[13px] text-[#a0662e]">{story.kind}</span>
          </div>
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {story.steps.map(({ name, detail, done }, i) => (
              <li key={name} className="stepped bg-[#f6e6c4] p-3 shadow-[inset_0_0_0_3px_#d9b77d]">
                <span className={cn("font-pixel text-[11px]", done ? "text-[#3f8a3a]" : "text-[#a0662e]")}>{done ? "✓ Done" : `Step ${i + 1}`}</span>
                <p className="mt-1 font-game text-[16px] font-bold leading-tight">{name}</p>
                <p className="mt-1 font-game text-[13px] text-[#7a5430]">{detail}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-[44ch] font-game text-[15px] leading-relaxed">{story.text}</p>
            <PixelButton href={story.link} tone="wood">{story.action}</PixelButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Three story scrolls, one per starter: click a side one to bring it to the middle */
export function StoryScrolls() {
  //Which story sits left, in the middle and right
  const [order, setOrder] = useState([1, 0, 2]);
  //Scrolls only animate once a story was picked, not when the page loads
  const [moved, setMoved] = useState(false);
  const pick = (index: number) => {
    if (index === 1) {
      return;
    }
    setMoved(true);
    setOrder((order) => order.map((story, i) => i === 1 ? order[index] : i === index ? order[1] : story));
  };
  const [left, middle, right] = order.map((i) => stories[i]);
  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Phones and tablets: pick a starter instead of clicking the side scrolls */}
      <div role="tablist" aria-label="Stories" className="mb-8 flex justify-center gap-3 xl:hidden">
        {stories.map((story) => {
          const active = story === middle;
          return (
            <button key={story.starter.id} role="tab" aria-selected={active} onClick={() => pick(order.indexOf(stories.indexOf(story)))} className={cn("stepped flex flex-col items-center gap-1 px-3 pb-2 pt-1 font-pixel text-[11px] transition-colors", active ? "bg-[#ecd3a3] text-[#4a2e14]" : "bg-[#1d1038] text-[#c9b8f5] shadow-[inset_0_0_0_3px_#3f2c74]")}>
              <Starter starter={story.starter} className="h-12 w-auto" />
              {story.starter.name}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-center">
        <Side story={left} side="left" moved={moved} onPick={() => pick(0)} />
        <div className="relative z-10 w-full max-w-4xl">
          <Main story={middle} moved={moved} />
        </div>
        <Side story={right} side="right" moved={moved} onPick={() => pick(2)} />
      </div>
    </div>
  );
}
