"use client";

import type {CurrentUser} from "@quadratics/types";
import {useMemo, useState, type ReactNode} from "react";

import {EquationForm} from "@/components/equation-form";

type AppMode = "app" | "notes";

export function AppModeShell({
  initialUser,
  readmeMarkdown
}: {
  initialUser: CurrentUser | null;
  readmeMarkdown: string;
}) {
  const [mode, setMode] = useState<AppMode>("app");
  const [demoMounted, setDemoMounted] = useState(false);

  function showDemo() {
    setDemoMounted(true);
    setMode("notes");
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      <div className="mb-7 flex justify-center">
        <div className="grid w-56 grid-cols-2 rounded border border-zinc-800 bg-zinc-950/70 p-1 text-sm shadow-xl shadow-black/30">
          <button
            aria-pressed={mode === "app"}
            className={modeButtonClass(mode === "app")}
            onClick={() => setMode("app")}
            type="button"
          >
            App
          </button>
          <button
            aria-pressed={mode === "notes"}
            className={modeButtonClass(mode === "notes")}
            onClick={showDemo}
            type="button"
          >
            Demo
          </button>
        </div>
      </div>

      <div className={mode === "app" ? "block" : "hidden"} aria-hidden={mode !== "app"}>
        <EquationForm initialUser={initialUser} />
      </div>
      {demoMounted ? (
        <div className={mode === "notes" ? "block" : "hidden"} aria-hidden={mode !== "notes"}>
          <NotesMode readmeMarkdown={readmeMarkdown} />
        </div>
      ) : null}
    </div>
  );
}

