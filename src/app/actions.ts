"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { checkAll, checkOne } from "@/lib/monitor";

export async function addProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const goodsId = String(formData.get("goods_id") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const fetcher = String(formData.get("fetcher") ?? "") || config.defaultFetcher;
  const thresholdPrice = Number(formData.get("threshold_price"));

  if (!name || !goodsId || !Number.isFinite(thresholdPrice) || thresholdPrice <= 0) {
    return;
  }

  await prisma.product.create({
    data: { name, goodsId, url, fetcher, thresholdPrice },
  });
  revalidatePath("/");
}

export async function deleteProduct(formData: FormData) {
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) {
    await prisma.product.delete({ where: { id } });
  }
  revalidatePath("/");
}

export async function toggleProduct(formData: FormData) {
  const id = Number(formData.get("id"));
  const product = await prisma.product.findUnique({ where: { id } });
  if (product) {
    await prisma.product.update({
      where: { id },
      data: { active: !product.active },
    });
  }
  revalidatePath("/");
}

export async function checkProductNow(formData: FormData) {
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) {
    await checkOne(id);
  }
  revalidatePath("/");
  revalidatePath(`/products/${id}`);
}

export async function checkAllNow() {
  await checkAll();
  revalidatePath("/");
}
