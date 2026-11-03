"use client";

import { Maximize2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

type Source =
  /** An image in public/learn/, at its intrinsic size (sets the aspect ratio). */
  | { src: string; width: number; height: number; children?: never }
  /** An inline diagram, e.g. one from components/learn/diagrams/. */
  | { src?: never; width?: never; height?: never; children: React.ReactNode };

/**
 * A picture in a lesson, with a caption. Click (or Enter) opens it full size in
 * a native <dialog>; Esc or any click closes it. Inline diagrams are drawn at
 * 720 wide, the lesson column's width, so their text is page-sized; on a phone
 * the full-size view keeps that width and scrolls sideways.
 */
export function Figure({
  alt,
  caption,
  ...source
}: { alt: string; caption?: React.ReactNode } & Source) {
  const dialog = useRef<HTMLDialogElement>(null);
  // The full-size copy renders only while open, so a closed dialog doesn't
  // hold a second copy of every diagram in the page.
  const [open, setOpen] = useState(false);

  function show() {
    setOpen(true);
    dialog.current?.showModal();
  }

  return (
    <figure className="not-prose my-8">
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-label={`${alt} View full size.`}
        className="group border-border focus-visible:ring-ring relative block w-full cursor-zoom-in rounded-lg border bg-white p-3 outline-none focus-visible:ring-2"
      >
        <Picture alt={alt} {...source} />
        <span className="bg-background/90 text-muted-foreground border-border absolute top-2 right-2 rounded-md border p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="size-3.5" aria-hidden />
        </span>
      </button>
      {caption && (
        <figcaption className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {caption}
        </figcaption>
      )}
      <dialog
        ref={dialog}
        aria-label={alt}
        onClick={() => dialog.current?.close()}
        onClose={() => setOpen(false)}
        className="m-auto max-h-[95vh] w-[min(1200px,calc(100vw-1rem))] max-w-none cursor-zoom-out overflow-auto rounded-lg bg-white p-4 backdrop:bg-black/60"
      >
        {open && (
          <div className="min-w-[720px]">
            <Picture alt={alt} full {...source} />
          </div>
        )}
      </dialog>
    </figure>
  );
}

function Picture({ alt, full, ...source }: { alt: string; full?: boolean } & Source) {
  if (source.src === undefined) {
    // A span, because the inline copy sits inside a <button>.
    return (
      <span role="img" aria-label={alt} className="block">
        {source.children}
      </span>
    );
  }
  return (
    <Image
      src={source.src}
      alt={alt}
      width={source.width}
      height={source.height}
      loading={full ? "eager" : "lazy"}
      sizes={full ? "100vw" : "(max-width: 768px) 100vw, 720px"}
      className="h-auto w-full"
    />
  );
}
