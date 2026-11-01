import Link from "next/link";

import { glossary, glossaryById, glossaryGroups } from "@/content/glossary";

export default function GlossaryPage() {
  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Glossary</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Every term the app uses, in plain words. Dotted-underlined words on any page link here. New
        to RAG? Read <Link href="/learn/start-here">Start here</Link> first; it uses these terms in
        order.
      </p>

      <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {glossaryGroups.map((g) => (
          <a key={g} href={`#${slug(g)}`} className="underline underline-offset-2">
            {g}
          </a>
        ))}
      </nav>

      {glossaryGroups.map((group) => (
        <section key={group} id={slug(group)} className="mt-8 scroll-mt-6">
          <h2 className="text-lg font-semibold">{group}</h2>
          <dl className="mt-3 flex flex-col divide-y rounded-lg border">
            {glossary
              .filter((g) => g.group === group)
              .map((g) => (
                <div
                  key={g.id}
                  id={g.id}
                  className="target:bg-muted/60 scroll-mt-6 p-4 transition-colors"
                >
                  <dt className="font-medium">{g.term}</dt>
                  <dd className="mt-1 flex flex-col gap-2 text-sm">
                    <p>{g.short}</p>
                    {g.long && <p className="text-muted-foreground">{g.long}</p>}
                    {g.example && (
                      <p className="text-muted-foreground border-l-2 pl-3">{g.example}</p>
                    )}
                    {g.see && (
                      <p className="text-muted-foreground text-xs">
                        See also:{" "}
                        {g.see.map((id, i) => (
                          <span key={id}>
                            {i > 0 && ", "}
                            <a href={`#${id}`} className="underline underline-offset-2">
                              {glossaryById.get(id)?.term ?? id}
                            </a>
                          </span>
                        ))}
                      </p>
                    )}
                  </dd>
                </div>
              ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "-");
