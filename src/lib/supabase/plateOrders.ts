import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente del flujo de PLACAS: solicitud, pedido, pago (preparado, sin pasarela),
 * envio y guia. La identidad SIEMPRE la determina el backend con auth.uid(); el
 * frontend nunca envia user_id ni importes.
 */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_to_ship"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded";

export type ShipmentStatus =
  | "pending"
  | "preparing"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready_to_ship: "Listo para envío",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  pending: "Pendiente",
  preparing: "Preparando",
  shipped: "Enviado",
  in_transit: "En tránsito",
  out_for_delivery: "En reparto",
  delivered: "Entregado",
  exception: "Novedad",
  cancelled: "Cancelado",
};

export const SHIPMENT_EVENT_LABEL: Record<string, string> = {
  CREATED: "Envío creado",
  PREPARED: "Preparado",
  SHIPPED: "Enviado",
  IN_TRANSIT: "En tránsito",
  OUT_FOR_DELIVERY: "En reparto",
  DELIVERED: "Entregado",
  EXCEPTION: "Novedad",
  CANCELLED: "Cancelado",
};

export function plateErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }
  return "No fue posible completar la operación.";
}

export function formatCOP(amount: number, currency = "COP"): string {
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString("es-CO")}`;
  }
}

/* ---------------- Usuario ---------------- */

export interface PetForPlate {
  petKind: "owner";
  petId: string;
  name: string;
  species: string;
  plateCode: string | null;
  plateStatus: string | null;
  activeOrderRef: string | null;
  activeOrderStatus: OrderStatus | null;
  eligible: boolean;
  reason: string | null;
}

export async function fetchMyPetsForPlate(supabase: SupabaseClient): Promise<PetForPlate[]> {
  const { data, error } = await supabase.rpc("my_pets_for_plate");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    petKind: "owner",
    petId: String(row.pet_id),
    name: String(row.name),
    species: String(row.species),
    plateCode: (row.plate_code as string) ?? null,
    plateStatus: (row.plate_status as string) ?? null,
    activeOrderRef: (row.active_order_ref as string) ?? null,
    activeOrderStatus: (row.active_order_status as OrderStatus) ?? null,
    eligible: Boolean(row.eligible),
    reason: (row.reason as string) ?? null,
  }));
}

export interface PlateQuote {
  zoneId: string;
  zoneName: string;
  productAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
}

export async function fetchPlateQuote(
  supabase: SupabaseClient,
  petId: string,
  city: string,
): Promise<PlateQuote> {
  const { data, error } = await supabase.rpc("plate_order_quote", {
    p_pet_kind: "owner",
    p_pet_id: petId,
    p_city: city,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return {
    zoneId: String(row.zone_id),
    zoneName: String(row.zone_name),
    productAmount: Number(row.product_amount),
    shippingAmount: Number(row.shipping_amount),
    totalAmount: Number(row.total_amount),
    currency: String(row.currency),
  };
}

export interface CreateOrderInput {
  petId: string;
  firstName: string;
  lastName: string;
  city: string;
  neighborhood: string;
  address: string;
  phone: string;
  email: string;
  useAccountEmail: boolean;
}

export async function createPlateOrder(
  supabase: SupabaseClient,
  input: CreateOrderInput,
): Promise<{ orderId: string; reference: string; totalAmount: number }> {
  const { data, error } = await supabase.rpc("plate_order_create", {
    p_pet_kind: "owner",
    p_pet_id: input.petId,
    p_first: input.firstName,
    p_last: input.lastName,
    p_city: input.city,
    p_neighborhood: input.neighborhood,
    p_address: input.address,
    p_phone: input.phone,
    p_email: input.email,
    p_use_account_email: input.useAccountEmail,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return {
    orderId: String(row.order_id),
    reference: String(row.reference),
    totalAmount: Number(row.total_amount),
  };
}

export interface MyOrderRow {
  id: string;
  reference: string;
  petName: string | null;
  plateCode: string | null;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  shipmentStatus: ShipmentStatus | null;
  trackingNumber: string | null;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

export async function fetchMyPlateOrders(supabase: SupabaseClient): Promise<MyOrderRow[]> {
  const { data, error } = await supabase.rpc("my_plate_orders");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    reference: String(row.reference),
    petName: (row.pet_name as string) ?? null,
    plateCode: (row.plate_code as string) ?? null,
    orderStatus: row.order_status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    shipmentStatus: (row.shipment_status as ShipmentStatus) ?? null,
    trackingNumber: (row.tracking_number as string) ?? null,
    totalAmount: Number(row.total_amount),
    currency: String(row.currency),
    createdAt: String(row.created_at),
  }));
}

export interface OrderDetail {
  id: string;
  reference: string;
  petName: string | null;
  plateCode: string | null;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  productAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
  city: string;
  neighborhood: string;
  address: string;
  recipient: string;
  phone: string;
  email: string;
  createdAt: string;
  shipment: {
    trackingNumber: string;
    carrier: string | null;
    service: string | null;
    status: ShipmentStatus;
    shippedAt: string | null;
    deliveredAt: string | null;
  } | null;
  shipmentEvents: { status: string; description: string | null; createdAt: string }[];
  orderEvents: { event: string; note: string | null; createdAt: string }[];
}

export async function fetchMyOrderDetail(
  supabase: SupabaseClient,
  orderId: string,
): Promise<OrderDetail> {
  const { data, error } = await supabase.rpc("my_plate_order_detail", { p_order_id: orderId });
  if (error) throw error;
  const row = data as Record<string, unknown>;
  const s = row.shipment as Record<string, unknown> | null;
  return {
    id: String(row.id),
    reference: String(row.reference),
    petName: (row.pet_name as string) ?? null,
    plateCode: (row.plate_code as string) ?? null,
    orderStatus: row.order_status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    productAmount: Number(row.product_amount),
    shippingAmount: Number(row.shipping_amount),
    totalAmount: Number(row.total_amount),
    currency: String(row.currency),
    city: String(row.city),
    neighborhood: String(row.neighborhood),
    address: String(row.address),
    recipient: String(row.recipient),
    phone: String(row.phone),
    email: String(row.email),
    createdAt: String(row.created_at),
    shipment: s
      ? {
          trackingNumber: String(s.tracking_number),
          carrier: (s.carrier as string) ?? null,
          service: (s.service as string) ?? null,
          status: s.status as ShipmentStatus,
          shippedAt: (s.shipped_at as string) ?? null,
          deliveredAt: (s.delivered_at as string) ?? null,
        }
      : null,
    shipmentEvents: ((row.shipment_events as Record<string, unknown>[]) ?? []).map((e) => ({
      status: String(e.status),
      description: (e.description as string) ?? null,
      createdAt: String(e.created_at),
    })),
    orderEvents: ((row.order_events as Record<string, unknown>[]) ?? []).map((e) => ({
      event: String(e.event),
      note: (e.note as string) ?? null,
      createdAt: String(e.created_at),
    })),
  };
}

export async function cancelPlateOrder(supabase: SupabaseClient, orderId: string): Promise<void> {
  const { error } = await supabase.rpc("plate_order_cancel", { p_order_id: orderId });
  if (error) throw error;
}

/* ---------------- Admin ---------------- */

export interface AdminOrderRow {
  id: string;
  reference: string;
  userEmail: string | null;
  petName: string | null;
  plateCode: string | null;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  shipmentStatus: ShipmentStatus | null;
  trackingNumber: string | null;
  totalAmount: number;
  currency: string;
  city: string;
  createdAt: string;
  totalCount: number;
}

export async function adminListPlateOrders(
  supabase: SupabaseClient,
  opts: { status?: string | null; query?: string | null; limit?: number; offset?: number } = {},
): Promise<{ rows: AdminOrderRow[]; total: number }> {
  const { data, error } = await supabase.rpc("plate_order_admin_list", {
    p_status: opts.status ?? null,
    p_query: opts.query ?? null,
    p_limit: opts.limit ?? 50,
    p_offset: opts.offset ?? 0,
  });
  if (error) throw error;
  const list = (data ?? []) as Record<string, unknown>[];
  return {
    total: list.length > 0 ? Number(list[0].total_count) : 0,
    rows: list.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      userEmail: (row.user_email as string) ?? null,
      petName: (row.pet_name as string) ?? null,
      plateCode: (row.plate_code as string) ?? null,
      orderStatus: row.order_status as OrderStatus,
      paymentStatus: row.payment_status as PaymentStatus,
      shipmentStatus: (row.shipment_status as ShipmentStatus) ?? null,
      trackingNumber: (row.tracking_number as string) ?? null,
      totalAmount: Number(row.total_amount),
      currency: String(row.currency),
      city: String(row.city),
      createdAt: String(row.created_at),
      totalCount: Number(row.total_count),
    })),
  };
}

export async function adminOrderDetail(
  supabase: SupabaseClient,
  orderId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("plate_order_admin_detail", { p_order_id: orderId });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function adminSetPaymentStatus(
  supabase: SupabaseClient,
  orderId: string,
  status: PaymentStatus,
  method?: string | null,
  providerReference?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("plate_payment_admin_set_status", {
    p_order_id: orderId,
    p_status: status,
    p_method: method ?? null,
    p_provider_reference: providerReference ?? null,
  });
  if (error) throw error;
}

export async function adminAssignPlate(
  supabase: SupabaseClient,
  orderId: string,
  tagId: string,
): Promise<void> {
  const { error } = await supabase.rpc("plate_order_admin_assign_plate", {
    p_order_id: orderId,
    p_tag_id: tagId,
  });
  if (error) throw error;
}

export async function adminCreateShipment(
  supabase: SupabaseClient,
  orderId: string,
  carrier?: string | null,
  service?: string | null,
): Promise<{ shipmentId: string; trackingNumber: string }> {
  const { data, error } = await supabase.rpc("shipment_admin_create", {
    p_order_id: orderId,
    p_carrier: carrier ?? null,
    p_service: service ?? null,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return { shipmentId: String(row.shipment_id), trackingNumber: String(row.tracking_number) };
}

export async function adminAddShipmentEvent(
  supabase: SupabaseClient,
  shipmentId: string,
  status: string,
  description?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("shipment_admin_add_event", {
    p_shipment_id: shipmentId,
    p_status: status,
    p_description: description ?? null,
  });
  if (error) throw error;
}

export interface AdminShipmentRow {
  id: string;
  orderReference: string;
  trackingNumber: string;
  carrier: string | null;
  service: string | null;
  status: ShipmentStatus;
  petName: string | null;
  city: string;
  userEmail: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export async function adminListShipments(
  supabase: SupabaseClient,
  status?: string | null,
): Promise<AdminShipmentRow[]> {
  const { data, error } = await supabase.rpc("shipment_admin_list", { p_status: status ?? null });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    orderReference: String(row.order_reference),
    trackingNumber: String(row.tracking_number),
    carrier: (row.carrier as string) ?? null,
    service: (row.service as string) ?? null,
    status: row.status as ShipmentStatus,
    petName: (row.pet_name as string) ?? null,
    city: String(row.city),
    userEmail: (row.user_email as string) ?? null,
    shippedAt: (row.shipped_at as string) ?? null,
    deliveredAt: (row.delivered_at as string) ?? null,
    createdAt: String(row.created_at),
  }));
}
