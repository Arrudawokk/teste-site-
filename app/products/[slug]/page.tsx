import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { ProductEventTracker } from "@/components/analytics/ProductEventTracker";
import { ProductContent } from "@/components/product/ProductContent";
import { ProductHero } from "@/components/product/ProductHero";
import { getCategoryBySlug, getProductBySlug, getProductPath, getPublishedProducts } from "@/lib/catalog";
import { SITE_URL, siteConfig } from "@/lib/site";

type ProductPageProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedProducts().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = getProductBySlug((await params).slug);
  if (!product) return {};

  const productPath = getProductPath(product);
  const openGraphImage = product.seo.openGraphImage ?? product.coverImage;
  const twitterImage = product.seo.twitterImage ?? openGraphImage;

  return {
    title: product.seo.title,
    description: product.seo.description,
    keywords: product.seo.keywords,
    authors: [{ name: product.author }],
    category: getCategoryBySlug(product.category)?.name,
    alternates: { canonical: productPath },
    openGraph: {
      title: product.seo.title,
      description: product.seo.description,
      type: "website",
      url: productPath,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      images: [{ url: openGraphImage, alt: product.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.seo.title,
      description: product.seo.description,
      images: [twitterImage],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = getProductBySlug((await params).slug);
  if (!product) notFound();

  const productPath = getProductPath(product);
  const category = getCategoryBySlug(product.category);
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${SITE_URL}${productPath}#product`,
    name: product.title,
    description: product.description,
    image: product.gallery.map((image) => `${SITE_URL}${image}`),
    category: category?.name,
    brand: { "@type": "Brand", name: siteConfig.name },
    author: { "@type": "Organization", name: product.author },
    offers: {
      "@type": "Offer",
      priceCurrency: product.currency,
      price: product.price.toFixed(2),
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}${productPath}`,
    },
  };

  return (
    <>
      <Header productHref="#comprar" ctaLabel="Comprar agora" conversionMode />
      <main>
        <ProductHero product={product} />
        <ProductContent product={product} />
      </main>
      <Footer />
      <ProductEventTracker event="ViewContent" product={{ slug: product.slug, title: product.title, price: product.price, currency: product.currency, category: category?.name ?? product.category }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replace(/</g, "\\u003c") }} />
    </>
  );
}
