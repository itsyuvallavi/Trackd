import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <main className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold mb-4">Job Tracker</h1>
        <p className="text-xl text-foreground/70 mb-8">
          Track your job applications effortlessly. Never lose track of an opportunity again.
        </p>

        <div className="mb-12">
          <Link href="/jobs">
            <Button size="lg">Get Started</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 border border-foreground/20 rounded-lg">
            <h3 className="font-semibold mb-2">Fast Capture</h3>
            <p className="text-sm text-foreground/70">
              Add jobs quickly with just a title and company. Fill in details later.
            </p>
          </div>
          <div className="p-6 border border-foreground/20 rounded-lg">
            <h3 className="font-semibold mb-2">Track Progress</h3>
            <p className="text-sm text-foreground/70">
              Monitor your applications from saved to offer with automatic timeline tracking.
            </p>
          </div>
          <div className="p-6 border border-foreground/20 rounded-lg">
            <h3 className="font-semibold mb-2">Stay Organized</h3>
            <p className="text-sm text-foreground/70">
              See what needs attention today and never miss a follow-up.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