function NotesMode({readmeMarkdown}: {readmeMarkdown: string}) {
  const blocks = useMemo(() => parseMarkdown(readmeMarkdown), [readmeMarkdown]);
  const headings = blocks.filter((block): block is HeadingBlock => block.type === "heading");
  const [headingFilter, setHeadingFilter] = useState("");
  const filteredHeadings = headings.filter((heading) =>
    heading.text.toLowerCase().includes(headingFilter.toLowerCase())
  );

  return (
    <section className="mx-auto grid max-w-5xl gap-6" aria-label="Demo">
      <div className="overflow-hidden rounded-md border border-zinc-800 bg-[#080c12] shadow-2xl shadow-black/40">
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="aspect-video w-full"
          referrerPolicy="strict-origin-when-cross-origin"
          src="https://www.youtube-nocookie.com/embed/rOgAuzpOOgE?rel=0"
          title="Quadratics demo video"
        />
      </div>

      <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950/55 shadow-2xl shadow-black/25">
        <div className="flex h-12 items-center justify-between border-b border-zinc-800 bg-[#080c12]/95 px-4">
          <div className="flex h-full items-center border-b border-emerald-400/60 px-2 font-mono text-sm font-semibold text-zinc-100">
            README.md
          </div>
          <div className="flex items-center gap-2">
            <div className="group/toc relative">
              <button
                aria-label="Filter README headings"
                className="flex h-9 w-9 items-center justify-center rounded border border-zinc-800 bg-zinc-900/80 text-zinc-400 transition hover:border-emerald-400/45 hover:text-emerald-200"
                type="button"
              >
                <TocIcon />
              </button>
              <div className="absolute right-0 top-9 z-20 hidden w-72 pt-2 group-focus-within/toc:block group-hover/toc:block">
                <div className="rounded-md border border-zinc-700 bg-[#080c12]/95 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.68)] backdrop-blur">
                  <label className="flex h-10 items-center gap-2 rounded border border-emerald-400/45 bg-black/30 px-3 text-sm text-zinc-300">
                    <FilterIcon />
                    <input
                      className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-zinc-600"
                      onChange={(event) => setHeadingFilter(event.currentTarget.value)}
                      placeholder="Filter headings"
                      value={headingFilter}
                    />
                  </label>
                  <nav className="mt-3 grid max-h-72 gap-1 overflow-auto text-sm" aria-label="README headings">
                    {filteredHeadings.map((heading) => (
                      <a
                        className="rounded px-2 py-1.5 text-zinc-300 transition hover:bg-emerald-400/10 hover:text-emerald-200"
                        href={`#${heading.id}`}
                        key={heading.id}
                        style={{paddingLeft: `${(heading.depth - 1) * 14 + 8}px`}}
                      >
                        {heading.text}
                      </a>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
        <article className="prose-invert p-6 text-zinc-200 sm:p-8">
          <MarkdownBlocks blocks={blocks} />
        </article>
      </div>
    </section>
  );
}

function modeButtonClass(active: boolean) {
  return [
    "h-9 rounded-sm border px-4 transition",
    active
      ? "border-emerald-400/45 bg-emerald-400/10 text-emerald-200 shadow-[inset_0_0_18px_rgba(52,211,153,0.08)]"
      : "border-transparent text-zinc-400 hover:border-zinc-800 hover:text-zinc-100"
  ].join(" ");
}

type MarkdownBlock = HeadingBlock | ParagraphBlock | ListBlock | CodeBlock;
type HeadingBlock = {type: "heading"; depth: number; text: string; id: string};
type ParagraphBlock = {type: "paragraph"; text: string};
type ListBlock = {type: "list"; items: string[]};
type CodeBlock = {type: "code"; text: string};

function MarkdownBlocks({blocks}: {blocks: MarkdownBlock[]}) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = `h${Math.min(block.depth, 3)}` as "h1" | "h2" | "h3";
          return (
            <HeadingTag
              className={headingClass(block.depth)}
              id={block.id}
              key={`${block.id}-${index}`}
            >
              {renderInlineMarkdown(block.text)}
            </HeadingTag>
          );
        }
        if (block.type === "list") {
          return (
            <ul className="my-4 list-disc space-y-2 pl-7 text-sm leading-7 text-zinc-300" key={index}>
              {block.items.map((item) => (
                <li key={item}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "code") {
          return (
            <pre className="my-5 overflow-auto rounded border border-zinc-800 bg-black/35 p-4 font-mono text-xs leading-6 text-zinc-300" key={index}>
              {block.text}
            </pre>
          );
        }
        return (
          <p className="my-4 max-w-3xl text-sm leading-7 text-zinc-200 sm:text-base" key={index}>
            {renderInlineMarkdown(block.text)}
          </p>
        );
      })}
    </>
  );
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.split("\n");
  const slugCounts = new Map<string, number>();
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({type: "code", text: codeLines.join("\n")});
      index += 1;
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const text = heading[2].trim();
      const baseSlug = slugify(text);
      const count = slugCounts.get(baseSlug) ?? 0;
      slugCounts.set(baseSlug, count + 1);
      blocks.push({
        type: "heading",
        depth: heading[1].length,
        text,
        id: count === 0 ? baseSlug : `${baseSlug}-${count + 1}`
      });
      index += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, "").trim());
        index += 1;
      }
      blocks.push({type: "list", items});
      continue;
    }
    const paragraphLines = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !lines[index].startsWith("```")
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({type: "paragraph", text: paragraphLines.join(" ")});
  }
  return blocks;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-[0.9em] text-emerald-200" key={match.index}>
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(<strong className="font-semibold text-zinc-100" key={match.index}>{token.slice(2, -2)}</strong>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function headingClass(depth: number) {
  if (depth === 1) {
    return "mb-4 mt-3 border-b border-zinc-800 pb-3 text-3xl font-bold tracking-tight text-zinc-100";
  }
  if (depth === 2) {
    return "mb-3 mt-8 border-b border-zinc-800 pb-2 text-2xl font-semibold tracking-tight text-zinc-100";
  }
  return "mb-2 mt-6 text-lg font-semibold text-zinc-100";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "section";
}

function TocIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}
