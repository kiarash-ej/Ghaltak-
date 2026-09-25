import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, findGuide, type HelpBlock } from "../guides";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

// Only the guides above exist; any other slug is a 404 without rendering.
export const dynamicParams = false;

export async function generateMetadata(props: PageProps<"/help/[slug]">): Promise<Metadata> {
  const guide = findGuide((await props.params).slug);
  return { title: guide ? `${guide.title} | راهنمای غلتک` : "راهنما | غلتک" };
}

function Block({ block }: { block: HelpBlock }) {
  switch (block.kind) {
    case "p":
      return <p className="leading-8 text-neutral-800">{block.text}</p>;
    case "steps":
      return (
        <ol className="flex list-decimal flex-col gap-2 ps-6 leading-7 text-neutral-800 marker:text-neutral-400">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case "tip":
      return (
        <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm leading-7 text-sky-900">
          <span className="font-semibold">نکته: </span>
          {block.text}
        </p>
      );
    case "image":
      return (
        <figure className="flex flex-col items-center gap-2">
          <Image
            src={block.image.src}
            alt={block.image.alt}
            width={block.image.width}
            height={block.image.height}
            sizes="(min-width: 640px) 390px, 90vw"
            className="h-auto w-full max-w-[390px] rounded-xl border border-neutral-200 shadow-sm"
          />
          {block.image.caption && (
            <figcaption className="text-sm text-neutral-500">{block.image.caption}</figcaption>
          )}
        </figure>
      );
  }
}

export default async function HelpGuidePage(props: PageProps<"/help/[slug]">) {
  const guide = findGuide((await props.params).slug);
  if (!guide) notFound();

  const index = GUIDES.indexOf(guide);
  const next = GUIDES[index + 1];

  return (
    <article className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/help" className="text-sm text-neutral-500 hover:text-neutral-800">
          → همهٔ راهنماها
        </Link>
        <h1 className="text-2xl font-bold">{guide.title}</h1>
        <p className="text-neutral-600">{guide.summary}</p>
      </div>

      {guide.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>
      ))}

      <nav className="flex flex-wrap justify-between gap-3 border-t border-neutral-200 pt-6 text-sm">
        <Link href="/help" className="font-medium text-neutral-700 hover:text-neutral-900">
          همهٔ راهنماها و پرسش‌های پرتکرار
        </Link>
        {next && (
          <Link href={`/help/${next.slug}`} className="font-medium text-neutral-900 underline underline-offset-4">
            راهنمای بعدی: {next.title}
          </Link>
        )}
      </nav>
    </article>
  );
}
