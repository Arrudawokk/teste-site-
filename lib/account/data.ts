import "server-only";
import { redirect } from "next/navigation";
import { formatProductPrice, getCategoryBySlug, getProductBySlug, type Product } from "@/lib/catalog";
import { getOrderStore, type OrderRecord } from "@/lib/payments/orderStore";
import { getCustomerSession } from "./session";
import type { CustomerProfile, CustomerSession } from "./types";

export type CustomerOrder = {
  id: string;
  productSlug: string;
  productTitle: string;
  amount: string;
  status: OrderRecord["status"];
  accessStatus: OrderRecord["accessStatus"];
  method: OrderRecord["method"];
  gateway: "Mercado Pago" | "Stripe";
  purchasedAt: string;
};

export type LibraryProduct = {
  orderId: string;
  product: Product;
  category: string;
  purchasedAt: string;
  downloadUrl: string;
  accessUrl: string;
};

export type CustomerAccountData = {
  profile: CustomerProfile;
  orders: CustomerOrder[];
  library: LibraryProduct[];
};

export async function requireCustomerSession(): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) redirect("/account/entrar");
  return session;
}

export async function getCustomerAccountData(): Promise<CustomerAccountData> {
  const session = await requireCustomerSession();
  const records = await getOrderStore().listByPayerEmail(session.profile.email);
  const orders = records.map(toCustomerOrder);
  const approvedByProduct = new Map<string, OrderRecord>();
  for (const order of records) {
    if (order.status === "approved" && order.accessStatus === "granted" && !approvedByProduct.has(order.productSlug)) {
      approvedByProduct.set(order.productSlug, order);
    }
  }
  const library = [...approvedByProduct.values()].flatMap((order) => {
    const product = getProductBySlug(order.productSlug);
    if (!product) return [];
    return [{
      orderId: order.externalReference,
      product,
      category: getCategoryBySlug(product.category)?.name ?? product.category,
      purchasedAt: order.accessGrantedAt ?? order.updatedAt,
      downloadUrl: `/api/account/download?orderId=${encodeURIComponent(order.externalReference)}`,
      accessUrl: `/products/${encodeURIComponent(product.slug)}`,
    }];
  });
  return { profile: session.profile, orders, library };
}

export async function getAuthorizedOrder(orderId: string): Promise<OrderRecord | null> {
  const session = await getCustomerSession();
  if (!session) return null;
  const order = await getOrderStore().getByExternalReference(orderId);
  if (!order || order.payerEmail.trim().toLowerCase() !== session.profile.email.trim().toLowerCase()) return null;
  if (order.status !== "approved" || order.accessStatus !== "granted") return null;
  return order;
}

function toCustomerOrder(order: OrderRecord): CustomerOrder {
  const product = getProductBySlug(order.productSlug);
  return {
    id: order.externalReference,
    productSlug: order.productSlug,
    productTitle: product?.title ?? "Produto digital",
    amount: formatProductPrice({ price: order.amount, currency: order.currency as "BRL" }),
    status: order.status,
    accessStatus: order.accessStatus,
    method: order.method,
    gateway: order.gateway === "stripe" ? "Stripe" : "Mercado Pago",
    purchasedAt: order.createdAt,
  };
}
