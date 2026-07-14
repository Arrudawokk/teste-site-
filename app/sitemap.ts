import type { MetadataRoute } from "next";
import { getArticlePath, getPublishedArticles } from "@/content/articles";
import { getProductPath, getPublishedProducts } from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const productEntries: MetadataRoute.Sitemap = getPublishedProducts().map((product) => ({
    url: `${SITE_URL}${getProductPath(product)}`,
    changeFrequency: "monthly",
    priority: product.featured ? 0.9 : 0.8,
    images: product.gallery.map((image) => `${SITE_URL}${image}`),
  }));
  const articleEntries: MetadataRoute.Sitemap = getPublishedArticles().map((article) => ({
    url: `${SITE_URL}${getArticlePath(article)}`,
    lastModified: new Date(`${article.updatedAt}T00:00:00Z`),
    changeFrequency: "monthly",
    priority: article.featured ? 0.8 : 0.7,
  }));
  const institutionalEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.85 },
    { url: `${SITE_URL}/sobre`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/contato`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacidade`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/termos`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/cookies`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/LGPD`, changeFrequency: "yearly", priority: 0.3 },
  ];

  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...institutionalEntries,
    ...articleEntries,
    ...productEntries,
  ];
}
