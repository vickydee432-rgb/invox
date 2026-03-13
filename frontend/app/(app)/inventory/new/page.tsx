import InventoryNewProductClient from "./product-client";

export default function InventoryNewProductPage({
  searchParams
}: {
  searchParams?: { barcode?: string };
}) {
  return <InventoryNewProductClient barcode={searchParams?.barcode || ""} />;
}
