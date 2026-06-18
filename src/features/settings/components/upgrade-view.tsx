"use client";

import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/constants";
import {
  BASIC_PLAN_FEATURES,
  PLAN_PRICING,
  PRO_PLAN_FEATURES,
} from "@/lib/plans";
import { useShop } from "@/lib/hooks/use-shop";
import { cn } from "@/lib/utils";

export function UpgradeView() {
  const { shop, loading } = useShop();
  const currentPlan = shop?.plan ?? "basic";
  const isPro = currentPlan === "pro";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans & Upgrade"
        description={`Every new shop gets a 15-day free trial after approval. Payment is handled offline through ${APP_NAME} support when you continue.`}
      />

      {loading ? null : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Current plan:
          <Badge variant={isPro ? "default" : "secondary"}>
            {PLAN_PRICING[currentPlan].label}
          </Badge>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <PlanCard
          name={PLAN_PRICING.basic.label}
          price={PLAN_PRICING.basic.price}
          description="Essential repair workflow for small shops."
          features={BASIC_PLAN_FEATURES}
          isCurrent={!loading && currentPlan === "basic"}
          highlighted={false}
        />
        <PlanCard
          name={PLAN_PRICING.pro.label}
          price={PLAN_PRICING.pro.price}
          description="Full business tools — inventory, finance, reports, and team."
          features={PRO_PLAN_FEATURES}
          isCurrent={!loading && currentPlan === "pro"}
          highlighted
        />
      </div>

      {!isPro && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Ready to upgrade?
            </CardTitle>
            <CardDescription>
              Contact {APP_NAME} support to switch your shop to Pro. We will activate
              Pro on your account after payment (₱{PLAN_PRICING.pro.price}/month).
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-wrap gap-3">
            <Button asChild>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Upgrade%20to%20TalyerHub%20Pro`}>
                Email {APP_NAME} support
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

function PlanCard({
  name,
  price,
  description,
  features,
  isCurrent,
  highlighted,
}: {
  name: string;
  price: number;
  description: string;
  features: readonly string[];
  isCurrent: boolean;
  highlighted: boolean;
}) {
  return (
    <Card
      className={cn(
        highlighted && "border-primary shadow-md",
        isCurrent && "ring-2 ring-primary/40"
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{name}</CardTitle>
          {isCurrent && <Badge>Current</Badge>}
          {highlighted && !isCurrent && (
            <Badge variant="default">Recommended</Badge>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
        <p className="pt-2 text-3xl font-bold tracking-tight">
          ₱{price}
          <span className="text-sm font-normal text-muted-foreground"> / month</span>
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
