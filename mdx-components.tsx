import type { MDXComponents } from "mdx/types";
import Link from "next/link";

// Required by @next/mdx in the App Router. Internal links use next/link so
// "Try it" links in lessons navigate client-side into the app.
const components: MDXComponents = {
  a: ({ href = "", ...props }) =>
    href.startsWith("/") ? (
      <Link href={href} {...props} />
    ) : (
      <a href={href} target="_blank" rel="noreferrer" {...props} />
    ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
