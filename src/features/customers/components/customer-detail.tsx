"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Car, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VehicleDialog } from "@/features/vehicles/components/vehicle-dialog";
import { VehicleRemoveDialog } from "@/features/vehicles/components/vehicle-remove-dialog";
import {
  createVehicle,
  updateVehicle,
} from "@/features/vehicles/actions";
import {
  getCustomer,
  getCustomerHistory,
  getCustomersForSelect,
  updateCustomer,
} from "../actions";
import { CustomerRemoveDialog } from "./customer-remove-dialog";
import { CustomerDialog } from "./customer-dialog";
import type { CustomerFormValues } from "../schemas";
import type { VehicleFormValues } from "@/features/vehicles/schemas";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Vehicle } from "@/types/database";

interface CustomerDetailProps {
  customerId: string;
}

export function CustomerDetail({ customerId }: CustomerDetailProps) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [removeVehicleOpen, setRemoveVehicleOpen] = useState(false);
  const [removeCustomerOpen, setRemoveCustomerOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | undefined>();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      const result = await getCustomer(customerId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["customer-history", customerId],
    queryFn: async () => {
      const result = await getCustomerHistory(customerId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-select"],
    queryFn: async () => {
      const result = await getCustomersForSelect();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      const result = await updateCustomer(customerId, values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer updated successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createVehicleMutation = useMutation({
    mutationFn: async (values: VehicleFormValues) => {
      const result = await createVehicle(values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle added successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: VehicleFormValues;
    }) => {
      const result = await updateVehicle(id, values);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle updated successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleVehicleRemoveSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
    queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    queryClient.invalidateQueries({ queryKey: ["vehicles-list"] });
    setRemoveVehicleOpen(false);
    setSelectedVehicle(undefined);
  };

  const handleCustomerRemoveSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["customers-select"] });
    queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
    queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    queryClient.invalidateQueries({ queryKey: ["vehicles-list"] });
    setRemoveCustomerOpen(false);
  };

  const handleVehicleSubmit = async (values: VehicleFormValues) => {
    if (selectedVehicle) {
      await updateVehicleMutation.mutateAsync({
        id: selectedVehicle.id,
        values,
      });
    } else {
      await createVehicleMutation.mutateAsync(values);
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading customer...</p>;
  }

  if (!customer) {
    return <p className="text-destructive">Customer not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/customers">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to customers</span>
          </Link>
        </Button>
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              {customer.full_name}
              {customer.is_active === false && (
                <Badge variant="secondary">Deactivated</Badge>
              )}
            </span>
          }
          description={`Customer #${customer.customer_number}`}
          className="flex-1"
          actions={
            <div className="flex gap-2">
              {customer.is_active !== false && (
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setRemoveCustomerOpen(true)}
              >
                {customer.is_active === false ? (
                  <>
                    <Undo2 className="mr-2 h-4 w-4" />
                    Reactivate
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </>
                )}
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Contact</CardDescription>
            <CardTitle className="text-base">
              {customer.contact_number ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Email</CardDescription>
            <CardTitle className="text-base">{customer.email ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Member Since</CardDescription>
            <CardTitle className="text-base">
              {formatDate(customer.created_at)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {customer.address && (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Address</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">{customer.address}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Vehicles
            </CardTitle>
            <CardDescription>
              {customer.vehicles.length} registered vehicle
              {customer.vehicles.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setSelectedVehicle(undefined);
              setVehicleDialogOpen(true);
            }}
            disabled={customer.is_active === false}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Vehicle
          </Button>
        </CardHeader>
        <CardContent>
          {customer.vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vehicles registered.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plate</TableHead>
                  <TableHead>Brand / Model</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.vehicles.map((vehicle) => (
                  <TableRow
                  key={vehicle.id}
                  className={vehicle.is_active === false ? "opacity-70" : undefined}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{vehicle.plate_number}</span>
                      {vehicle.is_active === false && (
                        <Badge variant="secondary">Deactivated</Badge>
                      )}
                    </div>
                  </TableCell>
                    <TableCell>
                      {vehicle.brand} {vehicle.model}
                    </TableCell>
                    <TableCell>{vehicle.year_model ?? "—"}</TableCell>
                    <TableCell>{vehicle.color ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {customer.is_active !== false &&
                          vehicle.is_active !== false && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedVehicle(vehicle);
                                setVehicleDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        {(vehicle.is_active !== false ||
                          customer.is_active !== false) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={
                              vehicle.is_active === false
                                ? "Reactivate vehicle"
                                : "Remove vehicle"
                            }
                            onClick={() => {
                              setSelectedVehicle(vehicle);
                              setRemoveVehicleOpen(true);
                            }}
                          >
                            {vehicle.is_active === false ? (
                              <Undo2 className="h-4 w-4" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service History</CardTitle>
          <CardDescription>
            Estimates, job orders, and invoices for this customer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium">Job Orders</h3>
            {!history?.jobOrders.length ? (
              <p className="text-sm text-muted-foreground">No job orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Order #</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.jobOrders.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>{job.job_order_number}</TableCell>
                      <TableCell>
                        {job.vehicles
                          ? `${job.vehicles.plate_number} — ${job.vehicles.brand} ${job.vehicles.model}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={job.status} />
                      </TableCell>
                      <TableCell>
                        {job.date_started ? formatDate(job.date_started) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Estimates</h3>
            {!history?.estimates.length ? (
              <p className="text-sm text-muted-foreground">No estimates yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estimate #</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.estimates.map((estimate) => (
                    <TableRow key={estimate.id}>
                      <TableCell>{estimate.estimate_number}</TableCell>
                      <TableCell>
                        {estimate.vehicles
                          ? `${estimate.vehicles.plate_number} — ${estimate.vehicles.brand} ${estimate.vehicles.model}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={estimate.status} />
                      </TableCell>
                      <TableCell>{formatCurrency(estimate.total_cost)}</TableCell>
                      <TableCell>{formatDate(estimate.estimate_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Invoices</h3>
            {!history?.invoices.length ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.invoice_number}</TableCell>
                      <TableCell>
                        {invoice.vehicles
                          ? `${invoice.vehicles.plate_number} — ${invoice.vehicles.brand} ${invoice.vehicles.model}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.payment_status} />
                      </TableCell>
                      <TableCell>{formatCurrency(invoice.total_amount)}</TableCell>
                      <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <CustomerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={customer}
        onSubmit={async (values) => {
          await updateMutation.mutateAsync(values);
        }}
        isLoading={updateMutation.isPending}
      />

      <VehicleDialog
        open={vehicleDialogOpen}
        onOpenChange={setVehicleDialogOpen}
        vehicle={selectedVehicle}
        customers={customers}
        defaultCustomerId={customerId}
        onSubmit={handleVehicleSubmit}
        isLoading={
          createVehicleMutation.isPending || updateVehicleMutation.isPending
        }
      />

      <CustomerRemoveDialog
        open={removeCustomerOpen}
        onOpenChange={setRemoveCustomerOpen}
        customer={customer}
        onSuccess={handleCustomerRemoveSuccess}
      />

      <VehicleRemoveDialog
        open={removeVehicleOpen}
        onOpenChange={setRemoveVehicleOpen}
        vehicle={selectedVehicle}
        customerIsActive={customer.is_active !== false}
        onSuccess={handleVehicleRemoveSuccess}
      />
    </div>
  );
}
