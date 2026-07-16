export type ProductCategorySlug =
  | "marketing"
  | "ia"
  | "negocios"
  | "produtividade"
  | "design"
  | "automacao";

export type ProductStatus = "draft" | "published" | "archived";

export type ProductCategory = {
  slug: ProductCategorySlug;
  name: string;
  description: string;
};

export type ProductBenefit = {
  title: string;
  description: string;
};

export type ProductModule = {
  title: string;
  description: string;
  topics: string[];
};

export type ProductFaq = {
  question: string;
  answer: string;
};

export type ProductAudience = {
  title: string;
  description: string;
};

export type ProductTestimonial = {
  name: string;
  role: string;
  quote: string;
};

export type ProductSeo = {
  title: string;
  description: string;
  keywords: string[];
  openGraphImage?: string;
  twitterImage?: string;
};

export type ProductDelivery = {
  /** Chave privada do objeto dentro do bucket configurado no provider. */
  objectKey: string;
  fileName: string;
  contentType: "application/pdf" | "application/epub+zip" | "application/zip";
};

export type Product = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  shortDescription: string;
  price: number;
  oldPrice?: number;
  currency: "BRL";
  coverImage: string;
  gallery: string[];
  category: ProductCategorySlug;
  author: string;
  benefits: ProductBenefit[];
  learning: ProductBenefit[];
  modules: ProductModule[];
  audience: ProductAudience[];
  faq: ProductFaq[];
  testimonials: ProductTestimonial[];
  checkoutUrl: string;
  featured: boolean;
  badge?: string;
  status: ProductStatus;
  seo: ProductSeo;
  format: string;
  accessLabel: string;
  guaranteeDays: number;
  platforms: string[];
  delivery: ProductDelivery;
};
