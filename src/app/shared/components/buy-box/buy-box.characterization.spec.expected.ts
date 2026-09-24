// Valores capturados del buy-box ANTES de refactorizar (ver buy-box.characterization.spec.ts).
// No editar a mano: si un cambio los altera, cambió lo que ve el cliente.
export const BUY_BOX_EXPECTED: Record<string, unknown> = {
  bb_agregar_item: [{"variantId":"v96","productId":"p1","productName":"Cono 10","slug":"cono-10","sku":"C-96","price_ars":47636,"price_usd":32.85,"cost_currency":"USD","cost_usd":1.9,"cost_usd_master":19,"quantity":10,"imageUrl":"/olivo-pack.webp","stock":10,"units_per_pack":96,"units_per_pack_master":96,"has_packaging":true,"volume_cc":10,"product_volume_cc":10}],
  bb_precio: [{"price_ars":52533,"price_usd":36.23,"price_sin_impuestos_ars":52533.33},52533,96,{"price_ars":47636,"price_usd":32.85,"price_sin_impuestos_ars":47635.56},333452,672,{"price_ars":53590,"price_usd":36.96,"price_sin_impuestos_ars":53590}],
  bb_precio_conCarrito: {"price_ars":50084,"price_usd":34.54,"price_sin_impuestos_ars":50084.44},
};
