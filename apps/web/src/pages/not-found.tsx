import { Link } from "react-router";
import { Button } from "@/components/sodium/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyIcon,
  EmptyTitle,
} from "@/components/sodium/ui/empty-state";

export function NotFoundPage() {
  return (
    <div className="py-16">
      <h1 className="sr-only">Not found</h1>
      <Empty reason="no-results">
        <EmptyIcon />
        <EmptyHeader>
          <EmptyTitle>No page at this address</EmptyTitle>
          <EmptyDescription>The link may be mistyped, or the page was removed.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="secondary" render={<Link to="/" />} nativeButton={false}>
            Go home
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
