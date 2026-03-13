import InventoryEditStockClient from "./stock-edit-client";

export default function InventoryEditStockPage({
  searchParams
}: {
  searchParams?: { productId?: string; branchId?: string; onHand?: string };
}) {
  return (
    <InventoryEditStockClient
      productId={searchParams?.productId || ""}
      branchId={searchParams?.branchId || ""}
      onHand={searchParams?.onHand || ""}
    />
  );
}
