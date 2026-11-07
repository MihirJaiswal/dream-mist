import { source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { pageMetadata, siteName, siteUrl } from "@/lib/site";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/** Docs page */
export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }
  const MDX = page.data.body;
  //Breadcrumbs for search results: Docs, then the page
  const crumbs = [{ name: "Docs", url: "/docs" }, ...(page.url === "/docs" ? [] : [{ name: page.data.title, url: page.url }])];
  const structured = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: siteName, url: "" }, ...crumbs].map(({ name, url }, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: `${siteUrl}${url}`,
    })),
  };
  return (
    <DocsPage toc={page.data.toc}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

//Only the pages built ahead of time exist: any other path is a static 404, never rendered on a server
export const dynamicParams = false;

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }
  const meta = pageMetadata({ title: page.data.title, description: page.data.description ?? "", path: page.url });
  return { ...meta, openGraph: { ...meta.openGraph, type: "article" } };
}
