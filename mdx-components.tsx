import type { MDXComponents } from "mdx/types";

import { Term } from "@/components/term";

// Required by @next/mdx in the App Router. Lessons are loaded with a dynamic
// import, and next/link can't be resolved through that path in dev, so
// internal links are plain anchors (a full page load is fine here).
const components: MDXComponents = {
  a: ({ href = "", ...props }) =>
    href.startsWith("/") ? (
      <a href={href} {...props} />
    ) : (
      <a href={href} target="_blank" rel="noreferrer" {...props} />
    ),
  // <Term id="…"> gives lessons the same hover definitions as the app.
  Term,
  // Wide tables scroll on their own rather than stretching the lesson.
  table: (props) => (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
