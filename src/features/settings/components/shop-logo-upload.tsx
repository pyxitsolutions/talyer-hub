"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ShopLogo } from "@/components/shared/shop-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useShop } from "@/lib/hooks/use-shop";
import { MAX_LOGO_SIZE } from "@/lib/supabase/logo-file";
import {
  removeShopLogoFromStorage,
  uploadShopLogoToStorage,
} from "@/lib/supabase/upload-shop-logo";
import { clearShopLogoUrl, saveShopLogoUrl } from "../actions";

interface ShopLogoUploadProps {
  shopName: string;
  logoUrl?: string | null;
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export function ShopLogoUpload({ shopName, logoUrl }: ShopLogoUploadProps) {
  const queryClient = useQueryClient();
  const { shopId } = useShop();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!shopId) {
        throw new Error("Shop not found");
      }

      const uploadResult = await uploadShopLogoToStorage(shopId, file);
      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }

      const saveResult = await saveShopLogoUrl(uploadResult.logoUrl);
      if (!saveResult.success) {
        throw new Error(saveResult.error);
      }

      return saveResult.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-settings"] });
      queryClient.invalidateQueries({ queryKey: ["shop"] });
      setPreviewUrl(null);
      toast.success("Shop logo updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!shopId) {
        throw new Error("Shop not found");
      }

      const removeStorageResult = await removeShopLogoFromStorage(shopId);
      if (!removeStorageResult.success) {
        throw new Error(removeStorageResult.error);
      }

      const clearResult = await clearShopLogoUrl();
      if (!clearResult.success) {
        throw new Error(clearResult.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-settings"] });
      queryClient.invalidateQueries({ queryKey: ["shop"] });
      setPreviewUrl(null);
      toast.success("Shop logo removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(png|jpe?g|webp|svg)$/i)) {
      toast.error("Use PNG, JPG, WEBP, or SVG only.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      toast.error("Logo must be 2MB or smaller.");
      event.target.value = "";
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    uploadMutation.mutate(file);
    event.target.value = "";
  };

  const isBusy = uploadMutation.isPending || removeMutation.isPending;
  const displayLogo = previewUrl ?? logoUrl ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shop Logo</CardTitle>
        <CardDescription>
          Upload your shop logo. It appears in the sidebar, invoices, PDFs, and
          the public verify page.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ShopLogo logoUrl={displayLogo} alt={shopName} size="lg" />

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            disabled={isBusy || !shopId}
            onClick={() => inputRef.current?.click()}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="mr-2 h-4 w-4" />
            )}
            Upload Logo
          </Button>
          {logoUrl && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={isBusy || !shopId}
              onClick={() => removeMutation.mutate()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
