import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** A model answer rendered as Markdown, without chat's clickable citations. */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
