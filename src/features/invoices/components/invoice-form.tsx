"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import {
  requiresPaymentReference,
  validatePaymentDetails,
} from "@/lib/invoices/payment";
import type { Customer, InventoryItem, Invoice, JobOrder, Vehicle } from "@/types/database";
import { getJobOrderInvoicePrefill } from "../actions";
import {
  invoiceFormSchema,
  type InvoiceFormValues,
} from "../schemas";

interface InvoiceFormProps {
  invoice?: Invoice & {
    invoice_items?: { inventory_item_id: string | null; part_name: string; quantity: number; unit_price: number }[];
    job_orders?: Pick<JobOrder, "status" | "job_order_number"> | null;
  };
  jobOrders?: Pick<JobOrder, "id" | "job_order_number" | "status">[];
  customers: Pick<Customer, "id" | "full_name" | "customer_number">[];
  vehicles: Pick<Vehicle, "id" | "plate_number" | "brand" | "model" | "customer_id">[];
  inventory: Pick<InventoryItem, "id" | "part_number" | "part_name" | "selling_price" | "quantity">[];
  onSubmit: (values: InvoiceFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function InvoiceForm({
  invoice,
  jobOrders = [],
  customers,
  vehicles: allVehicles,
  inventory,
  onSubmit,
  onCancel,
  isLoading = false,
}: InvoiceFormProps) {
  const [prefillLoading, setPrefillLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      customer_id: invoice?.customer_id ?? "",
      vehicle_id: invoice?.vehicle_id ?? "",
      job_order_id: invoice?.job_order_id ?? "",
      invoice_date: invoice?.invoice_date ?? new Date().toISOString().split("T")[0],
      chassis_number: invoice?.chassis_number ?? "",
      engine_number: invoice?.engine_number ?? "",
      repair_description: invoice?.repair_description ?? "",
      recommendation: invoice?.recommendation ?? "",
      parts_used: invoice?.parts_used ?? "",
      labor_cost: invoice?.labor_cost ?? 0,
      technician_name: invoice?.technician_name ?? "",
      amount_paid: invoice?.amount_paid ?? 0,
      payment_method: invoice?.payment_method ?? "",
      payment_reference: invoice?.payment_reference ?? "",
      payer_account_name: invoice?.payer_account_name ?? "",
      items:
        invoice?.invoice_items?.map((item) => ({
          inventory_item_id: item.inventory_item_id ?? "",
          part_name: item.part_name,
          quantity: Math.round(Number(item.quantity)),
          unit_price: item.unit_price,
        })) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const customerId = useWatch({ control, name: "customer_id" });
  const vehicleId = useWatch({ control, name: "vehicle_id" });
  const jobOrderId = useWatch({ control, name: "job_order_id" });
  const laborCost = useWatch({ control, name: "labor_cost" });
  const amountPaidValue = useWatch({ control, name: "amount_paid" });
  const paymentMethod = useWatch({ control, name: "payment_method" });
  const items = useWatch({ control, name: "items" });

  const isCreate = !invoice;
  const isReleased = invoice?.job_orders?.status === "released";
  const canCreateInvoice = !isCreate || (!!jobOrderId && jobOrders.length > 0);
  const isFormDisabled = (isCreate && !canCreateInvoice) || isReleased;
  const lockFromJobOrder = !!jobOrderId || !!invoice?.job_order_id;
  const lockPartsAndLabor = !!invoice || !!jobOrderId;

  const filteredVehicles = customerId
    ? allVehicles.filter((v) => v.customer_id === customerId)
    : allVehicles;

  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const selectedVehicle =
    allVehicles.find((vehicle) => vehicle.id === vehicleId) ??
    filteredVehicles.find((vehicle) => vehicle.id === vehicleId);
  const lockedCustomerLabel = selectedCustomer
    ? `${selectedCustomer.full_name} (${selectedCustomer.customer_number})`
    : "";
  const lockedVehicleLabel = selectedVehicle
    ? `${selectedVehicle.plate_number} — ${selectedVehicle.brand} ${selectedVehicle.model}`
    : "";

  const loadFromJobOrder = useCallback(
    async (jobOrderId: string) => {
      if (!jobOrderId || invoice) return;

      setPrefillLoading(true);
      try {
        const result = await getJobOrderInvoicePrefill(jobOrderId);
        if (!result.success) {
          toast.error(result.error);
          setValue("job_order_id", "");
          return;
        }

        reset(result.data);
        toast.success("Invoice fields filled from job order");
      } finally {
        setPrefillLoading(false);
      }
    },
    [invoice, reset, setValue]
  );

  const partsCost = (items ?? []).reduce(
    (sum, item) => sum + (item?.quantity || 0) * (item?.unit_price || 0),
    0
  );
  const totalAmount = (laborCost || 0) + partsCost;
  const isPaid = totalAmount > 0 && Number(amountPaidValue) >= totalAmount;
  const showPaymentReference = isPaid && requiresPaymentReference(paymentMethod);

  useEffect(() => {
    if (lockFromJobOrder) return;

    if (customerId && vehicleId && !filteredVehicles.find((v) => v.id === vehicleId)) {
      setValue("vehicle_id", "");
    }
  }, [customerId, vehicleId, filteredVehicles, lockFromJobOrder, setValue]);

  const handleInventorySelect = (index: number, inventoryId: string) => {
    const item = inventory.find((i) => i.id === inventoryId);
    if (item) {
      setValue(`items.${index}.inventory_item_id`, inventoryId);
      setValue(`items.${index}.part_name`, item.part_name);
      setValue(`items.${index}.unit_price`, item.selling_price);
    }
  };

  return (
    <form
      onSubmit={handleSubmit((values) => {
        if (isCreate && !values.job_order_id) {
          toast.error("Select a completed job order to create an invoice.");
          return;
        }

        const paymentCheck = validatePaymentDetails(
          values.payment_method,
          values.amount_paid,
          totalAmount,
          values.payment_reference,
          values.payer_account_name
        );
        if (!paymentCheck.ok) {
          toast.error(paymentCheck.error);
          return;
        }
        return onSubmit({
          ...values,
          amount_paid:
            totalAmount > 0 && Number(values.amount_paid) >= totalAmount
              ? totalAmount
              : 0,
        });
      })}
      className="space-y-4"
    >
      {!invoice && (
        <div className="space-y-2 rounded-lg border border-dashed p-4">
          <Label>From Job Order</Label>
          {jobOrders.length > 0 ? (
            <Controller
              name="job_order_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={(value) => {
                    field.onChange(value);
                    void loadFromJobOrder(value);
                  }}
                  disabled={prefillLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a completed job order to auto-fill..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jobOrders.map((jobOrder) => (
                      <SelectItem key={jobOrder.id} value={jobOrder.id}>
                        {jobOrder.job_order_number} ({jobOrder.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No completed job orders are available for invoicing. Complete a job order
              first, or delete an existing invoice linked to that job order.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Customer, vehicle, parts, labor, technician, and repair details will
            be copied from the selected job order.
          </p>
          {prefillLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading job order details...
            </p>
          )}
          {errors.job_order_id && (
            <p className="text-sm text-destructive">{errors.job_order_id.message}</p>
          )}
        </div>
      )}

      {isCreate && !canCreateInvoice && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Select a completed job order above to continue. Invoices must be created from a job
          order.
        </p>
      )}

      {isReleased && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <strong>Locked record.</strong> Job order {invoice?.job_orders?.job_order_number} is
          released. This invoice cannot be updated.
        </p>
      )}

      <fieldset
        disabled={isFormDisabled}
        className="min-w-0 space-y-4 border-0 p-0 disabled:opacity-60"
      >
      {lockFromJobOrder && (
        <p className="text-sm text-muted-foreground">
          Job order details are copied automatically. Only payment status and method can be
          edited.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Customer *</Label>
          {lockFromJobOrder ? (
            <Input value={lockedCustomerLabel} disabled readOnly />
          ) : (
            <Controller
              name="customer_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.full_name} ({customer.customer_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
          {errors.customer_id && (
            <p className="text-sm text-destructive">{errors.customer_id.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Vehicle *</Label>
          {lockFromJobOrder ? (
            <Input value={lockedVehicleLabel} disabled readOnly />
          ) : (
            <Controller
              name="vehicle_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredVehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.plate_number} — {vehicle.brand} {vehicle.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
          {errors.vehicle_id && (
            <p className="text-sm text-destructive">{errors.vehicle_id.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invoice_date">Invoice Date *</Label>
          <Input
            id="invoice_date"
            type="date"
            disabled={lockFromJobOrder}
            readOnly={lockFromJobOrder}
            {...register("invoice_date")}
          />
          {errors.invoice_date && (
            <p className="text-sm text-destructive">{errors.invoice_date.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="technician_name">Technician</Label>
          <Input
            id="technician_name"
            disabled={lockFromJobOrder}
            readOnly={lockFromJobOrder}
            {...register("technician_name")}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="chassis_number">Chassis Number</Label>
          <Input
            id="chassis_number"
            disabled={lockFromJobOrder}
            readOnly={lockFromJobOrder}
            {...register("chassis_number")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="engine_number">Engine Number</Label>
          <Input
            id="engine_number"
            disabled={lockFromJobOrder}
            readOnly={lockFromJobOrder}
            {...register("engine_number")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="repair_description">Repair Description</Label>
        <Textarea
          id="repair_description"
          rows={2}
          disabled={lockFromJobOrder}
          readOnly={lockFromJobOrder}
          {...register("repair_description")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="recommendation">Recommendation</Label>
        <Textarea
          id="recommendation"
          rows={2}
          disabled={lockFromJobOrder}
          readOnly={lockFromJobOrder}
          {...register("recommendation")}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Parts / Items</Label>
          {!lockPartsAndLabor && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({ inventory_item_id: "", part_name: "", quantity: 1, unit_price: 0 })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Item
            </Button>
          )}
        </div>

        {lockPartsAndLabor && (
          <p className="text-sm text-muted-foreground">
            Parts and labor are taken from the job order and cannot be edited on the invoice.
          </p>
        )}

        <div
          className={`space-y-3 ${lockPartsAndLabor ? "pointer-events-none opacity-60" : ""}`}
        >
        {fields.map((field, index) => (
          <div key={field.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-12">
            <div className="sm:col-span-3">
              <Label className="text-xs">From Inventory</Label>
              <Controller
                name={`items.${index}.inventory_item_id`}
                control={control}
                render={({ field: f }) => (
                  <Select
                    value={f.value || undefined}
                    onValueChange={(val) => handleInventorySelect(index, val)}
                    disabled={lockPartsAndLabor}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select part" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventory.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.part_name} ({item.quantity} in stock)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="sm:col-span-3">
              <Label className="text-xs">Part Name *</Label>
              <Input
                {...register(`items.${index}.part_name`)}
                disabled={lockPartsAndLabor}
                readOnly={lockPartsAndLabor}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Qty</Label>
              <Input
                type="number"
                step="1"
                min="1"
                disabled={lockPartsAndLabor}
                readOnly={lockPartsAndLabor}
                {...register(`items.${index}.quantity`)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Unit Price</Label>
              <Input
                type="number"
                step="0.01"
                disabled={lockPartsAndLabor}
                readOnly={lockPartsAndLabor}
                {...register(`items.${index}.unit_price`)}
              />
            </div>
            {!lockPartsAndLabor && (
              <div className="flex items-end sm:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="labor_cost">Labor Cost</Label>
          <Input
            id="labor_cost"
            type="number"
            step="0.01"
            disabled={lockPartsAndLabor}
            readOnly={lockPartsAndLabor}
            {...register("labor_cost")}
          />
        </div>
        <div className="space-y-2">
          <Label>Parts Cost</Label>
          <Input value={formatCurrency(partsCost)} disabled />
        </div>
        <div className="space-y-2">
          <Label>Total Amount</Label>
          <Input value={formatCurrency(totalAmount)} disabled />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Payment</Label>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">{isPaid ? "Paid" : "Unpaid"}</p>
              <p className="text-xs text-muted-foreground">
                {totalAmount <= 0
                  ? "Invoice total is zero"
                  : isPaid
                    ? `Full amount: ${formatCurrency(totalAmount)}`
                    : "Toggle on to mark as fully paid"}
              </p>
            </div>
            <Switch
              checked={isPaid}
              disabled={totalAmount <= 0}
              onCheckedChange={(checked) => {
                setValue("amount_paid", checked ? totalAmount : 0, {
                  shouldValidate: true,
                });
                if (!checked) {
                  setValue("payment_method", "", { shouldValidate: true });
                  setValue("payment_reference", "", { shouldValidate: true });
                  setValue("payer_account_name", "", { shouldValidate: true });
                }
              }}
            />
          </div>
        </div>
        {isPaid && (
          <div className="space-y-2">
            <Label>Payment Method *</Label>
            <Controller
              name="payment_method"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={(value) => {
                    field.onChange(value);
                    if (value === "cash") {
                      setValue("payment_reference", "", { shouldValidate: true });
                      setValue("payer_account_name", "", { shouldValidate: true });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}
      </div>

      {showPaymentReference && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payment_reference">Reference Number *</Label>
            <Input
              id="payment_reference"
              placeholder="Transaction / reference number"
              {...register("payment_reference")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payer_account_name">Payer Account Name *</Label>
            <Input
              id="payer_account_name"
              placeholder="Name on the account used to pay"
              {...register("payer_account_name")}
            />
          </div>
        </div>
      )}

      </fieldset>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading || isFormDisabled}>
          {isLoading ? "Saving..." : invoice ? "Update Invoice" : "Create Invoice"}
        </Button>
      </div>
    </form>
  );
}
