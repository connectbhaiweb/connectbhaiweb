import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { BorderBeam } from "@/components/magicui/border-beam";

export const metadata = { title: "UI kit · Connect Bhai", robots: { index: false, follow: false } };

/* Internal preview of the shadcn/ui + Magic UI components. Delete this folder before launch if you don't want it public. */
export default function UiKit() {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-5 py-10">
      <div><h1 className="font-display text-4xl font-extrabold">UI kit</h1><p className="mt-2 text-muted-foreground">shadcn/ui + Magic UI, wired to the site&apos;s own colours (light and dark).</p></div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Download", 182, "Mbps", 1], ["Upload", 96, "Mbps", 1], ["Ping", 11, "ms", 0], ["Jitter", 3, "ms", 0]].map(([l, v, u, d]) => (
          <Card key={l} interactive>
            <CardDescription className="font-bold uppercase tracking-wider text-primary">{l}</CardDescription>
            <div className="font-display text-3xl font-extrabold"><NumberTicker value={v} decimalPlaces={d} /> <small className="text-base font-semibold text-muted-foreground">{u}</small></div>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="relative overflow-hidden">
          <CardHeader><CardTitle>Border Beam card</CardTitle><CardDescription>A light runs around the border.</CardDescription></CardHeader>
          <CardContent className="text-sm">Use it on the speed-test dial card or the booking card.</CardContent>
          <BorderBeam size={120} duration={7} />
        </Card>
        <Card className="justify-center gap-4">
          <CardTitle>Buttons</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button><Button variant="outline">Outline</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button>
            <ShimmerButton>Start speed test</ShimmerButton>
          </div>
        </Card>
      </section>
    </div>
  );
}
